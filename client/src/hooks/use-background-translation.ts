import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BackgroundTask, TranslationProject } from "@shared/schema";

interface BackgroundTranslationOptions {
  projectId: number;
  provider: string;
  model: string;
  batchSize?: number;
}

export function useBackgroundTranslation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTranslations, setActiveTranslations] = useState<Set<number>>(new Set());

  // Generate unique task ID
  const generateTaskId = () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Start background translation
  const startBackgroundTranslation = useMutation({
    mutationFn: async ({ projectId, provider, model, batchSize = 50 }: BackgroundTranslationOptions) => {
      const taskId = generateTaskId();
      
      // Get untranslated items count
      const items = await apiRequest(`/api/projects/${projectId}/items`);
      const untranslatedItems = items.filter((item: any) => 
        item.status === 'untranslated' && 
        item.originalText?.trim() && 
        item.originalText !== item.translatedText
      );

      if (untranslatedItems.length === 0) {
        throw new Error('لا توجد عناصر تحتاج للترجمة');
      }

      // Create background task
      const task = await apiRequest('/api/background-tasks', 'POST', {
        id: taskId,
        projectId,
        type: 'batch_translation',
        status: 'running',
        totalItems: untranslatedItems.length,
        processedItems: 0,
        progress: 0,
        currentBatch: 0,
        totalBatches: Math.ceil(untranslatedItems.length / batchSize),
        settings: {
          provider,
          model,
          batchSize,
          items: untranslatedItems.map((item: any) => item.id)
        }
      });

      // Update project status
      await apiRequest(`/api/projects/${projectId}`, 'PATCH', {
        isTranslating: true,
        backgroundTaskId: taskId
      });

      return { task, untranslatedCount: untranslatedItems.length };
    },
    onSuccess: (data, variables) => {
      setActiveTranslations(prev => {
        const newSet = new Set(prev);
        newSet.add(variables.projectId);
        return newSet;
      });
      
      // Start the actual translation process
      processBackgroundTranslation(data.task.id, variables);
      
      toast({
        title: "بدأت الترجمة في الخلفية",
        description: `سيتم ترجمة ${data.untranslatedCount} عنصر`,
      });

      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/background-tasks/active'] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في بدء الترجمة",
        description: error.message || "فشل في بدء الترجمة في الخلفية",
        variant: "destructive",
      });
    }
  });

  // Process background translation
  const processBackgroundTranslation = async (taskId: string, options: BackgroundTranslationOptions) => {
    try {
      const task = await apiRequest(`/api/background-tasks/${taskId}`);
      const settings = task.settings;
      
      if (!settings?.items || settings.items.length === 0) {
        throw new Error('لا توجد عناصر للترجمة');
      }

      const batchSize = settings.batchSize || 50;
      const totalBatches = Math.ceil(settings.items.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Check if task is still running
        const currentTask = await apiRequest(`/api/background-tasks/${taskId}`);
        if (currentTask.status !== 'running') {
          break; // Task was paused or stopped
        }

        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, settings.items.length);
        const batchItemIds = settings.items.slice(startIdx, endIdx);

        // Get current items data
        const items = await apiRequest(`/api/projects/${options.projectId}/items`);
        const batchItems = items.filter((item: any) => batchItemIds.includes(item.id));

        if (batchItems.length === 0) continue;

        // Translate batch
        try {
          const response = await apiRequest('/api/translate-batch', 'POST', {
            texts: batchItems.map((item: any) => item.originalText),
            provider: options.provider,
            model: options.model,
          });

          // Update translations
          const updates = batchItems.map((item: any, index: number) => ({
            id: item.id,
            translatedText: response.translations[`item_${index}`] || item.originalText,
            status: 'translated'
          }));

          await apiRequest('/api/items/bulk-update', 'PATCH', { updates });

          // Update task progress
          const processedItems = (batchIndex + 1) * batchSize;
          const progress = Math.min(Math.round((processedItems / settings.items.length) * 100), 100);

          await apiRequest(`/api/background-tasks/${taskId}`, 'PATCH', {
            processedItems: Math.min(processedItems, settings.items.length),
            progress,
            currentBatch: batchIndex + 1,
            lastActivity: new Date().toISOString()
          });

          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (batchError) {
          console.error('Batch translation error:', batchError);
          
          // Update task with error but continue
          await apiRequest(`/api/background-tasks/${taskId}`, 'PATCH', {
            errorMessage: `خطأ في الدفعة ${batchIndex + 1}: ${batchError}`,
            lastActivity: new Date().toISOString()
          });
        }
      }

      // Complete the task
      await apiRequest(`/api/background-tasks/${taskId}`, 'PATCH', {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString()
      });

      // Update project status
      await apiRequest(`/api/projects/${options.projectId}`, 'PATCH', {
        isTranslating: false,
        backgroundTaskId: null
      });

      setActiveTranslations(prev => {
        const newSet = new Set(prev);
        newSet.delete(options.projectId);
        return newSet;
      });

      // Update project progress
      await apiRequest(`/api/projects/${options.projectId}/progress`, 'PUT');

    } catch (error) {
      console.error('Background translation error:', error);
      
      // Mark task as failed
      await apiRequest(`/api/background-tasks/${taskId}`, 'PATCH', {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'خطأ غير معروف'
      });

      // Update project status
      await apiRequest(`/api/projects/${options.projectId}`, 'PATCH', {
        isTranslating: false,
        backgroundTaskId: null
      });

      setActiveTranslations(prev => {
        const newSet = new Set(prev);
        newSet.delete(options.projectId);
        return newSet;
      });
    }

    // Refresh queries
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    queryClient.invalidateQueries({ queryKey: ['/api/background-tasks'] });
  };

  // Pause background translation
  const pauseBackgroundTranslation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest(`/api/background-tasks/${taskId}/pause`, 'PUT');
    },
    onSuccess: () => {
      toast({
        title: "تم إيقاف الترجمة مؤقتاً",
        description: "يمكنك استئناف الترجمة في أي وقت",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/background-tasks'] });
    }
  });

  // Resume background translation
  const resumeBackgroundTranslation = useMutation({
    mutationFn: async (taskId: string) => {
      const task = await apiRequest(`/api/background-tasks/${taskId}`);
      await apiRequest(`/api/background-tasks/${taskId}/resume`, 'PUT');
      
      // Resume processing
      const options = {
        projectId: task.projectId,
        provider: task.settings.provider,
        model: task.settings.model,
        batchSize: task.settings.batchSize
      };
      
      processBackgroundTranslation(taskId, options);
    },
    onSuccess: () => {
      toast({
        title: "تم استئناف الترجمة",
        description: "الترجمة تعمل الآن في الخلفية",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/background-tasks'] });
    }
  });

  // Stop background translation
  const stopBackgroundTranslation = useMutation({
    mutationFn: async (taskId: string) => {
      const task = await apiRequest(`/api/background-tasks/${taskId}`);
      
      await apiRequest(`/api/background-tasks/${taskId}`, 'DELETE');
      
      // Update project status
      await apiRequest(`/api/projects/${task.projectId}`, 'PATCH', {
        isTranslating: false,
        backgroundTaskId: null
      });

      setActiveTranslations(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.projectId);
        return newSet;
      });
    },
    onSuccess: () => {
      toast({
        title: "تم إيقاف الترجمة",
        description: "تم إنهاء المهمة نهائياً",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/background-tasks'] });
    }
  });

  // Check if project has active translation
  const isProjectTranslating = useCallback((projectId: number) => {
    return activeTranslations.has(projectId);
  }, [activeTranslations]);

  // Get project background task
  const { data: projectTasks = [] } = useQuery<BackgroundTask[]>({
    queryKey: ['/api/background-tasks/active'],
    refetchInterval: 5000, // Check every 5 seconds
  });

  const getProjectTask = useCallback((projectId: number) => {
    return projectTasks.find((task) => task.projectId === projectId);
  }, [projectTasks]);

  return {
    startBackgroundTranslation,
    pauseBackgroundTranslation,
    resumeBackgroundTranslation,
    stopBackgroundTranslation,
    isProjectTranslating,
    getProjectTask,
    activeTranslations
  };
}