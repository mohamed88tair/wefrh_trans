/**
 * Database Storage Implementation using Drizzle ORM
 * Direct connection to Supabase PostgreSQL database
 */

import { db } from "./db";
import {
  users, translationProjects, translationItems, apiSettings, globalSettings,
  projectSettings, backgroundTasks, systemLogs, aiModels, usageStats,
  type User, type InsertUser, type TranslationProject, type InsertTranslationProject,
  type TranslationItem, type InsertTranslationItem, type ApiSettings, type InsertApiSettings,
  type GlobalSettings, type InsertGlobalSettings, type ProjectSettings, type InsertProjectSettings,
  type BackgroundTask, type InsertBackgroundTask, type SystemLog, type InsertSystemLog,
  type AiModel, type InsertAiModel, type UsageStats, type InsertUsageStats
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";

export class DatabaseStorage {
  // User Management
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Project Management
  async createProject(project: InsertTranslationProject): Promise<TranslationProject> {
    const result = await db.insert(translationProjects).values({
      ...project,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async getProject(id: number): Promise<TranslationProject | undefined> {
    const result = await db.select().from(translationProjects).where(eq(translationProjects.id, id));
    return result[0];
  }

  async getAllProjects(): Promise<TranslationProject[]> {
    return await db.select().from(translationProjects).orderBy(desc(translationProjects.updatedAt));
  }

  async updateProject(id: number, updates: Partial<TranslationProject>): Promise<TranslationProject> {
    const result = await db.update(translationProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(translationProjects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(translationProjects).where(eq(translationProjects.id, id));
  }

  async updateProjectLastOpened(id: number): Promise<void> {
    await db.update(translationProjects)
      .set({ lastOpenedAt: new Date() })
      .where(eq(translationProjects.id, id));
  }

  async updateProjectProgress(id: number): Promise<void> {
    const items = await this.getProjectItems(id);
    const translatedCount = items.filter(item => item.status === 'translated').length;
    const totalCount = items.length;
    const progressPercentage = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;

    await db.update(translationProjects)
      .set({
        translatedItems: translatedCount,
        progressPercentage,
        isCompleted: progressPercentage === 100,
        updatedAt: new Date()
      })
      .where(eq(translationProjects.id, id));
  }

  // Translation Items
  async createTranslationItem(item: InsertTranslationItem): Promise<TranslationItem> {
    const result = await db.insert(translationItems).values({
      ...item,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async getProjectItems(projectId: number, limit?: number, offset?: number): Promise<TranslationItem[]> {
    let query = db.select().from(translationItems).where(eq(translationItems.projectId, projectId));

    if (limit) {
      query = query.limit(limit) as any;
    }
    if (offset) {
      query = query.offset(offset) as any;
    }

    return await query;
  }

  async getProjectItemsCount(projectId: number): Promise<number> {
    const items = await db.select().from(translationItems).where(eq(translationItems.projectId, projectId));
    return items.length;
  }

  async updateTranslationItem(id: number, updates: Partial<TranslationItem>): Promise<TranslationItem> {
    const result = await db.update(translationItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(translationItems.id, id))
      .returning();
    return result[0];
  }

  async deleteTranslationItem(id: number): Promise<void> {
    await db.delete(translationItems).where(eq(translationItems.id, id));
  }

  async bulkUpdateTranslations(updates: Array<{id: number, translatedText: string, translationStatus: string}>): Promise<void> {
    for (const update of updates) {
      await db.update(translationItems)
        .set({
          translatedText: update.translatedText,
          status: update.translationStatus,
          updatedAt: new Date()
        })
        .where(eq(translationItems.id, update.id));
    }
  }

  async getUntranslatedItems(projectId: number, limit?: number): Promise<TranslationItem[]> {
    let query = db.select().from(translationItems)
      .where(and(
        eq(translationItems.projectId, projectId),
        eq(translationItems.status, 'untranslated')
      ));

    if (limit) {
      query = query.limit(limit) as any;
    }

    return await query;
  }

  // API Settings
  async getApiSettings(): Promise<ApiSettings[]> {
    return await db.select().from(apiSettings);
  }

  async createApiSetting(setting: InsertApiSettings): Promise<ApiSettings> {
    const result = await db.insert(apiSettings).values({
      ...setting,
      createdAt: new Date()
    }).returning();
    return result[0];
  }

  async updateApiSetting(id: number, updates: Partial<ApiSettings>): Promise<ApiSettings> {
    const result = await db.update(apiSettings)
      .set(updates)
      .where(eq(apiSettings.id, id))
      .returning();
    return result[0];
  }

  async deleteApiSetting(id: number): Promise<void> {
    await db.delete(apiSettings).where(eq(apiSettings.id, id));
  }

  // Global Settings
  async getGlobalSetting(key: string): Promise<GlobalSettings | undefined> {
    const result = await db.select().from(globalSettings).where(eq(globalSettings.settingKey, key));
    return result[0];
  }

  async setGlobalSetting(key: string, value: string, description?: string): Promise<GlobalSettings> {
    const existing = await this.getGlobalSetting(key);

    if (existing) {
      const result = await db.update(globalSettings)
        .set({ settingValue: value, description, updatedAt: new Date() })
        .where(eq(globalSettings.settingKey, key))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(globalSettings).values({
        settingKey: key,
        settingValue: value,
        description,
        updatedAt: new Date()
      }).returning();
      return result[0];
    }
  }

  async getAllGlobalSettings(): Promise<GlobalSettings[]> {
    return await db.select().from(globalSettings);
  }

  async deleteGlobalSetting(key: string): Promise<void> {
    await db.delete(globalSettings).where(eq(globalSettings.settingKey, key));
  }

  // Background Tasks
  async createBackgroundTask(task: InsertBackgroundTask): Promise<BackgroundTask> {
    const result = await db.insert(backgroundTasks).values({
      ...task,
      startedAt: new Date(),
      lastActivity: new Date()
    }).returning();
    return result[0];
  }

  async getBackgroundTask(id: string): Promise<BackgroundTask | undefined> {
    const result = await db.select().from(backgroundTasks).where(eq(backgroundTasks.id, id));
    return result[0];
  }

  async getAllBackgroundTasks(): Promise<BackgroundTask[]> {
    return await db.select().from(backgroundTasks).orderBy(desc(backgroundTasks.startedAt));
  }

  async getActiveBackgroundTasks(): Promise<BackgroundTask[]> {
    return await db.select().from(backgroundTasks)
      .where(eq(backgroundTasks.status, 'running'));
  }

  async getProjectBackgroundTasks(projectId: number): Promise<BackgroundTask[]> {
    return await db.select().from(backgroundTasks)
      .where(eq(backgroundTasks.projectId, projectId))
      .orderBy(desc(backgroundTasks.startedAt));
  }

  async updateBackgroundTask(id: string, updates: Partial<BackgroundTask>): Promise<BackgroundTask> {
    const result = await db.update(backgroundTasks)
      .set({ ...updates, lastActivity: new Date() })
      .where(eq(backgroundTasks.id, id))
      .returning();
    return result[0];
  }

  async pauseBackgroundTask(id: string): Promise<void> {
    await db.update(backgroundTasks)
      .set({ status: 'paused', pausedAt: new Date(), lastActivity: new Date() })
      .where(eq(backgroundTasks.id, id));
  }

  async resumeBackgroundTask(id: string): Promise<void> {
    await db.update(backgroundTasks)
      .set({ status: 'running', pausedAt: null, lastActivity: new Date() })
      .where(eq(backgroundTasks.id, id));
  }

  async completeBackgroundTask(id: string): Promise<void> {
    await db.update(backgroundTasks)
      .set({ status: 'completed', completedAt: new Date(), lastActivity: new Date() })
      .where(eq(backgroundTasks.id, id));
  }

  async failBackgroundTask(id: string, error: string): Promise<void> {
    await db.update(backgroundTasks)
      .set({ status: 'failed', errorMessage: error, lastActivity: new Date() })
      .where(eq(backgroundTasks.id, id));
  }

  // System Logs
  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const result = await db.insert(systemLogs).values({
      ...log,
      timestamp: new Date()
    }).returning();
    return result[0];
  }

  async getSystemLogs(options: {
    limit?: number;
    offset?: number;
    level?: string;
    category?: string;
  }): Promise<SystemLog[]> {
    let query = db.select().from(systemLogs);

    const conditions = [];
    if (options.level) {
      conditions.push(eq(systemLogs.level, options.level));
    }
    if (options.category) {
      conditions.push(eq(systemLogs.category, options.category));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(systemLogs.timestamp)) as any;

    if (options.limit) {
      query = query.limit(options.limit) as any;
    }
    if (options.offset) {
      query = query.offset(options.offset) as any;
    }

    return await query;
  }

  async clearSystemLogs(): Promise<void> {
    await db.delete(systemLogs);
  }

  // AI Models
  async getAllAiModels(): Promise<AiModel[]> {
    return await db.select().from(aiModels).orderBy(asc(aiModels.provider));
  }

  async getAiModel(id: number): Promise<AiModel | undefined> {
    const result = await db.select().from(aiModels).where(eq(aiModels.id, id));
    return result[0];
  }

  async getAiModelByProviderAndModel(provider: string, model: string): Promise<AiModel | undefined> {
    const result = await db.select().from(aiModels)
      .where(and(
        eq(aiModels.provider, provider),
        eq(aiModels.modelId, model)
      ));
    return result[0];
  }

  async createAiModel(model: InsertAiModel): Promise<AiModel> {
    const result = await db.insert(aiModels).values({
      ...model,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel> {
    const result = await db.update(aiModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiModels.id, id))
      .returning();
    return result[0];
  }

  async deleteAiModel(id: number): Promise<void> {
    await db.delete(aiModels).where(eq(aiModels.id, id));
  }

  // Usage Statistics
  async createUsageStats(stats: InsertUsageStats): Promise<UsageStats> {
    const result = await db.insert(usageStats).values({
      ...stats,
      createdAt: new Date()
    }).returning();
    return result[0];
  }

  async getUsageStats(limit?: number, offset?: number): Promise<UsageStats[]> {
    let query = db.select().from(usageStats).orderBy(desc(usageStats.date));

    if (limit) {
      query = query.limit(limit) as any;
    }
    if (offset) {
      query = query.offset(offset) as any;
    }

    return await query;
  }

  async getUsageStatsByDateRange(startDate: Date, endDate: Date): Promise<UsageStats[]> {
    return await db.select().from(usageStats)
      .where(and(
        gte(usageStats.date, startDate.toISOString().split('T')[0]),
        lte(usageStats.date, endDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(usageStats.date));
  }

  async getUsageStatsByProvider(provider: string): Promise<UsageStats[]> {
    const models = await db.select().from(aiModels)
      .where(eq(aiModels.provider, provider));

    const modelIds = models.map(m => m.modelId);

    if (modelIds.length === 0) {
      return [];
    }

    return await db.select().from(usageStats)
      .orderBy(desc(usageStats.date));
  }

  // Project Settings
  async getProjectSettings(projectId: number): Promise<ProjectSettings | undefined> {
    const result = await db.select().from(projectSettings)
      .where(eq(projectSettings.projectId, projectId));
    return result[0];
  }

  async createProjectSettings(settings: InsertProjectSettings): Promise<ProjectSettings> {
    const result = await db.insert(projectSettings).values({
      ...settings,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async updateProjectSettings(projectId: number, updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const result = await db.update(projectSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectSettings.projectId, projectId))
      .returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
