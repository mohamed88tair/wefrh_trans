import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ApiSettings } from '@shared/schema';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiSettings: ApiSettings[];
  onCreateSettings: (settings: { provider: string; apiKey: string; model: string; isActive: boolean }) => void;
  onUpdateSettings: (data: { id: number; updates: Partial<ApiSettings> }) => void;
  onTestConnection: (provider: string, apiKey: string, model?: string) => Promise<boolean>;
}

export default function SettingsModal({
  open,
  onOpenChange,
  apiSettings,
  onCreateSettings,
  onUpdateSettings,
  onTestConnection,
}: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [batchSize, setBatchSize] = useState('25');
  const [requestDelay, setRequestDelay] = useState(1.0);
  const [enableMemoryOptimization, setEnableMemoryOptimization] = useState(true);
  const [createBackup, setCreateBackup] = useState(true);
  const [addComments, setAddComments] = useState(false);
  const [phpFormat, setPhpFormat] = useState('array');

  useEffect(() => {
    // Load existing settings
    const openaiSettings = apiSettings.find(s => s.provider === 'openai');
    const geminiSettings = apiSettings.find(s => s.provider === 'gemini');
    
    if (openaiSettings) {
      setOpenaiKey(openaiSettings.apiKey);
    }
    if (geminiSettings) {
      setGeminiKey(geminiSettings.apiKey);
    }
  }, [apiSettings]);

  const getConnectionStatus = (provider: string) => {
    const settings = apiSettings.find(s => s.provider === provider);
    return settings && settings.apiKey ? 'connected' : 'disconnected';
  };

  const handleTestConnection = async (provider: string) => {
    const apiKey = provider === 'openai' ? openaiKey : geminiKey;
    const model = provider === 'openai' ? 'gpt-3.5-turbo' : 'gemini-2.5-flash';
    
    if (!apiKey) {
      return;
    }

    return await onTestConnection(provider, apiKey, model);
  };

  const handleSaveSettings = () => {
    // Save OpenAI settings
    if (openaiKey) {
      const existingOpenAI = apiSettings.find(s => s.provider === 'openai');
      if (existingOpenAI) {
        onUpdateSettings({
          id: existingOpenAI.id,
          updates: { apiKey: openaiKey, isActive: selectedProvider === 'openai' }
        });
      } else {
        onCreateSettings({
          provider: 'openai',
          apiKey: openaiKey,
          model: 'gpt-3.5-turbo',
          isActive: selectedProvider === 'openai',
        });
      }
    }

    // Save Gemini settings
    if (geminiKey) {
      const existingGemini = apiSettings.find(s => s.provider === 'gemini');
      if (existingGemini) {
        onUpdateSettings({
          id: existingGemini.id,
          updates: { apiKey: geminiKey, isActive: selectedProvider === 'gemini' }
        });
      } else {
        onCreateSettings({
          provider: 'gemini',
          apiKey: geminiKey,
          model: selectedModel,
          isActive: selectedProvider === 'gemini',
        });
      }
    }

    onOpenChange(false);
  };

  const resetSettings = () => {
    setOpenaiKey('');
    setGeminiKey('');
    setSelectedProvider('gemini');
    setSelectedModel('gemini-2.5-flash');
    setBatchSize('25');
    setRequestDelay(1.0);
    setEnableMemoryOptimization(true);
    setCreateBackup(true);
    setAddComments(false);
    setPhpFormat('array');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <i className="fas fa-cog ml-2"></i>
            الإعدادات
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* API Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">إعدادات API</h3>
            
            {/* OpenAI Settings */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <i className="fas fa-robot text-primary text-lg ml-2"></i>
                  OpenAI
                  <Badge 
                    variant={getConnectionStatus('openai') === 'connected' ? 'default' : 'destructive'}
                    className="mr-auto"
                  >
                    {getConnectionStatus('openai') === 'connected' ? 'متصل' : 'غير متصل'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="openai-key">مفتاح API</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection('openai')}
                  disabled={!openaiKey}
                >
                  اختبار الاتصال
                </Button>
              </CardContent>
            </Card>
            
            {/* Gemini Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <i className="fas fa-gem text-purple-600 text-lg ml-2"></i>
                  Google Gemini
                  <Badge 
                    variant={getConnectionStatus('gemini') === 'connected' ? 'default' : 'destructive'}
                    className="mr-auto"
                  >
                    {getConnectionStatus('gemini') === 'connected' ? 'متصل' : 'غير متصل'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="gemini-key">مفتاح API</Label>
                  <Input
                    id="gemini-key"
                    type="password"
                    placeholder="AIza..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection('gemini')}
                  disabled={!geminiKey}
                >
                  اختبار الاتصال
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Performance Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">إعدادات الأداء</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="batch-size">حجم الدفعة</Label>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 (سريع)</SelectItem>
                    <SelectItem value="25">25 (متوسط)</SelectItem>
                    <SelectItem value="50">50 (بطيء)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">دفعات أصغر = سرعة أكبر لكن تكلفة أعلى</p>
              </div>
              
              <div>
                <Label htmlFor="request-delay">تأخير بين الطلبات (ثانية)</Label>
                <Input
                  id="request-delay"
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={requestDelay}
                  onChange={(e) => setRequestDelay(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.5</span>
                  <span>{requestDelay.toFixed(1)}</span>
                  <span>5.0</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="memory-optimization"
                  checked={enableMemoryOptimization}
                  onCheckedChange={setEnableMemoryOptimization}
                />
                <Label htmlFor="memory-optimization">تفعيل تحسين الذاكرة التلقائي</Label>
              </div>
            </div>
          </div>
          
          {/* Export Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">إعدادات التصدير</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="php-format">تنسيق ملف PHP</Label>
                <Select value={phpFormat} onValueChange={setPhpFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="array">مصفوفة PHP عادية</SelectItem>
                    <SelectItem value="laravel">تنسيق Laravel</SelectItem>
                    <SelectItem value="codeigniter">تنسيق CodeIgniter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="create-backup"
                  checked={createBackup}
                  onCheckedChange={setCreateBackup}
                />
                <Label htmlFor="create-backup">إنشاء نسخة احتياطية قبل الحفظ</Label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="add-comments"
                  checked={addComments}
                  onCheckedChange={setAddComments}
                />
                <Label htmlFor="add-comments">إضافة تعليقات للنصوص الأصلية</Label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 space-x-reverse pt-6 border-t">
          <Button variant="outline" onClick={resetSettings}>
            إعادة تعيين
          </Button>
          <Button onClick={handleSaveSettings}>
            حفظ الإعدادات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
