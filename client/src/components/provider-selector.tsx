import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, Brain, Sparkles, MessageSquare, Code, Globe } from 'lucide-react';

interface ProviderSelectorProps {
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    icon: <Globe className="h-4 w-4" />,
    color: 'bg-blue-500',
    models: {
      'gemini-1.5-pro': {
        name: 'Gemini 1.5 Pro',
        batchSize: 100,
        speed: 'بطيء',
        quality: 'عالي جداً',
        cost: '$$$'
      },
      'gemini-1.5-flash': {
        name: 'Gemini 1.5 Flash',
        batchSize: 100,
        speed: 'سريع جداً',
        quality: 'عالي',
        cost: '$'
      },
      'gemini-1.0-pro': {
        name: 'Gemini 1.0 Pro',
        batchSize: 75,
        speed: 'متوسط',
        quality: 'عالي',
        cost: '$$'
      }
    }
  },
  openai: {
    name: 'OpenAI GPT',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'bg-green-500',
    models: {
      'gpt-4o': {
        name: 'GPT-4o',
        batchSize: 50,
        speed: 'بطيء',
        quality: 'ممتاز',
        cost: '$$$$'
      },
      'gpt-4o-mini': {
        name: 'GPT-4o Mini',
        batchSize: 75,
        speed: 'سريع',
        quality: 'عالي',
        cost: '$$'
      },
      'gpt-4-turbo': {
        name: 'GPT-4 Turbo',
        batchSize: 40,
        speed: 'بطيء جداً',
        quality: 'ممتاز',
        cost: '$$$$$'
      }
    }
  },
  deepseek: {
    name: 'DeepSeek AI',
    icon: <Brain className="h-4 w-4" />,
    color: 'bg-purple-500',
    models: {
      'deepseek-chat': {
        name: 'DeepSeek Chat',
        batchSize: 80,
        speed: 'سريع',
        quality: 'عالي',
        cost: '$'
      },
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        batchSize: 60,
        speed: 'متوسط',
        quality: 'عالي جداً',
        cost: '$'
      }
    }
  }
};

export default function ProviderSelector({ 
  selectedProvider, 
  selectedModel, 
  onProviderChange,
  disabled = false 
}: ProviderSelectorProps) {
  const [currentProvider, setCurrentProvider] = useState(selectedProvider);
  const [currentModel, setCurrentModel] = useState(selectedModel);

  const handleProviderSelect = (provider: string) => {
    setCurrentProvider(provider);
    const firstModel = Object.keys(PROVIDER_INFO[provider as keyof typeof PROVIDER_INFO].models)[0];
    setCurrentModel(firstModel);
    onProviderChange(provider, firstModel);
  };

  const handleModelSelect = (model: string) => {
    setCurrentModel(model);
    onProviderChange(currentProvider, model);
  };

  const currentProviderInfo = PROVIDER_INFO[currentProvider as keyof typeof PROVIDER_INFO];
  const currentModelInfo = currentProviderInfo?.models[currentModel as keyof typeof currentProviderInfo.models];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          اختيار نموذج الذكاء الاصطناعي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(PROVIDER_INFO).map(([key, info]) => (
            <Button
              key={key}
              variant={currentProvider === key ? "default" : "outline"}
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => handleProviderSelect(key)}
              disabled={disabled}
            >
              <div className={`p-2 rounded-full ${info.color} text-white`}>
                {info.icon}
              </div>
              <span className="text-sm font-medium">{info.name}</span>
            </Button>
          ))}
        </div>

        {/* Model Selection */}
        {currentProviderInfo && (
          <div className="space-y-3">
            <label className="text-sm font-medium">اختيار النموذج:</label>
            <Select value={currentModel} onValueChange={handleModelSelect} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="اختر النموذج" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(currentProviderInfo.models).map(([key, model]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center justify-between w-full">
                      <span>{model.name}</span>
                      <div className="flex gap-1 mr-2">
                        <Badge variant="secondary" className="text-xs">
                          {model.batchSize} دفعة
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {model.speed}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Model Details */}
            {currentModelInfo && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">{currentModelInfo.name}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">حجم الدفعة:</span>
                      <Badge variant="secondary">{currentModelInfo.batchSize} عنصر</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">السرعة:</span>
                      <Badge variant="outline">{currentModelInfo.speed}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">الجودة:</span>
                      <Badge variant="default">{currentModelInfo.quality}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">التكلفة:</span>
                      <Badge variant="destructive">{currentModelInfo.cost}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-2 border-t">
          <span>النماذج المتاحة: {Object.keys(PROVIDER_INFO).length}</span>
          <span>دعم الترجمة الدفعية: 100 عنصر</span>
        </div>
      </CardContent>
    </Card>
  );
}