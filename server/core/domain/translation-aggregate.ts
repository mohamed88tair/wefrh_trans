/**
 * Translation Domain Aggregate Root
 * Enterprise DDD implementation with event sourcing
 * 
 * @author Senior Domain Architect (15+ years)
 * @version 3.0.0 Enterprise
 */

import { 
  BaseEntity, 
  TranslationProject, 
  TranslationItem, 
  TranslationStatus,
  ReviewStatus,
  DomainEvent,
  ProjectMetadata,
  ItemMetadata,
  TranslationContext 
} from '../interfaces';

// ==================== DOMAIN EVENTS ====================

export class ProjectCreatedEvent implements DomainEvent {
  readonly id = crypto.randomUUID();
  readonly type = 'ProjectCreated';
  readonly timestamp = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      readonly name: string;
      readonly type: string;
      readonly sourceLanguage: string;
      readonly targetLanguage: string;
      readonly metadata: ProjectMetadata;
    }
  ) {}
}

export class ItemAddedEvent implements DomainEvent {
  readonly id = crypto.randomUUID();
  readonly type = 'ItemAdded';
  readonly timestamp = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      readonly itemId: string;
      readonly key: string;
      readonly originalText: string;
      readonly context?: TranslationContext;
    }
  ) {}
}

export class ItemTranslatedEvent implements DomainEvent {
  readonly id = crypto.randomUUID();
  readonly type = 'ItemTranslated';
  readonly timestamp = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      readonly itemId: string;
      readonly translatedText: string;
      readonly provider: string;
      readonly model: string;
      readonly confidence: number;
      readonly cost: number;
    }
  ) {}
}

export class BatchProcessingStartedEvent implements DomainEvent {
  readonly id = crypto.randomUUID();
  readonly type = 'BatchProcessingStarted';
  readonly timestamp = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      readonly batchId: string;
      readonly itemCount: number;
      readonly provider: string;
      readonly model: string;
    }
  ) {}
}

export class BatchProcessingCompletedEvent implements DomainEvent {
  readonly id = crypto.randomUUID();
  readonly type = 'BatchProcessingCompleted';
  readonly timestamp = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      readonly batchId: string;
      readonly successCount: number;
      readonly failureCount: number;
      readonly totalCost: number;
      readonly duration: number;
    }
  ) {}
}

export class ProjectCompletedEvent implements DomainEvent {
  readonly id = crypto.randomUUID();
  readonly type = 'ProjectCompleted';
  readonly timestamp = new Date();

  constructor(
    readonly aggregateId: string,
    readonly aggregateVersion: number,
    readonly payload: {
      readonly totalItems: number;
      readonly translatedItems: number;
      readonly totalCost: number;
      readonly completionTime: Date;
    }
  ) {}
}

// ==================== VALUE OBJECTS ====================

export class TranslationQuality {
  constructor(
    readonly confidence: number,
    readonly fluency: number,
    readonly accuracy: number,
    readonly consistency: number
  ) {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
    if (fluency < 0 || fluency > 1) {
      throw new Error('Fluency must be between 0 and 1');
    }
    if (accuracy < 0 || accuracy > 1) {
      throw new Error('Accuracy must be between 0 and 1');
    }
    if (consistency < 0 || consistency > 1) {
      throw new Error('Consistency must be between 0 and 1');
    }
  }

  get overallScore(): number {
    return (this.confidence + this.fluency + this.accuracy + this.consistency) / 4;
  }

  get grade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.overallScore;
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }
}

export class Cost {
  constructor(
    readonly amount: number,
    readonly currency: string = 'USD',
    readonly breakdown?: Record<string, number>
  ) {
    if (amount < 0) {
      throw new Error('Cost amount cannot be negative');
    }
  }

  add(other: Cost): Cost {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add costs with different currencies');
    }
    return new Cost(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Cost {
    return new Cost(this.amount * factor, this.currency, this.breakdown);
  }

  toString(): string {
    return `${this.amount.toFixed(4)} ${this.currency}`;
  }
}

// ==================== AGGREGATE ROOT ====================

export class TranslationProjectAggregate {
  private _version = 0;
  private _uncommittedEvents: DomainEvent[] = [];
  private _items = new Map<string, TranslationItem>();

  constructor(
    private _id: string,
    private _name: string,
    private _description: string,
    private _type: string,
    private _sourceLanguage: string,
    private _targetLanguage: string,
    private _status: string,
    private _metadata: ProjectMetadata,
    private _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date()
  ) {}

  // ==================== FACTORY METHODS ====================

