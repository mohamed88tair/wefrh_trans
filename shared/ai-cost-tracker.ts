// AI Cost and Usage Tracking
export interface AIModelPricing {
  provider: 'openai' | 'gemini' | 'xai' | 'anthropic' | 'deepseek';
  model: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  currency: 'USD';
  maxTokens: number;
  contextWindow: number;
}

export interface AIUsageRecord {
  id: string;
  timestamp: Date;
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
  duration: number; // milliseconds
  success: boolean;
  errorMessage?: string;
  requestType: 'single' | 'batch';
  batchSize?: number;
}

// Current AI model pricing (as of 2024)
export const AI_MODEL_PRICING: Record<string, AIModelPricing> = {
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    inputCostPer1kTokens: 0.005,
    outputCostPer1kTokens: 0.015,
    currency: 'USD',
    maxTokens: 4096,
    contextWindow: 128000
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPer1kTokens: 0.00015,
    outputCostPer1kTokens: 0.0006,
    currency: 'USD',
    maxTokens: 16384,
    contextWindow: 128000
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    inputCostPer1kTokens: 0.01,
    outputCostPer1kTokens: 0.03,
    currency: 'USD',
    maxTokens: 4096,
    contextWindow: 128000
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    inputCostPer1kTokens: 0.0005,
    outputCostPer1kTokens: 0.0015,
    currency: 'USD',
    maxTokens: 4096,
    contextWindow: 16385
  },
  'gemini-1.5-pro': {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    inputCostPer1kTokens: 0.00125,
    outputCostPer1kTokens: 0.005,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 2000000
  },
  'gemini-1.5-flash': {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    inputCostPer1kTokens: 0.000075,
    outputCostPer1kTokens: 0.0003,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 1000000
  },
  'gemini-1.5-flash-8b': {
    provider: 'gemini',
    model: 'gemini-1.5-flash-8b',
    inputCostPer1kTokens: 0.0000375,
    outputCostPer1kTokens: 0.00015,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 1000000
  },
  
  // x.ai Grok models
  'grok-2-1212': {
    provider: 'xai',
    model: 'grok-2-1212',
    inputCostPer1kTokens: 0.002,
    outputCostPer1kTokens: 0.01,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 131072
  },
  'grok-2-vision-1212': {
    provider: 'xai',
    model: 'grok-2-vision-1212',
    inputCostPer1kTokens: 0.002,
    outputCostPer1kTokens: 0.01,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 8192
  },
  'grok-beta': {
    provider: 'xai',
    model: 'grok-beta',
    inputCostPer1kTokens: 0.005,
    outputCostPer1kTokens: 0.015,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 131072
  },
  'grok-vision-beta': {
    provider: 'xai',
    model: 'grok-vision-beta',
    inputCostPer1kTokens: 0.005,
    outputCostPer1kTokens: 0.015,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 8192
  },

  // Anthropic Claude models
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 200000
  },
  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    inputCostPer1kTokens: 0.001,
    outputCostPer1kTokens: 0.005,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 200000
  },
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    inputCostPer1kTokens: 0.015,
    outputCostPer1kTokens: 0.075,
    currency: 'USD',
    maxTokens: 4096,
    contextWindow: 200000
  },
  'claude-3-sonnet-20240229': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    currency: 'USD',
    maxTokens: 4096,
    contextWindow: 200000
  },
  'claude-3-haiku-20240307': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    inputCostPer1kTokens: 0.00025,
    outputCostPer1kTokens: 0.00125,
    currency: 'USD',
    maxTokens: 4096,
    contextWindow: 200000
  },

  // DeepSeek models
  'deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    inputCostPer1kTokens: 0.00014,
    outputCostPer1kTokens: 0.00028,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 64000
  },
  'deepseek-coder': {
    provider: 'deepseek',
    model: 'deepseek-coder',
    inputCostPer1kTokens: 0.00014,
    outputCostPer1kTokens: 0.00028,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 64000
  },
  'deepseek-v3': {
    provider: 'deepseek',
    model: 'deepseek-v3',
    inputCostPer1kTokens: 0.00027,
    outputCostPer1kTokens: 0.0011,
    currency: 'USD',
    maxTokens: 8192,
    contextWindow: 64000
  }
};

export class AICostTracker {
  private usageRecords: AIUsageRecord[] = [];
  private maxRecords = 10000;

