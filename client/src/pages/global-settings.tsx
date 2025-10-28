import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Settings, 
  Key, 
  Brain, 
  Zap, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2
} from "lucide-react";

interface ApiSettings {
  id: number;
  provider: string;
  apiKey: string;
  model: string;
  isActive: boolean;
}

interface ModelPricing {
  provider: 'openai' | 'gemini' | 'xai' | 'anthropic' | 'deepseek';
  model: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  currency: 'USD';
  maxTokens: number;
  contextWindow: number;
}

interface GlobalSettings {
  autoSaveInterval: number;
  maxRetries: number;
  enableCostTracking: boolean;
  enableAutoBackup: boolean;
}

export default function GlobalSettingsPage() {
  const { toast } = useToast();
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<Record<string, string>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});

  // Global settings state
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    autoSaveInterval: 30,
    maxRetries: 3,
    enableCostTracking: true,
    enableAutoBackup: true
  });

  // Fetch existing API settings
  const { data: apiSettings = [], refetch: refetchSettings } = useQuery<ApiSettings[]>({
    queryKey: ['/api/settings'],
  });

  // Fetch model pricing
  const { data: modelPricing = {} } = useQuery<Record<string, ModelPricing>>({
    queryKey: ['/api/ai-models'],
  });

  // API key test mutation with enhanced error handling
  const testApiKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const response = await apiRequest('/api/test-api', 'POST', { provider, apiKey });
      return response;
    },
    onSuccess: (data, variables) => {
      const balanceInfo = data.balance ? ` - الرصيد: ${data.balance}` : '';
      const modelsInfo = data.modelAccess?.length ? ` - ${data.modelAccess.length} نموذج متاح` : '';
      
      toast({
        title: "نجح الاختبار",
        description: `${data.message}${balanceInfo}${modelsInfo}`,
      });
      
      // Update available models
      if (data.modelAccess?.length > 0) {
        setAvailableModels(prev => ({ ...prev, [variables.provider]: data.modelAccess }));
      }
    },
    onError: (error: any, variables) => {
      const errorData = error.response?.data || error;
      let errorDescription = errorData.message || `مفتاح ${variables.provider} غير صحيح`;
      
      // Add specific error details
      if (errorData.errorCode === 'INVALID_API_KEY') {
        errorDescription += " - تأكد من صحة المفتاح";
      } else if (errorData.errorCode === 'INSUFFICIENT_QUOTA') {
        errorDescription += " - الرصيد منتهي";
      } else if (errorData.errorCode === 'RATE_LIMITED') {
        errorDescription += " - تم تجاوز حد الاستخدام";
      } else if (errorData.errorCode === 'PERMISSION_DENIED') {
        errorDescription += " - ليس لديك صلاحية";
      }
      
      if (errorData.quotaInfo) {
        errorDescription += ` - ${errorData.quotaInfo}`;
      }
      
      toast({
        title: "فشل الاختبار",
        description: errorDescription,
        variant: "destructive",
      });
    }
  });

  // Save API settings mutation
  const saveApiSettingsMutation = useMutation({
    mutationFn: async (settings: Omit<ApiSettings, 'id'>) => {
      const response = await apiRequest('/api/settings', 'POST', settings);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات API بنجاح",
      });
      refetchSettings();
    },
  });

  // Fetch global settings
  const { data: savedGlobalSettings, refetch: refetchGlobalSettings } = useQuery<any[]>({
    queryKey: ['/api/global-settings'],
  });

  // Save global settings mutation
  const saveGlobalSettingsMutation = useMutation({
    mutationFn: async (setting: { key: string; value: string; description?: string }) => {
      const response = await apiRequest('/api/global-settings', 'POST', setting);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "تم الحفظ",
        description: "تم حفظ الإعدادات العامة بنجاح",
      });
      refetchGlobalSettings();
    },
  });

  // Fetch available models from API
  const fetchAvailableModels = async (provider: string, apiKey: string) => {
    try {
      let models: string[] = [];
      
      if (provider === 'gemini') {
        // Fetch Gemini models
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (response.ok) {
          const data = await response.json();
          models = data.models
            ?.filter((model: any) => model.name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent'))
            ?.map((model: any) => model.name.replace('models/', '')) || [];
        }
      } else if (provider === 'openai') {
        // OpenAI models (static list as API requires different auth)
        models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      }
      
      setAvailableModels(prev => ({ ...prev, [provider]: models }));
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleApiKeyTest = (provider: string) => {
    const apiKey = newApiKey[provider];
    if (!apiKey) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مفتاح API أولاً",
        variant: "destructive",
      });
      return;
    }
    
    setTestingProvider(provider);
    testApiKeyMutation.mutate({ provider, apiKey });
  };

  const handleSaveApiKey = (provider: string) => {
    const apiKey = newApiKey[provider];
    if (!apiKey) return;
    
    saveApiSettingsMutation.mutate({
      provider,
      apiKey,
      model: 'gemini-1.5-flash', // Default model
      isActive: true
    });
  };

  const toggleApiKeyVisibility = (provider: string) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSettingsChange = (key: keyof GlobalSettings, value: any) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }));
  };

  // Load saved global settings on component mount
  useEffect(() => {
    if (savedGlobalSettings && Array.isArray(savedGlobalSettings)) {
      const settingsMap: Record<string, string> = {};
      savedGlobalSettings.forEach((setting: any) => {
        settingsMap[setting.settingKey] = setting.settingValue;
      });

      setGlobalSettings(prev => ({
        ...prev,
        autoSaveInterval: parseInt(settingsMap.autoSaveInterval) || prev.autoSaveInterval,
        maxRetries: parseInt(settingsMap.maxRetries) || prev.maxRetries,
        enableCostTracking: settingsMap.enableCostTracking === 'true' || prev.enableCostTracking,
        enableAutoBackup: settingsMap.enableAutoBackup === 'true' || prev.enableAutoBackup,
      }));
    }
  }, [savedGlobalSettings]);

  // Save all global settings
  const handleSaveGlobalSettings = async () => {
    const settingsToSave = [
      { key: 'autoSaveInterval', value: globalSettings.autoSaveInterval.toString(), description: 'فترة الحفظ التلقائي بالثواني' },
      { key: 'maxRetries', value: globalSettings.maxRetries.toString(), description: 'عدد المحاولات القصوى' },
      { key: 'enableCostTracking', value: globalSettings.enableCostTracking.toString(), description: 'تفعيل تتبع التكلفة' },
      { key: 'enableAutoBackup', value: globalSettings.enableAutoBackup.toString(), description: 'تفعيل النسخ الاحتياطي التلقائي' },
    ];

    try {
      for (const setting of settingsToSave) {
        await apiRequest('/api/global-settings', 'POST', setting);
      }
      toast({
        title: "تم الحفظ",
        description: "تم حفظ جميع الإعدادات العامة بنجاح",
      });
      refetchGlobalSettings();
    } catch (error) {
      toast({
        title: "خطأ في الحفظ",
        description: "فشل في حفظ بعض الإعدادات",
        variant: "destructive",
      });
    }
  };

  const providers = [
    {
      name: 'gemini',
      displayName: 'Google Gemini',
      description: 'نماذج Gemini من Google للترجمة عالية الجودة',
      icon: <Brain className="w-5 h-5" />,
      color: 'bg-blue-500'
    },
    {
      name: 'openai',
      displayName: 'OpenAI GPT',
      description: 'نماذج GPT من OpenAI للترجمة المتقدمة',
      icon: <Zap className="w-5 h-5" />,
      color: 'bg-green-500'
    },
    {
      name: 'xai',
      displayName: 'x.ai Grok',
      description: 'نماذج Grok من x.ai للترجمة الذكية والإبداعية',
      icon: <Brain className="w-5 h-5" />,
      color: 'bg-purple-500'
    },
    {
      name: 'anthropic',
      displayName: 'Anthropic Claude',
      description: 'نماذج Claude من Anthropic للترجمة الدقيقة والآمنة',
      icon: <Brain className="w-5 h-5" />,
      color: 'bg-orange-500'
    },
    {
      name: 'deepseek',
      displayName: 'DeepSeek',
      description: 'نماذج DeepSeek للترجمة السريعة والاقتصادية',
      icon: <Brain className="w-5 h-5" />,
      color: 'bg-indigo-500'
    }
  ];

  const getAllAvailableModels = () => {
    const allModels: { value: string; label: string; provider: string; cost: string }[] = [];
    
    Object.entries(modelPricing).forEach(([modelKey, pricing]) => {
      allModels.push({
        value: modelKey,
        label: `${pricing.model} (${pricing.provider})`,
        provider: pricing.provider,
        cost: `$${pricing.inputCostPer1kTokens}/1K`
      });
    });
    
    return allModels;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(amount);
  };

  useEffect(() => {
    // Initialize available models from pricing data
    if (Object.keys(modelPricing).length > 0) {
      const modelsByProvider: Record<string, string[]> = {};
      Object.entries(modelPricing).forEach(([modelKey, pricing]) => {
        if (!modelsByProvider[pricing.provider]) {
          modelsByProvider[pricing.provider] = [];
        }
        modelsByProvider[pricing.provider].push(modelKey);
      });
      setAvailableModels(modelsByProvider);
    }
  }, [Object.keys(modelPricing).length]);

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الإعدادات العامة</h1>
          <p className="text-muted-foreground">إدارة شاملة لجميع إعدادات النظام والذكاء الاصطناعي</p>
        </div>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            مفاتيح API
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            النماذج
          </TabsTrigger>
          <TabsTrigger value="defaults" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            الافتراضيات
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            متقدم
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إدارة مفاتيح API</CardTitle>
              <CardDescription>
                أضف واختبر مفاتيح API لجميع مزودي الذكاء الاصطناعي
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {providers.map((provider) => {
                const existingSetting = apiSettings.find(s => s.provider === provider.name);
                const isTesting = testingProvider === provider.name;
                
                return (
                  <div key={provider.name} className="border rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded ${provider.color} text-white`}>
                        {provider.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold">{provider.displayName}</h3>
                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                      </div>
                      {existingSetting && (
                        <Badge variant="outline" className="mr-auto">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          مُعدّ
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor={`${provider.name}-key`}>مفتاح API</Label>
                        <div className="flex gap-2 mt-1">
                          <div className="relative flex-1">
                            <Input
                              id={`${provider.name}-key`}
                              type={showApiKeys[provider.name] ? "text" : "password"}
                              placeholder={existingSetting ? "••••••••••••••••" : `أدخل مفتاح ${provider.displayName}`}
                              value={newApiKey[provider.name] || ''}
                              onChange={(e) => setNewApiKey(prev => ({ ...prev, [provider.name]: e.target.value }))}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => toggleApiKeyVisibility(provider.name)}
                            >
                              {showApiKeys[provider.name] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleApiKeyTest(provider.name)}
                          disabled={isTesting || !newApiKey[provider.name]}
                          className="flex-1"
                        >
                          {isTesting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          اختبار
                        </Button>
                        
                        <Button
                          onClick={() => handleSaveApiKey(provider.name)}
                          disabled={!newApiKey[provider.name]}
                          className="flex-1"
                        >
                          حفظ
                        </Button>
                      </div>
                    </div>

                    {/* API Status and Balance Information */}
                    {existingSetting && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium">حالة API والرصيد</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (existingSetting.apiKey) {
                                handleApiKeyTest(provider.name);
                              }
                            }}
                            disabled={testApiKeyMutation.isPending}
                            className="text-xs"
                          >
                            {testApiKeyMutation.isPending && testingProvider === provider.name ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                            تحديث
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="p-2 bg-muted/50 rounded">
                            <div className="text-xs text-muted-foreground">الرصيد المتاح</div>
                            <div className="font-medium text-green-600">
                              {provider.name === 'gemini' && "مجاني (حصة يومية)"}
                              {provider.name === 'openai' && "غير متاح للعرض"}
                              {provider.name === 'xai' && "غير متاح للعرض"}
                              {provider.name === 'anthropic' && "غير متاح للعرض"}
                              {provider.name === 'deepseek' && "غير متاح للعرض"}
                            </div>
                          </div>
                          
                          <div className="p-2 bg-muted/50 rounded">
                            <div className="text-xs text-muted-foreground">حالة الاتصال</div>
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              <span className="font-medium">نشط</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Available models for this provider */}
                    {availableModels[provider.name] && availableModels[provider.name].length > 0 && (
                      <div className="mt-4">
                        <Label>النماذج المتاحة ({availableModels[provider.name].length})</Label>
                        <div className="flex flex-wrap gap-2 mt-2 max-h-20 overflow-y-auto">
                          {availableModels[provider.name].slice(0, 8).map((model) => (
                            <Badge key={model} variant="secondary" className="text-xs">
                              {model.replace(provider.name + '-', '')}
                              {modelPricing[model] && (
                                <span className="mr-1 text-muted-foreground">
                                  ({formatCurrency(modelPricing[model].inputCostPer1kTokens)}/1K)
                                </span>
                              )}
                            </Badge>
                          ))}
                          {availableModels[provider.name].length > 8 && (
                            <Badge variant="outline" className="text-xs">
                              +{availableModels[provider.name].length - 8} أخرى
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>مقارنة النماذج والأسعار</CardTitle>
              <CardDescription>
                معلومات مفصلة عن جميع النماذج المتاحة وتكلفتها
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(modelPricing).map(([modelKey, pricing]) => (
                  <div key={modelKey} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${pricing.provider === 'gemini' ? 'bg-blue-500' : 'bg-green-500'} text-white`}>
                          {pricing.provider === 'gemini' ? <Brain className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{pricing.model}</h3>
                          <Badge variant="outline">{pricing.provider}</Badge>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <DollarSign className="w-3 h-3" />
                          التكلفة لكل 1K رمز
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">إدخال</div>
                        <div className="font-medium">{formatCurrency(pricing.inputCostPer1kTokens)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">إخراج</div>
                        <div className="font-medium">{formatCurrency(pricing.outputCostPer1kTokens)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">حد الرموز</div>
                        <div className="font-medium">{pricing.maxTokens?.toLocaleString() || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">نافذة السياق</div>
                        <div className="font-medium">{pricing.contextWindow?.toLocaleString() || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات عامة</CardTitle>
              <CardDescription>
                إعدادات النظام العامة والتحسينات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                <div>
                  <Label htmlFor="auto-save">فترة الحفظ التلقائي (بالثواني)</Label>
                  <Input
                    id="auto-save"
                    type="number"
                    value={globalSettings.autoSaveInterval}
                    onChange={(e) => handleSettingsChange('autoSaveInterval', parseInt(e.target.value) || 30)}
                    min="10"
                    max="300"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    فترة حفظ البيانات تلقائياً (10-300 ثانية)
                  </p>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="max-retries">عدد المحاولات عند الفشل</Label>
                  <Input
                    id="max-retries"
                    type="number"
                    value={globalSettings.maxRetries}
                    onChange={(e) => handleSettingsChange('maxRetries', parseInt(e.target.value) || 3)}
                    min="1"
                    max="10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    عدد مرات إعادة المحاولة عند فشل الترجمة (1-10)
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="cost-tracking">تتبع التكلفة</Label>
                    <p className="text-xs text-muted-foreground">
                      عرض تكلفة الترجمة المقدرة
                    </p>
                  </div>
                  <Switch
                    id="cost-tracking"
                    checked={globalSettings.enableCostTracking}
                    onCheckedChange={(checked) => handleSettingsChange('enableCostTracking', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-backup">النسخ الاحتياطي التلقائي</Label>
                    <p className="text-xs text-muted-foreground">
                      إنشاء نسخ احتياطية تلقائية من البيانات
                    </p>
                  </div>
                  <Switch
                    id="auto-backup"
                    checked={globalSettings.enableAutoBackup}
                    onCheckedChange={(checked) => handleSettingsChange('enableAutoBackup', checked)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={handleSaveGlobalSettings}
                  disabled={saveGlobalSettingsMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {saveGlobalSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4 ml-2" />
                      حفظ الإعدادات
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>الإعدادات المتقدمة</CardTitle>
              <CardDescription>
                خيارات متقدمة لتحسين أداء النظام
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>تتبع التكاليف</Label>
                    <p className="text-xs text-muted-foreground">
                      تسجيل تلقائي لتكاليف استخدام الذكاء الاصطناعي
                    </p>
                  </div>
                  <Switch
                    checked={globalSettings.enableCostTracking}
                    onCheckedChange={(checked) => handleSettingsChange('enableCostTracking', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>النسخ الاحتياطي التلقائي</Label>
                    <p className="text-xs text-muted-foreground">
                      حفظ تلقائي للمشاريع كل فترة زمنية محددة
                    </p>
                  </div>
                  <Switch
                    checked={globalSettings.enableAutoBackup}
                    onCheckedChange={(checked) => handleSettingsChange('enableAutoBackup', checked)}
                  />
                </div>

                <Separator />

                <div>
                  <Label htmlFor="auto-save">فترة الحفظ التلقائي (ثانية)</Label>
                  <Input
                    id="auto-save"
                    type="number"
                    min="10"
                    max="300"
                    value={globalSettings.autoSaveInterval}
                    onChange={(e) => handleSettingsChange('autoSaveInterval', parseInt(e.target.value))}
                  />
                </div>

                <div>
                  <Label htmlFor="max-retries">عدد المحاولات عند الفشل</Label>
                  <Input
                    id="max-retries"
                    type="number"
                    min="1"
                    max="10"
                    value={globalSettings.maxRetries}
                    onChange={(e) => handleSettingsChange('maxRetries', parseInt(e.target.value))}
                  />
                </div>


              </div>

              <Separator />

              <div className="flex justify-end gap-3">
                <Button variant="outline">
                  إعادة تعيين
                </Button>
                <Button>
                  حفظ الإعدادات
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}