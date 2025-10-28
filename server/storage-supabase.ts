/**
 * Supabase Storage Implementation
 * Direct connection using @supabase/supabase-js
 */

import { supabase } from "./supabase";
import type {
  User, InsertUser, TranslationProject, InsertTranslationProject,
  TranslationItem, InsertTranslationItem, ApiSettings, InsertApiSettings,
  GlobalSettings, InsertGlobalSettings, ProjectSettings, InsertProjectSettings,
  BackgroundTask, InsertBackgroundTask, SystemLog, InsertSystemLog,
  AiModel, InsertAiModel, UsageStats, InsertUsageStats
} from "@shared/schema";

export class SupabaseStorage {
  // User Management
  async getUser(id: number): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Project Management
  async createProject(project: InsertTranslationProject): Promise<TranslationProject> {
    const { data, error } = await supabase
      .from('translation_projects')
      .insert({
        ...project,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getProject(id: number): Promise<TranslationProject | undefined> {
    const { data, error } = await supabase
      .from('translation_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async getAllProjects(): Promise<TranslationProject[]> {
    const { data, error } = await supabase
      .from('translation_projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateProject(id: number, updates: Partial<TranslationProject>): Promise<TranslationProject> {
    const { data, error } = await supabase
      .from('translation_projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProject(id: number): Promise<void> {
    const { error } = await supabase
      .from('translation_projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async updateProjectLastOpened(id: number): Promise<void> {
    const { error } = await supabase
      .from('translation_projects')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async updateProjectProgress(id: number): Promise<void> {
    const items = await this.getProjectItems(id);
    const translatedCount = items.filter(item => item.status === 'translated').length;
    const totalCount = items.length;
    const progressPercentage = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;

    const { error } = await supabase
      .from('translation_projects')
      .update({
        translated_items: translatedCount,
        progress_percentage: progressPercentage,
        is_completed: progressPercentage === 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  // Translation Items
  async createTranslationItem(item: InsertTranslationItem): Promise<TranslationItem> {
    const { data, error } = await supabase
      .from('translation_items')
      .insert({
        ...item,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getProjectItems(projectId: number, limit?: number, offset?: number): Promise<TranslationItem[]> {
    let query = supabase
      .from('translation_items')
      .select('*')
      .eq('project_id', projectId);

    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 1000) - 1);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getProjectItemsCount(projectId: number): Promise<number> {
    const { count, error } = await supabase
      .from('translation_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) throw error;
    return count || 0;
  }

  async updateTranslationItem(id: number, updates: Partial<TranslationItem>): Promise<TranslationItem> {
    const { data, error } = await supabase
      .from('translation_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTranslationItem(id: number): Promise<void> {
    const { error } = await supabase
      .from('translation_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async bulkUpdateTranslations(updates: Array<{id: number, translatedText: string, translationStatus: string}>): Promise<void> {
    for (const update of updates) {
      await this.updateTranslationItem(update.id, {
        translatedText: update.translatedText,
        status: update.translationStatus
      });
    }
  }

  async getUntranslatedItems(projectId: number, limit?: number): Promise<TranslationItem[]> {
    let query = supabase
      .from('translation_items')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'untranslated');

    if (limit) query = query.limit(limit);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  // API Settings
  async getApiSettings(): Promise<ApiSettings[]> {
    const { data, error } = await supabase
      .from('api_settings')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async createApiSetting(setting: InsertApiSettings): Promise<ApiSettings> {
    const { data, error } = await supabase
      .from('api_settings')
      .insert({ ...setting, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateApiSetting(id: number, updates: Partial<ApiSettings>): Promise<ApiSettings> {
    const { data, error } = await supabase
      .from('api_settings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteApiSetting(id: number): Promise<void> {
    const { error } = await supabase
      .from('api_settings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Global Settings
  async getGlobalSetting(key: string): Promise<GlobalSettings | undefined> {
    const { data, error } = await supabase
      .from('global_settings')
      .select('*')
      .eq('setting_key', key)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async setGlobalSetting(key: string, value: string, description?: string): Promise<GlobalSettings> {
    const existing = await this.getGlobalSetting(key);

    if (existing) {
      const { data, error } = await supabase
        .from('global_settings')
        .update({
          setting_value: value,
          description,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', key)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('global_settings')
        .insert({
          setting_key: key,
          setting_value: value,
          description,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async getAllGlobalSettings(): Promise<GlobalSettings[]> {
    const { data, error } = await supabase
      .from('global_settings')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async deleteGlobalSetting(key: string): Promise<void> {
    const { error } = await supabase
      .from('global_settings')
      .delete()
      .eq('setting_key', key);

    if (error) throw error;
  }

  // Background Tasks
  async createBackgroundTask(task: InsertBackgroundTask): Promise<BackgroundTask> {
    const { data, error } = await supabase
      .from('background_tasks')
      .insert({
        ...task,
        started_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getBackgroundTask(id: string): Promise<BackgroundTask | undefined> {
    const { data, error } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async getAllBackgroundTasks(): Promise<BackgroundTask[]> {
    const { data, error } = await supabase
      .from('background_tasks')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getActiveBackgroundTasks(): Promise<BackgroundTask[]> {
    const { data, error } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('status', 'running');

    if (error) throw error;
    return data || [];
  }

  async getProjectBackgroundTasks(projectId: number): Promise<BackgroundTask[]> {
    const { data, error } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateBackgroundTask(id: string, updates: Partial<BackgroundTask>): Promise<BackgroundTask> {
    const { data, error } = await supabase
      .from('background_tasks')
      .update({ ...updates, last_activity: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async pauseBackgroundTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('background_tasks')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async resumeBackgroundTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('background_tasks')
      .update({
        status: 'running',
        paused_at: null,
        last_activity: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async completeBackgroundTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('background_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async failBackgroundTask(id: string, errorMsg: string): Promise<void> {
    const { error } = await supabase
      .from('background_tasks')
      .update({
        status: 'failed',
        error_message: errorMsg,
        last_activity: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  // System Logs
  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const { data, error } = await supabase
      .from('system_logs')
      .insert({ ...log, timestamp: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSystemLogs(options: {
    limit?: number;
    offset?: number;
    level?: string;
    category?: string;
  }): Promise<SystemLog[]> {
    let query = supabase
      .from('system_logs')
      .select('*');

    if (options.level) {
      query = query.eq('level', options.level);
    }
    if (options.category) {
      query = query.eq('category', options.category);
    }

    query = query.order('timestamp', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async clearSystemLogs(): Promise<void> {
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .neq('id', 0); // Delete all

    if (error) throw error;
  }

  // AI Models
  async getAllAiModels(): Promise<AiModel[]> {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .order('provider', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getAiModel(id: number): Promise<AiModel | undefined> {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async getAiModelByProviderAndModel(provider: string, model: string): Promise<AiModel | undefined> {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('provider', provider)
      .eq('model_id', model)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async createAiModel(model: InsertAiModel): Promise<AiModel> {
    const { data, error } = await supabase
      .from('ai_models')
      .insert({
        ...model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAiModel(id: number, updates: Partial<AiModel>): Promise<AiModel> {
    const { data, error } = await supabase
      .from('ai_models')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteAiModel(id: number): Promise<void> {
    const { error } = await supabase
      .from('ai_models')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Usage Statistics
  async createUsageStats(stats: InsertUsageStats): Promise<UsageStats> {
    const { data, error } = await supabase
      .from('usage_stats')
      .insert({ ...stats, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUsageStats(limit?: number, offset?: number): Promise<UsageStats[]> {
    let query = supabase
      .from('usage_stats')
      .select('*')
      .order('date', { ascending: false });

    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit || 50) - 1);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getUsageStatsByDateRange(startDate: Date, endDate: Date): Promise<UsageStats[]> {
    const { data, error } = await supabase
      .from('usage_stats')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getUsageStatsByProvider(provider: string): Promise<UsageStats[]> {
    // First get model IDs for this provider
    const { data: models, error: modelsError } = await supabase
      .from('ai_models')
      .select('model_id')
      .eq('provider', provider);

    if (modelsError) throw modelsError;

    if (!models || models.length === 0) {
      return [];
    }

    const modelIds = models.map(m => m.model_id);

    const { data, error } = await supabase
      .from('usage_stats')
      .select('*')
      .in('model_id', modelIds)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Project Settings
  async getProjectSettings(projectId: number): Promise<ProjectSettings | undefined> {
    const { data, error } = await supabase
      .from('project_settings')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async createProjectSettings(settings: InsertProjectSettings): Promise<ProjectSettings> {
    const { data, error } = await supabase
      .from('project_settings')
      .insert({
        ...settings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProjectSettings(projectId: number, updates: Partial<ProjectSettings>): Promise<ProjectSettings> {
    const { data, error } = await supabase
      .from('project_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const storage = new SupabaseStorage();
