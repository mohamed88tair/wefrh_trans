// Enhanced Multi-Provider Translation System
// Supporting Gemini, OpenAI GPT, DeepSeek, Anthropic, and xAI models

export interface ModelConfig {
  batchSize: number;
  maxConcurrent: number;
  delayBetweenBatches: number;
  temperature: number;
  maxTokens: number;
  description: string;
  costPerToken?: {
    input: number;
    output: number;
  };
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  models: Record<string, ModelConfig>;
  apiEndpoint: string;
  supportsStreaming: boolean;
}

// Comprehensive provider configurations optimized for batch translation
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    supportsStreaming: false,
    models: {
      'gemini-1.5-pro': {
        batchSize: 100,
        maxConcurrent: 2,
        delayBetweenBatches: 3000,
        temperature: 0.1,
        maxTokens: 2048,
        description: 'High accuracy model for complex translations',
        costPerToken: { input: 0.00125, output: 0.005 }
      },
      'gemini-1.5-flash': {
        batchSize: 100,
        maxConcurrent: 3,
        delayBetweenBatches: 1500,
        temperature: 0.2,
        maxTokens: 1024,
        description: 'Fast processing optimized for speed',
        costPerToken: { input: 0.000075, output: 0.0003 }
      },
      'gemini-1.0-pro': {
        batchSize: 75,
        maxConcurrent: 2,
        delayBetweenBatches: 2500,
        temperature: 0.15,
        maxTokens: 1536,
        description: 'Balanced performance and accuracy',
        costPerToken: { input: 0.0005, output: 0.0015 }
      }
    }
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI GPT',
    apiEndpoint: 'https://api.openai.com/v1',
    supportsStreaming: true,
    models: {
      'gpt-4o': {
        batchSize: 50,
        maxConcurrent: 1,
        delayBetweenBatches: 4000,
        temperature: 0.1,
        maxTokens: 2048,
        description: 'Most capable GPT model for high quality translations',
        costPerToken: { input: 0.005, output: 0.015 }
      },
      'gpt-4o-mini': {
        batchSize: 75,
        maxConcurrent: 2,
        delayBetweenBatches: 2000,
        temperature: 0.15,
        maxTokens: 1024,
        description: 'Efficient GPT model for fast translations',
        costPerToken: { input: 0.00015, output: 0.0006 }
      },
      'gpt-4-turbo': {
        batchSize: 40,
        maxConcurrent: 1,
        delayBetweenBatches: 5000,
        temperature: 0.1,
        maxTokens: 2048,
        description: 'Advanced GPT-4 for complex translations',
        costPerToken: { input: 0.01, output: 0.03 }
      }
    }
  },
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek AI',
    apiEndpoint: 'https://api.deepseek.com/v1',
    supportsStreaming: true,
    models: {
      'deepseek-chat': {
        batchSize: 80,
        maxConcurrent: 2,
        delayBetweenBatches: 2000,
        temperature: 0.2,
        maxTokens: 1024,
        description: 'DeepSeek chat model for conversational translations',
        costPerToken: { input: 0.00014, output: 0.00028 }
      },
      'deepseek-coder': {
        batchSize: 60,
        maxConcurrent: 2,
        delayBetweenBatches: 2500,
        temperature: 0.15,
        maxTokens: 1536,
        description: 'DeepSeek coder model for technical translations',
        costPerToken: { input: 0.00014, output: 0.00028 }
      }
    }
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic Claude',
    apiEndpoint: 'https://api.anthropic.com/v1',
    supportsStreaming: true,
    models: {
      'claude-3-5-sonnet-20241022': {
        batchSize: 45,
        maxConcurrent: 1,
        delayBetweenBatches: 3500,
        temperature: 0.1,
        maxTokens: 1536,
        description: 'Advanced Claude model for nuanced translations',
        costPerToken: { input: 0.003, output: 0.015 }
      },
      'claude-3-5-haiku-20241022': {
        batchSize: 70,
        maxConcurrent: 2,
        delayBetweenBatches: 2000,
        temperature: 0.2,
        maxTokens: 1024,
        description: 'Fast Claude model for efficient translations',
        costPerToken: { input: 0.00025, output: 0.00125 }
      }
    }
  },
  xai: {
    name: 'xai',
    displayName: 'xAI Grok',
    apiEndpoint: 'https://api.x.ai/v1',
    supportsStreaming: true,
    models: {
      'grok-2-1212': {
        batchSize: 55,
        maxConcurrent: 1,
        delayBetweenBatches: 3000,
        temperature: 0.15,
        maxTokens: 1536,
        description: 'Latest Grok model for intelligent translations',
        costPerToken: { input: 0.002, output: 0.01 }
      },
      'grok-2-vision-1212': {
        batchSize: 35,
        maxConcurrent: 1,
        delayBetweenBatches: 4000,
        temperature: 0.1,
        maxTokens: 1024,
        description: 'Grok vision model for context-aware translations',
        costPerToken: { input: 0.002, output: 0.01 }
      }
    }
  }
};

