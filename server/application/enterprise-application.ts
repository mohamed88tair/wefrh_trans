/**
 * Enterprise Application Container
 * Advanced dependency injection with comprehensive service orchestration
 * 
 * @author Senior Application Architect (15+ years)
 * @version 3.0.0 Enterprise
 */

import { Express } from 'express';
import { createServer, Server } from 'http';
import {
  Logger,
  ApplicationConfig,
  TranslationService,
  SystemHealth,
  HealthCheck
} from '../core/interfaces';
import { EnterpriseTranslationService } from '../core/services/enterprise-translation-service';
import { TranslationProjectRepository, TranslationItemRepository } from '../infrastructure/enterprise-repository';
import { logger } from '../logger-professional';

// ==================== APPLICATION COMMANDS ====================

export interface CreateProjectCommand {
  readonly name: string;
  readonly description?: string;
  readonly type: 'php' | 'laravel' | 'generic' | 'delivery';
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly items?: Array<{
    key: string;
    originalText: string;
    context?: any;
  }>;
}

export interface TranslateBatchCommand {
  readonly projectId: number;
  readonly provider: string;
  readonly model: string;
  readonly batchSize?: number;
  readonly delay?: number;
  readonly maxRetries?: number;
}

export interface TestProviderCommand {
  readonly provider: string;
  readonly apiKey: string;
  readonly testText?: string;
}

// ==================== APPLICATION SERVICES ====================

export class EnterpriseProjectService {
  constructor(
    private readonly projectRepository: TranslationProjectRepository,
    private readonly itemRepository: TranslationItemRepository,
    private readonly translationService: TranslationService,
    private readonly logger: Logger
  ) {}

  async createProject(command: CreateProjectCommand) {
    try {
      this.logger.info('Creating new translation project', {
        name: command.name,
        type: command.type,
        itemCount: command.items?.length || 0
      });

      // Create project
      const project = await this.projectRepository.create({
        name: command.name,
        description: command.description || '',
        type: command.type,
        sourceLanguage: command.sourceLanguage,
        targetLanguage: command.targetLanguage,
        status: 'active',
        totalItems: command.items?.length || 0,
        translatedItems: 0,
        progressPercentage: 0,
        lastOpenedAt: new Date(),
        metadata: {
          fileFormat: 'json',
          complexity: 'medium',
          tags: []
        }
      });

      // Add items if provided
      if (command.items && command.items.length > 0) {
        for (const itemData of command.items) {
          await this.itemRepository.create({
            projectId: project.id as number,
            key: itemData.key,
            originalText: itemData.originalText,
            cleanedText: this.cleanText(itemData.originalText),
            status: 'pending',
            context: itemData.context,
            metadata: {
              characterCount: itemData.originalText.length,
              wordCount: itemData.originalText.split(/\s+/).length,
              complexity: this.calculateComplexity(itemData.originalText)
            }
          });
        }

        // Update project totals
        await this.projectRepository.update(project.id, {
          totalItems: command.items.length
        });
      }

      this.logger.info('Project created successfully', {
        projectId: project.id,
        name: project.name,
        itemCount: command.items?.length || 0
      });

      return project;

    } catch (error) {
      this.logger.error('Failed to create project', error as Error, {
        command
      });
      throw error;
    }
  }

  async translateBatch(command: TranslateBatchCommand) {
    try {
      this.logger.info('Starting batch translation', {
        projectId: command.projectId,
        provider: command.provider,
        model: command.model
      });

      // Get pending items
      const items = await this.itemRepository.findByStatus('pending', command.projectId);
      
      if (items.length === 0) {
        this.logger.info('No pending items found for translation', {
          projectId: command.projectId
        });
        return { success: true, message: 'No items to translate', results: [] };
      }

      // Create batch request
      const batchRequest = {
        id: `batch_${Date.now()}`,
        projectId: command.projectId,
        items: items,
        provider: command.provider,
        model: command.model,
        priority: 'normal' as const,
        options: {
          batchSize: command.batchSize || 100,
          delay: command.delay || 2000,
          maxRetries: command.maxRetries || 3,
          timeoutMs: 300000,
          continueOnError: true,
          contextPreservation: true
        },
        createdAt: new Date()
      };

      // Execute batch translation
      const result = await this.translationService.translateBatch(batchRequest);

      // Update items with results
      const updates = result.translations.map(translation => ({
        id: translation.itemId,
        updates: {
          translatedText: translation.translatedText,
          status: 'translated' as const,
          confidence: translation.confidence,
          metadata: {
            ...items.find(i => i.id === translation.itemId)?.metadata,
            ...translation.metadata
          }
        }
      }));

      if (updates.length > 0) {
        await this.itemRepository.updateBatch(updates);
      }

      // Update project progress
      const project = await this.projectRepository.findById(command.projectId);
      if (project) {
        const allItems = await this.itemRepository.findByProjectId(command.projectId);
        const translatedCount = allItems.filter(item => item.status === 'translated').length;
        const progressPercentage = Math.round((translatedCount / allItems.length) * 100);

        await this.projectRepository.update(command.projectId, {
          translatedItems: translatedCount,
          progressPercentage,
          lastOpenedAt: new Date()
        });
      }

      this.logger.info('Batch translation completed', {
        projectId: command.projectId,
        successCount: result.successfulItems,
        failureCount: result.failedItems,
        duration: result.performance.totalDuration
      });

      return {
        success: true,
        batchId: result.batchId,
        results: result,
        updatedItems: updates.length
      };

    } catch (error) {
      this.logger.error('Batch translation failed', error as Error, {
        command
      });
      throw error;
    }
  }