  static create(
    name: string,
    description: string,
    type: string,
    sourceLanguage: string,
    targetLanguage: string,
    metadata: ProjectMetadata
  ): TranslationProjectAggregate {
    const id = crypto.randomUUID();
    const aggregate = new TranslationProjectAggregate(
      id,
      name,
      description,
      type,
      sourceLanguage,
      targetLanguage,
      'draft',
      metadata
    );

    const event = new ProjectCreatedEvent(id, aggregate._version + 1, {
      name,
      type,
      sourceLanguage,
      targetLanguage,
      metadata
    });

    aggregate.applyEvent(event);
    return aggregate;
  }

  static fromHistory(events: DomainEvent[]): TranslationProjectAggregate {
    if (events.length === 0) {
      throw new Error('Cannot create aggregate from empty event history');
    }

    const firstEvent = events[0] as ProjectCreatedEvent;
    const aggregate = new TranslationProjectAggregate(
      firstEvent.aggregateId,
      firstEvent.payload.name,
      '', // Will be set by events
      firstEvent.payload.type,
      firstEvent.payload.sourceLanguage,
      firstEvent.payload.targetLanguage,
      'draft',
      firstEvent.payload.metadata
    );

    events.forEach(event => aggregate.apply(event));
    aggregate._uncommittedEvents = [];
    
    return aggregate;
  }

  // ==================== COMMAND HANDLERS ====================

  addTranslationItem(
    key: string,
    originalText: string,
    context?: TranslationContext
  ): void {
    this.ensureNotCompleted();
    this.ensureUniqueKey(key);

    const itemId = crypto.randomUUID();
    const event = new ItemAddedEvent(this._id, this._version + 1, {
      itemId,
      key,
      originalText,
      context
    });

    this.applyEvent(event);
  }

  translateItem(
    itemId: string,
    translatedText: string,
    provider: string,
    model: string,
    confidence: number,
    cost: number
  ): void {
    this.ensureNotCompleted();
    this.ensureItemExists(itemId);
    this.ensureValidConfidence(confidence);

    const event = new ItemTranslatedEvent(this._id, this._version + 1, {
      itemId,
      translatedText,
      provider,
      model,
      confidence,
      cost
    });

    this.applyEvent(event);
  }

  startBatchProcessing(
    batchId: string,
    itemIds: string[],
    provider: string,
    model: string
  ): void {
    this.ensureNotCompleted();
    this.ensureBatchItemsExist(itemIds);

    const event = new BatchProcessingStartedEvent(this._id, this._version + 1, {
      batchId,
      itemCount: itemIds.length,
      provider,
      model
    });

    this.applyEvent(event);
  }

  completeBatchProcessing(
    batchId: string,
    successCount: number,
    failureCount: number,
    totalCost: number,
    duration: number
  ): void {
    const event = new BatchProcessingCompletedEvent(this._id, this._version + 1, {
      batchId,
      successCount,
      failureCount,
      totalCost,
      duration
    });

    this.applyEvent(event);

    // Check if project is now complete
    this.checkCompletion();
  }

  markAsCompleted(): void {
    if (this._status === 'completed') {
      return; // Already completed
    }

    const translatedCount = this.getTranslatedItemsCount();
    const totalCost = this.getTotalCost();

    const event = new ProjectCompletedEvent(this._id, this._version + 1, {
      totalItems: this._items.size,
      translatedItems: translatedCount,
      totalCost,
      completionTime: new Date()
    });

    this.applyEvent(event);
  }

  // ==================== EVENT HANDLERS ====================

  private applyEvent(event: DomainEvent): void {
    this.apply(event);
    this._uncommittedEvents.push(event);
  }

  private apply(event: DomainEvent): void {
    this._version = event.aggregateVersion;
    this._updatedAt = event.timestamp;

    switch (event.type) {
      case 'ProjectCreated':
        this.handleProjectCreated(event as ProjectCreatedEvent);
        break;
      case 'ItemAdded':
        this.handleItemAdded(event as ItemAddedEvent);
        break;
      case 'ItemTranslated':
        this.handleItemTranslated(event as ItemTranslatedEvent);
        break;
      case 'BatchProcessingStarted':
        this.handleBatchProcessingStarted(event as BatchProcessingStartedEvent);
        break;
      case 'BatchProcessingCompleted':
        this.handleBatchProcessingCompleted(event as BatchProcessingCompletedEvent);
        break;
      case 'ProjectCompleted':
        this.handleProjectCompleted(event as ProjectCompletedEvent);
        break;
      default:
        // Unknown event type - might be from a newer version
        console.warn(`Unknown event type: ${event.type}`);
    }
  }

  private handleProjectCreated(event: ProjectCreatedEvent): void {
    this._status = 'active';
  }

