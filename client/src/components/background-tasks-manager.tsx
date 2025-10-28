import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, Square, Clock, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BackgroundTask } from "@shared/schema";

export function BackgroundTasksManager() {
  const { toast } = useToast();

  // Fetch active background tasks
  const { data: activeTasks = [], refetch } = useQuery<BackgroundTask[]>({
    queryKey: ['/api/background-tasks/active'],
    refetchInterval: 3000, // Update every 3 seconds
  });

  // Task control mutations
  const pauseTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest(`/api/background-tasks/${taskId}/pause`, 'PUT');
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "تم إيقاف المهمة مؤقتاً",
        description: "يمكنك استئناف الترجمة لاحقاً",
      });
    },
  });

  const resumeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest(`/api/background-tasks/${taskId}/resume`, 'PUT');
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "تم استئناف المهمة",
        description: "الترجمة تعمل الآن في الخلفية",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest(`/api/background-tasks/${taskId}`, 'DELETE');
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "تم حذف المهمة",
        description: "تم إيقاف الترجمة نهائياً",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-green-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'جارٍ التشغيل';
      case 'paused':
        return 'متوقف مؤقتاً';
      case 'completed':
        return 'مكتملة';
      case 'failed':
        return 'فشلت';
      default:
        return 'غير معروف';
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'running':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (activeTasks.length === 0) {
    return (
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
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-right flex items-center justify-between">
          المهام النشطة
          <Badge variant="secondary">
            {activeTasks.length} مهمة
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <div
                key={task.id}
                className="border rounded-lg p-4 space-y-3"
              >
                {/* Task Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <Badge variant={getStatusVariant(task.status)}>
                      {getStatusText(task.status)}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">
                    مشروع #{task.projectId}
                  </span>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{task.progress}%</span>
                    <span>
                      {task.processedItems} / {task.totalItems}
                    </span>
                  </div>
                  <Progress value={task.progress} className="h-2" />
                </div>

                {/* Task Controls */}
                <div className="flex gap-2 justify-end">
                  {task.status === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseTaskMutation.mutate(task.id)}
                      disabled={pauseTaskMutation.isPending}
                    >
                      <Pause className="w-3 h-3 mr-1" />
                      إيقاف مؤقت
                    </Button>
                  )}
                  
                  {task.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => resumeTaskMutation.mutate(task.id)}
                      disabled={resumeTaskMutation.isPending}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      استئناف
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteTaskMutation.mutate(task.id)}
                    disabled={deleteTaskMutation.isPending}
                  >
                    <Square className="w-3 h-3 mr-1" />
                    إيقاف نهائي
                  </Button>
                </div>

                {/* Error Message */}
                {task.errorMessage && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-right">
                    خطأ: {task.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}