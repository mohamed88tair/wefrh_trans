/**
 * Enterprise API Routes
 * Professional REST API with comprehensive error handling and validation
 * 
 * @author Senior API Architect (15+ years)
 * @version 3.0.0 Enterprise
 */

import { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { enterpriseApp } from '../application/enterprise-application';
import { logger } from '../logger-professional';
import { z } from 'zod';

// ==================== REQUEST/RESPONSE SCHEMAS ====================

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['php', 'laravel', 'generic', 'delivery']),
  sourceLanguage: z.string().min(2).max(10),
  targetLanguage: z.string().min(2).max(10),
  items: z.array(z.object({
    key: z.string().min(1),
    originalText: z.string().min(1),
    context: z.any().optional()
  })).optional()
});

const TranslateBatchSchema = z.object({
  projectId: z.number().positive(),
  provider: z.string().min(1),
  model: z.string().min(1),
  batchSize: z.number().positive().max(1000).optional(),
  delay: z.number().min(100).max(30000).optional(),
  maxRetries: z.number().min(1).max(10).optional()
});

const UpdateItemSchema = z.object({
  translatedText: z.string().optional(),
  status: z.enum(['pending', 'processing', 'translated', 'reviewed', 'approved', 'rejected', 'failed']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reviewStatus: z.enum(['not_reviewed', 'in_review', 'approved', 'needs_revision']).optional()
});

const TestProviderSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  testText: z.string().optional()
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const errorHandler = (error: any, req: Request, res: Response, next: any) => {
  logger.error('API Error', error, {
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query
  });

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details
    });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: error.errors
    });
  }

  // Generic error
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

// ==================== ASYNC HANDLER WRAPPER ====================

const asyncHandler = (fn: (req: Request, res: Response, next: any) => Promise<any>) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ==================== RESPONSE UTILITIES ====================

const sendSuccess = (res: Response, data: any, message?: string) => {
  res.json({
    success: true,
    message: message || 'Operation completed successfully',
    data
  });
};

const sendError = (res: Response, statusCode: number, message: string, code?: string, details?: any) => {
  res.status(statusCode).json({
    success: false,
    message,
    code,
    details
  });
};

// ==================== ROUTE HANDLERS ====================

