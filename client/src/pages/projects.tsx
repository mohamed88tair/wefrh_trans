import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { detectFileType, parseFileByType } from "@/lib/php-parser";
import { FormatPreservingExporter } from "@/lib/format-preserving-exporter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Upload, 
  FolderOpen, 
  Trash2, 
  Download, 
  FileText, 
  CheckCircle, 
  Clock, 
  Plus,
  Database,
  Settings,
  Search,
  RefreshCw
} from "lucide-react";

interface TranslationProject {
  id: number;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  totalItems: number;
  translatedItems: number;
  progressPercentage: number;
  lastOpenedAt?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: projectsResponse, isLoading, refetch } = useQuery({
    queryKey: ['/api/projects'],
  });

  // Ensure projects is always an array - handle different response structures
  const projects: TranslationProject[] = React.useMemo(() => {
    if (Array.isArray(projectsResponse)) {
      return projectsResponse;
    }
    if (projectsResponse && typeof projectsResponse === 'object') {
      // Handle {data: [...]} structure
      if (Array.isArray((projectsResponse as any).data)) {
        return (projectsResponse as any).data;
      }
      // Handle {projects: [...]} structure  
      if (Array.isArray((projectsResponse as any).projects)) {
        return (projectsResponse as any).projects;
      }
    }
    return [];
  }, [projectsResponse]);

  // Fetch global settings to display default models
  const { data: globalSettingsResponse } = useQuery({
    queryKey: ['/api/global-settings'],
  });

  // Ensure globalSettings is always an array - handle different response structures
  const globalSettings = React.useMemo(() => {
    if (Array.isArray(globalSettingsResponse)) {
      return globalSettingsResponse;
    }
    if (globalSettingsResponse && typeof globalSettingsResponse === 'object') {
      // Handle {data: [...]} structure
      if (Array.isArray((globalSettingsResponse as any).data)) {
        return (globalSettingsResponse as any).data;
      }
      // Handle {settings: [...]} structure  
      if (Array.isArray((globalSettingsResponse as any).settings)) {
        return (globalSettingsResponse as any).settings;
      }
    }
    return [];
  }, [globalSettingsResponse]);

  // Helper function to get default model names
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
      batch: settingsMap.batchTranslationModel || 'gemini-1.5-flash'
    };
  };

  // Utility functions for detecting file format metadata
  const getIndentation = (content: string): string => {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match && match[1].length > 0) {
        return match[1];
      }
    }
    return '  '; // default 2 spaces
  };

  const getQuoteStyle = (content: string, fileType: string): 'single' | 'double' => {
    if (fileType === 'json') return 'double';
    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;
    return singleQuotes > doubleQuotes ? 'single' : 'double';
  };

  const getArrayStyle = (content: string): 'short' | 'long' => {
    return content.includes('array(') ? 'long' : 'short';
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; file: File; content: string; items: any[]; formatMetadata?: any }) => {
      // Show progress toast for large files
      if (data.items.length > 500) {
        toast({
          title: "جاري إنشاء المشروع",
          description: `جاري معالجة ${data.items.length} عنصر، يرجى الانتظار...`,
        });
      }

      const projectData = {
        name: data.name,
        fileName: data.file.name,
        fileType: detectFileType(data.file.name, data.content),
        fileSize: data.file.size,
        totalItems: data.items.length,
        originalContent: data.content,
        formatMetadata: data.formatMetadata
      };

      // Step 1: Create project
      const project = await apiRequest('/api/projects', 'POST', projectData);

      // Step 2: Create translation items with progress indication
      if (data.items.length > 1000) {
        toast({
          title: "تم إنشاء المشروع",
          description: "جاري رفع عناصر الترجمة... قد يستغرق هذا دقائق قليلة",
        });
      }

      const itemsData = data.items.map(item => ({
        projectId: project.id,
        key: item.key,
        originalText: item.originalText,
        status: item.status,
        selected: false
      }));

      await apiRequest(`/api/projects/${project.id}/items/bulk`, 'POST', { items: itemsData });

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "تم إنشاء المشروع بنجاح",
        description: `تم إنشاء مشروع "${project.name}" مع ${project.totalItems} عنصر ترجمة`,
      });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setProjectName("");
      
      // Auto-navigate to the new project
      setTimeout(() => {
        openProject(project.id);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إنشاء المشروع",
        description: error.message || "فشل في إنشاء المشروع",
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest(`/api/projects/${projectId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "تم حذف المشروع",
        description: "تم حذف المشروع وجميع بياناته بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في حذف المشروع",
        description: error.message || "فشل في حذف المشروع",
        variant: "destructive",
      });
    },
  });

  const renameProjectMutation = useMutation({
    mutationFn: async ({ projectId, name }: { projectId: number; name: string }) => {
      return await apiRequest(`/api/projects/${projectId}/rename`, 'PUT', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setEditingProject(null);
      setNewProjectName("");
      toast({
        title: "تم تغيير اسم المشروع",
        description: "تم تحديث اسم المشروع بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التسمية",
        description: "فشل في تغيير اسم المشروع",
        variant: "destructive",
      });
    }
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest(`/api/projects/${projectId}/progress`, 'PUT');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "تم تحديث التقدم",
        description: "تم إعادة حساب تقدم المشروع بناءً على الترجمات الفعلية",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التحديث",
        description: "فشل في تحديث التقدم",
        variant: "destructive",
      });
    }
  });

  const updateAllProgressMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/projects/update-all-progress', 'PUT');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "تم تحديث جميع المشاريع",
        description: `تم إعادة حساب التقدم لـ ${data.updatedCount} مشروع`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التحديث الشامل",
        description: "فشل في تحديث جميع المشاريع",
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-generate project name from file name
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setProjectName(nameWithoutExt);
    }
  };

  const handleUploadProject = async () => {
    if (!selectedFile || !projectName.trim()) {
      toast({
        title: "معلومات ناقصة",
        description: "يرجى اختيار ملف وإدخال اسم المشروع",
        variant: "destructive",
      });
      return;
    }

    try {
      const content = await selectedFile.text();
      const fileType = detectFileType(selectedFile.name, content);
      
      if (fileType === 'unknown') {
        toast({
          title: "نوع ملف غير مدعوم",
          description: "يجب أن يكون الملف من نوع PHP, JSON, PO, أو CSV",
          variant: "destructive",
        });
        return;
      }

      const items = parseFileByType(content, fileType);
      
      if (items.length === 0) {
        toast({
          title: "ملف فارغ",
          description: "لم يتم العثور على عناصر ترجمة في الملف",
          variant: "destructive",
        });
        return;
      }

      // Detect format metadata for preserving original structure
      const formatMetadata = FormatPreservingExporter.detectFormatMetadata(content, fileType);

      createProjectMutation.mutate({
        name: projectName.trim(),
        file: selectedFile,
        content,
        items,
        formatMetadata
      });

    } catch (error: any) {
      toast({
        title: "خطأ في تحليل الملف",
        description: error.message || "فشل في قراءة الملف",
        variant: "destructive",
      });
    }
  };

  const openProject = async (projectId: number) => {
    console.log('Opening project with ID:', projectId);
    try {
      // Update last opened timestamp
      console.log('Updating last opened for project:', projectId);
      await apiRequest(`/api/projects/${projectId}/last-opened`, 'PUT');
      
      // Clear all related cache entries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.removeQueries({ queryKey: ['/api/projects', projectId, 'items'] });
      queryClient.removeQueries({ queryKey: ['/api/projects', projectId] });
      
      console.log('Navigating to translator with project:', projectId);
      setLocation(`/translator?project=${projectId}`);
    } catch (error) {
      console.error('Error updating last opened:', error);
      // Clear cache even if update fails
      queryClient.removeQueries({ queryKey: ['/api/projects', projectId, 'items'] });
      setLocation(`/translator?project=${projectId}`);
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'php': return '🐘';
      case 'json': return '📋';
      case 'po': return '🌐';
      case 'csv': return '📊';
      default: return '📄';
    }
  };

  const getStatusBadge = (project: TranslationProject) => {
    if (project.isCompleted) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />مكتمل</Badge>;
    } else if (project.progressPercentage > 0) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />قيد العمل</Badge>;
    } else {
      return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" />جديد</Badge>;
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Background Tasks Manager */}
      <div className="mb-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-right">المهام النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-6">
              لا توجد مهام ترجمة نشطة حالياً
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Default Models Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            النماذج الافتراضية المختارة
          </CardTitle>
          <CardDescription>
            النماذج المحددة حالياً للاستخدام في جميع المشاريع
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="p-2 bg-blue-500 text-white rounded">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium">الترجمة الافتراضية</div>
                <div className="text-sm text-muted-foreground">{getDefaultModels().default}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="p-2 bg-green-500 text-white rounded">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium">الترجمة اليدوية</div>
                <div className="text-sm text-muted-foreground">{getDefaultModels().manual}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <div className="p-2 bg-purple-500 text-white rounded">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium">الترجمة المجمعة</div>
                <div className="text-sm text-muted-foreground">{getDefaultModels().batch}</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <Link href="/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                تعديل النماذج الافتراضية
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المشاريع المحفوظة</h1>
          <p className="text-muted-foreground">إدارة جميع مشاريع الترجمة الخاصة بك</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary"
            onClick={() => updateAllProgressMutation.mutate()}
            disabled={updateAllProgressMutation.isPending}
            title="إعادة حساب التقدم لجميع المشاريع القديمة"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {updateAllProgressMutation.isPending ? "جارٍ التحديث..." : "تحديث التقدم للكل"}
          </Button>
          
          <Link href="/translator">
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              الإعدادات
            </Button>
          </Link>
          
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                مشروع جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء مشروع ترجمة جديد</DialogTitle>
                <DialogDescription>
                  اختر ملف ترجمة وأعطه اسماً مناسباً. يدعم النظام ملفات PHP, JSON, PO, و CSV
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="project-name">اسم المشروع</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="أدخل اسم المشروع"
                  />
                </div>
                
                <div>
                  <Label htmlFor="file-upload">اختر الملف</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".php,.json,.po,.csv"
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {selectedFile ? selectedFile.name : "اختر ملف الترجمة"}
                    </Button>
                  </div>
                  
                  {selectedFile && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      النوع: {detectFileType(selectedFile.name, "")} | الحجم: {Math.round(selectedFile.size / 1024)} KB
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button 
                    onClick={handleUploadProject}
                    disabled={createProjectMutation.isPending || !selectedFile || !projectName.trim()}
                  >
                    {createProjectMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء المشروع"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="البحث في المشاريع..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد مشاريع</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "لم يتم العثور على مشاريع مطابقة للبحث" : "ابدأ بإنشاء مشروع ترجمة جديد"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsUploadDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                إنشاء أول مشروع
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project: TranslationProject) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-xl">{getFileTypeIcon(project.fileType)}</span>
                      {editingProject === project.id ? (
                        <Input
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onBlur={() => {
                            if (newProjectName.trim() && newProjectName.trim() !== project.name) {
                              renameProjectMutation.mutate({ projectId: project.id, name: newProjectName.trim() });
                            } else {
                              setEditingProject(null);
                              setNewProjectName("");
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (newProjectName.trim() && newProjectName.trim() !== project.name) {
                                renameProjectMutation.mutate({ projectId: project.id, name: newProjectName.trim() });
                              } else {
                                setEditingProject(null);
                                setNewProjectName("");
                              }
                            } else if (e.key === 'Escape') {
                              setEditingProject(null);
                              setNewProjectName("");
                            }
                          }}
                          className="text-lg font-semibold"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="cursor-pointer hover:text-blue-600 flex items-center gap-2"
                          onClick={() => {
                            setEditingProject(project.id);
                            setNewProjectName(project.name);
                          }}
                        >
                          {project.name}
                          <Badge variant="outline" className="text-xs">#{project.id}</Badge>
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>{project.fileName}</CardDescription>
                  </div>
                  {getStatusBadge(project)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>التقدم</span>
                    <span>{project.progressPercentage}%</span>
                  </div>
                  <Progress value={project.progressPercentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{project.translatedItems} مترجم</span>
                    <span>{project.totalItems} إجمالي</span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>الحجم: {Math.round(project.fileSize / 1024)} KB</div>
                  <div>آخر فتح: {project.lastOpenedAt 
                    ? format(new Date(project.lastOpenedAt), 'dd/MM/yyyy', { locale: ar })
                    : "لم يفتح بعد"
                  }</div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1" 
                    onClick={() => openProject(project.id)}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    فتح
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateProgressMutation.mutate(project.id)}
                    disabled={updateProgressMutation.isPending}
                    title="إعادة حساب التقدم"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteProjectMutation.mutate(project.id)}
                    disabled={deleteProjectMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Statistics */}
      {filteredProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>إحصائيات المشاريع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{filteredProjects.length}</div>
                <div className="text-sm text-muted-foreground">إجمالي المشاريع</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredProjects.filter((p: TranslationProject) => p.isCompleted).length}
                </div>
                <div className="text-sm text-muted-foreground">مكتملة</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {filteredProjects.filter((p: TranslationProject) => p.progressPercentage > 0 && !p.isCompleted).length}
                </div>
                <div className="text-sm text-muted-foreground">قيد العمل</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {filteredProjects.reduce((sum: number, p: TranslationProject) => sum + p.totalItems, 0)}
                </div>
                <div className="text-sm text-muted-foreground">إجمالي العناصر</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}