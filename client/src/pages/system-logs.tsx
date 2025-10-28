import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle, 
  RefreshCw, 
  Search,
  Clock,
  Database,
  Activity,
  Bug,
  DollarSign,
  Brain
} from "lucide-react";
import { AICostDashboard } from "@/components/ai-cost-dashboard";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'database' | 'api' | 'translation' | 'project';
  message: string;
  details?: any;
  projectId?: number;
  projectName?: string;
}

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  // Fetch real-time logs from server
  const { data: serverLogs = [], refetch: refetchLogs } = useQuery<LogEntry[]>({
    queryKey: ['/api/logs'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const { data: logStats = { total: 0, errors: 0, warnings: 0, success: 0, info: 0 } } = useQuery<{
    total: number;
    errors: number;
    warnings: number;
    success: number;
    info: number;
  }>({
    queryKey: ['/api/logs/stats'],
    refetchInterval: 5000, // Refresh stats every 5 seconds
  });

  // Update local logs when server logs change
  useEffect(() => {
    if (Array.isArray(serverLogs) && serverLogs.length > 0) {
      setLogs(serverLogs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      })));
    }
  }, [serverLogs]);

  const addLog = (logData: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...logData
    };

    setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 1000)); // Keep last 1000 logs
  };

  // Initialize with some sample logs to show the interface
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      {
        id: 'log_1',
        timestamp: new Date(),
        level: 'error',
        category: 'database',
        message: 'فشل في تحديث جميع المشاريع - خطأ في قاعدة البيانات',
        details: { error: 'Failed to update all project progress', endpoint: '/api/projects/update-all-progress' }
      },
      {
        id: 'log_2',
        timestamp: new Date(Date.now() - 60000),
        level: 'info',
        category: 'project',
        message: 'تم تحميل مشروع "تطبيق الديلفري" بنجاح',
        projectId: 10,
        projectName: 'تطبيق الديلفري'
      },
      {
        id: 'log_3',
        timestamp: new Date(Date.now() - 120000),
        level: 'warning',
        category: 'translation',
        message: 'تحذير: معدل استخدام API مرتفع - قد يحدث بطء في الترجمة',
        details: { apiCalls: 450, limit: 500 }
      },
      {
        id: 'log_4',
        timestamp: new Date(Date.now() - 180000),
        level: 'success',
        category: 'project',
        message: 'تم حفظ مشروع "لوحة التحكم الرئيسية" بنجاح',
        projectId: 9,
        projectName: 'لوحة التحكم الرئيسية'
      },
      {
        id: 'log_5',
        timestamp: new Date(Date.now() - 240000),
        level: 'error',
        category: 'system',
        message: 'خطأ في تحديث التقدم للمشروع - المشروع غير موجود',
        details: { projectId: 999, error: 'Project not found' }
      }
    ];

    setLogs(initialLogs);
  }, []);

  const getIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBadgeVariant = (level: string): "default" | "secondary" | "destructive" => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'success':
        return 'default';
      case 'info':
      default:
        return 'secondary';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'api':
        return <Activity className="w-4 h-4" />;
      case 'translation':
        return <RefreshCw className="w-4 h-4" />;
      case 'project':
        return <Info className="w-4 h-4" />;
      case 'system':
      default:
        return <Bug className="w-4 h-4" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (log.projectName && log.projectName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    
    return matchesSearch && matchesLevel;
  });

  // Use server stats instead of calculating locally
  const stats = logStats;

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/logs', 'DELETE');
    },
    onSuccess: () => {
      setLogs([]);
      refetchLogs();
    }
  });

  const testBulkUpdate = async () => {
    try {
      const response = await apiRequest('/api/projects/update-all-progress', 'PUT');
      console.log('Bulk update successful:', response);
    } catch (error) {
      console.error('Bulk update failed:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">سجل النظام والأخطاء</h1>
          <p className="text-muted-foreground">مراقبة شاملة لجميع عمليات النظام والأخطاء</p>
        </div>
        
        <Button onClick={testBulkUpdate} variant="outline">
          <Bug className="w-4 h-4 mr-2" />
          اختبار التحديث الشامل
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي السجلات (24 ساعة)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">أخطاء</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">تحذيرات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">نجح</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>فلترة السجلات</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
            >
              {clearLogsMutation.isPending ? "جارٍ المسح..." : "مسح السجلات"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في السجلات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            
            <Tabs value={selectedLevel} onValueChange={setSelectedLevel}>
              <TabsList>
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="error">أخطاء</TabsTrigger>
                <TabsTrigger value="warning">تحذيرات</TabsTrigger>
                <TabsTrigger value="success">نجح</TabsTrigger>
                <TabsTrigger value="info">معلومات</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            السجلات المباشرة
          </TabsTrigger>
          <TabsTrigger value="ai-costs" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            تكاليف الذكاء الاصطناعي
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Logs Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                السجلات المباشرة ({filteredLogs.length})
              </CardTitle>
              <CardDescription>
                آخر تحديث: {format(new Date(), 'PPpp', { locale: ar })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد سجلات تطابق المعايير المحددة
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        {/* Log Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getIcon(log.level)}
                            <Badge variant={getBadgeVariant(log.level)}>
                              {log.level}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              {getCategoryIcon(log.category)}
                              {log.category}
                            </div>
                            
                            {/* AI Cost specific badges */}
                            {log.category === 'ai-cost' && (
                              <div className="flex items-center gap-1">
                                <Brain className="w-3 h-3" />
                                <Badge variant="outline" className="text-xs">
                                  {log.details?.aiModel || 'AI'}
                                </Badge>
                                {log.details?.estimatedCost && (
                                  <Badge variant="secondary" className="text-xs">
                                    ${log.details.estimatedCost.toFixed(4)}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(log.timestamp, 'HH:mm:ss', { locale: ar })}
                          </div>
                        </div>

                        {/* Log Message */}
                        <div className="text-sm font-medium">{log.message}</div>

                        {/* AI Cost specific info */}
                        {log.category === 'ai-cost' && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            {log.details?.inputTokens && (
                              <div>الإدخال: {log.details.inputTokens} رمز</div>
                            )}
                            {log.details?.outputTokens && (
                              <div>الإخراج: {log.details.outputTokens} رمز</div>
                            )}
                            {log.details?.duration && (
                              <div>المدة: {(log.details.duration / 1000).toFixed(1)}s</div>
                            )}
                            {log.details?.aiProvider && (
                              <div>المزود: {log.details.aiProvider}</div>
                            )}
                          </div>
                        )}

                        {/* Project Info */}
                        {log.projectName && (
                          <div className="text-xs text-muted-foreground">
                            المشروع: {log.projectName} (ID: {log.projectId})
                          </div>
                        )}

                        {/* Log Details */}
                        {log.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">
                              عرض التفاصيل التقنية
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-costs" className="space-y-4">
          <AICostDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}