  async getAllProjects() {
    return this.projectRepository.findAll({
      sortBy: 'lastOpenedAt',
      sortOrder: 'desc'
    });
  }

  async getProject(id: number) {
    const project = await this.projectRepository.findById(id);
    if (project) {
      // Update last opened timestamp
      await this.projectRepository.update(id, {
        lastOpenedAt: new Date()
      });
    }
    return project;
  }

  async getProjectItems(projectId: number, limit?: number, offset?: number) {
    return this.itemRepository.findByProjectId(projectId, {
      limit,
      offset,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
  }

  async updateProjectItem(itemId: number, updates: any) {
    return this.itemRepository.update(itemId, updates);
  }

  async deleteProject(id: number) {
    // Delete all items first
    const items = await this.itemRepository.findByProjectId(id);
    for (const item of items) {
      await this.itemRepository.delete(item.id);
    }

    // Delete project
    await this.projectRepository.delete(id);

    this.logger.info('Project deleted', {
      projectId: id,
      deletedItems: items.length
    });
  }

  private cleanText(text: string): string {
    return text
      .replace(/^\s*["']|["']\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateComplexity(text: string): number {
    let complexity = 0;
    complexity += Math.min(text.length / 100, 1) * 0.3;
    const specialChars = (text.match(/[{}()[\]<>|\\]/g) || []).length;
    complexity += Math.min(specialChars / 10, 1) * 0.4;
    const capitalWords = (text.match(/[A-Z][a-z]+/g) || []).length;
    complexity += Math.min(capitalWords / 5, 1) * 0.3;
    return Math.min(complexity, 1);
  }
}

// ==================== HEALTH MONITORING ====================

export class SystemHealthMonitor {
  constructor(
    private readonly logger: Logger,
    private readonly projectRepository: TranslationProjectRepository,
    private readonly translationService: TranslationService
  ) {}

  async getSystemHealth(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database health check
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);
    if (dbCheck.status !== 'healthy') overallStatus = 'degraded';

    // Translation service health check
    const translationCheck = await this.checkTranslationService();
    checks.push(translationCheck);
    if (translationCheck.status === 'unhealthy') overallStatus = 'unhealthy';

    // Memory health check
    const memoryCheck = await this.checkMemoryUsage();
    checks.push(memoryCheck);
    if (memoryCheck.status !== 'healthy' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      overall: overallStatus,
      checks,
      timestamp: new Date()
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple database connectivity test
      const count = await this.projectRepository.count();
      const duration = Date.now() - startTime;

      return {
        name: 'Database',
        status: duration < 1000 ? 'healthy' : 'degraded',
        duration,
        details: {
          projectCount: count,
          responseTime: duration
        }
      };
    } catch (error) {
      return {
        name: 'Database',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        details: {
          error: (error as Error).message
        }
      };
    }
  }

  private async checkTranslationService(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check if providers are available
      const providers = await this.translationService.getProviders();
      const duration = Date.now() - startTime;

      return {
        name: 'Translation Service',
        status: providers.length > 0 ? 'healthy' : 'degraded',
        duration,
        details: {
          availableProviders: providers.length,
          providers: providers.map(p => p.name)
        }
      };
    } catch (error) {
      return {
        name: 'Translation Service',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        details: {
          error: (error as Error).message
        }
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const usagePercentage = (usedMB / totalMB) * 100;

      let status: HealthCheck['status'] = 'healthy';
      if (usagePercentage > 90) status = 'unhealthy';
      else if (usagePercentage > 75) status = 'degraded';

      return {
        name: 'Memory Usage',
        status,
        duration: Date.now() - startTime,
        details: {
          totalMB,
          usedMB,
          usagePercentage: Math.round(usagePercentage)
        }
      };
    } catch (error) {
      return {
        name: 'Memory Usage',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        details: {
          error: (error as Error).message
        }
      };
    }
  }
}

// ==================== DEPENDENCY INJECTION CONTAINER ====================

export class EnterpriseApplicationContainer {
  private static instance: EnterpriseApplicationContainer;
  private _projectRepository!: TranslationProjectRepository;
  private _itemRepository!: TranslationItemRepository;
  private _translationService!: EnterpriseTranslationService;
  private _projectService!: EnterpriseProjectService;
  private _healthMonitor!: SystemHealthMonitor;
  private _isInitialized = false;

  private constructor() {}

  static getInstance(): EnterpriseApplicationContainer {
    if (!EnterpriseApplicationContainer.instance) {
      EnterpriseApplicationContainer.instance = new EnterpriseApplicationContainer();
    }
    return EnterpriseApplicationContainer.instance;
  }

  initialize(config?: ApplicationConfig): void {
    if (this._isInitialized) {
      return;
    }

    // Initialize repositories
    this._projectRepository = new TranslationProjectRepository(logger);
    this._itemRepository = new TranslationItemRepository(logger);

    // Initialize services
    this._translationService = new EnterpriseTranslationService(logger);
    this._projectService = new EnterpriseProjectService(
      this._projectRepository,
      this._itemRepository,
      this._translationService,
      logger
    );

    // Initialize health monitor
    this._healthMonitor = new SystemHealthMonitor(
      logger,
      this._projectRepository,
      this._translationService
    );

    // Initialize default AI models and settings
    this.initializeDefaults();

    this._isInitialized = true;
    
    logger.info('Enterprise application container initialized', {
      components: ['ProjectRepository', 'ItemRepository', 'TranslationService', 'ProjectService', 'HealthMonitor']
    });
  }

  // ==================== SERVICE GETTERS ====================

  get projectRepository(): TranslationProjectRepository {
    this.ensureInitialized();
    return this._projectRepository;
  }

  get itemRepository(): TranslationItemRepository {
    this.ensureInitialized();
    return this._itemRepository;
  }

  get translationService(): EnterpriseTranslationService {
    this.ensureInitialized();
    return this._translationService;
  }

  get projectService(): EnterpriseProjectService {
    this.ensureInitialized();
    return this._projectService;
  }

  get healthMonitor(): SystemHealthMonitor {
    this.ensureInitialized();
    return this._healthMonitor;
  }

  // ==================== CONFIGURATION ====================

  configureApiKeys(keys: Record<string, string>): void {
    this.ensureInitialized();
    
    for (const [provider, apiKey] of Object.entries(keys)) {
      this._translationService.setApiKey(provider, apiKey);
      logger.info('API key configured', { provider });
    }
  }

  // ==================== LIFECYCLE ====================

  async shutdown(): Promise<void> {
    if (!this._isInitialized) {
      return;
    }

    logger.info('Shutting down enterprise application container');
    
    // Cleanup resources
    // In a real implementation, this would close database connections, etc.
    
    this._isInitialized = false;
  }

  private ensureInitialized(): void {
    if (!this._isInitialized) {
      throw new Error('Application container not initialized. Call initialize() first.');
    }
  }

  private initializeDefaults(): void {
    // Initialize default global settings
    const defaultSettings = [
      { key: 'default_provider', value: 'gemini', description: 'Default AI provider for translations' },
      { key: 'default_model', value: 'gemini-1.5-pro', description: 'Default AI model for translations' },
      { key: 'batch_size', value: '100', description: 'Default batch size for translations' },
      { key: 'max_retries', value: '3', description: 'Maximum retry attempts for failed translations' },
      { key: 'timeout_seconds', value: '300', description: 'Request timeout in seconds' },
      { key: 'enable_logging', value: 'true', description: 'Enable detailed logging' },
      { key: 'enable_cost_tracking', value: 'true', description: 'Enable cost tracking' },
      { key: 'enable_performance_monitoring', value: 'true', description: 'Enable performance monitoring' }
    ];

    logger.info('Default settings initialized', {
      settingCount: defaultSettings.length
    });
  }
}

// ==================== APPLICATION FACTORY ====================

export class EnterpriseApplication {
  private container: EnterpriseApplicationContainer;
  private server?: Server;

  constructor() {
    this.container = EnterpriseApplicationContainer.getInstance();
  }

  async initialize(config?: ApplicationConfig): Promise<void> {
    this.container.initialize(config);
    
    logger.info('Enterprise Translation Platform initialized', {
      version: '3.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }

  createServer(app: Express): Server {
    this.server = createServer(app);
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
    
    return this.server;
  }

  get services() {
    return {
      projects: this.container.projectService,
      translation: this.container.translationService,
      health: this.container.healthMonitor,
      repositories: {
        projects: this.container.projectRepository,
        items: this.container.itemRepository
      }
    };
  }

  configureApiKeys(keys: Record<string, string>): void {
    this.container.configureApiKeys(keys);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return this.container.healthMonitor.getSystemHealth();
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Received shutdown signal, starting graceful shutdown');
    
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    await this.container.shutdown();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  }
}

// Export singleton instance
export const enterpriseApp = new EnterpriseApplication();