  addUsageRecord(record: Omit<AIUsageRecord, 'id' | 'timestamp'>) {
    const newRecord: AIUsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...record
    };

    this.usageRecords.unshift(newRecord);
    
    // Keep only the last maxRecords entries
    if (this.usageRecords.length > this.maxRecords) {
      this.usageRecords = this.usageRecords.slice(0, this.maxRecords);
    }
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): { inputCost: number; outputCost: number; totalCost: number } {
    const pricing = AI_MODEL_PRICING[model];
    if (!pricing) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 };
    }

    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1kTokens;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1kTokens;
    const totalCost = inputCost + outputCost;

    return { inputCost, outputCost, totalCost };
  }

  getUsageRecords(limit?: number): AIUsageRecord[] {
    return limit ? this.usageRecords.slice(0, limit) : this.usageRecords;
  }

  getDailyStats(date?: Date): {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    successRate: number;
    avgDuration: number;
    topModels: { model: string; usage: number; cost: number }[];
  } {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dayRecords = this.usageRecords.filter(record => 
      record.timestamp >= startOfDay && record.timestamp <= endOfDay
    );

    const totalCost = dayRecords.reduce((sum, record) => sum + record.totalCost, 0);
    const totalTokens = dayRecords.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalRequests = dayRecords.length;
    const successfulRequests = dayRecords.filter(record => record.success).length;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const avgDuration = totalRequests > 0 ? dayRecords.reduce((sum, record) => sum + record.duration, 0) / totalRequests : 0;

    // Top models by usage
    const modelStats = dayRecords.reduce((acc, record) => {
      if (!acc[record.model]) {
        acc[record.model] = { usage: 0, cost: 0 };
      }
      acc[record.model].usage += record.totalTokens;
      acc[record.model].cost += record.totalCost;
      return acc;
    }, {} as Record<string, { usage: number; cost: number }>);

    const topModels = Object.entries(modelStats)
      .map(([model, stats]) => ({ model, ...stats }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    return {
      totalCost,
      totalTokens,
      totalRequests,
      successRate,
      avgDuration,
      topModels
    };
  }

  getMonthlyStats(year: number, month: number): {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    dailyBreakdown: { date: string; cost: number; requests: number }[];
  } {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const monthRecords = this.usageRecords.filter(record => 
      record.timestamp >= startOfMonth && record.timestamp <= endOfMonth
    );

    const totalCost = monthRecords.reduce((sum, record) => sum + record.totalCost, 0);
    const totalTokens = monthRecords.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalRequests = monthRecords.length;

    // Daily breakdown
    const dailyStats = monthRecords.reduce((acc, record) => {
      const dateKey = record.timestamp.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { cost: 0, requests: 0 };
      }
      acc[dateKey].cost += record.totalCost;
      acc[dateKey].requests += 1;
      return acc;
    }, {} as Record<string, { cost: number; requests: number }>);

    const dailyBreakdown = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCost,
      totalTokens,
      totalRequests,
      dailyBreakdown
    };
  }

  getProjectStats(projectId: number): {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    modelBreakdown: { model: string; cost: number; tokens: number; requests: number }[];
  } {
    const projectRecords = this.usageRecords.filter(record => record.projectId === projectId);

    const totalCost = projectRecords.reduce((sum, record) => sum + record.totalCost, 0);
    const totalTokens = projectRecords.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalRequests = projectRecords.length;

    // Model breakdown
    const modelStats = projectRecords.reduce((acc, record) => {
      if (!acc[record.model]) {
        acc[record.model] = { cost: 0, tokens: 0, requests: 0 };
      }
      acc[record.model].cost += record.totalCost;
      acc[record.model].tokens += record.totalTokens;
      acc[record.model].requests += 1;
      return acc;
    }, {} as Record<string, { cost: number; tokens: number; requests: number }>);

    const modelBreakdown = Object.entries(modelStats)
      .map(([model, stats]) => ({ model, ...stats }))
      .sort((a, b) => b.cost - a.cost);

    return {
      totalCost,
      totalTokens,
      totalRequests,
      modelBreakdown
    };
  }

  clearRecords() {
    this.usageRecords = [];
  }

  exportData(): AIUsageRecord[] {
    return [...this.usageRecords];
  }
}

export const aiCostTracker = new AICostTracker();