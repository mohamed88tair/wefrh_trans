import { db } from "./db";
import { eq, count, sql } from "drizzle-orm";
import {
  users,
  translationProjects,
  translationItems,
  apiSettings,
  globalSettings,
  projectSettings,
  backgroundTasks,
  aiModels,
  usageStats,
  type User,
  type InsertUser,
  type TranslationProject,
  type InsertTranslationProject,
  type TranslationItem,
  type InsertTranslationItem,
  type ApiSettings,
  type InsertApiSettings,
  type GlobalSettings,
  type InsertGlobalSettings,
  type ProjectSettings,
  type InsertProjectSettings,
  type BackgroundTask,
  type InsertBackgroundTask,
  type AiModel,
  type InsertAiModel,
  type UsageStats,
  type InsertUsageStats
} from "@shared/schema";
// Professional Storage Interface
// Supporting both Database and Memory implementations
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Translation Projects
  createProject(project: InsertTranslationProject): Promise<TranslationProject>;
  getProject(id: number): Promise<TranslationProject | undefined>;
  getAllProjects(): Promise<TranslationProject[]>;
  updateProject(id: number, updates: Partial<TranslationProject>): Promise<TranslationProject>;
  deleteProject(id: number): Promise<void>;
  updateProjectLastOpened(id: number): Promise<void>;
  updateProjectProgress(id: number): Promise<void>;
  
  // Translation Items
  createTranslationItem(item: InsertTranslationItem): Promise<TranslationItem>;
  getProjectItems(projectId: number, limit?: number, offset?: number): Promise<TranslationItem[]>;
  getProjectItemsCount(projectId: number): Promise<number>;
  updateTranslationItem(id: number, updates: Partial<TranslationItem>): Promise<TranslationItem>;
  deleteTranslationItem(id: number): Promise<void>;
  bulkUpdateTranslations(updates: Array<{id: number, translatedText: string, translationStatus: string}>): Promise<void>;
  getUntranslatedItems(projectId: number, limit?: number): Promise<TranslationItem[]>;
  
  // API Settings
  getApiSettings(): Promise<ApiSettings[]>;
  createApiSetting(setting: InsertApiSettings): Promise<ApiSettings>;
  updateApiSetting(id: number, updates: Partial<ApiSettings>): Promise<ApiSettings>;
  deleteApiSetting(id: number): Promise<void>;
  
  // Global Settings
  getGlobalSetting(key: string): Promise<GlobalSettings | undefined>;
  setGlobalSetting(key: string, value: string, description?: string): Promise<GlobalSettings>;
  getAllGlobalSettings(): Promise<GlobalSettings[]>;
  deleteGlobalSetting(key: string): Promise<void>;
  
  // Background Tasks
  createBackgroundTask(task: InsertBackgroundTask): Promise<BackgroundTask>;
  getBackgroundTask(id: string): Promise<BackgroundTask | undefined>;
  getAllBackgroundTasks(): Promise<BackgroundTask[]>;
  getActiveBackgroundTasks(): Promise<BackgroundTask[]>;
  getProjectBackgroundTasks(projectId: number): Promise<BackgroundTask[]>;
  updateBackgroundTask(id: string, updates: Partial<BackgroundTask>): Promise<BackgroundTask>;
  pauseBackgroundTask(id: string): Promise<void>;
  resumeBackgroundTask(id: string): Promise<void>;
  completeBackgroundTask(id: string): Promise<void>;
  deleteBackgroundTask(id: string): Promise<void>;
  
  // Project Settings
  getProjectSettings(projectId: number): Promise<ProjectSettings | undefined>;
  createProjectSettings(settings: InsertProjectSettings): Promise<ProjectSettings>;
  updateProjectSettings(projectId: number, updates: Partial<ProjectSettings>): Promise<ProjectSettings>;
  
  // Chat History
  getChatHistory(projectId: number): Promise<any[]>;
  
  // AI Models
  getAiModels(): Promise<AiModel[]>;
  createAiModel(model: InsertAiModel): Promise<AiModel>;
  updateAiModel(modelId: string, updates: Partial<AiModel>): Promise<AiModel>;
  importModelsFromProvider(provider: string): Promise<AiModel[]>;
  
  // Usage Statistics
  createUsageStats(stats: InsertUsageStats): Promise<UsageStats>;
  getUsageStats(): Promise<UsageStats[]>;
  getUsageStatsGrouped(): Promise<Record<string, any>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createProject(project: InsertTranslationProject): Promise<TranslationProject> {
    const [newProject] = await db
      .insert(translationProjects)
      .values(project)
      .returning();
    return newProject;
  }

  async getProject(id: number): Promise<TranslationProject | undefined> {
    const [project] = await db
      .select()
      .from(translationProjects)
      .where(eq(translationProjects.id, id));
    return project || undefined;
  }

  async getAllProjects(): Promise<TranslationProject[]> {
    return await db
      .select()
      .from(translationProjects)
      .orderBy(sql`${translationProjects.lastOpenedAt} DESC NULLS LAST, ${translationProjects.createdAt} DESC`);
  }

  async updateProject(id: number, updates: Partial<TranslationProject>): Promise<TranslationProject> {
    const [updatedProject] = await db
      .update(translationProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(translationProjects.id, id))
      .returning();
    
    if (!updatedProject) {
      throw new Error(`Project ${id} not found`);
    }
    
    return updatedProject;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(translationProjects).where(eq(translationProjects.id, id));
  }

  async updateProjectLastOpened(id: number): Promise<void> {
    await db
      .update(translationProjects)
      .set({ lastOpenedAt: new Date() })
      .where(eq(translationProjects.id, id));
  }

  async updateProjectProgress(id: number): Promise<void> {
    try {
      console.log(`Starting progress update for project ${id}`);
      
      const result = await db
        .select({
          translated: sql<number>`COUNT(CASE WHEN ${translationItems.status} = 'translated' THEN 1 END)`,
          total: count(translationItems.id)
        })
        .from(translationItems)
        .where(eq(translationItems.projectId, id));

      const stats = result[0];
      const translatedCount = Number(stats.translated) || 0;
      const totalCount = Number(stats.total) || 0;
      const percentage = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;

      console.log(`Project ${id} progress: ${translatedCount}/${totalCount} = ${percentage}%`);

      await db
        .update(translationProjects)
        .set({
          translatedItems: translatedCount,
          progressPercentage: percentage,
          isCompleted: percentage === 100,
          updatedAt: new Date()
        })
        .where(eq(translationProjects.id, id));

      console.log(`Successfully updated progress for project ${id}`);
    } catch (error) {
      console.error(`Error updating progress for project ${id}:`, error);
      throw error;
    }
  }

  async createTranslationItem(item: InsertTranslationItem): Promise<TranslationItem> {
    const [newItem] = await db
      .insert(translationItems)
      .values(item)
      .returning();
    return newItem;
  }

  async getProjectItems(projectId: number, limit?: number, offset?: number): Promise<TranslationItem[]> {
    console.log(`Fetching items for project ${projectId}...`);
    const startTime = Date.now();
    
    const items = await db
      .select()
      .from(translationItems)
      .where(eq(translationItems.projectId, projectId))
      .orderBy(translationItems.id);
    
    const endTime = Date.now();
    console.log(`Fetched ${items.length} items in ${endTime - startTime}ms`);
    return items;
  }

  async getProjectItemsCount(projectId: number): Promise<number> {
    const result = await db
      .select({ count: count(translationItems.id) })
      .from(translationItems)
      .where(eq(translationItems.projectId, projectId));
    return result[0]?.count || 0;
  }

  async updateTranslationItem(id: number, updates: Partial<TranslationItem>): Promise<TranslationItem> {
    const [updatedItem] = await db
      .update(translationItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(translationItems.id, id))
      .returning();
    
    if (!updatedItem) {
      throw new Error(`Translation item ${id} not found`);
    }
    
    return updatedItem;
  }

  async deleteTranslationItem(id: number): Promise<void> {
    await db.delete(translationItems).where(eq(translationItems.id, id));
  }

  async bulkUpdateTranslations(updates: Array<{id: number, translatedText: string, translationStatus: string}>): Promise<void> {
    for (const update of updates) {
      await db
        .update(translationItems)
        .set({ 
          translatedText: update.translatedText, 
          status: update.translationStatus,
          updatedAt: new Date()
        })
        .where(eq(translationItems.id, update.id));
    }
  }

  async getUntranslatedItems(projectId: number, limit?: number): Promise<TranslationItem[]> {
    const query = db
      .select()
      .from(translationItems)
      .where(sql`${translationItems.projectId} = ${projectId} AND ${translationItems.status} = 'untranslated'`)
      .orderBy(translationItems.id);

    if (limit) {
      return await query.limit(limit);
    }

    return await query;
  }

  async getApiSettings(): Promise<ApiSettings[]> {
    return await db.select().from(apiSettings);
  }

  async createApiSetting(setting: InsertApiSettings): Promise<ApiSettings> {
    const [newSetting] = await db
      .insert(apiSettings)
      .values(setting)
      .returning();
    return newSetting;
  }

  async updateApiSetting(id: number, updates: Partial<ApiSettings>): Promise<ApiSettings> {
    const [updatedSetting] = await db
      .update(apiSettings)
      .set(updates)
      .where(eq(apiSettings.id, id))
      .returning();
    return updatedSetting;
  }

  async deleteApiSetting(id: number): Promise<void> {
    await db.delete(apiSettings).where(eq(apiSettings.id, id));
  }

  async getGlobalSetting(key: string): Promise<GlobalSettings | undefined> {
    const [setting] = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.settingKey, key));
    return setting || undefined;
  }

  async setGlobalSetting(key: string, value: string, description?: string): Promise<GlobalSettings> {
    const existingSetting = await this.getGlobalSetting(key);
    
    if (existingSetting) {
      const [updated] = await db
        .update(globalSettings)
        .set({ 
          settingValue: value, 
          description: description || existingSetting.description,
          updatedAt: new Date()
        })
        .where(eq(globalSettings.settingKey, key))
        .returning();
      return updated;
    } else {
      const [newSetting] = await db
        .insert(globalSettings)
        .values({ 
          settingKey: key, 
          settingValue: value, 
          description: description || null 
        })
        .returning();
      return newSetting;
    }
  }

  async getAllGlobalSettings(): Promise<GlobalSettings[]> {
    return await db.select().from(globalSettings);
  }

  async deleteGlobalSetting(key: string): Promise<void> {
    await db.delete(globalSettings).where(eq(globalSettings.settingKey, key));
  }

  // Background Tasks Implementation
  async createBackgroundTask(task: InsertBackgroundTask): Promise<BackgroundTask> {
    const [newTask] = await db
      .insert(backgroundTasks)
      .values(task)
      .returning();
    return newTask;
  }

  async getBackgroundTask(id: string): Promise<BackgroundTask | undefined> {
    const [task] = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.id, id));
    return task || undefined;
  }

  async getAllBackgroundTasks(): Promise<BackgroundTask[]> {
    return await db.select().from(backgroundTasks);
  }

  async getActiveBackgroundTasks(): Promise<BackgroundTask[]> {
    return await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.status, 'running'));
  }

  async getProjectBackgroundTasks(projectId: number): Promise<BackgroundTask[]> {
    return await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.projectId, projectId));
  }

  async updateBackgroundTask(id: string, updates: Partial<BackgroundTask>): Promise<BackgroundTask> {
    const [updatedTask] = await db
      .update(backgroundTasks)
      .set({ ...updates, lastActivity: new Date() })
      .where(eq(backgroundTasks.id, id))
      .returning();
    
    if (!updatedTask) {
      throw new Error(`Background task ${id} not found`);
    }
    
    return updatedTask;
  }

  async pauseBackgroundTask(id: string): Promise<void> {
    await this.updateBackgroundTask(id, { 
      status: 'paused', 
      pausedAt: new Date() 
    });
  }

  async resumeBackgroundTask(id: string): Promise<void> {
    await this.updateBackgroundTask(id, { 
      status: 'running', 
      pausedAt: null 
    });
  }

  async completeBackgroundTask(id: string): Promise<void> {
    await this.updateBackgroundTask(id, { 
      status: 'completed', 
      completedAt: new Date(),
      progress: 100
    });
  }

  async deleteBackgroundTask(id: string): Promise<void> {
    await db.delete(backgroundTasks).where(eq(backgroundTasks.id, id));
  }

  // Project Settings Implementation
  async getProjectSettings(projectId: number): Promise<ProjectSettings | undefined> {
    const [settings] = await db
      .select()
      .from(projectSettings)
      .where(eq(projectSettings.projectId, projectId));
    return settings || undefined;
  }

  async createProjectSettings(settings: InsertProjectSettings): Promise<ProjectSettings> {
    const [newSettings] = await db
      .insert(projectSettings)
      .values(settings)
      .returning();
    return newSettings;
  }

  async updateProjectSettings(projectId: number, updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const [updated] = await db
      .update(projectSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectSettings.projectId, projectId))
      .returning();

    if (!updated) {
      throw new Error(`Project settings for project ${projectId} not found`);
    }

    return updated;
  }

  async getChatHistory(projectId: number): Promise<any[]> {
    // For now, return empty array
    // In a full implementation, this would query a dedicated chat_history table
    return [];
  }

  // AI Models Management
  async getAiModels(): Promise<AiModel[]> {
    return await db.select().from(aiModels);
  }

  async createAiModel(model: InsertAiModel): Promise<AiModel> {
    const [newModel] = await db
      .insert(aiModels)
      .values(model)
      .returning();
    return newModel;
  }

  async updateAiModel(modelId: string, updates: Partial<AiModel>): Promise<AiModel> {
    const [updatedModel] = await db
      .update(aiModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiModels.modelId, modelId))
      .returning();
    return updatedModel;
  }

  async importModelsFromProvider(provider: string): Promise<AiModel[]> {
    const modelsData = await this.fetchModelsFromProvider(provider);
    const importedModels: AiModel[] = [];

    for (const modelData of modelsData) {
      try {
        // Check if model already exists
        const [existingModel] = await db
          .select()
          .from(aiModels)
          .where(eq(aiModels.modelId, modelData.modelId));

        if (existingModel) {
          // Update existing model
          const [updatedModel] = await db
            .update(aiModels)
            .set({ ...modelData, updatedAt: new Date() })
            .where(eq(aiModels.modelId, modelData.modelId))
            .returning();
          importedModels.push(updatedModel);
        } else {
          // Create new model
          const [newModel] = await db
            .insert(aiModels)
            .values(modelData)
            .returning();
          importedModels.push(newModel);
        }
      } catch (error) {
        console.error(`Error importing model ${modelData.modelId}:`, error);
      }
    }

    return importedModels;
  }

  private async fetchModelsFromProvider(provider: string): Promise<InsertAiModel[]> {
    const models: InsertAiModel[] = [];

    switch (provider) {
      case 'gemini':
        models.push(
          {
            modelId: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            provider: 'gemini',
            inputCost: 0.00125,
            outputCost: 0.005,
            contextWindow: 2097152,
            description: 'الأفضل من Google للترجمة الدقيقة خاصة في المجالات التقنية والقانونية. يفهم السياق بشكل جيد، ويقدم ترجمات قابلة للنشر مباشرة.',
            capabilities: ['text', 'translation', 'technical'],
            isActive: true
          },
          {
            modelId: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            provider: 'gemini',
            inputCost: 0.000075,
            outputCost: 0.0003,
            contextWindow: 1048576,
            description: 'أسرع وأرخص، مناسب للترجمة العامة والمحتوى اليومي. أقل جودة من Pro من حيث الحفاظ على الأسلوب والمصطلحات.',
            capabilities: ['text', 'translation', 'fast'],
            isActive: true
          }
        );
        break;

      default:
        // Only support Gemini models
        break;
    }

    return models;
  }

  // Usage Statistics
  async createUsageStats(stats: InsertUsageStats): Promise<UsageStats> {
    const [newStats] = await db
      .insert(usageStats)
      .values(stats)
      .returning();
    return newStats;
  }

  async getUsageStats(): Promise<UsageStats[]> {
    return await db.select().from(usageStats);
  }

  async getUsageStatsGrouped(): Promise<Record<string, any>> {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await db.select().from(usageStats);
    
    const result: Record<string, any> = {
      today: { date: today, requestCount: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 },
      total: { requestCount: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 }
    };
    
    stats.forEach(stat => {
      result.total.requestCount += stat.requestCount || 0;
      result.total.inputTokens += stat.inputTokens || 0;
      result.total.outputTokens += stat.outputTokens || 0;
      result.total.totalCost += stat.totalCost || 0;
    });
    
    return result;
  }
}

export const storage = new DatabaseStorage();