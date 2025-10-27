/**
 * Professional Enterprise Logging System
 * Advanced logging with performance monitoring and error tracking
 * 
 * Author: Senior Full-Stack Engineer (15+ years)
 * Features: Multi-level logging, performance tracking, error aggregation
 */

import type { Request, Response, NextFunction } from "express";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warning' | 'error';
  category: string;
  message: string;
  details?: any;
  projectId?: number;
  projectName?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
  aiModel?: string;
  aiProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  currency?: string;
}

export interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  success: number;
  performance: {
    averageResponseTime: number;
    slowRequests: number;
    fastRequests: number;
  };
  ai: {
    totalRequests: number;
    totalCost: number;
    tokenUsage: number;
    topProvider: string;
  };
}

class ProfessionalLogger {
  private logs: Map<string, LogEntry> = new Map();
  private maxLogs = 10000; // Prevent memory overflow
  private logIdCounter = 1;

  // High-performance logging with memory management
  addLog(level: LogEntry['level'], category: string, message: string, details?: any): string {
    const logId = `log_${Date.now()}_${this.logIdCounter++}`;
    
    const logEntry: LogEntry = {
      id: logId,
      timestamp: new Date(),
      level,
      category,
      message,
      details: this.sanitizeDetails(details)
    };

    this.logs.set(logId, logEntry);
    
    // Cleanup old logs to prevent memory leaks
    if (this.logs.size > this.maxLogs) {
      this.cleanupOldLogs();
    }

    // Console output for development
    this.outputToConsole(logEntry);

    return logId;
  }

