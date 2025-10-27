/**
 * Enterprise Core Interfaces & Types
 * Professional type definitions with comprehensive domain modeling
 * 
 * @author Senior Full-Stack Architect (15+ years)
 * @version 3.0.0 Enterprise
 * @date December 2024
 */

// ==================== CORE DOMAIN INTERFACES ====================

export interface BaseEntity {
  readonly id: string | number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version?: number;
}

export interface AuditableEntity extends BaseEntity {
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

// ==================== TRANSLATION DOMAIN ====================

export interface TranslationProject extends AuditableEntity {
  readonly name: string;
  readonly description?: string;
  readonly type: 'php' | 'laravel' | 'generic' | 'delivery';
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly status: 'draft' | 'active' | 'completed' | 'archived';
  readonly totalItems: number;
  readonly translatedItems: number;
  readonly progressPercentage: number;
  readonly lastOpenedAt: Date;
  readonly metadata: ProjectMetadata;
}

export interface ProjectMetadata {
  readonly fileFormat: string;
  readonly originalFileName?: string;
  readonly fileSize?: number;
  readonly encoding?: string;
  readonly estimatedCost?: number;
  readonly complexity?: 'simple' | 'medium' | 'complex';
  readonly tags?: readonly string[];
}

export interface TranslationItem extends AuditableEntity {
  readonly projectId: number;
  readonly key: string;
  readonly originalText: string;
  readonly cleanedText?: string;
  readonly translatedText?: string;
  readonly context?: TranslationContext;
  readonly status: TranslationStatus;
  readonly confidence?: number;
  readonly reviewStatus?: ReviewStatus;
  readonly metadata: ItemMetadata;
}

export interface TranslationContext {
  readonly category?: string;
  readonly domain?: string;
  readonly usage?: 'ui' | 'error' | 'notification' | 'content';
  readonly tone?: 'formal' | 'informal' | 'technical';
  readonly audience?: 'admin' | 'customer' | 'developer';
}

export interface ItemMetadata {
  readonly characterCount: number;
  readonly wordCount: number;
  readonly complexity: number;
  readonly translationTime?: number;
  readonly provider?: string;
  readonly model?: string;
  readonly cost?: number;
}

export type TranslationStatus = 
  | 'pending' 
  | 'processing' 
  | 'translated' 
  | 'reviewed' 
  | 'approved' 
  | 'rejected'
  | 'failed';

export type ReviewStatus = 
  | 'not_reviewed' 
  | 'in_review' 
  | 'approved' 
  | 'needs_revision';

// ==================== AI PROVIDER INTERFACES ====================

export interface AIProvider {
  readonly name: string;
  readonly displayName: string;
  readonly endpoint: string;
  readonly models: readonly AIModel[];
  readonly features: readonly ProviderFeature[];
  readonly rateLimit: RateLimit;
  readonly pricing: ProviderPricing;
}

export interface AIModel {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly provider: string;
  readonly maxTokens: number;
  readonly contextWindow: number;
  readonly capabilities: readonly ModelCapability[];
  readonly pricing: ModelPricing;
  readonly performance: ModelPerformance;
}

export interface ModelPricing {
  readonly inputCostPerToken: number;
  readonly outputCostPerToken: number;
  readonly currency: 'USD' | 'EUR' | 'GBP';
  readonly minimumCost?: number;
}

export interface ModelPerformance {
  readonly averageResponseTime: number;
  readonly successRate: number;
  readonly qualityScore: number;
  readonly recommendedBatchSize: number;
  readonly optimalDelay: number;
}

export interface RateLimit {
  readonly requestsPerMinute: number;
  readonly tokensPerMinute: number;
  readonly concurrentRequests: number;
}

export interface ProviderPricing {
  readonly tier: 'free' | 'pro' | 'enterprise';
  readonly monthlyQuota?: number;
  readonly overageRate?: number;
}

export type ProviderFeature = 
  | 'batch_translation' 
  | 'context_awareness' 
  | 'domain_adaptation' 
  | 'quality_scoring'
  | 'custom_models'
  | 'real_time_translation';

export type ModelCapability = 
  | 'text_translation' 
  | 'context_understanding' 
  | 'terminology_consistency'
  | 'cultural_adaptation'
  | 'technical_content'
  | 'creative_content';

// ==================== BATCH PROCESSING INTERFACES ====================

export interface BatchRequest {
  readonly id: string;
  readonly projectId: number;
  readonly items: readonly TranslationItem[];
  readonly provider: string;
  readonly model: string;
  readonly options: BatchOptions;
  readonly priority: BatchPriority;
  readonly createdAt: Date;
}

export interface BatchOptions {
  readonly batchSize: number;
  readonly delay: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly continueOnError: boolean;
  readonly contextPreservation: boolean;
}

export interface BatchResult {
  readonly batchId: string;
  readonly status: BatchStatus;
  readonly totalItems: number;
  readonly processedItems: number;
  readonly successfulItems: number;
  readonly failedItems: number;
  readonly translations: readonly BatchTranslation[];
  readonly performance: BatchPerformance;
  readonly errors?: readonly BatchError[];
}

export interface BatchTranslation {
  readonly itemId: number;
  readonly originalText: string;
  readonly translatedText: string;
  readonly confidence: number;
  readonly metadata: TranslationMetadata;
}

export interface TranslationMetadata {
  readonly provider: string;
  readonly model: string;
  readonly processingTime: number;
  readonly tokenUsage: TokenUsage;
  readonly cost: number;
  readonly qualityScore?: number;
}

export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly total: number;
}

