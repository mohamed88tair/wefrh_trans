import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  Zap, 
  Clock, 
  TrendingUp, 
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface AIUsageRecord {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  projectId?: number;
  projectName?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  duration: number;
  success: boolean;
  errorMessage?: string;
  requestType: 'single' | 'batch';
  batchSize?: number;
}

interface DailyStats {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  successRate: number;
  avgDuration: number;
  topModels: { model: string; usage: number; cost: number }[];
}

interface ModelPricing {
  provider: 'openai' | 'gemini';
  model: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  currency: 'USD';
  maxTokens: number;
  contextWindow: number;
}

export function AICostDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch AI usage records
  const { data: usageRecords = [] } = useQuery<AIUsageRecord[]>({
    queryKey: ['/api/ai-costs'],
    refetchInterval: 10000, // Update every 10 seconds
  });

  // Fetch daily stats
  const { data: dailyStats } = useQuery<DailyStats>({
    queryKey: ['/api/ai-costs/daily', selectedDate],
    refetchInterval: 30000, // Update every 30 seconds
  });

  // Fetch model pricing
  const { data: modelPricing = {} } = useQuery<Record<string, ModelPricing>>({
    queryKey: ['/api/ai-models'],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'gemini':
        return 'bg-blue-500';
      case 'openai':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getModelIcon = (model: string) => {
    if (model.includes('gemini')) {
      return <Brain className="w-4 h-4" />;
    } else if (model.includes('gpt')) {
      return <Zap className="w-4 h-4" />;
    }
    return <Activity className="w-4 h-4" />;
  };

  // Calculate totals for today
  const todayRecords = usageRecords.filter(record => 
    new Date(record.timestamp).toDateString() === new Date().toDateString()
  );

  const todayTotal = todayRecords.reduce((sum, record) => sum + record.totalCost, 0);
  const todayTokens = todayRecords.reduce((sum, record) => sum + record.totalTokens, 0);
  const todayRequests = todayRecords.length;
  const todaySuccess = todayRecords.filter(r => r.success).length;
  const todaySuccessRate = todayRequests > 0 ? (todaySuccess / todayRequests) * 100 : 0;

  // Get recent usage for the activity feed
  const recentUsage = usageRecords.slice(0, 10);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              التكلفة اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(todayTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayRequests} طلب ترجمة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              الرموز المستهلكة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatTokens(todayTokens)}
            </div>
            <p className="text-xs text-muted-foreground">
              رمز اليوم
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              معدل النجاح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {todaySuccessRate.toFixed(1)}%
            </div>
            <Progress value={todaySuccessRate} className="h-2 mt-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              متوسط الاستجابة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {todayRecords.length > 0 
                ? (todayRecords.reduce((sum, r) => sum + r.duration, 0) / todayRecords.length / 1000).toFixed(1)
                : '0.0'
              }s
            </div>
            <p className="text-xs text-muted-foreground">
              متوسط زمن الاستجابة
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="activity">النشاط الحديث</TabsTrigger>
          <TabsTrigger value="models">النماذج والتكاليف</TabsTrigger>
          <TabsTrigger value="stats">الإحصائيات المفصلة</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>النشاط الحديث للذكاء الاصطناعي</CardTitle>
              <CardDescription>
                آخر {recentUsage.length} عملية ترجمة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentUsage.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد عمليات ترجمة حديثة
                  </div>
                ) : (
                  recentUsage.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getProviderColor(record.provider)}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            {getModelIcon(record.model)}
                            <span className="font-medium">{record.model}</span>
                            {record.success ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {record.projectName && `${record.projectName} • `}
                            {formatTokens(record.totalTokens)} رمز • {(record.duration / 1000).toFixed(1)}s
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-left">
                        <div className="font-medium">{formatCurrency(record.totalCost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(record.timestamp), 'HH:mm', { locale: ar })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>النماذج المتاحة وأسعارها</CardTitle>
              <CardDescription>
                تفاصيل تكلفة كل نموذج ذكاء اصطناعي
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {Object.entries(modelPricing).map(([modelKey, pricing]) => (
                  <div key={modelKey} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getModelIcon(pricing.model)}
                        <span className="font-medium">{pricing.model}</span>
                        <Badge variant="outline">{pricing.provider}</Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">الإدخال (1K رمز)</div>
                        <div className="font-medium">{formatCurrency(pricing.inputCostPer1kTokens)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">الإخراج (1K رمز)</div>
                        <div className="font-medium">{formatCurrency(pricing.outputCostPer1kTokens)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">الحد الأقصى للرموز</div>
                        <div className="font-medium">{formatTokens(pricing.maxTokens)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">نافذة السياق</div>
                        <div className="font-medium">{formatTokens(pricing.contextWindow)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>الإحصائيات المفصلة</CardTitle>
              <CardDescription>
                تحليل شامل لاستخدام الذكاء الاصطناعي والتكاليف
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dailyStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatCurrency(dailyStats.totalCost)}</div>
                      <div className="text-sm text-muted-foreground">إجمالي التكلفة</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatTokens(dailyStats.totalTokens)}</div>
                      <div className="text-sm text-muted-foreground">إجمالي الرموز</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{dailyStats.totalRequests}</div>
                      <div className="text-sm text-muted-foreground">إجمالي الطلبات</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{(dailyStats.avgDuration / 1000).toFixed(1)}s</div>
                      <div className="text-sm text-muted-foreground">متوسط الاستجابة</div>
                    </div>
                  </div>

                  {dailyStats.topModels.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">النماذج الأكثر استخداماً</h4>
                      <div className="space-y-2">
                        {dailyStats.topModels.map((model, index) => (
                          <div key={model.model} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">#{index + 1}</span>
                              {getModelIcon(model.model)}
                              <span>{model.model}</span>
                            </div>
                            <div className="text-left">
                              <div className="font-medium">{formatCurrency(model.cost)}</div>
                              <div className="text-xs text-muted-foreground">{formatTokens(model.usage)} رمز</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد إحصائيات متاحة لهذا التاريخ
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}