  private handleItemAdded(event: ItemAddedEvent): void {
    const { itemId, key, originalText, context } = event.payload;
    
    const item: TranslationItem = {
      id: itemId,
      projectId: parseInt(this._id),
      key,
      originalText,
      cleanedText: this.cleanText(originalText),
      status: 'pending',
      context,
      metadata: {
        characterCount: originalText.length,
        wordCount: originalText.split(/\s+/).length,
        complexity: this.calculateComplexity(originalText)
      },
      createdAt: event.timestamp,
      updatedAt: event.timestamp
    };

    this._items.set(itemId, item);
  }

  private handleItemTranslated(event: ItemTranslatedEvent): void {
    const { itemId, translatedText, provider, model, confidence, cost } = event.payload;
    const item = this._items.get(itemId);
    
    if (item) {
      const updatedItem: TranslationItem = {
        ...item,
        translatedText,
        status: 'translated',
        confidence,
        metadata: {
          ...item.metadata,
          provider,
          model,
          cost,
          translationTime: event.timestamp.getTime() - item.createdAt.getTime()
        },
        updatedAt: event.timestamp
      };

      this._items.set(itemId, updatedItem);
    }
  }

  private handleBatchProcessingStarted(event: BatchProcessingStartedEvent): void {
    // Update relevant items to processing status
    for (const item of this._items.values()) {
      if (item.status === 'pending') {
        const updatedItem: TranslationItem = {
          ...item,
          status: 'processing',
          updatedAt: event.timestamp
        };
        this._items.set(item.id.toString(), updatedItem);
      }
    }
  }

  private handleBatchProcessingCompleted(event: BatchProcessingCompletedEvent): void {
    // Batch processing completion handled by individual item translation events
  }

  private handleProjectCompleted(event: ProjectCompletedEvent): void {
    this._status = 'completed';
  }

  // ==================== BUSINESS RULES ====================

  private ensureNotCompleted(): void {
    if (this._status === 'completed') {
      throw new Error('Cannot modify completed project');
    }
  }

  private ensureUniqueKey(key: string): void {
    for (const item of this._items.values()) {
      if (item.key === key) {
        throw new Error(`Item with key '${key}' already exists`);
      }
    }
  }

  private ensureItemExists(itemId: string): void {
    if (!this._items.has(itemId)) {
      throw new Error(`Item with ID '${itemId}' not found`);
    }
  }

  private ensureBatchItemsExist(itemIds: string[]): void {
    for (const itemId of itemIds) {
      this.ensureItemExists(itemId);
    }
  }

  private ensureValidConfidence(confidence: number): void {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  private checkCompletion(): void {
    const totalItems = this._items.size;
    const translatedItems = this.getTranslatedItemsCount();

    if (totalItems > 0 && translatedItems === totalItems) {
      this.markAsCompleted();
    }
  }

  // ==================== HELPER METHODS ====================

  private cleanText(text: string): string {
    return text
      .replace(/^\s*["']|["']\s*$/g, '') // Remove quotes
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .trim();
  }

  private calculateComplexity(text: string): number {
    let complexity = 0;
    
    // Length factor
    complexity += Math.min(text.length / 100, 1) * 0.3;
    
    // Special characters
    const specialChars = (text.match(/[{}()[\]<>|\\]/g) || []).length;
    complexity += Math.min(specialChars / 10, 1) * 0.4;
    
    // Capitalization patterns
    const capitalWords = (text.match(/[A-Z][a-z]+/g) || []).length;
    complexity += Math.min(capitalWords / 5, 1) * 0.3;

    return Math.min(complexity, 1);
  }

  private getTranslatedItemsCount(): number {
    return Array.from(this._items.values())
      .filter(item => item.status === 'translated').length;
  }

  private getTotalCost(): number {
    return Array.from(this._items.values())
      .reduce((total, item) => total + (item.metadata.cost || 0), 0);
  }

  // ==================== GETTERS ====================

  get id(): string { return this._id; }
  get version(): number { return this._version; }
  get uncommittedEvents(): readonly DomainEvent[] { return this._uncommittedEvents; }
  get name(): string { return this._name; }
  get status(): string { return this._status; }
  get items(): readonly TranslationItem[] { return Array.from(this._items.values()); }
  get totalItems(): number { return this._items.size; }
  get translatedItems(): number { return this.getTranslatedItemsCount(); }
  get progressPercentage(): number {
    return this.totalItems > 0 ? (this.translatedItems / this.totalItems) * 100 : 0;
  }
  get totalCost(): number { return this.getTotalCost(); }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // ==================== PERSISTENCE ====================

  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  toSnapshot(): TranslationProject {
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      type: this._type as any,
      sourceLanguage: this._sourceLanguage,
      targetLanguage: this._targetLanguage,
      status: this._status as any,
      totalItems: this.totalItems,
      translatedItems: this.translatedItems,
      progressPercentage: this.progressPercentage,
      lastOpenedAt: this._updatedAt,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      version: this._version
    };
  }
}