export interface BatchPerformance {
  readonly totalDuration: number;
  readonly averageItemTime: number;
  readonly throughput: number;
  readonly costEfficiency: number;
}

export interface BatchError {
  readonly itemId: number;
  readonly error: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly timestamp: Date;
}

export type BatchStatus = 
  | 'queued' 
  | 'processing' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type BatchPriority = 'low' | 'normal' | 'high' | 'urgent';

// ==================== STORAGE INTERFACES ====================

export interface Repository<T extends BaseEntity> {
  findById(id: string | number): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(entity: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: string | number, updates: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<void>;
  count(filters?: QueryFilter[]): Promise<number>;
}

export interface QueryOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
  readonly filters?: readonly QueryFilter[];
  readonly include?: readonly string[];
}

export interface QueryFilter {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: any;
}

export type FilterOperator = 
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'like' | 'ilike'
  | 'is_null' | 'not_null';

// ==================== SERVICE INTERFACES ====================

export interface TranslationService {
  translateText(
    text: string, 
    options: TranslationOptions
  ): Promise<TranslationResult>;
  
  translateBatch(
    request: BatchRequest
  ): Promise<BatchResult>;
  
  getProviders(): Promise<readonly AIProvider[]>;
  
  testProvider(
    provider: string, 
    apiKey: string
  ): Promise<ProviderTestResult>;
}

export interface TranslationOptions {
  readonly provider: string;
  readonly model: string;
  readonly sourceLanguage?: string;
  readonly targetLanguage: string;
  readonly context?: TranslationContext;
  readonly quality?: 'draft' | 'standard' | 'premium';
  readonly preserveFormatting?: boolean;
}

export interface TranslationResult {
  readonly translatedText: string;
  readonly confidence: number;
  readonly metadata: TranslationMetadata;
  readonly alternatives?: readonly string[];
}

export interface ProviderTestResult {
  readonly success: boolean;
  readonly message: string;
  readonly errorCode?: string;
  readonly balance?: string;
  readonly quotaInfo?: string;
  readonly modelAccess: readonly string[];
  readonly performance?: {
    readonly latency: number;
    readonly availability: number;
  };
}

// ==================== EVENT INTERFACES ====================

export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;
}

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(event: DomainEvent): event is T;
}

export interface EventStore {
  append(events: readonly DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<readonly DomainEvent[]>;
  subscribe(handler: EventHandler): void;
  unsubscribe(handler: EventHandler): void;
}

// ==================== SYSTEM INTERFACES ====================

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

export interface LogContext {
  readonly [key: string]: any;
  readonly userId?: string;
  readonly requestId?: string;
  readonly operation?: string;
}

export interface HealthCheck {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly duration: number;
  readonly details?: Record<string, any>;
}

export interface SystemHealth {
  readonly overall: 'healthy' | 'degraded' | 'unhealthy';
  readonly checks: readonly HealthCheck[];
  readonly timestamp: Date;
}

// ==================== CONFIGURATION INTERFACES ====================

export interface ApplicationConfig {
  readonly app: AppConfig;
  readonly database: DatabaseConfig;
  readonly providers: ProviderConfig[];
  readonly features: FeatureFlags;
  readonly monitoring: MonitoringConfig;
}

export interface AppConfig {
  readonly name: string;
  readonly version: string;
  readonly environment: 'development' | 'staging' | 'production';
  readonly port: number;
  readonly cors: CorsConfig;
}

export interface DatabaseConfig {
  readonly type: 'memory' | 'postgresql' | 'mysql';
  readonly url?: string;
  readonly pool: PoolConfig;
  readonly migrations: MigrationConfig;
}

export interface PoolConfig {
  readonly min: number;
  readonly max: number;
  readonly idleTimeoutMillis: number;
}

export interface MigrationConfig {
  readonly auto: boolean;
  readonly directory: string;
}

export interface CorsConfig {
  readonly origin: string | string[];
  readonly methods: string[];
  readonly allowedHeaders: string[];
}

export interface ProviderConfig {
  readonly name: string;
  readonly enabled: boolean;
  readonly apiKey?: string;
  readonly endpoint?: string;
  readonly timeout: number;
  readonly retries: number;
}

export interface FeatureFlags {
  readonly batchProcessing: boolean;
  readonly multipleTranslations: boolean;
  readonly qualityScoring: boolean;
  readonly realTimeUpdates: boolean;
  readonly advancedAnalytics: boolean;
}

export interface MonitoringConfig {
  readonly enabled: boolean;
  readonly metricsEndpoint?: string;
  readonly alerting: AlertingConfig;
  readonly performance: PerformanceConfig;
}

export interface AlertingConfig {
  readonly enabled: boolean;
  readonly thresholds: AlertThresholds;
}

export interface AlertThresholds {
  readonly errorRate: number;
  readonly responseTime: number;
  readonly memoryUsage: number;
  readonly cpuUsage: number;
}

export interface PerformanceConfig {
  readonly sampling: number;
  readonly retention: number;
  readonly slowQueryThreshold: number;
}