import { supabase } from "./supabase";
import type { InsertSystemLog, SystemLog } from "@shared/schema";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'database' | 'api' | 'translation' | 'project' | 'ai-cost';
  message: string;
  details?: any;
  projectId?: number;
  projectName?: string;
  endpoint?: string;
  statusCode?: number;
  // AI Cost tracking fields
  aiModel?: string;
  aiProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  currency?: string;
  duration?: number;
}

class SystemLogger {
  private logs: LogEntry[] = [];
  private maxMemoryLogs = 100; // Keep fewer in memory since we store in DB

  async addLog(logData: Omit<LogEntry, 'id' | 'timestamp'>) {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newLog: LogEntry = {
      id: logId,
      timestamp: new Date(),
      ...logData
    };

    // Add to memory for quick access
    this.logs.unshift(newLog);
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs = this.logs.slice(0, this.maxMemoryLogs);
    }

    // Also log to console for debugging
    console.log(`[${newLog.level.toUpperCase()}] ${newLog.category}: ${newLog.message}`, newLog.details || '');

    // Save to database asynchronously
    try {
      await this.saveToDatabase(newLog);
    } catch (error) {
      console.error('Failed to save log to database:', error);
      // Continue execution even if DB save fails
    }
  }

  private async saveToDatabase(logEntry: LogEntry) {
    const dbLog: any = {
      log_id: logEntry.id,
      level: logEntry.level,
      category: logEntry.category,
      message: logEntry.message,
      details: logEntry.details,
      project_id: logEntry.projectId,
      project_name: logEntry.projectName,
      endpoint: logEntry.endpoint,
      status_code: logEntry.statusCode,
      ai_model: logEntry.aiModel,
      ai_provider: logEntry.aiProvider,
      input_tokens: logEntry.inputTokens,
      output_tokens: logEntry.outputTokens,
      total_tokens: logEntry.totalTokens,
      estimated_cost: logEntry.estimatedCost ? logEntry.estimatedCost.toString() : null,
      currency: logEntry.currency,
      duration: logEntry.duration,
      timestamp: new Date().toISOString()
    };

    await supabase.from('system_logs').insert(dbLog);
  }

  // Get logs from database with pagination and filtering
  async getLogsFromDB(options: {
    limit?: number;
    offset?: number;
    level?: string;
    category?: string;
    projectId?: number;
  } = {}): Promise<SystemLog[]> {
    try {
      const { limit = 50, offset = 0, level, category, projectId } = options;

      let query = supabase
        .from('system_logs')
        .select('*');

      if (level && level !== 'all') {
        query = query.eq('level', level);
      }
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Failed to fetch logs from database:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch logs from database:', error);
      return [];
    }
  }

  // Get stats from database
  async getStatsFromDB() {
    try {
      const { count: total, error: totalError } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true });

      const { count: errors, error: errorsError } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'error');

      const { count: warnings, error: warningsError } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'warning');

      const { count: success, error: successError } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'success');

      const { count: info, error: infoError } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('level', 'info');

      return {
        total: total || 0,
        errors: errors || 0,
        warnings: warnings || 0,
        success: success || 0,
        info: info || 0
      };
    } catch (error) {
      console.error('Failed to get stats from database:', error);
      return {
        total: 0,
        errors: 0,
        warnings: 0,
        success: 0,
        info: 0
      };
    }
  }

  // Memory-based methods for backward compatibility
  getLogs(limit?: number): LogEntry[] {
    return limit ? this.logs.slice(0, limit) : this.logs;
  }

  getLogsByLevel(level: string): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  async clearAllLogs() {
    try {
      await supabase.from('system_logs').delete().neq('id', 0);
      this.logs = [];
      console.log('All logs cleared from database and memory');
    } catch (error) {
      console.error('Failed to clear logs from database:', error);
    }
  }

  getStats() {
    const last24h = this.logs.filter(log => 
      (Date.now() - log.timestamp.getTime()) < 24 * 60 * 60 * 1000
    );

    return {
      total: last24h.length,
      errors: last24h.filter(log => log.level === 'error').length,
      warnings: last24h.filter(log => log.level === 'warning').length,
      success: last24h.filter(log => log.level === 'success').length,
      info: last24h.filter(log => log.level === 'info').length
    };
  }
}

export const logger = new SystemLogger();

// Helper function for AI cost logging
export const logAIUsage = (
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  duration: number,
  success: boolean,
  projectId?: number,
  projectName?: string,
  errorMessage?: string
) => {
  logger.addLog({
    level: success ? 'success' : 'error',
    category: 'ai-cost',
    message: success 
      ? `${provider} ${model}: ${inputTokens + outputTokens} tokens, $${cost.toFixed(4)}`
      : `${provider} ${model} failed: ${errorMessage}`,
    aiModel: model,
    aiProvider: provider,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost: cost,
    currency: 'USD',
    duration,
    projectId,
    projectName,
    details: { success, errorMessage }
  });
};

// Helper functions for common logging scenarios
export const logError = (category: LogEntry['category'], message: string, details?: any, projectId?: number) => {
  logger.addLog({ level: 'error', category, message, details, projectId });
};

export const logSuccess = (category: LogEntry['category'], message: string, details?: any, projectId?: number) => {
  logger.addLog({ level: 'success', category, message, details, projectId });
};

export const logWarning = (category: LogEntry['category'], message: string, details?: any, projectId?: number) => {
  logger.addLog({ level: 'warning', category, message, details, projectId });
};

export const logInfo = (category: LogEntry['category'], message: string, details?: any, projectId?: number) => {
  logger.addLog({ level: 'info', category, message, details, projectId });
};

// Express middleware for automatic API logging
export const apiLoggingMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    if (statusCode >= 400) {
      logError('api', `${req.method} ${req.path} failed`, {
        statusCode,
        duration,
        body: req.body,
        response: data
      });
    } else if (statusCode >= 300) {
      logWarning('api', `${req.method} ${req.path} redirected`, {
        statusCode,
        duration
      });
    } else {
      logInfo('api', `${req.method} ${req.path} succeeded`, {
        statusCode,
        duration
      });
    }

    return originalSend.call(this, data);
  };

  next();
};