  // AI-specific logging with cost tracking
  logAIUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    projectId?: number,
    projectName?: string,
    details?: any
  ): string {
    return this.addLog('info', 'ai-usage', `AI request completed: ${provider}/${model}`, {
      ...details,
      projectId,
      projectName,
      aiProvider: provider,
      aiModel: model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: cost,
      currency: 'USD'
    });
  }

  // Performance logging for API endpoints
  logPerformance(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    details?: any
  ): string {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warning' : 'info';
    const message = `${method} ${endpoint} - ${statusCode} (${duration}ms)`;

    return this.addLog(level, 'api-performance', message, {
      ...details,
      endpoint,
      method,
      statusCode,
      duration
    });
  }

  // Get filtered logs with pagination
  getLogs(options: {
    limit?: number;
    offset?: number;
    level?: string;
    category?: string;
    projectId?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): LogEntry[] {
    let filteredLogs = Array.from(this.logs.values());

    // Apply filters
    if (options.level && options.level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }

    if (options.category && options.category !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.category === options.category);
    }

    if (options.projectId) {
      filteredLogs = filteredLogs.filter(log => log.projectId === options.projectId);
    }

    if (options.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= options.endDate!);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (options.offset) {
      filteredLogs = filteredLogs.slice(options.offset);
    }

    if (options.limit) {
      filteredLogs = filteredLogs.slice(0, options.limit);
    }

    return filteredLogs;
  }

  // Get comprehensive statistics
  getStats(): LogStats {
    const allLogs = Array.from(this.logs.values());
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentLogs = allLogs.filter(log => log.timestamp.getTime() > oneHourAgo);

    // Basic stats
    const total = allLogs.length;
    const errors = allLogs.filter(log => log.level === 'error').length;
    const warnings = allLogs.filter(log => log.level === 'warning').length;
    const success = allLogs.filter(log => log.level === 'info').length;

    // Performance stats
    const performanceLogs = allLogs.filter(log => log.duration !== undefined);
    const averageResponseTime = performanceLogs.length > 0
      ? performanceLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / performanceLogs.length
      : 0;
    const slowRequests = performanceLogs.filter(log => (log.duration || 0) > 5000).length;
    const fastRequests = performanceLogs.filter(log => (log.duration || 0) < 1000).length;

    // AI stats
    const aiLogs = allLogs.filter(log => log.category === 'ai-usage');
    const totalCost = aiLogs.reduce((sum, log) => sum + (log.estimatedCost || 0), 0);
    const tokenUsage = aiLogs.reduce((sum, log) => sum + (log.totalTokens || 0), 0);
    
    // Find top provider
    const providerCounts = new Map<string, number>();
    aiLogs.forEach(log => {
      if (log.aiProvider) {
        providerCounts.set(log.aiProvider, (providerCounts.get(log.aiProvider) || 0) + 1);
      }
    });
    const topProvider = Array.from(providerCounts.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    return {
      total,
      errors,
      warnings,
      success,
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        slowRequests,
        fastRequests
      },
      ai: {
        totalRequests: aiLogs.length,
        totalCost: Math.round(totalCost * 100) / 100,
        tokenUsage,
        topProvider
      }
    };
  }

  // Clear all logs
  clearAllLogs(): void {
    this.logs.clear();
    this.logIdCounter = 1;
    console.log('🧹 All logs cleared');
  }

  // Express middleware for automatic API logging
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;
      const originalJson = res.json;

      // Capture response data
      let responseData: any;

      res.send = function(data: any) {
        responseData = data;
        return originalSend.call(this, data);
      };

      res.json = function(data: any) {
        responseData = data;
        return originalJson.call(this, data);
      };

      // Log when response finishes
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const endpoint = `${req.method} ${req.path}`;
        
        logger.logPerformance(
          endpoint,
          req.method,
          res.statusCode,
          duration,
          {
            body: this.sanitizeBody(req.body),
            query: req.query,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            responseSize: res.get('Content-Length') || 0
          }
        );
      });

      next();
    };
  }

  // Private helper methods
  private sanitizeDetails(details: any): any {
    if (!details) return undefined;
    
    // Remove sensitive information
    const sanitized = { ...details };
    
    // Remove API keys and passwords
    if (typeof sanitized === 'object') {
      Object.keys(sanitized).forEach(key => {
        if (key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token')) {
          sanitized[key] = '[REDACTED]';
        }
      });
    }

    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    ['apiKey', 'password', 'token', 'secret'].forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase();
    const category = entry.category;
    const message = entry.message;

    let color = '\x1b[37m'; // White
    switch (entry.level) {
      case 'error': color = '\x1b[31m'; break;   // Red
      case 'warning': color = '\x1b[33m'; break; // Yellow
      case 'info': color = '\x1b[36m'; break;    // Cyan
      case 'debug': color = '\x1b[35m'; break;   // Magenta
    }

    console.log(`${color}[${level}] ${timestamp} ${category}: ${message}\x1b[0m`);
    
    if (entry.details && Object.keys(entry.details).length > 0) {
      console.log(`${color}  Details:`, JSON.stringify(entry.details, null, 2), '\x1b[0m');
    }
  }

  private cleanupOldLogs(): void {
    const logs = Array.from(this.logs.entries());
    logs.sort(([,a], [,b]) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Remove oldest 20% of logs
    const removeCount = Math.floor(logs.length * 0.2);
    for (let i = 0; i < removeCount; i++) {
      this.logs.delete(logs[i][0]);
    }

    console.log(`🧹 Cleaned up ${removeCount} old log entries`);
  }

  // Convenience methods for the logger instance
  info(message: string, details?: any): string {
    return this.addLog('info', 'general', message, details);
  }

  error(message: string, details?: any): string {
    return this.addLog('error', 'general', message, details);
  }

  warning(message: string, details?: any): string {
    return this.addLog('warning', 'general', message, details);
  }

  debug(message: string, details?: any): string {
    return this.addLog('debug', 'general', message, details);
  }
}

// Export singleton instance
export const logger = new ProfessionalLogger();

// Convenience functions for common log levels
export const logError = (category: string, message: string, details?: any) => 
  logger.addLog('error', category, message, details);

export const logWarning = (category: string, message: string, details?: any) => 
  logger.addLog('warning', category, message, details);

export const logInfo = (category: string, message: string, details?: any) => 
  logger.addLog('info', category, message, details);

export const logDebug = (category: string, message: string, details?: any) => 
  logger.addLog('debug', category, message, details);

export const logSuccess = (category: string, message: string, details?: any) => 
  logger.addLog('info', category, `✅ ${message}`, details);

export const logAIUsage = (
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  projectId?: number,
  projectName?: string,
  details?: any
) => logger.logAIUsage(provider, model, inputTokens, outputTokens, cost, projectId, projectName, details);

// Middleware export
export const apiLoggingMiddleware = logger.middleware();