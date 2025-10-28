import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, DollarSign, Zap, Clock } from 'lucide-react';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  inputCost: number;
  outputCost: number;
  contextWindow: number;
  description?: string;
  capabilities: string[];
  isActive: boolean;
}

interface ProviderInfo {
  name: string;
  displayName: string;
  icon: string;
  apiEndpoint: string;
  requiresKey: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  {
    name: 'gemini',
    displayName: 'Google Gemini',
    icon: 'fab fa-google',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1/models',
    requiresKey: true
  },
  {
    name: 'openai',
    displayName: 'OpenAI GPT',
    icon: 'fab fa-openai',
    apiEndpoint: 'https://api.openai.com/v1/models',
    requiresKey: true
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek AI',
    icon: 'fas fa-brain',
    apiEndpoint: 'https://api.deepseek.com/v1/models',
    requiresKey: true
  }
];

export default function ModelsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState('google');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Fetch available models
  const { data: models = [], isLoading } = useQuery({
    queryKey: ['/api/models'],
    queryFn: async () => {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      return response.json();
    }
  });

  // Fetch usage statistics
  const { data: usageStats } = useQuery({
    queryKey: ['/api/usage-stats'],
    queryFn: async () => {
      const response = await fetch('/api/usage-stats');
      if (!response.ok) throw new Error('Failed to fetch usage stats');
      return response.json();
    }
  });

  // Import models mutation
  const importModelsMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await fetch('/api/models/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      if (!response.ok) throw new Error('Failed to import models');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/models'] });
      toast({
        title: "تم استيراد النماذج بنجاح",
        description: "تم تحديث قائمة النماذج المتاحة"
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في استيراد النماذج",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update model mutation
  const updateModelMutation = useMutation({
    mutationFn: async ({ modelId, updates }: { modelId: string; updates: any }) => {
      const response = await fetch(`/api/models/${modelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update model');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/models'] });
    }
  });

  const handleImportModels = async (provider: string) => {
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await importModelsMutation.mutateAsync(provider);
      
      clearInterval(progressInterval);
      setImportProgress(100);
      
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
      }, 1000);
    } catch (error) {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const groupedModels = models.reduce((acc: Record<string, ModelInfo[]>, model: ModelInfo) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {});

  const formatCost = (cost: number) => {
    if (cost === 0) return 'مجاني';
    if (cost < 0.001) return `$${(cost * 1000000).toFixed(2)}/1M tokens`;
    if (cost < 1) return `$${(cost * 1000).toFixed(2)}/1K tokens`;
    return `$${cost.toFixed(2)}/1K tokens`;
  };

  const getProviderInfo = (providerName: string) => {
    return PROVIDERS.find(p => p.name === providerName) || {
      name: providerName,
      displayName: providerName,
      icon: 'fas fa-server',
      apiEndpoint: '',
      requiresKey: true
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">إدارة النماذج</h1>
          <p className="text-gray-600">
            استيراد وإدارة نماذج الذكاء الاصطناعي من مختلف المزودين
          </p>
        </div>

        {/* Import Progress */}
        {isImporting && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    جاري استيراد النماذج...
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
                <span className="text-sm text-gray-600">{importProgress}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={selectedProvider} onValueChange={setSelectedProvider} className="space-y-6">
          {/* Provider Tabs */}
          <TabsList className="grid w-full grid-cols-1">
            {PROVIDERS.map((provider) => (
              <TabsTrigger key={provider.name} value={provider.name} className="flex items-center gap-2">
                <i className={`${provider.icon} text-sm`}></i>
                {provider.displayName}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Provider Content */}
          {PROVIDERS.map((provider) => (
            <TabsContent key={provider.name} value={provider.name} className="space-y-4">
              {/* Provider Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <i className={`${provider.icon} text-xl text-blue-600`}></i>
                      <div>
                        <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                        <p className="text-sm text-gray-600">
                          {groupedModels[provider.name]?.length || 0} نموذج متاح
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleImportModels(provider.name)}
                      disabled={isImporting}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      استيراد النماذج
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Models Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedModels[provider.name]?.map((model: ModelInfo) => (
                  <Card key={model.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{model.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={model.isActive ? "default" : "secondary"}>
                              {model.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateModelMutation.mutate({
                            modelId: model.id,
                            updates: { isActive: !model.isActive }
                          })}
                        >
                          {model.isActive ? 'إلغاء التفعيل' : 'تفعيل'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {model.description && (
                        <p className="text-sm text-gray-600">{model.description}</p>
                      )}
                      
                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.map((capability: string) => (
                          <Badge key={capability} variant="outline" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                      </div>

                      {/* Pricing */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          <span className="text-gray-600">الإدخال:</span>
                          <span className="font-medium">{formatCost(model.inputCost)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-3 w-3 text-blue-600" />
                          <span className="text-gray-600">الإخراج:</span>
                          <span className="font-medium">{formatCost(model.outputCost)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Zap className="h-3 w-3 text-purple-600" />
                          <span className="text-gray-600">نافذة السياق:</span>
                          <span className="font-medium">{model.contextWindow.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Usage Stats */}
                      {usageStats && usageStats[model.id] && (
                        <div className="pt-2 border-t">
                          <div className="text-xs text-gray-500 mb-1">الاستخدام هذا الشهر</div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span>{usageStats[model.id].requests} طلب</span>
                            <span>•</span>
                            <span>${usageStats[model.id].cost.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Empty State */}
              {(!groupedModels[provider.name] || groupedModels[provider.name].length === 0) && (
                <Card>
                  <CardContent className="text-center py-8">
                    <i className={`${provider.icon} text-4xl text-gray-400 mb-4`}></i>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      لا توجد نماذج متاحة
                    </h3>
                    <p className="text-gray-600 mb-4">
                      اضغط على "استيراد النماذج" لجلب النماذج المتاحة من {provider.displayName}
                    </p>
                    <Button
                      onClick={() => handleImportModels(provider.name)}
                      disabled={isImporting}
                    >
                      استيراد النماذج الآن
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}