/*
  # Translation System Database Schema
  
  1. New Tables
    - `users` - User accounts for authentication
      - `id` (serial, primary key)
      - `username` (text, unique, not null)
      - `password` (text, not null)
      
    - `translation_projects` - Translation projects with metadata
      - `id` (serial, primary key)
      - `name` (text, not null) - Project name
      - `file_name` (text, not null) - Original file name
      - `file_type` (text, not null) - File type (php, json, po, csv)
      - `file_size` (integer, not null) - File size in bytes
      - `total_items` (integer, not null) - Total translation items
      - `translated_items` (integer, default 0) - Number of translated items
      - `progress_percentage` (integer, default 0) - Progress percentage
      - `last_opened_at` (timestamptz) - Last opened timestamp
      - `is_completed` (boolean, default false) - Completion status
      - `is_translating` (boolean, default false) - Currently translating flag
      - `translation_paused` (boolean, default false) - Translation paused flag
      - `background_task_id` (text) - Related background task ID
      - `original_content` (text) - Original file content
      - `format_metadata` (jsonb) - Format-specific metadata
      - `metadata` (jsonb) - Additional metadata
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      
    - `translation_items` - Individual translation items
      - `id` (serial, primary key)
      - `project_id` (integer, references translation_projects) - Parent project
      - `key` (text, not null) - Translation key
      - `original_text` (text, not null) - Original text
      - `translated_text` (text) - Translated text
      - `status` (text, default 'untranslated') - Translation status
      - `selected` (boolean, default false) - Selection flag
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      
    - `api_settings` - API provider settings
      - `id` (serial, primary key)
      - `provider` (text, not null) - Provider name (openai, gemini, anthropic, xai, deepseek)
      - `api_key` (text, not null) - API key
      - `model` (text, not null) - Model name
      - `is_active` (boolean, default false) - Active status
      - `created_at` (timestamptz, default now())
      
    - `global_settings` - Global application settings
      - `id` (serial, primary key)
      - `setting_key` (text, unique, not null) - Setting key
      - `setting_value` (text, not null) - Setting value
      - `description` (text) - Setting description
      - `updated_at` (timestamptz, default now())
      
    - `background_tasks` - Background translation tasks
      - `id` (text, primary key) - Task ID
      - `project_id` (integer, references translation_projects, not null)
      - `type` (text, not null) - Task type (translation, batch_translation)
      - `status` (text, not null) - Task status (running, paused, completed, failed)
      - `progress` (integer, default 0) - Progress percentage
      - `total_items` (integer, default 0) - Total items to process
      - `processed_items` (integer, default 0) - Processed items count
      - `current_batch` (integer, default 0) - Current batch number
      - `total_batches` (integer, default 0) - Total batches
      - `settings` (jsonb) - Task settings
      - `started_at` (timestamptz, default now())
      - `paused_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `last_activity` (timestamptz, default now())
      - `error_message` (text) - Error message if failed
      
    - `system_logs` - System activity logs
      - `id` (serial, primary key)
      - `log_id` (text, unique, not null) - Unique log ID
      - `timestamp` (timestamptz, default now())
      - `level` (text, not null) - Log level (info, warning, error, success)
      - `category` (text, not null) - Log category (system, database, api, translation, project, ai-cost)
      - `message` (text, not null) - Log message
      - `details` (jsonb) - Additional details
      - `project_id` (integer) - Related project ID
      - `project_name` (text) - Project name
      - `endpoint` (text) - API endpoint
      - `status_code` (integer) - HTTP status code
      - `ai_model` (text) - AI model used
      - `ai_provider` (text) - AI provider
      - `input_tokens` (integer) - Input tokens count
      - `output_tokens` (integer) - Output tokens count
      - `total_tokens` (integer) - Total tokens
      - `estimated_cost` (numeric(10,6)) - Estimated cost
      - `currency` (text) - Currency code
      - `duration` (integer) - Duration in milliseconds
      
    - `project_settings` - Per-project settings
      - `id` (serial, primary key)
      - `project_id` (integer, references translation_projects, not null)
      - `manual_translation_model` (text, default 'gemini-1.5-pro')
      - `batch_translation_model` (text, default 'gemini-1.5-flash')
      - `default_provider` (text, default 'gemini')
      - `auto_save_enabled` (boolean, default true)
      - `smart_grouping_enabled` (boolean, default true)
      - `cache_enabled` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      
    - `ai_models` - AI model definitions with pricing
      - `id` (serial, primary key)
      - `model_id` (text, unique, not null) - Model identifier
      - `name` (text, not null) - Model display name
      - `provider` (text, not null) - Provider name
      - `input_cost` (real, default 0) - Input cost per million tokens
      - `output_cost` (real, default 0) - Output cost per million tokens
      - `context_window` (integer, default 4096) - Context window size
      - `description` (text) - Model description
      - `capabilities` (text[]) - Model capabilities array
      - `is_active` (boolean, default true) - Active status
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      
    - `usage_stats` - AI usage statistics
      - `id` (serial, primary key)
      - `model_id` (text, not null) - Model identifier
      - `project_id` (integer) - Related project
      - `request_count` (integer, default 0) - Number of requests
      - `input_tokens` (integer, default 0) - Total input tokens
      - `output_tokens` (integer, default 0) - Total output tokens
      - `total_cost` (real, default 0) - Total cost
      - `date` (date, not null) - Statistics date
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access (will be configured later with auth system)

  3. Indexes
    - translation_items: project_id, status, selected
    - system_logs: timestamp, category, level, project_id
    - project_settings: project_id
    - ai_models: provider, is_active
    - usage_stats: model_id, project_id, date

  4. Important Notes
    - All timestamps use timestamptz for timezone support
    - Foreign keys use ON DELETE CASCADE for data integrity
    - JSONB columns for flexible metadata storage
    - Indexes on frequently queried columns for performance
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- Create translation_projects table
CREATE TABLE IF NOT EXISTS translation_projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  total_items INTEGER NOT NULL,
  translated_items INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  is_translating BOOLEAN DEFAULT false,
  translation_paused BOOLEAN DEFAULT false,
  background_task_id TEXT,
  original_content TEXT,
  format_metadata JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create translation_items table
CREATE TABLE IF NOT EXISTS translation_items (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES translation_projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  status TEXT NOT NULL DEFAULT 'untranslated',
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for translation_items
CREATE INDEX IF NOT EXISTS translation_items_project_id_idx ON translation_items(project_id);
CREATE INDEX IF NOT EXISTS translation_items_status_idx ON translation_items(status);
CREATE INDEX IF NOT EXISTS translation_items_selected_idx ON translation_items(selected);

-- Create api_settings table
CREATE TABLE IF NOT EXISTS api_settings (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create global_settings table
CREATE TABLE IF NOT EXISTS global_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create background_tasks table
CREATE TABLE IF NOT EXISTS background_tasks (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES translation_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER DEFAULT 0,
  settings JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT now(),
  error_message TEXT
);

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  log_id TEXT NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  project_id INTEGER,
  project_name TEXT,
  endpoint TEXT,
  status_code INTEGER,
  ai_model TEXT,
  ai_provider TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost NUMERIC(10,6),
  currency TEXT,
  duration INTEGER
);

-- Create indexes for system_logs
CREATE INDEX IF NOT EXISTS system_logs_timestamp_idx ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS system_logs_category_idx ON system_logs(category);
CREATE INDEX IF NOT EXISTS system_logs_level_idx ON system_logs(level);
CREATE INDEX IF NOT EXISTS system_logs_project_id_idx ON system_logs(project_id);

-- Create project_settings table
CREATE TABLE IF NOT EXISTS project_settings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES translation_projects(id) ON DELETE CASCADE,
  manual_translation_model TEXT DEFAULT 'gemini-1.5-pro',
  batch_translation_model TEXT DEFAULT 'gemini-1.5-flash',
  default_provider TEXT DEFAULT 'gemini',
  auto_save_enabled BOOLEAN DEFAULT true,
  smart_grouping_enabled BOOLEAN DEFAULT true,
  cache_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index for project_settings
CREATE INDEX IF NOT EXISTS project_settings_project_id_idx ON project_settings(project_id);

-- Create ai_models table
CREATE TABLE IF NOT EXISTS ai_models (
  id SERIAL PRIMARY KEY,
  model_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_cost REAL DEFAULT 0,
  output_cost REAL DEFAULT 0,
  context_window INTEGER DEFAULT 4096,
  description TEXT,
  capabilities TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for ai_models
CREATE INDEX IF NOT EXISTS ai_models_provider_idx ON ai_models(provider);
CREATE INDEX IF NOT EXISTS ai_models_active_idx ON ai_models(is_active);

-- Create usage_stats table
CREATE TABLE IF NOT EXISTS usage_stats (
  id SERIAL PRIMARY KEY,
  model_id TEXT NOT NULL,
  project_id INTEGER,
  request_count INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for usage_stats
CREATE INDEX IF NOT EXISTS usage_stats_model_idx ON usage_stats(model_id);
CREATE INDEX IF NOT EXISTS usage_stats_project_idx ON usage_stats(project_id);
CREATE INDEX IF NOT EXISTS usage_stats_date_idx ON usage_stats(date);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (will be restricted later with auth)
CREATE POLICY "Allow all operations for now" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON translation_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON translation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON api_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON global_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON background_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON project_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON ai_models FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for now" ON usage_stats FOR ALL USING (true) WITH CHECK (true);
