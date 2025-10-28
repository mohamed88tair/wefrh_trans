import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { translateText, testApiConnection, countWords, estimateCost } from '@/lib/translation-api';
import { parsePHPFile, parseJSONFile, type ParsedTranslation } from '@/lib/php-parser';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { TranslationProject, TranslationItem, ApiSettings } from '@shared/schema';

export interface TranslationProgress {
  current: number;
  total: number;
  percentage: number;
  isActive: boolean;
}

export function useTranslator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  const [currentProject, setCurrentProject] = useState<TranslationProject | null>(null);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    isActive: false,
  });

  // Get project ID from URL parameter
  const getProjectIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    console.log('Current URL:', window.location.href, 'Project ID from URL:', projectId);
    return projectId ? parseInt(projectId) : null;
  };

  // Get all projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<TranslationProject[]>({
    queryKey: ['/api/projects'],
  });

  // Get project ID from URL for direct API calls
  const urlProjectId = getProjectIdFromUrl();

  // Get current project items using URL project ID directly
  const { data: translationItems = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery<TranslationItem[]>({
    queryKey: ['/api/projects', urlProjectId, 'items'],
    queryFn: () => urlProjectId ? fetch(`/api/projects/${urlProjectId}/items`).then(res => res.json()) : Promise.resolve([]),
    enabled: !!urlProjectId,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Get API settings
  const { data: apiSettings = [], isLoading: settingsLoading } = useQuery<ApiSettings[]>({
    queryKey: ['/api/settings'],
  });

  // Auto-select project based on URL or first available project
  useEffect(() => {
    const projectIdFromUrl = getProjectIdFromUrl();
    
    if (projectIdFromUrl && projects.length > 0) {
      // Find project by ID from URL
      const projectFromUrl = projects.find(p => p.id === projectIdFromUrl);
      if (projectFromUrl) {
        // Always set the project from URL - this is the correct project to display
        setCurrentProject(projectFromUrl);
        console.log('Selected project from URL:', projectFromUrl.name, 'ID:', projectFromUrl.id);
      }
    } else if (projects.length > 0 && !projectIdFromUrl) {
      // Only select first project if no URL parameter
      setCurrentProject(projects[0]);
      console.log('Selected first project:', projects[0].name, 'ID:', projects[0].id);
    }
  }, [projects, location, queryClient]);

  // Refetch items when current project changes
  useEffect(() => {
    if (currentProject?.id) {
      refetchItems();
    }
  }, [currentProject?.id, refetchItems]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; fileName: string; fileSize: number; totalItems: number }) => {
      const response = await apiRequest('POST', '/api/projects', data);
      return response.json();
    },
    onSuccess: (project) => {
      setCurrentProject(project);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'items'] });
    },
  });

  // Create translation items mutation
  const createItemsMutation = useMutation({
    mutationFn: async ({ projectId, items }: { projectId: number; items: ParsedTranslation[] }) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/items`, items);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', currentProject?.id, 'items'] });
    },
  });

  // Update translation item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<TranslationItem> }) => {
      const response = await apiRequest('PATCH', `/api/items/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both items and projects to update progress immediately
      queryClient.invalidateQueries({ queryKey: ['/api/projects', currentProject?.id, 'items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  const updateTranslationItem = useCallback((id: number, updates: Partial<TranslationItem>) => {
    updateItemMutation.mutate({ id, updates });
  }, [updateItemMutation]);

  // Bulk update items mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; translatedText: string; status: string }>) => {
      const response = await apiRequest('POST', '/api/items/bulk-update', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', currentProject?.id, 'items'] });
    },
  });

  // API settings mutations
  const createApiSettingsMutation = useMutation({
    mutationFn: async (data: { provider: string; apiKey: string; model: string; isActive: boolean }) => {
      const response = await apiRequest('POST', '/api/settings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });

  const updateApiSettingsMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<ApiSettings> }) => {
      const response = await apiRequest('PATCH', `/api/settings/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.php') && !file.name.endsWith('.json')) {
      toast({
        title: "نوع ملف غير مدعوم",
        description: "يرجى اختيار ملف PHP أو JSON",
        variant: "destructive",
      });
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "الملف كبير جداً",
        description: "حجم الملف يجب أن يكون أقل من 5 ميجابايت",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "جارٍ تحليل الملف...",
        description: "يرجى الانتظار أثناء تحليل محتوى الملف",
      });

      const content = await file.text();
      let parsedItems: ParsedTranslation[];

      if (file.name.endsWith('.json')) {
        parsedItems = parseJSONFile(content);
      } else {
        parsedItems = parsePHPFile(content);
      }

      // Limit items to prevent memory issues
      if (parsedItems.length > 10000) {
        toast({
          title: "الملف يحتوي على عناصر كثيرة",
          description: `الملف يحتوي على ${parsedItems.length} عنصر. سيتم معالجة أول 10,000 عنصر فقط`,
          variant: "destructive",
        });
        parsedItems = parsedItems.slice(0, 10000);
      }

      toast({
        title: "جارٍ إنشاء المشروع...",
        description: `تم العثور على ${parsedItems.length} عنصر، جارٍ الحفظ في قاعدة البيانات`,
      });

      // Create project
      const project = await createProjectMutation.mutateAsync({
        name: file.name.replace(/\.(php|json)$/, ''),
        fileName: file.name,
        fileSize: file.size,
        totalItems: parsedItems.length,
      });

      // Create translation items in batches with progress
      const batchSize = 100;
      let processed = 0;
      
      for (let i = 0; i < parsedItems.length; i += batchSize) {
        const batch = parsedItems.slice(i, i + batchSize);
        await createItemsMutation.mutateAsync({
          projectId: project.id,
          items: batch,
        });
        
        processed += batch.length;
        const progress = Math.round((processed / parsedItems.length) * 100);
        
        toast({
          title: `جارٍ الحفظ... ${progress}%`,
          description: `تم حفظ ${processed} من أصل ${parsedItems.length} عنصر`,
        });
        
        // Add a small delay between batches for large files
        if (parsedItems.length > 1000 && i + batchSize < parsedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      toast({
        title: "تم تحميل الملف بنجاح",
        description: `تم حفظ ${parsedItems.length} عنصر في قاعدة البيانات`,
      });

    } catch (error) {
      toast({
        title: "خطأ في تحميل الملف",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    }
  }, [createProjectMutation, createItemsMutation, toast]);

  // Batch translation
  const startBatchTranslation = useCallback(async (selectedItems: TranslationItem[], provider: string, apiKey: string, model?: string) => {
    if (selectedItems.length === 0) {
      toast({
        title: "لا توجد عناصر مختارة",
        description: "يرجى اختيار عناصر تحتاج ترجمة",
        variant: "destructive",
      });
      return;
    }

    setTranslationProgress({
      current: 0,
      total: selectedItems.length,
      percentage: 0,
      isActive: true,
    });

    const updates: Array<{ id: number; translatedText: string; status: string }> = [];
    let completed = 0;

    try {
      for (const item of selectedItems) {
        try {
          const translatedText = await translateText({
            text: item.originalText,
            provider: provider as 'openai' | 'gemini',
            apiKey,
            model,
          });

          updates.push({
            id: item.id,
            translatedText,
            status: 'translated',
          });

          completed++;
          const percentage = Math.round((completed / selectedItems.length) * 100);
          
          setTranslationProgress({
            current: completed,
            total: selectedItems.length,
            percentage,
            isActive: true,
          });

          // Delay between requests
          if (completed < selectedItems.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error('Translation error for item:', item.key, error);
          updates.push({
            id: item.id,
            translatedText: item.originalText,
            status: 'error',
          });
          completed++;
        }
      }

      // Bulk update all items
      await bulkUpdateMutation.mutateAsync(updates);

      toast({
        title: "تمت الترجمة بنجاح",
        description: `تم ترجمة ${updates.filter(u => u.status === 'translated').length} عنصر`,
      });

    } catch (error) {
      toast({
        title: "خطأ في الترجمة",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setTranslationProgress(prev => ({ ...prev, isActive: false }));
    }
  }, [bulkUpdateMutation, toast]);

  // Calculate cost estimate
  const getCostEstimate = useCallback((items: TranslationItem[], provider: string, model?: string) => {
    const totalWords = items.reduce((sum, item) => sum + countWords(item.originalText), 0);
    return estimateCost(totalWords, provider, model);
  }, []);

  // Test API connection
  const testConnection = useCallback(async (provider: string, apiKey: string, model?: string) => {
    try {
      const result = await testApiConnection({
        provider: provider as 'openai' | 'gemini',
        apiKey,
        model,
      });

      if (result.success) {
        toast({
          title: "اختبار الاتصال نجح",
          description: "تم الاتصال بـ API بنجاح",
        });
      } else {
        toast({
          title: "فشل اختبار الاتصال",
          description: result.errorMessage || "تحقق من مفتاح API",
          variant: "destructive",
        });
      }

      return result.success;
    } catch (error) {
      toast({
        title: "خطأ في الاتصال",
        description: "تحقق من الاتصال بالإنترنت",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  return {
    // Data
    projects,
    currentProject,
    translationItems,
    apiSettings,
    translationProgress,
    
    // Loading states
    projectsLoading,
    itemsLoading,
    settingsLoading,
    isTranslating: translationProgress.isActive,
    
    // Actions
    setCurrentProject,
    handleFileUpload,
    startBatchTranslation,
    updateTranslationItem,
    getCostEstimate,
    testConnection,
    
    // API Settings
    createApiSettings: createApiSettingsMutation.mutate,
    updateApiSettings: updateApiSettingsMutation.mutate,
    
    // Clear all data
    clearAllData: async () => {
      if (window.confirm('هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        try {
          const response = await apiRequest('DELETE', '/api/clear-all');
          const result = await response.json();
          setCurrentProject(null);
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          toast({
            title: "تم حذف جميع البيانات",
            description: result.message,
          });
        } catch (error) {
          toast({
            title: "خطأ في حذف البيانات",
            description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
            variant: "destructive",
          });
        }
      }
    },
  };
}
