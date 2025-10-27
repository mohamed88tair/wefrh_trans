import { db } from "./db";
import { systemLogs, type InsertSystemLog } from "@shared/schema";
import { eq, desc, count, and } from "drizzle-orm";

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
    const dbLog: InsertSystemLog = {
      logId: logEntry.id,
      level: logEntry.level,
      category: logEntry.category,
      message: logEntry.message,
      details: logEntry.details,
      projectId: logEntry.projectId,
      projectName: logEntry.projectName,
      endpoint: logEntry.endpoint,
      statusCode: logEntry.statusCode,
      aiModel: logEntry.aiModel,
      aiProvider: logEntry.aiProvider,
      inputTokens: logEntry.inputTokens,
      outputTokens: logEntry.outputTokens,
      totalTokens: logEntry.totalTokens,
      estimatedCost: logEntry.estimatedCost ? logEntry.estimatedCost.toString() : null,
      currency: logEntry.currency,
      duration: logEntry.duration,
    };

    await db.insert(systemLogs).values(dbLog);
  }

  // Get logs from database with pagination and filtering
  async getLogsFromDB(options: {
    limit?: number;
    offset?: number;
    level?: string;
    category?: string;
    projectId?: number;
  } = {}) {
    try {
      const { limit = 50, offset = 0, level, category, projectId } = options;
      
      // Build query with proper typing
      const whereConditions: any[] = [];
      
      if (level && level !== 'all') {
        whereConditions.push(eq(systemLogs.level, level));
      }
      if (category && category !== 'all') {
        whereConditions.push(eq(systemLogs.category, category));
      }
      if (projectId) {
        whereConditions.push(eq(systemLogs.projectId, projectId));
      }
      
      let query = db.select().from(systemLogs);
      
      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions));
      }
      
      const logs = await query
        .orderBy(desc(systemLogs.timestamp))
        .limit(limit)
        .offset(offset);
        
      return logs;
    } catch (error) {
      console.error('Failed to fetch logs from database:', error);
      return [];
    }
  }

  // Get stats from database
  async getStatsFromDB() {
    try {
      const totalResult = await db.select({ count: count() }).from(systemLogs);
      const errorResult = await db.select({ count: count() }).from(systemLogs).where(eq(systemLogs.level, 'error'));
      const warningResult = await db.select({ count: count() }).from(systemLogs).where(eq(systemLogs.level, 'warning'));
      const successResult = await db.select({ count: count() }).from(systemLogs).where(eq(systemLogs.level, 'success'));
      const infoResult = await db.select({ count: count() }).from(systemLogs).where(eq(systemLogs.level, 'info'));

      return {
        total: totalResult[0]?.count || 0,
        errors: errorResult[0]?.count || 0,
        warnings: warningResult[0]?.count || 0,
        success: successResult[0]?.count || 0,
        info: infoResult[0]?.count || 0
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
      await db.delete(systemLogs);
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