// Enhanced model configuration getter with fallback logic
export const getModelConfig = (provider: string, model: string): ModelConfig => {
  const providerConfig = PROVIDER_CONFIGS[provider];
  if (!providerConfig) {
    console.warn(`Provider ${provider} not found, using Gemini Flash as fallback`);
    return PROVIDER_CONFIGS.gemini.models['gemini-1.5-flash'];
  }
  
  const modelConfig = providerConfig.models[model];
  if (!modelConfig) {
    console.warn(`Model ${model} not found for provider ${provider}, using first available model`);
    const firstModel = Object.values(providerConfig.models)[0];
    return firstModel || PROVIDER_CONFIGS.gemini.models['gemini-1.5-flash'];
  }
  
  return modelConfig;
};

// Get all available models for a provider
export const getProviderModels = (provider: string): string[] => {
  const providerConfig = PROVIDER_CONFIGS[provider];
  return providerConfig ? Object.keys(providerConfig.models) : [];
};

// Get all available providers
export const getAllProviders = (): ProviderConfig[] => {
  return Object.values(PROVIDER_CONFIGS);
};

// Calculate optimal batch size based on model and content complexity
export const calculateOptimalBatchSize = (
  provider: string, 
  model: string, 
  totalItems: number,
  avgTextLength: number = 50
): number => {
  const config = getModelConfig(provider, model);
  let optimalSize = config.batchSize;
  
  // Adjust based on text complexity
  if (avgTextLength > 200) {
    optimalSize = Math.floor(optimalSize * 0.7);
  } else if (avgTextLength < 20) {
    optimalSize = Math.floor(optimalSize * 1.3);
  }
  
  // Ensure we don't exceed reasonable limits
  return Math.min(Math.max(optimalSize, 10), Math.min(totalItems, 150));
};

// Enhanced delay calculation with adaptive logic
export const getOptimalDelay = (
  provider: string, 
  model: string, 
  batchSize: number,
  previousDuration?: number,
  errorCount: number = 0
): number => {
  const config = getModelConfig(provider, model);
  let baseDelay = config.delayBetweenBatches;
  
  // Adaptive delay based on previous performance
  if (previousDuration) {
    if (previousDuration > 30000) { // If previous batch took > 30s
      baseDelay *= 1.5;
    } else if (previousDuration < 5000) { // If previous batch was very fast
      baseDelay *= 0.8;
    }
  }
  
  // Exponential backoff for errors
  if (errorCount > 0) {
    baseDelay *= Math.pow(2, Math.min(errorCount, 5));
  }
  
  // Provider-specific adjustments
  switch (provider) {
    case 'gemini':
      if (model === 'gemini-1.5-pro') {
        baseDelay += 1000; // Extra delay for Pro model stability
      }
      break;
    case 'openai':
      if (model.includes('gpt-4')) {
        baseDelay += 500; // GPT-4 models need slightly more time
      }
      break;
    case 'deepseek':
      baseDelay *= 0.9; // DeepSeek generally handles load well
      break;
  }
  
  return Math.min(baseDelay, 30000); // Cap at 30 seconds
};

export default {
  PROVIDER_CONFIGS,
  getModelConfig,
  getProviderModels,
  getAllProviders,
  calculateOptimalBatchSize,
  getOptimalDelay
};