import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FinalTranslationTable } from '@/components/final-translation-table';

import SettingsModal from '@/components/settings-modal';
import LoadingOverlay from '@/components/loading-overlay';
import ApiDiagnostics from '@/components/api-diagnostics';
import { cleanText, translateWithDictionary, needsTranslation, createDeliveryPrompt } from '@/lib/smart-translator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';



export default function TranslatorPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [translationFilter, setTranslationFilter] = useState('all');
  const [smartGrouping, setSmartGrouping] = useState(true);
  const [useCache, setUseCache] = useState(true);
  const [activeTab, setActiveTab] = useState('translator');

  // Fetch global settings to get default models
  const { data: globalSettings = [] } = useQuery<any[]>({
    queryKey: ['/api/global-settings'],
  });

  // Helper function to get default models
  const getDefaultModels = () => {
    const settingsMap: Record<string, string> = {};
    if (Array.isArray(globalSettings)) {
      globalSettings.forEach((setting: any) => {
        settingsMap[setting.settingKey] = setting.settingValue;
      });
    }
    return {
      default: settingsMap.defaultTranslationModel || 'gemini-1.5-flash',
      manual: settingsMap.manualTranslationModel || 'gemini-1.5-pro',
      batch: settingsMap.batchTranslationModel || 'gemini-1.5-flash',
      multiple: settingsMap.multipleTranslationModel || 'gpt-4o'
    };
  };
  
  // Get manual translation models from global settings using useMemo
  const { manualTranslationModel, manualProvider } = useMemo(() => {
    const defaultModels = getDefaultModels();
    const model = defaultModels.manual;
    const provider = model?.includes('gpt') ? 'openai' : 
                    model?.includes('claude') ? 'anthropic' :
                    model?.includes('grok') ? 'xai' :
                    model?.includes('deepseek') ? 'deepseek' : 'gemini';
    return { 
      manualTranslationModel: model, 
      manualProvider: provider 
    };
  }, [globalSettings]);
  
  // Get project ID from URL parameter - using URLSearchParams directly
  const urlProjectId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    console.log('URL parsing:', { 
      fullUrl: window.location.href, 
      search: window.location.search, 
      projectId 
    });
    return projectId ? parseInt(projectId) : null;
  }, [location]);

  // Helper function for MIME type detection
  const getMimeType = (fileType: string): string => {
    switch (fileType) {
      case 'php': return 'text/php';
      case 'json': return 'application/json';
      case 'po': return 'text/plain';
      case 'csv': return 'text/csv';
      default: return 'text/plain';
    }
  };

  // Translation Progress State
  const [translationProgress, setTranslationProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    isActive: false
  });
  const [isTranslating, setIsTranslating] = useState(false);

  // Projects query
  const { data: projects = [], refetch: refetchProjects } = useQuery<any[]>({
    queryKey: ['/api/projects'],
  });

  // API Settings query
  const { data: apiSettings = [] } = useQuery<any[]>({
    queryKey: ['/api/settings'],
  });

  // Items query for current project - fix project ID resolution  
  const targetProjectId = useMemo(() => {
    const resolvedId = urlProjectId || projects[0]?.id;
    console.log('Target project ID resolution:', { urlProjectId, firstProjectId: projects[0]?.id, resolvedId });
    return resolvedId;
  }, [urlProjectId, projects]);
  
  const { data: items = [], refetch: refetchItems } = useQuery<any[]>({
    queryKey: ['/api/projects', targetProjectId, 'items'],
    enabled: !!targetProjectId,
  });
  
  // Debug project ID resolution - moved after all queries
  useEffect(() => {
    console.log('Project ID Debug:', {
      urlProjectId,
      currentLocation: location,
      projectsCount: projects.length,
      firstProjectId: projects[0]?.id,
      targetProjectId: targetProjectId
    });
  }, [urlProjectId, location, projects, targetProjectId]);

  // Get current project - safe initialization with correct ID
  const currentProject = useMemo(() => {
    if (!projects.length) return null;
    return projects.find(p => p.id === targetProjectId) || projects[0];
  }, [projects, targetProjectId]);

  // Filter items based on current filter
  const filteredItems = items.filter(item => {
    if (translationFilter === 'all') return true;
    if (translationFilter === 'untranslated') return !item.translatedText;
    if (translationFilter === 'needs_review') return item.status === 'needs_review';
    return true;
  });

  // Cost estimation
  const costEstimate = selectedItems.length * 0.001; // Simple estimation

  // Get active API settings
  const activeApiSettings = apiSettings.find((setting: any) => setting.provider === manualProvider);

  // Create API settings
  const createApiSettings = async (settings: { provider: string; apiKey: string; model: string; isActive: boolean }) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم حفظ إعدادات API بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ في حفظ الإعدادات",
        description: "فشل في حفظ إعدادات API",
        variant: "destructive",
      });
    }
  };

  // Update API settings
  const updateApiSettings = async (data: { id: number; updates: any }) => {
    try {
      await fetch(`/api/settings/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates)
      });
      toast({
        title: "تم تحديث الإعدادات",
        description: "تم تحديث إعدادات API بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ في تحديث الإعدادات",
        description: "فشل في تحديث إعدادات API",
        variant: "destructive",
      });
    }
  };

  // Test API connection
  const testConnection = async (provider: string, apiKey: string, model?: string) => {
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "اتصال ناجح",
          description: "تم الاتصال بـ API بنجاح",
        });
        return true;
      } else {
        toast({
          title: "فشل الاتصال",
          description: result.message || "فشل في الاتصال بـ API",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "خطأ في الاتصال",
        description: "فشل في اختبار الاتصال",
        variant: "destructive",
      });
      return false;
    }
  };



  const updateTranslationItem = (id: number, updates: any) => {
    // Update item logic handled by FinalTranslationTable component
    refetchItems();
  };

  const handleStartTranslation = () => {
    setIsTranslating(true);
    setTranslationProgress({
      current: 0,
      total: selectedItems.length,
      percentage: 0,
      isActive: true
    });
  };

  // Export functions
  const exportToCSV = (data: any[]) => {
    const headers = ['Key', 'Original Text', 'Translated Text', 'Status'];
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        `"${item.key}"`,
        `"${item.originalText}"`,
        `"${item.translatedText || ''}"`,
        `"${item.status}"`
      ].join(','))
    ].join('\n');
    return csvContent;
  };

  const exportToJSON = (data: any[]) => {
    const jsonData = data.reduce((acc, item) => {
      acc[item.key] = item.translatedText || item.originalText;
      return acc;
    }, {});
    return JSON.stringify(jsonData, null, 2);
  };

  const exportToPHP = (data: any[]) => {
    const phpContent = data.map(item => {
      const key = item.key.replace(/'/g, "\\'");
      const value = (item.translatedText || item.originalText).replace(/'/g, "\\'");
      return `    '${key}' => '${value}',`;
    }).join('\n');
    
    return `<?php\n\nreturn [\n${phpContent}\n];\n`;
  };

  const handleExport = (format: 'php' | 'json' | 'csv') => {
    try {
      let content: string = '';
      let filename: string = '';
      let mimeType: string = '';

      const parsedItems = filteredItems.length > 0 ? filteredItems : items;

      if (parsedItems.length === 0) {
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "قم بتحميل ملف أولاً",
          variant: "destructive",
        });
        return;
      }

      if (currentProject) {
        switch (format) {
          case 'php':
            content = exportToPHP(parsedItems);
            filename = `${currentProject.name}_translations.php`;
            mimeType = 'text/php';
            break;
          case 'json':
            content = exportToJSON(parsedItems);
            filename = `${currentProject.name}_translations.json`;
            mimeType = 'application/json';
            break;
          case 'csv':
            content = exportToCSV(parsedItems);
            filename = `${currentProject.name}_translations.csv`;
            mimeType = 'text/csv';
            break;
          default:
            throw new Error('Unsupported format');
        }

        // Download file
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);

        toast({
          title: "تم تصدير الملف بنجاح",
          description: `تم تصدير ${items.length} عنصر بصيغة ${format.toUpperCase()}`,
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "خطأ في التصدير",
        description: "فشل في تصدير الملف",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className="flex items-center">
                <i className="fas fa-language text-primary text-2xl ml-3"></i>
                <h1 className="text-xl font-bold text-gray-900">مترجم ملفات PHP المتقدم</h1>
              </div>
              <Badge className="bg-primary text-white">v2.1</Badge>
            </div>
            
            <div className="flex items-center space-x-4 space-x-reverse">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-accent rounded-full ml-2"></div>
                <span className="text-sm text-gray-600">متصل</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <i className="fas fa-cog text-lg"></i>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Project Info Bar */}
      {currentProject && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4 space-x-reverse">
                <span className="font-medium text-blue-900">
                  المشروع الحالي: {currentProject.name}
                </span>
                <span className="text-blue-700">
                  الملف: {currentProject.fileName}
                </span>
                <span className="text-blue-600">
                  المعرف: #{currentProject.id}
                </span>
                <span className="text-blue-600">
                  النوع: {currentProject.fileType.toUpperCase()}
                </span>
                <span className="text-blue-600">
                  URL Project ID: {urlProjectId || 'غير محدد'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="text-blue-700">التقدم:</span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {currentProject.progressPercentage}%
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar - Translation Controls Only */}
        <aside className="w-80 bg-white shadow-sm border-l border-gray-200 flex flex-col min-h-[calc(100vh-4rem)] relative">
          {/* Sticky Translation Controls in Sidebar */}
          {currentProject && (
            <div className="sticky top-0 bg-white p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                <i className="fas fa-play-circle ml-2 text-blue-600"></i>
                التحكم في الترجمة
              </h3>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if ((window as any).translationControls) {
                        (window as any).translationControls.startBatchTranslation();
                      } else {
                        toast({
                          title: "خطأ",
                          description: "لا يمكن الوصول لوظائف الترجمة، يرجى إعادة تحميل الصفحة",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <i className="fas fa-language ml-2"></i>
                    ترجمة الكل
                  </Button>
                  
                  <Button
                    onClick={() => {
                      if ((window as any).translationControls) {
                        const status = (window as any).translationControls.getStatus();
                        if (status.selectedCount === 0) {
                          toast({
                            title: "لا توجد عناصر محددة",
                            description: "يرجى تحديد العناصر المراد ترجمتها أولاً",
                            variant: "destructive"
                          });
                          return;
                        }
                        (window as any).translationControls.startSelectedTranslation();
                      } else {
                        toast({
                          title: "خطأ",
                          description: "لا يمكن الوصول لوظائف الترجمة، يرجى إعادة تحميل الصفحة",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <i className="fas fa-check-square ml-2"></i>
                    ترجمة المحدد
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if ((window as any).translationControls) {
                        (window as any).translationControls.pauseTranslation();
                      }
                    }}
                    variant="outline"
                    className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                    size="sm"
                  >
                    <i className="fas fa-pause ml-1"></i>
                    إيقاف
                  </Button>
                  
                  <Button
                    onClick={() => {
                      if ((window as any).translationControls) {
                        (window as any).translationControls.resumeTranslation();
                      }
                    }}
                    variant="outline"
                    className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                    size="sm"
                  >
                    <i className="fas fa-play ml-1"></i>
                    استئناف
                  </Button>
                </div>
                
                <Button
                  onClick={() => {
                    if ((window as any).translationControls) {
                      (window as any).translationControls.stopTranslation();
                    }
                  }}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  <i className="fas fa-stop ml-2"></i>
                  إيقاف الترجمة
                </Button>
                

                
                {/* إعدادات النماذج الافتراضية للمشروع */}
                <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-md font-medium text-gray-800 mb-3">
                    <i className="fas fa-cog ml-2 text-gray-600"></i>
                    النماذج الافتراضية للمشروع
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-gray-700">نموذج الترجمة اليدوية</Label>
                      <Select value={getDefaultModels().manual} onValueChange={async (value) => {
                        // Update global setting for manual translation model
                        try {
                          await fetch('/api/global-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              key: 'manualTranslationModel',
                              value: value,
                              description: 'النموذج الافتراضي للترجمة اليدوية'
                            })
                          });
                          
                          // Refresh global settings
                          queryClient.invalidateQueries({ queryKey: ['/api/global-settings'] });
                          
                          toast({
                            title: "تم التحديث",
                            description: "تم تحديث نموذج الترجمة اليدوية"
                          });
                        } catch (error) {
                          toast({
                            title: "خطأ",
                            description: "فشل في تحديث النموذج",
                            variant: "destructive"
                          });
                        }
                      }}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                          <SelectItem value="grok-2">Grok 2</SelectItem>
                          <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-gray-700">نموذج الترجمة الدفعية</Label>
                      <Select value={getDefaultModels().batch} onValueChange={async (value) => {
                        // Update global setting for batch translation model
                        try {
                          await fetch('/api/global-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              key: 'batchTranslationModel',
                              value: value,
                              description: 'النموذج الافتراضي للترجمة الدفعية'
                            })
                          });
                          
                          // Refresh global settings
                          queryClient.invalidateQueries({ queryKey: ['/api/global-settings'] });
                          
                          toast({
                            title: "تم التحديث",
                            description: "تم تحديث نموذج الترجمة الدفعية"
                          });
                        } catch (error) {
                          toast({
                            title: "خطأ",
                            description: "فشل في تحديث النموذج",
                            variant: "destructive"
                          });
                        }
                      }}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                          <SelectItem value="grok-2-mini">Grok 2 Mini</SelectItem>
                          <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-gray-700">نموذج الترجمة المتعددة</Label>
                      <Select value={getDefaultModels().multiple} onValueChange={async (value) => {
                        // Update global setting for multiple translation model
                        try {
                          await fetch('/api/global-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              key: 'multipleTranslationModel',
                              value: value,
                              description: 'النموذج الافتراضي للترجمة المتعددة'
                            })
                          });
                          
                          // Refresh global settings
                          queryClient.invalidateQueries({ queryKey: ['/api/global-settings'] });
                          
                          toast({
                            title: "تم التحديث",
                            description: "تم تحديث نموذج الترجمة المتعددة"
                          });
                        } catch (error) {
                          toast({
                            title: "خطأ",
                            description: "فشل في تحديث النموذج",
                            variant: "destructive"
                          });
                        }
                      }}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="grok-2">Grok 2</SelectItem>
                          <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2">
                      هذه النماذج ستُستخدم افتراضياً في هذا المشروع وتتوافق مع الإعدادات العامة
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no project */}
          {!currentProject && (
            <div className="p-6 text-center">
              <i className="fas fa-folder-open text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                لا يوجد مشروع مفتوح
              </h3>
              <p className="text-gray-600 text-sm">
                انتقل إلى صفحة المشاريع لفتح أو إنشاء مشروع جديد
              </p>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative">
          {/* Workspace Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4 space-x-reverse">
                <h2 className="text-lg font-semibold text-gray-900">جدول الترجمة</h2>
                <Badge variant="secondary">
                  {filteredItems.length} عنصر
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3 space-x-reverse">
                {/* Export Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <i className="fas fa-download ml-2"></i>
                      تصدير
                      <i className="fas fa-chevron-down mr-2 text-sm"></i>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('php')}>
                      <i className="fas fa-code ml-2"></i>
                      ملف PHP
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('json')}>
                      <i className="fas fa-file-code ml-2"></i>
                      ملف JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('csv')}>
                      <i className="fas fa-file-csv ml-2"></i>
                      ملف CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Spacing between header and table */}
          <div className="h-4 bg-gray-50"></div>

          {/* Translation Table */}
          {(urlProjectId || currentProject) ? (
            <FinalTranslationTable
              projectId={urlProjectId || currentProject?.id || 0}
              onUpdateItem={updateTranslationItem}
              apiSettings={apiSettings}
              selectedProvider={manualProvider}
              selectedModel={manualTranslationModel}
              multipleTranslationModel={getDefaultModels().multiple}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-file-upload text-4xl text-gray-400 mb-4"></i>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  لا يوجد ملف محمل
                </h3>
                <p className="text-gray-600">
                  انتقل إلى صفحة المشاريع لفتح أو إنشاء مشروع جديد
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        apiSettings={apiSettings}
        onCreateSettings={createApiSettings}
        onUpdateSettings={updateApiSettings}
        onTestConnection={testConnection}
      />

      {/* Loading Overlay */}
      <LoadingOverlay
        open={isTranslating}
        current={translationProgress.current}
        total={translationProgress.total}
        percentage={translationProgress.percentage}
      />
    </div>
  );
}