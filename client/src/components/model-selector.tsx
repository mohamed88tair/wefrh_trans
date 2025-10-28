import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

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

const PROVIDER_ICONS: Record<string, string> = {
  google: 'fab fa-google',
  openai: 'fas fa-brain',
  anthropic: 'fas fa-robot',
  xai: 'fab fa-x-twitter',
  deepseek: 'fas fa-microchip'
};

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google AI',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  xai: 'xAI (Grok)',
  deepseek: 'DeepSeek'
};

export function ModelSelector({ value, onValueChange, placeholder = "اختر نموذج", className }: ModelSelectorProps) {
  const { data: models = [] } = useQuery({
    queryKey: ['/api/models'],
    queryFn: async () => {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      return response.json();
    }
  });

  // Group models by provider
  const groupedModels = models.reduce((acc: Record<string, ModelInfo[]>, model: ModelInfo) => {
    if (model.isActive) {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
    }
    return acc;
  }, {});

  const formatCost = (cost: number) => {
    if (cost === 0) return 'مجاني';
    if (cost < 0.001) return `$${(cost * 1000000).toFixed(2)}/1M`;
    if (cost < 1) return `$${(cost * 1000).toFixed(2)}/1K`;
    return `$${cost.toFixed(2)}/1K`;
  };

  const selectedModel = models.find((model: ModelInfo) => model.id === value);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedModel && (
            <div className="flex items-center gap-2">
              <i className={`${PROVIDER_ICONS[selectedModel.provider] || 'fas fa-server'} text-sm`}></i>
              <span>{selectedModel.name}</span>
              <Badge variant="outline" className="text-xs">
                {formatCost(selectedModel.inputCost)}
              </Badge>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-80">
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <div key={provider}>
            {/* Provider Header */}
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-600">
              <i className={`${PROVIDER_ICONS[provider] || 'fas fa-server'} text-xs`}></i>
              {PROVIDER_NAMES[provider] || provider}
            </div>
            
            {/* Provider Models */}
            {(providerModels as ModelInfo[]).map((model: ModelInfo) => (
              <SelectItem key={model.id} value={model.id} className="cursor-pointer">
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      <div className="flex gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {formatCost(model.inputCost)}
                        </Badge>
                        {model.capabilities.includes('image') && (
                          <Badge variant="outline" className="text-xs">
                            صور
                          </Badge>
                        )}
                      </div>
                    </div>
                    {model.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {model.description}
                      </div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
            
            <Separator className="my-1" />
          </div>
        ))}
        
        {/* Empty State */}
        {Object.keys(groupedModels).length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            لا توجد نماذج متاحة. انتقل إلى صفحة النماذج لاستيراد النماذج.
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

export default ModelSelector;