import { pgTable, text, serial, integer, boolean, jsonb, timestamp, numeric, index, real, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const translationProjects = pgTable("translation_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // "php", "json", "po", "csv", etc.
  fileSize: integer("file_size").notNull(),
  totalItems: integer("total_items").notNull(),
  translatedItems: integer("translated_items").default(0),
  progressPercentage: integer("progress_percentage").default(0),
  lastOpenedAt: timestamp("last_opened_at"),
  isCompleted: boolean("is_completed").default(false),
  isTranslating: boolean("is_translating").default(false),
  translationPaused: boolean("translation_paused").default(false),
  backgroundTaskId: text("background_task_id"),
  originalContent: text("original_content"), // Store original file content
  formatMetadata: jsonb("format_metadata"), // Store original format details
  metadata: jsonb("metadata"), // Additional project metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const backgroundTasks = pgTable("background_tasks", {
  id: text("id").primaryKey(),
  projectId: integer("project_id").references(() => translationProjects.id).notNull(),
  type: text("type").notNull(), // 'translation', 'batch_translation'
  status: text("status").notNull(), // 'running', 'paused', 'completed', 'failed'
  progress: integer("progress").default(0),
  totalItems: integer("total_items").default(0),
  processedItems: integer("processed_items").default(0),
  currentBatch: integer("current_batch").default(0),
  totalBatches: integer("total_batches").default(0),
  settings: jsonb("settings"), // Provider, model, etc.
  startedAt: timestamp("started_at").defaultNow(),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  lastActivity: timestamp("last_activity").defaultNow(),
  errorMessage: text("error_message"),
});

export const translationItems = pgTable("translation_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => translationProjects.id).notNull(),
  key: text("key").notNull(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text"),
  status: text("status").notNull().default("untranslated"), // "untranslated", "translated", "needs_review", "error"
  selected: boolean("selected").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("translation_items_project_id_idx").on(table.projectId),
  statusIdx: index("translation_items_status_idx").on(table.status),
  selectedIdx: index("translation_items_selected_idx").on(table.selected),
}));

export const apiSettings = pgTable("api_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // "openai", "gemini", "deepseek", "anthropic", "xai"
  apiKey: text("api_key").notNull(),
  model: text("model").notNull(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const globalSettings = pgTable("global_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  logId: text("log_id").notNull().unique(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  level: text("level").notNull(), // 'info' | 'warning' | 'error' | 'success'
  category: text("category").notNull(), // 'system' | 'database' | 'api' | 'translation' | 'project' | 'ai-cost'
  message: text("message").notNull(),
  details: jsonb("details"),
  projectId: integer("project_id"),
  projectName: text("project_name"),
  endpoint: text("endpoint"),
  statusCode: integer("status_code"),
  aiModel: text("ai_model"),
  aiProvider: text("ai_provider"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 6 }),
  currency: text("currency"),
  duration: integer("duration"),
}, (table) => ({
  timestampIdx: index("system_logs_timestamp_idx").on(table.timestamp),
  categoryIdx: index("system_logs_category_idx").on(table.category),
  levelIdx: index("system_logs_level_idx").on(table.level),
  projectIdIdx: index("system_logs_project_id_idx").on(table.projectId),
}));

export const projectSettings = pgTable("project_settings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => translationProjects.id).notNull(),
  manualTranslationModel: text("manual_translation_model").default("gemini-1.5-pro"),
  batchTranslationModel: text("batch_translation_model").default("gemini-1.5-flash"),
  defaultProvider: text("default_provider").default("gemini"),
  autoSaveEnabled: boolean("auto_save_enabled").default(true),
  smartGroupingEnabled: boolean("smart_grouping_enabled").default(true),
  cacheEnabled: boolean("cache_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("project_settings_project_id_idx").on(table.projectId),
]);

export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  modelId: text("model_id").notNull().unique(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  inputCost: real("input_cost").default(0),
  outputCost: real("output_cost").default(0),
  contextWindow: integer("context_window").default(4096),
  description: text("description"),
  capabilities: text("capabilities").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("ai_models_provider_idx").on(table.provider),
  index("ai_models_active_idx").on(table.isActive),
]);

export const usageStats = pgTable("usage_stats", {
  id: serial("id").primaryKey(),
  modelId: text("model_id").notNull(),
  projectId: integer("project_id"),
  requestCount: integer("request_count").default(0),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalCost: real("total_cost").default(0),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("usage_stats_model_idx").on(table.modelId),
  index("usage_stats_project_idx").on(table.projectId),
  index("usage_stats_date_idx").on(table.date),
]);

export const insertTranslationProjectSchema = createInsertSchema(translationProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  formatMetadata: z.any().optional()
});

export const insertTranslationItemSchema = createInsertSchema(translationItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiSettingsSchema = createInsertSchema(apiSettings).omit({
  id: true,
  createdAt: true,
});

export const insertGlobalSettingsSchema = createInsertSchema(globalSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

export const insertProjectSettingsSchema = createInsertSchema(projectSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBackgroundTaskSchema = createInsertSchema(backgroundTasks).omit({
  startedAt: true,
  lastActivity: true,
}).extend({
  settings: z.any().optional()
});

export const insertAiModelSchema = createInsertSchema(aiModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsageStatsSchema = createInsertSchema(usageStats).omit({
  id: true,
  createdAt: true,
});

// Relations
export const aiModelRelations = relations(aiModels, ({ many }) => ({
  usageStats: many(usageStats),
}));

export const usageStatsRelations = relations(usageStats, ({ one }) => ({
  model: one(aiModels, {
    fields: [usageStats.modelId],
    references: [aiModels.modelId],
  }),
  project: one(translationProjects, {
    fields: [usageStats.projectId],
    references: [translationProjects.id],
  }),
}));

export type InsertTranslationProject = z.infer<typeof insertTranslationProjectSchema>;
export type InsertTranslationItem = z.infer<typeof insertTranslationItemSchema>;
export type InsertApiSettings = z.infer<typeof insertApiSettingsSchema>;
export type InsertGlobalSettings = z.infer<typeof insertGlobalSettingsSchema>;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type InsertProjectSettings = z.infer<typeof insertProjectSettingsSchema>;
export type InsertBackgroundTask = z.infer<typeof insertBackgroundTaskSchema>;
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;
export type InsertUsageStats = z.infer<typeof insertUsageStatsSchema>;

export type TranslationProject = typeof translationProjects.$inferSelect;
export type TranslationItem = typeof translationItems.$inferSelect;
export type ApiSettings = typeof apiSettings.$inferSelect;
export type GlobalSettings = typeof globalSettings.$inferSelect;
export type SystemLog = typeof systemLogs.$inferSelect;
export type ProjectSettings = typeof projectSettings.$inferSelect;
export type BackgroundTask = typeof backgroundTasks.$inferSelect;
export type AiModel = typeof aiModels.$inferSelect;
export type UsageStats = typeof usageStats.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