export async function registerEnterpriseRoutes(app: Express): Promise<Server> {
  
  // Initialize application
  await enterpriseApp.initialize();
  const services = enterpriseApp.services;

  // ======================= HEALTH & MONITORING =======================

  app.get('/api/health', asyncHandler(async (req, res) => {
    const health = await enterpriseApp.getSystemHealth();
    
    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
  }));

  app.get('/api/metrics', asyncHandler(async (req, res) => {
    const projectStats = services.repositories.projects.getPerformanceStats();
    const itemStats = services.repositories.items.getPerformanceStats();
    
    sendSuccess(res, {
      repositories: {
        projects: projectStats,
        items: itemStats
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    });
  }));

  // ======================= PROJECT MANAGEMENT =======================

  app.get('/api/projects', asyncHandler(async (req, res) => {
    const { limit, offset, status } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);
    if (status) {
      options.filters = [{ field: 'status', operator: 'eq', value: status }];
    }

    const projects = status ? 
      await services.repositories.projects.findAll(options) :
      await services.projects.getAllProjects();

    logger.info('Projects retrieved', { 
      count: projects.length,
      filters: { status, limit, offset }
    });

    sendSuccess(res, projects, `Retrieved ${projects.length} projects`);
  }));

  app.post('/api/projects', asyncHandler(async (req, res) => {
    const validatedData = CreateProjectSchema.parse(req.body);
    
    const project = await services.projects.createProject(validatedData);
    
    logger.info('Project created via API', {
      projectId: project.id,
      name: project.name,
      itemCount: validatedData.items?.length || 0
    });

    sendSuccess(res, project, 'Project created successfully');
  }));

  app.get('/api/projects/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new ApiError(400, 'Invalid project ID', 'INVALID_ID');
    }

    const project = await services.projects.getProject(id);
    if (!project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    sendSuccess(res, project);
  }));

  app.put('/api/projects/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new ApiError(400, 'Invalid project ID', 'INVALID_ID');
    }

    const updates = req.body;
    const project = await services.repositories.projects.update(id, updates);

    logger.info('Project updated via API', {
      projectId: id,
      updates: Object.keys(updates)
    });

    sendSuccess(res, project, 'Project updated successfully');
  }));

  app.delete('/api/projects/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new ApiError(400, 'Invalid project ID', 'INVALID_ID');
    }

    await services.projects.deleteProject(id);

    logger.info('Project deleted via API', { projectId: id });

    sendSuccess(res, null, 'Project deleted successfully');
  }));

  // ======================= TRANSLATION ITEMS =======================

  app.get('/api/projects/:id/items', asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      throw new ApiError(400, 'Invalid project ID', 'INVALID_ID');
    }

    const { limit, offset, status } = req.query;

    const items = await services.projects.getProjectItems(
      projectId,
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );

    const filteredItems = status ? 
      items.filter(item => item.status === status) : 
      items;

    sendSuccess(res, filteredItems, `Retrieved ${filteredItems.length} items`);
  }));

  app.post('/api/projects/:id/items', asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      throw new ApiError(400, 'Invalid project ID', 'INVALID_ID');
    }

    const itemData = {
      ...req.body,
      projectId
    };

    const item = await services.repositories.items.create(itemData);

    logger.info('Translation item created via API', {
      projectId,
      itemId: item.id,
      key: item.key
    });

    sendSuccess(res, item, 'Translation item created successfully');
  }));

  app.put('/api/items/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new ApiError(400, 'Invalid item ID', 'INVALID_ID');
    }

    const validatedUpdates = UpdateItemSchema.parse(req.body);
    const item = await services.projects.updateProjectItem(id, validatedUpdates);

    logger.info('Translation item updated via API', {
      itemId: id,
      updates: Object.keys(validatedUpdates)
    });

    sendSuccess(res, item, 'Translation item updated successfully');
  }));

  app.delete('/api/items/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new ApiError(400, 'Invalid item ID', 'INVALID_ID');
    }

    await services.repositories.items.delete(id);

    logger.info('Translation item deleted via API', { itemId: id });

    sendSuccess(res, null, 'Translation item deleted successfully');
  }));

  // ======================= TRANSLATION SERVICES =======================

  app.post('/api/translate-batch', asyncHandler(async (req, res) => {
    const validatedData = TranslateBatchSchema.parse(req.body);
    
    const result = await services.projects.translateBatch(validatedData);

    logger.info('Batch translation completed via API', {
      projectId: validatedData.projectId,
      provider: validatedData.provider,
      successCount: result.results?.successfulItems || 0,
      batchId: result.batchId
    });

    sendSuccess(res, result, 'Batch translation completed');
  }));

  app.post('/api/translate-text', asyncHandler(async (req, res) => {
    const { text, provider, model, targetLanguage = 'Arabic' } = req.body;

    if (!text || !provider) {
      throw new ApiError(400, 'Text and provider are required', 'MISSING_FIELDS');
    }

    const result = await services.translation.translateText(text, {
      provider,
      model: model || 'default',
      targetLanguage
    });

    logger.info('Text translation completed via API', {
      provider,
      model,
      textLength: text.length,
      confidence: result.confidence
    });

    sendSuccess(res, {
      translatedText: result.translatedText,
      confidence: result.confidence,
      metadata: result.metadata
    }, 'Text translated successfully');
  }));

  app.post('/api/test-provider', asyncHandler(async (req, res) => {
    const validatedData = TestProviderSchema.parse(req.body);
    
    const result = await services.translation.testProvider(
      validatedData.provider,
      validatedData.apiKey
    );

    logger.info('Provider test completed via API', {
      provider: validatedData.provider,
      success: result.success
    });

    sendSuccess(res, result, 'Provider test completed');
  }));

  // ======================= AI PROVIDERS & MODELS =======================

  app.get('/api/providers', asyncHandler(async (req, res) => {
    const providers = await services.translation.getProviders();

    sendSuccess(res, providers, `Retrieved ${providers.length} providers`);
  }));

  app.get('/api/ai-models', asyncHandler(async (req, res) => {
    // Static model configuration for frontend compatibility
    const models = {
      'gemini-1.5-pro': {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        maxTokens: 2048,
        inputPrice: 0.00125,
        outputPrice: 0.005,
        isActive: true,
        features: ['translation', 'batch_processing', 'context_aware']
      },
      'gemini-1.5-flash': {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        maxTokens: 1024,
        inputPrice: 0.000075,
        outputPrice: 0.0003,
        isActive: true,
        features: ['translation', 'batch_processing', 'high_speed']
      },
      'gpt-4o': {
        provider: 'openai',
        model: 'gpt-4o',
        displayName: 'GPT-4o',
        maxTokens: 2048,
        inputPrice: 0.005,
        outputPrice: 0.015,
        isActive: true,
        features: ['translation', 'context_aware', 'high_quality']
      },
      'gpt-4o-mini': {
        provider: 'openai',
        model: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        maxTokens: 1024,
        inputPrice: 0.00015,
        outputPrice: 0.0006,
        isActive: true,
        features: ['translation', 'cost_effective']
      },
      'deepseek-chat': {
        provider: 'deepseek',
        model: 'deepseek-chat',
        displayName: 'DeepSeek Chat',
        maxTokens: 1024,
        inputPrice: 0.00014,
        outputPrice: 0.00028,
        isActive: true,
        features: ['translation', 'cost_effective', 'high_speed']
      },
      'claude-3-5-haiku': {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        maxTokens: 1024,
        inputPrice: 0.00025,
        outputPrice: 0.00125,
        isActive: true,
        features: ['translation', 'fast_response']
      },
      'grok-2-1212': {
        provider: 'xai',
        model: 'grok-2-1212',
        displayName: 'Grok-2 1212',
        maxTokens: 1024,
        inputPrice: 0.002,
        outputPrice: 0.01,
        isActive: true,
        features: ['translation', 'creative_content']
      }
    };

    sendSuccess(res, models, 'AI models retrieved successfully');
  }));

  // ======================= GLOBAL SETTINGS =======================

  app.get('/api/global-settings', asyncHandler(async (req, res) => {
    // Return static settings for compatibility
    const settings = [
      { id: 1, settingKey: 'default_provider', settingValue: 'gemini', description: 'Default AI provider' },
      { id: 2, settingKey: 'default_model', settingValue: 'gemini-1.5-pro', description: 'Default AI model' },
      { id: 3, settingKey: 'batch_size', settingValue: '100', description: 'Default batch size' },
      { id: 4, settingKey: 'max_retries', settingValue: '3', description: 'Maximum retry attempts' },
      { id: 5, settingKey: 'timeout_seconds', settingValue: '300', description: 'Request timeout' }
    ];

    sendSuccess(res, settings, 'Global settings retrieved');
  }));

  app.post('/api/global-settings', asyncHandler(async (req, res) => {
    const { key, value, description } = req.body;

    if (!key || !value) {
      throw new ApiError(400, 'Key and value are required', 'MISSING_FIELDS');
    }

    // For now, just return the setting as created
    const setting = {
      id: Date.now(),
      settingKey: key,
      settingValue: value,
      description: description || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    logger.info('Global setting created via API', { key, value });

    sendSuccess(res, setting, 'Global setting created successfully');
  }));

  // ======================= SYSTEM LOGS =======================

  app.get('/api/logs', asyncHandler(async (req, res) => {
    const { limit = 50, offset = 0, level, category } = req.query;

    const logs = logger.getLogs({
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      level: level && level !== 'all' ? level as string : undefined,
      category: category && category !== 'all' ? category as string : undefined
    });

    sendSuccess(res, logs, `Retrieved ${logs.length} log entries`);
  }));

  app.get('/api/logs/stats', asyncHandler(async (req, res) => {
    const stats = logger.getStats();
    
    sendSuccess(res, stats, 'Log statistics retrieved');
  }));

  app.delete('/api/logs', asyncHandler(async (req, res) => {
    logger.clearAllLogs();
    
    sendSuccess(res, null, 'All logs cleared successfully');
  }));

  // ======================= ERROR HANDLING =======================

  app.use(errorHandler);

  // ======================= SERVER CREATION =======================

  const server = enterpriseApp.createServer(app);
  
  logger.info('Enterprise API routes registered successfully', {
    endpoints: [
      'GET /api/health',
      'GET /api/projects',
      'POST /api/projects',
      'POST /api/translate-batch',
      'POST /api/test-provider',
      'GET /api/ai-models'
    ]
  });
  
  return server;
}