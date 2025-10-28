import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-supabase";
import { logger, logError, logSuccess, logWarning, logInfo, logAIUsage, apiLoggingMiddleware } from "./logger";
import { aiCostTracker, AI_MODEL_PRICING } from "@shared/ai-cost-tracker";
import { 
  insertTranslationProjectSchema, 
  insertTranslationItemSchema, 
  insertApiSettingsSchema,
  insertBackgroundTaskSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Add API logging middleware
  app.use(apiLoggingMiddleware);
  
  // System Logs API - Updated to use database storage
  app.get("/api/logs", async (req, res) => {
    try {
      const { limit, level, category, offset } = req.query;
      
      // Get logs from database with filtering
      const logs = await logger.getLogsFromDB({
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        level: level && level !== 'all' ? level as string : undefined,
        category: category && category !== 'all' ? category as string : undefined,
      });
      
      // Convert database logs to match frontend format
      const formattedLogs = logs.map(log => ({
        id: log.logId,
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        message: log.message,
        details: log.details,
        projectId: log.projectId,
        projectName: log.projectName,
        endpoint: log.endpoint,
        statusCode: log.statusCode,
        aiModel: log.aiModel,
        aiProvider: log.aiProvider,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        estimatedCost: log.estimatedCost ? parseFloat(log.estimatedCost.toString()) : undefined,
        currency: log.currency,
        duration: log.duration,
      }));
      
      res.json(formattedLogs);
    } catch (error) {
      logError('api', 'Failed to fetch logs from database', error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get("/api/logs/stats", async (req, res) => {
    try {
      // Get stats from database
      const stats = await logger.getStatsFromDB();
      res.json(stats);
    } catch (error) {
      logError('api', 'Failed to fetch log stats from database', error);
      res.status(500).json({ message: "Failed to fetch log stats" });
    }
  });

  // Clear all logs endpoint
  app.delete("/api/logs", async (req, res) => {
    try {
      await logger.clearAllLogs();
      res.json({ message: "All logs cleared successfully" });
    } catch (error) {
      logError('api', 'Failed to clear logs', error);
      res.status(500).json({ message: "Failed to clear logs" });
    }
  });

  // AI Cost Tracking API
  app.get("/api/ai-costs", async (req, res) => {
    try {
      const { limit } = req.query;
      const records = aiCostTracker.getUsageRecords(limit ? parseInt(limit as string) : undefined);
      res.json(records);
    } catch (error) {
      logError('api', 'Failed to fetch AI cost records', error);
      res.status(500).json({ message: "Failed to fetch AI cost records" });
    }
  });

  app.get("/api/ai-costs/daily", async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const stats = aiCostTracker.getDailyStats(targetDate);
      res.json(stats);
    } catch (error) {
      logError('api', 'Failed to fetch daily AI cost stats', error);
      res.status(500).json({ message: "Failed to fetch daily AI cost stats" });
    }
  });

  app.get("/api/ai-costs/monthly", async (req, res) => {
    try {
      const { year, month } = req.query;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const stats = aiCostTracker.getMonthlyStats(targetYear, targetMonth);
      res.json(stats);
    } catch (error) {
      logError('api', 'Failed to fetch monthly AI cost stats', error);
      res.status(500).json({ message: "Failed to fetch monthly AI cost stats" });
    }
  });

  app.get("/api/ai-costs/project/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const stats = aiCostTracker.getProjectStats(projectId);
      res.json(stats);
    } catch (error) {
      logError('api', 'Failed to fetch project AI cost stats', error);
      res.status(500).json({ message: "Failed to fetch project AI cost stats" });
    }
  });

  app.get("/api/ai-models", async (req, res) => {
    try {
      res.json(AI_MODEL_PRICING);
    } catch (error) {
      logError('api', 'Failed to fetch AI model pricing', error);
      res.status(500).json({ message: "Failed to fetch AI model pricing" });
    }
  });

  app.delete("/api/ai-costs", async (req, res) => {
    try {
      aiCostTracker.clearRecords();
      logInfo('system', 'AI cost records cleared by user');
      res.json({ message: "AI cost records cleared successfully" });
    } catch (error) {
      logError('api', 'Failed to clear AI cost records', error);
      res.status(500).json({ message: "Failed to clear AI cost records" });
    }
  });
  
  // Translation Projects
  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertTranslationProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid project data" });
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updates = req.body;
      const updatedProject = await storage.updateProject(projectId, updates);
      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.put("/api/projects/:id/last-opened", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      console.log('Server: Updating last opened for project ID:', projectId);
      await storage.updateProjectLastOpened(projectId);
      res.json({ message: "Last opened timestamp updated" });
    } catch (error) {
      const projectId = parseInt(req.params.id);
      console.error('Server: Failed to update last opened for project ID:', projectId, error);
      res.status(500).json({ message: "Failed to update last opened" });
    }
  });

  app.put("/api/projects/:id/progress", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      await storage.updateProjectProgress(projectId);
      res.json({ message: "Project progress updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  app.put("/api/projects/:id/rename", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Project name is required" });
      }

      const updatedProject = await storage.updateProject(projectId, { 
        name: name.trim(),
        updatedAt: new Date()
      });
      
      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ message: "Failed to rename project" });
    }
  });

  app.put("/api/projects/update-all-progress", async (req, res) => {
    try {
      logInfo('api', 'Starting bulk progress update for all projects');
      const projects = await storage.getAllProjects();
      logInfo('api', `Found ${projects.length} projects to update`);
      
      let updatedCount = 0;
      let errors: Array<{projectId: number, projectName: string, error: string}> = [];
      
      for (const project of projects) {
        try {
          logInfo('api', `Updating progress for project ${project.id} (${project.name})`);
          await storage.updateProjectProgress(project.id);
          updatedCount++;
          logSuccess('api', `Successfully updated project ${project.id} (${project.name})`);
        } catch (projectError) {
          const errorMessage = projectError instanceof Error ? projectError.message : String(projectError);
          logError('api', `Failed to update project ${project.id} (${project.name}): ${errorMessage}`, projectError);
          errors.push({ 
            projectId: project.id, 
            projectName: project.name,
            error: errorMessage
          });
        }
      }
      
      const successMessage = `Bulk update completed. Updated: ${updatedCount}/${projects.length} projects`;
      if (errors.length > 0) {
        logWarning('api', `${successMessage} with ${errors.length} errors`);
      } else {
        logSuccess('api', successMessage);
      }
      
      res.json({ 
        message: "Bulk progress update completed", 
        updatedCount,
        totalProjects: projects.length,
        errors: errors.length > 0 ? errors : undefined,
        success: errors.length === 0
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logError('api', `Bulk progress update failed: ${errorMessage}`, error);
      res.status(500).json({ 
        message: "Failed to update project",
        error: errorMessage
      });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(parseInt(req.params.id));
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Translation Items
  app.post("/api/projects/:projectId/items", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const items = req.body as Array<Omit<typeof insertTranslationItemSchema._type, 'projectId'>>;
      
      const createdItems = [];
      for (const itemData of items) {
        const item = await storage.createTranslationItem({
          ...itemData,
          projectId,
        });
        createdItems.push(item);
      }
      
      res.json(createdItems);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid item data" });
    }
  });

  app.post("/api/projects/:projectId/items/bulk", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { items } = req.body;
      
      const createdItems = [];
      for (const itemData of items) {
        const item = await storage.createTranslationItem({
          ...itemData,
          projectId,
        });
        createdItems.push(item);
      }
      
      // Update project progress after bulk insert
      await storage.updateProjectProgress(projectId);
      
      res.json(createdItems);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid bulk item data" });
    }
  });

  app.get("/api/projects/:projectId/items", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const items = await storage.getProjectItems(projectId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch translation items" });
    }
  });

  app.patch("/api/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedItem = await storage.updateTranslationItem(id, updates);
      res.json(updatedItem);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update item" });
    }
  });

  app.post("/api/items/bulk-update", async (req, res) => {
    try {
      const updates = req.body as Array<{ id: number; translatedText: string; status: string }>;
      await storage.bulkUpdateTranslations(updates.map(u => ({id: u.id, translatedText: u.translatedText, translationStatus: u.status})));
      res.json({ message: "Items updated successfully" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to bulk update items" });
    }
  });

  // API Settings
  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = insertApiSettingsSchema.parse(req.body);
      const settings = await storage.createApiSetting(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid settings data" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getApiSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch API settings" });
    }
  });

  app.patch("/api/settings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedSettings = await storage.updateApiSetting(id, updates);
      res.json(updatedSettings);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update settings" });
    }
  });

  app.delete("/api/settings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteApiSetting(id);
      res.json({ message: "Settings deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete settings" });
    }
  });

  // Enhanced API Key test endpoint with detailed diagnostics
  app.post('/api/test-api', async (req, res) => {
    try {
      const { provider, apiKey: providedApiKey } = req.body;
      
      let apiKey = providedApiKey;
      if (!apiKey) {
        const activeSettings = await storage.getApiSettings();
        const setting = activeSettings.find((s: any) => s.provider === provider);
        apiKey = setting?.apiKey || process.env.GEMINI_API_KEY;
      }

      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: `مفتاح API غير موجود لـ ${provider}`,
          errorCode: 'NO_API_KEY',
          balance: null,
          modelAccess: [],
          errorDetails: null
        });
      }

      let testResult = {
        success: false,
        message: "",
        errorCode: "",
        balance: null as string | null,
        usage: null as any,
        modelAccess: [] as string[],
        errorDetails: null as any,
        quotaInfo: null as string | null
      };

      if (provider === 'gemini') {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: "Test API"
                }]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 10,
              }
            }),
          });

          const data = await response.json();
          console.log("API Test Response:", response.status, data);
          
          if (response.ok && data.candidates) {
            res.json({ 
              success: true, 
              message: "مفتاح API يعمل بشكل صحيح",
              details: {
                model: "gemini-1.5-flash",
                status: "نشط",
                response: data.candidates[0]?.content?.parts[0]?.text || "تم الاختبار بنجاح"
              }
            });
          } else {
            const errorInfo = data.error || {};
            res.json({ 
              success: false, 
              message: errorInfo.message || "فشل في اختبار مفتاح API",
              errorCode: errorInfo.code || 'API_ERROR',
              details: {
                status: response.status,
                error: errorInfo,
                possibleCauses: [
                  "مفتاح API غير صحيح",
                  "تم استنفاد الحصة المجانية", 
                  "خدمة Gemini غير مفعلة",
                  "مفتاح منتهي الصلاحية"
                ]
              }
            });
          }
        } catch (error: any) {
          res.json({ 
            success: false, 
            message: `خطأ في الشبكة: ${error.message || 'Unknown error'}`,
            errorCode: 'NETWORK_ERROR',
            details: {
              error: error.message || error.toString(),
              possibleCauses: [
                "مشكلة في الاتصال بالإنترنت",
                "خدمة Google مؤقتاً غير متاحة"
              ]
            }
          });
        }
      } else if (provider === 'openai') {
        try {
          // Test models access first
          const modelsResponse = await fetch("https://api.openai.com/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` }
          });

          if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json();
            testResult.success = true;
            testResult.message = "مفتاح API صحيح ويعمل بشكل طبيعي";
            testResult.modelAccess = modelsData.data?.map((m: any) => m.id) || [];
            
            // Try to get billing information using correct OpenAI API
            try {
              const billingResponse = await fetch("https://api.openai.com/v1/usage", {
                headers: { 
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json"
                }
              });
              
              if (billingResponse.ok) {
                const billingData = await billingResponse.json();
                testResult.balance = "متصل - الرصيد متاح في لوحة التحكم";
                testResult.quotaInfo = "يرجى مراجعة platform.openai.com للحصول على تفاصيل الاستخدام والفوترة";
              } else {
                testResult.balance = "متصل - تحقق من لوحة التحكم للرصيد";
                testResult.quotaInfo = "مفتاح API صالح، الرصيد متاح في platform.openai.com";
              }
            } catch (e) {
              testResult.balance = "متصل - تحقق من لوحة التحكم للرصيد";
              testResult.quotaInfo = "مفتاح API صالح، الرصيد متاح في platform.openai.com";
            }
          } else {
            const errorData = await modelsResponse.json();
            testResult.errorDetails = errorData;
            
            if (modelsResponse.status === 401) {
              testResult.message = "مفتاح API غير صحيح أو منتهي الصلاحية";
              testResult.errorCode = "INVALID_API_KEY";
            } else if (modelsResponse.status === 429) {
              testResult.message = "تم تجاوز حد الاستخدام المسموح";
              testResult.errorCode = "RATE_LIMITED";
            } else if (modelsResponse.status === 402) {
              testResult.message = "الرصيد منتهي أو الفاتورة غير مدفوعة";
              testResult.errorCode = "INSUFFICIENT_QUOTA";
            } else {
              testResult.message = `خطأ في الخادم: ${modelsResponse.status}`;
              testResult.errorCode = "SERVER_ERROR";
            }
          }
        } catch (error: any) {
          testResult.message = `خطأ في الشبكة: ${error.message}`;
          testResult.errorCode = "NETWORK_ERROR";
        }
      } else if (provider === 'xai') {
        try {
          const response = await fetch("https://api.x.ai/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` }
          });

          if (response.ok) {
            const data = await response.json();
            testResult.success = true;
            testResult.message = "مفتاح API صحيح ويعمل بشكل طبيعي";
            testResult.modelAccess = data.data?.map((m: any) => m.id) || ['grok-2-1212', 'grok-beta'];
            testResult.balance = "متصل - تحقق من console.x.ai للرصيد";
            testResult.quotaInfo = "مفتاح API صالح، راجع console.x.ai لمعلومات الاستخدام والفوترة";
          } else {
            const errorData = await response.json();
            testResult.errorDetails = errorData;
            
            if (response.status === 401) {
              testResult.message = "مفتاح API غير صحيح";
              testResult.errorCode = "INVALID_API_KEY";
            } else if (response.status === 429) {
              testResult.message = "تم تجاوز حد الاستخدام المسموح";
              testResult.errorCode = "RATE_LIMITED";
            } else {
              testResult.message = `خطأ في الخادم: ${response.status}`;
              testResult.errorCode = "SERVER_ERROR";
            }
          }
        } catch (error: any) {
          testResult.message = `خطأ في الشبكة: ${error.message}`;
          testResult.errorCode = "NETWORK_ERROR";
        }
      } else if (provider === 'anthropic') {
        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 1,
              messages: [{ role: "user", content: "test" }]
            })
          });

          if (response.ok || response.status === 400) {
            testResult.success = true;
            testResult.message = "مفتاح API صحيح ويعمل بشكل طبيعي";
            testResult.modelAccess = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"];
            testResult.balance = "متصل - تحقق من console.anthropic.com للرصيد";
            testResult.quotaInfo = "مفتاح API صالح، راجع console.anthropic.com لمعلومات الاستخدام والفوترة";
          } else {
            const errorData = await response.json();
            testResult.errorDetails = errorData;
            
            if (response.status === 401) {
              testResult.message = "مفتاح API غير صحيح";
              testResult.errorCode = "INVALID_API_KEY";
            } else if (response.status === 429) {
              testResult.message = "تم تجاوز حد الاستخدام المسموح";
              testResult.errorCode = "RATE_LIMITED";
            } else if (response.status === 402) {
              testResult.message = "الرصيد منتهي أو تجاوز حد الإنفاق";
              testResult.errorCode = "INSUFFICIENT_QUOTA";
            } else {
              testResult.message = `خطأ في الخادم: ${response.status}`;
              testResult.errorCode = "SERVER_ERROR";
            }
          }
        } catch (error: any) {
          testResult.message = `خطأ في الشبكة: ${error.message}`;
          testResult.errorCode = "NETWORK_ERROR";
        }
      } else if (provider === 'deepseek') {
        try {
          const response = await fetch("https://api.deepseek.com/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` }
          });

          if (response.ok) {
            const data = await response.json();
            testResult.success = true;
            testResult.message = "مفتاح API صحيح ويعمل بشكل طبيعي";
            testResult.modelAccess = data.data?.map((m: any) => m.id) || ['deepseek-chat', 'deepseek-coder'];
            testResult.balance = "متصل - تحقق من platform.deepseek.com للرصيد";
            testResult.quotaInfo = "مفتاح API صالح، راجع platform.deepseek.com لمعلومات الاستخدام والفوترة";
          } else {
            const errorData = await response.json();
            testResult.errorDetails = errorData;
            
            if (response.status === 401) {
              testResult.message = "مفتاح API غير صحيح";
              testResult.errorCode = "INVALID_API_KEY";
            } else if (response.status === 429) {
              testResult.message = "تم تجاوز حد الاستخدام المسموح";
              testResult.errorCode = "RATE_LIMITED";
            } else {
              testResult.message = `خطأ في الخادم: ${response.status}`;
              testResult.errorCode = "SERVER_ERROR";
            }
          }
        } catch (error: any) {
          testResult.message = `خطأ في الشبكة: ${error.message}`;
          testResult.errorCode = "NETWORK_ERROR";
        }
      } else {
        testResult.message = "مزود غير مدعوم";
        testResult.errorCode = "UNSUPPORTED_PROVIDER";
      }

      // Log the test result
      if (testResult.success) {
        logInfo('api', `${provider} API key test successful`, { 
          provider, 
          balance: testResult.balance,
          modelCount: testResult.modelAccess.length 
        });
      } else {
        logWarning('api', `${provider} API key test failed`, { 
          provider, 
          error: testResult.message,
          errorCode: testResult.errorCode 
        });
      }

      // Ensure no duplicate response sending
      if (!res.headersSent) {
        res.json(testResult);
      }
    } catch (error: any) {
      console.error("API test error:", error);
      // Only send error response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: "فشل في اختبار مفتاح API",
          errorCode: 'INTERNAL_ERROR',
          details: error.message || error.toString()
        });
      }
    }
  });

  // Translation API endpoint
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, provider, apiKey, model } = req.body;
      
      if (!text || !provider || !apiKey) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      let translatedText = "";
      
      if (provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model || "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "أنت مترجم خبير للتطبيقات. ترجم النصوص إلى العربية بطريقة مناسبة للواجهات والتطبيقات. احرص على أن تكون الترجمة طبيعية ومناسبة للسياق."
              },
              {
                role: "user",
                content: text
              }
            ],
            max_tokens: 150,
            temperature: 0.3,
          }),
        });

        const data = await response.json();
        if (data.choices && data.choices[0]) {
          translatedText = data.choices[0].message.content.trim();
        } else {
          throw new Error("Failed to get translation from OpenAI");
        }
      } else if (provider === "gemini") {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Translate this English text to natural Arabic while keeping the same word order and meaning. Only provide the Arabic translation, nothing else: "${text}"`
                }]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 100,
              }
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", response.status, errorText);
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log("Gemini API response for text:", text);
          console.log("Response data:", JSON.stringify(data, null, 2));
          
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            let rawText = data.candidates[0].content.parts[0].text.trim();
            
            // Clean up the response to extract just the translation
            rawText = rawText.replace(/^(الترجمة:|Translation:|ترجمة:|The translation is:|Arabic:|العربية:)\s*/i, '');
            rawText = rawText.replace(/^["'](.*)["']$/, '$1');
            rawText = rawText.split('\n')[0].trim();
            
            if (rawText) {
              translatedText = rawText;
            } else {
              throw new Error("Empty translation received");
            }
          } else if (data.error) {
            console.error("Gemini API error:", data.error);
            throw new Error(`Gemini error: ${data.error.message || 'Unknown error'}`);
          } else {
            console.error("Unexpected Gemini response:", JSON.stringify(data, null, 2));
            throw new Error("Invalid response from Gemini API");
          }
        } catch (fetchError: any) {
          console.error("Gemini fetch error:", fetchError);
          throw new Error(`Translation service error: ${fetchError.message || 'Unknown error'}`);
        }
      } else {
        return res.status(400).json({ message: "Unsupported translation provider" });
      }

      res.json({ translatedText });
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Translation failed" 
      });
    }
  });

  // Single text translation endpoint (used by frontend)
  app.post("/api/translate-text", async (req, res) => {
    try {
      const { text, provider = "gemini", model } = req.body;
      
      // Get the manual translation model from global settings if not provided
      let selectedModel = model;
      if (!selectedModel) {
        const globalSettings = await storage.getAllGlobalSettings();
        const manualModelSetting = globalSettings.find((s: any) => s.settingKey === 'manualTranslationModel');
        selectedModel = manualModelSetting?.settingValue || 'gemini-1.5-flash';
      }
      
      const activeSettings = await storage.getApiSettings();
      const setting = activeSettings.find((s: any) => s.provider === provider);
      let apiKey = setting?.apiKey;
      
      // Fallback to environment variables if no API key found in settings
      if (!apiKey) {
        switch (provider) {
          case 'gemini':
            apiKey = process.env.GEMINI_API_KEY;
            break;
          case 'openai':
            apiKey = process.env.OPENAI_API_KEY;
            break;
          case 'anthropic':
            apiKey = process.env.ANTHROPIC_API_KEY;
            break;
          case 'xai':
            apiKey = process.env.XAI_API_KEY;
            break;
          case 'deepseek':
            apiKey = process.env.DEEPSEEK_API_KEY;
            break;
        }
      }
      
      if (!text || !provider || !apiKey) {
        return res.status(400).json({ message: "Missing required fields or API key not configured" });
      }

      let translatedText = "";
      
      if (provider === "gemini") {
        const startTime = Date.now();
        const modelName = selectedModel;
        
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Translate this English text to natural Arabic while keeping the same word order and meaning. Only provide the Arabic translation, nothing else: "${text}"`
                }]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 100,
              }
            }),
          });

          const duration = Date.now() - startTime;

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", response.status, errorText);
            
            // Log failed AI usage
            logAIUsage('gemini', modelName, 0, 0, 0, duration, false, undefined, undefined, `${response.status}: ${errorText}`);
            
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          
          // Extract token usage if available
          const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(text.length / 4); // Estimate if not provided
          const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
          const totalTokens = data.usageMetadata?.totalTokenCount || (inputTokens + outputTokens);
          
          // Calculate cost
          const costInfo = aiCostTracker.calculateCost(modelName, inputTokens, outputTokens);
          
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            let rawText = data.candidates[0].content.parts[0].text.trim();
            
            // Clean up the response to extract just the translation
            rawText = rawText.replace(/^(الترجمة:|Translation:|ترجمة:|The translation is:|Arabic:|العربية:)\s*/i, '');
            rawText = rawText.replace(/^["'](.*)["']$/, '$1');
            rawText = rawText.split('\n')[0].trim();
            
            if (rawText) {
              translatedText = rawText;
              
              // Log successful AI usage
              logAIUsage('gemini', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, true);
              
              // Add to cost tracker
              aiCostTracker.addUsageRecord({
                provider: 'gemini',
                model: modelName,
                inputTokens,
                outputTokens,
                totalTokens,
                inputCost: costInfo.inputCost,
                outputCost: costInfo.outputCost,
                totalCost: costInfo.totalCost,
                currency: 'USD',
                duration,
                success: true,
                requestType: 'single'
              });
              
            } else {
              logAIUsage('gemini', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "Empty translation received");
              throw new Error("Empty translation received");
            }
          } else if (data.error) {
            console.error("Gemini API error:", data.error);
            logAIUsage('gemini', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, data.error.message);
            throw new Error(`Gemini error: ${data.error.message || 'Unknown error'}`);
          } else {
            console.error("Unexpected Gemini response:", JSON.stringify(data, null, 2));
            logAIUsage('gemini', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "Invalid response format");
            throw new Error("Invalid response from Gemini API");
          }
        } catch (fetchError: any) {
          const duration = Date.now() - startTime;
          console.error("Gemini fetch error:", fetchError);
          logAIUsage('gemini', modelName, 0, 0, 0, duration, false, undefined, undefined, fetchError.message);
          throw new Error(`Translation service error: ${fetchError.message || 'Unknown error'}`);
        }
      } else if (provider === "openai") {
        const startTime = Date.now();
        const modelName = selectedModel;
        
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "system",
                  content: "أنت مترجم خبير للتطبيقات. ترجم النصوص إلى العربية بطريقة مناسبة للواجهات والتطبيقات. احرص على أن تكون الترجمة طبيعية ومناسبة للسياق."
                },
                {
                  role: "user",
                  content: text
                }
              ],
              max_tokens: 150,
              temperature: 0.3,
            }),
          });

          const duration = Date.now() - startTime;

          if (!response.ok) {
            const errorData = await response.json();
            logAIUsage('openai', modelName, 0, 0, 0, duration, false, undefined, undefined, `${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
          }

          const data = await response.json();
          
          const inputTokens = data.usage?.prompt_tokens || Math.ceil(text.length / 4);
          const outputTokens = data.usage?.completion_tokens || 0;
          const totalTokens = data.usage?.total_tokens || (inputTokens + outputTokens);
          
          const costInfo = aiCostTracker.calculateCost(modelName, inputTokens, outputTokens);
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            translatedText = data.choices[0].message.content.trim();
            
            logAIUsage('openai', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, true);
            
            aiCostTracker.addUsageRecord({
              provider: 'openai',
              model: modelName,
              inputTokens,
              outputTokens,
              totalTokens,
              inputCost: costInfo.inputCost,
              outputCost: costInfo.outputCost,
              totalCost: costInfo.totalCost,
              currency: 'USD',
              duration,
              success: true,
              requestType: 'single'
            });
          } else {
            logAIUsage('openai', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "No translation received");
            throw new Error("Failed to get translation from OpenAI");
          }
        } catch (fetchError: any) {
          const duration = Date.now() - startTime;
          console.error("OpenAI fetch error:", fetchError);
          logAIUsage('openai', modelName, 0, 0, 0, duration, false, undefined, undefined, fetchError.message);
          throw new Error(`Translation service error: ${fetchError.message || 'Unknown error'}`);
        }
      } else if (provider === "anthropic") {
        const startTime = Date.now();
        const modelName = model || 'claude-3-5-haiku-20241022';
        
        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: 150,
              messages: [
                {
                  role: "user",
                  content: `ترجم هذا النص إلى العربية بطريقة مناسبة للتطبيقات والواجهات: "${text}"`
                }
              ]
            }),
          });

          const duration = Date.now() - startTime;

          if (!response.ok) {
            const errorData = await response.json();
            logAIUsage('anthropic', modelName, 0, 0, 0, duration, false, undefined, undefined, `${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
          }

          const data = await response.json();
          
          const inputTokens = data.usage?.input_tokens || Math.ceil(text.length / 4);
          const outputTokens = data.usage?.output_tokens || 0;
          const totalTokens = inputTokens + outputTokens;
          
          const costInfo = aiCostTracker.calculateCost(modelName, inputTokens, outputTokens);
          
          if (data.content && data.content[0] && data.content[0].text) {
            translatedText = data.content[0].text.trim();
            
            logAIUsage('anthropic', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, true);
            
            aiCostTracker.addUsageRecord({
              provider: 'anthropic',
              model: modelName,
              inputTokens,
              outputTokens,
              totalTokens,
              inputCost: costInfo.inputCost,
              outputCost: costInfo.outputCost,
              totalCost: costInfo.totalCost,
              currency: 'USD',
              duration,
              success: true,
              requestType: 'single'
            });
          } else {
            logAIUsage('anthropic', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "No translation received");
            throw new Error("Failed to get translation from Anthropic");
          }
        } catch (fetchError: any) {
          const duration = Date.now() - startTime;
          console.error("Anthropic fetch error:", fetchError);
          logAIUsage('anthropic', modelName, 0, 0, 0, duration, false, undefined, undefined, fetchError.message);
          throw new Error(`Translation service error: ${fetchError.message || 'Unknown error'}`);
        }
      } else if (provider === "xai") {
        const startTime = Date.now();
        const modelName = model || 'grok-2-1212';
        
        try {
          const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "system",
                  content: "أنت مترجم خبير للتطبيقات. ترجم النصوص إلى العربية بطريقة مناسبة للواجهات والتطبيقات."
                },
                {
                  role: "user",
                  content: text
                }
              ],
              max_tokens: 150,
              temperature: 0.3,
            }),
          });

          const duration = Date.now() - startTime;

          if (!response.ok) {
            const errorData = await response.json();
            logAIUsage('xai', modelName, 0, 0, 0, duration, false, undefined, undefined, `${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            throw new Error(`xAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
          }

          const data = await response.json();
          
          const inputTokens = data.usage?.prompt_tokens || Math.ceil(text.length / 4);
          const outputTokens = data.usage?.completion_tokens || 0;
          const totalTokens = data.usage?.total_tokens || (inputTokens + outputTokens);
          
          const costInfo = aiCostTracker.calculateCost(modelName, inputTokens, outputTokens);
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            translatedText = data.choices[0].message.content.trim();
            
            logAIUsage('xai', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, true);
            
            aiCostTracker.addUsageRecord({
              provider: 'xai',
              model: modelName,
              inputTokens,
              outputTokens,
              totalTokens,
              inputCost: costInfo.inputCost,
              outputCost: costInfo.outputCost,
              totalCost: costInfo.totalCost,
              currency: 'USD',
              duration,
              success: true,
              requestType: 'single'
            });
          } else {
            logAIUsage('xai', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "No translation received");
            throw new Error("Failed to get translation from xAI");
          }
        } catch (fetchError: any) {
          const duration = Date.now() - startTime;
          console.error("xAI fetch error:", fetchError);
          logAIUsage('xai', modelName, 0, 0, 0, duration, false, undefined, undefined, fetchError.message);
          throw new Error(`Translation service error: ${fetchError.message || 'Unknown error'}`);
        }
      } else if (provider === "deepseek") {
        const startTime = Date.now();
        const modelName = model || 'deepseek-chat';
        
        try {
          const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "system",
                  content: "أنت مترجم خبير للتطبيقات. ترجم النصوص إلى العربية بطريقة مناسبة للواجهات والتطبيقات."
                },
                {
                  role: "user",
                  content: text
                }
              ],
              max_tokens: 150,
              temperature: 0.3,
            }),
          });

          const duration = Date.now() - startTime;

          if (!response.ok) {
            const errorData = await response.json();
            logAIUsage('deepseek', modelName, 0, 0, 0, duration, false, undefined, undefined, `${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
          }

          const data = await response.json();
          
          const inputTokens = data.usage?.prompt_tokens || Math.ceil(text.length / 4);
          const outputTokens = data.usage?.completion_tokens || 0;
          const totalTokens = data.usage?.total_tokens || (inputTokens + outputTokens);
          
          const costInfo = aiCostTracker.calculateCost(modelName, inputTokens, outputTokens);
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            translatedText = data.choices[0].message.content.trim();
            
            logAIUsage('deepseek', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, true);
            
            aiCostTracker.addUsageRecord({
              provider: 'deepseek',
              model: modelName,
              inputTokens,
              outputTokens,
              totalTokens,
              inputCost: costInfo.inputCost,
              outputCost: costInfo.outputCost,
              totalCost: costInfo.totalCost,
              currency: 'USD',
              duration,
              success: true,
              requestType: 'single'
            });
          } else {
            logAIUsage('deepseek', modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "No translation received");
            throw new Error("Failed to get translation from DeepSeek");
          }
        } catch (fetchError: any) {
          const duration = Date.now() - startTime;
          console.error("DeepSeek fetch error:", fetchError);
          logAIUsage('deepseek', modelName, 0, 0, 0, duration, false, undefined, undefined, fetchError.message);
          throw new Error(`Translation service error: ${fetchError.message || 'Unknown error'}`);
        }
      } else {
        return res.status(400).json({ message: "Unsupported translation provider" });
      }

      res.json({ translatedText });
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Translation failed" 
      });
    }
  });

  // Optimized batch translation endpoint with detailed logging
  app.post("/api/translate-batch", async (req, res) => {
    try {
      console.log('🚀 [BATCH] Starting batch translation request');
      const { batchData, provider = "gemini", model } = req.body;
      
      console.log(`📊 [BATCH] Provider: ${provider}, Model: ${model}`);
      console.log(`📝 [BATCH] Batch size: ${Object.keys(batchData || {}).length} items`);
      
      if (!batchData || typeof batchData !== 'object') {
        console.error('❌ [BATCH] Invalid batch data');
        return res.status(400).json({ error: 'Batch data is required' });
      }

      const activeSettings = await storage.getApiSettings();
      const setting = activeSettings.find((s: any) => s.provider === provider);
      let apiKey = setting?.apiKey;
      
      // Fallback to environment variables - only Gemini supported
      if (!apiKey) {
        if (provider === 'gemini') {
          apiKey = process.env.GEMINI_API_KEY;
        }
      }
      
      if (!apiKey) {
        console.error('❌ [BATCH] API key not configured for provider:', provider);
        return res.status(400).json({ error: 'API key not configured' });
      }
      
      console.log('✅ [BATCH] API key found for provider:', provider);

      const itemCount = Object.keys(batchData).length;
      const startTime = Date.now();
      
      // Log detailed request information
      console.log(`🚀 [${provider.toUpperCase()}] بدء ترجمة مجمعة لـ ${itemCount} عنصر`);
      console.log(`📝 النصوص المرسلة:`, JSON.stringify(batchData, null, 2));
      console.log(`🕐 وقت الإرسال: ${new Date().toISOString()}`);

      // Create optimized prompt for batch translation based on original system
      const batchItemCount = Object.keys(batchData).length;
      const batchPrompt = `أنت مترجم متخصص في تطبيقات التوصيل والطعام. ترجم النصوص التالية من الإنجليزية إلى العربية الفصحى مع الحفاظ على المعنى التقني.

تعليمات مهمة:
1. ترجم القيم فقط، أبق المفاتيح كما هي
2. احتفظ بالمصطلحات التقنية للتوصيل والطعام
3. أعد JSON صحيح بنفس البنية
4. تأكد من ترجمة جميع الـ ${batchItemCount} عنصر

البيانات للترجمة:
${JSON.stringify(batchData, null, 2)}

الاستجابة المطلوبة: JSON فقط بنفس البنية مع القيم المترجمة`;

      let rawResponse = '';
      let translations = {};
      let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0 };

      if (provider === "gemini") {
        const modelName = model || 'gemini-1.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: batchPrompt
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              candidateCount: 1,
              stopSequences: [],
              topP: 0.8,
              topK: 40
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE"
              }
            ]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ [BATCH] Gemini API error:", response.status, errorText);
          console.error("❌ [BATCH] Model used:", modelName);
          console.error("❌ [BATCH] API key length:", apiKey?.length || 0);
          console.error("❌ [BATCH] Batch size:", Object.keys(batchData).length);
          
          // Log the first few items for debugging
          const sampleItems = Object.entries(batchData).slice(0, 3);
          console.error("❌ [BATCH] Sample batch data:", sampleItems);
          
          return res.status(response.status).json({ 
            error: `Batch translation failed: ${response.status} - ${errorText}`,
            fallback: true 
          });
        }

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        
        // Calculate usage statistics
        const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(batchPrompt.length / 4);
        const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(rawResponse.length / 4);
        const totalTokens = data.usageMetadata?.totalTokenCount || (inputTokens + outputTokens);
        
        // Calculate costs using AI cost tracker
        const costInfo = aiCostTracker.calculateCost(modelName, inputTokens, outputTokens);
        usage = {
          inputTokens,
          outputTokens,
          totalTokens,
          inputCost: costInfo.inputCost,
          outputCost: costInfo.outputCost,
          totalCost: costInfo.totalCost
        };

        // Log detailed response information
        console.log(`📥 [${provider.toUpperCase()}] استجابة مجمعة:`);
        console.log(`⏱️ مدة الاستجابة: ${duration}ms`);
        console.log(`🔤 الاستجابة الكاملة من ${modelName}:`);
        console.log(rawResponse);
        console.log(`📊 إحصائيات الاستخدام:`, usage);
        console.log(`🕐 وقت الاستلام: ${new Date().toISOString()}`);
        
        if (!rawResponse) {
          console.error('❌ لم يتم استلام ترجمة مجمعة من النموذج');
          logAIUsage(provider, modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, "No batch translation received");
          return res.status(500).json({ 
            error: 'No batch translation received',
            fallback: true 
          });
        }

        // Clean and parse the JSON response
        try {
          let cleanedResponse = rawResponse;
          
          // Remove markdown code blocks if present
          cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          
          // Remove any leading/trailing text
          const jsonStart = cleanedResponse.indexOf('{');
          const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd);
          }

          translations = JSON.parse(cleanedResponse);
          
          console.log(`✅ تم تحليل الترجمات بنجاح لـ ${Object.keys(translations).length} عنصر`);
          console.log(`🌐 الترجمات المستخرجة:`, JSON.stringify(translations, null, 2));
          
          // Log successful usage
          logAIUsage(provider, modelName, inputTokens, outputTokens, costInfo.totalCost, duration, true);
          
          // Track usage in cost tracker
          aiCostTracker.addUsageRecord({
            provider,
            model: modelName,
            inputTokens,
            outputTokens,
            totalTokens,
            inputCost: costInfo.inputCost,
            outputCost: costInfo.outputCost,
            totalCost: costInfo.totalCost,
            currency: 'USD',
            duration,
            success: true,
            requestType: 'batch'
          });
          
        } catch (parseError: any) {
          console.error('❌ فشل في تحليل استجابة الترجمة المجمعة:', parseError);
          console.error('🔍 الاستجابة الخام:', rawResponse);
          
          logAIUsage(provider, modelName, inputTokens, outputTokens, costInfo.totalCost, duration, false, undefined, undefined, `Parse error: ${(parseError as Error).message}`);
          
          // Return error so frontend can use individual translation fallback
          return res.status(500).json({ 
            error: 'Failed to parse batch translation response',
            fallback: true,
            rawResponse,
            usage
          });
        }
      } else {
        res.status(400).json({ 
          error: 'Batch translation only supported for Gemini provider',
          fallback: true 
        });
      }

      // Send successful response with detailed information
      const finalDuration = Date.now() - startTime;
      console.log(`🎯 [${provider.toUpperCase()}] ترجمة مجمعة مكتملة:`);
      console.log(`📊 النتائج النهائية: ${Object.keys(translations).length}/${itemCount} عنصر مترجم`);
      console.log(`⏱️ المدة الإجمالية: ${finalDuration}ms`);
      console.log(`💰 التكلفة الإجمالية: $${usage.totalCost.toFixed(6)}`);

      res.json({ 
        translations,
        rawResponse,
        usage,
        duration: finalDuration,
        provider,
        model: model || 'gemini-1.5-flash',
        itemCount,
        translatedCount: Object.keys(translations).length
      });
    } catch (error: any) {
      console.error("❌ [BATCH] Critical batch translation error:", error);
      console.error("❌ [BATCH] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Batch translation failed",
        fallback: true,
        errorDetails: error.message || 'Unknown error'
      });
    }
  });

  // Test API connection
  app.post("/api/test-connection", async (req, res) => {
    try {
      const { provider, apiKey, model } = req.body;
      
      const testText = "Hello";
      let success = false;
      let errorMessage = "";

      try {
        if (provider === "openai") {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "gpt-3.5-turbo",
              messages: [{ role: "user", content: testText }],
              max_tokens: 10,
            }),
          });

          if (response.ok) {
            success = true;
          } else {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || "API connection failed";
          }
        } else if (provider === "gemini") {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testText }] }],
            }),
          });

          if (response.ok) {
            success = true;
          } else {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || "API connection failed";
          }
        } else if (provider === "xai") {
          // x.ai uses OpenAI-compatible API
          const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "grok-2-1212",
              messages: [{ role: "user", content: testText }],
              max_tokens: 10,
            }),
          });

          if (response.ok) {
            success = true;
          } else {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || "API connection failed";
          }
        } else if (provider === "anthropic") {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: model || "claude-3-5-sonnet-20241022",
              max_tokens: 10,
              messages: [{ role: "user", content: testText }],
            }),
          });

          if (response.ok) {
            success = true;
          } else {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || "API connection failed";
          }
        } else if (provider === "deepseek") {
          // DeepSeek uses OpenAI-compatible API
          const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model || "deepseek-chat",
              messages: [{ role: "user", content: testText }],
              max_tokens: 10,
            }),
          });

          if (response.ok) {
            success = true;
          } else {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || "API connection failed";
          }
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Network error";
      }

      res.json({ success, errorMessage });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        errorMessage: "Failed to test connection" 
      });
    }
  });

  // Clear all data
  app.delete('/api/clear-all', async (req, res) => {
    try {
      // Delete all projects and their items
      const projects = await storage.getAllProjects();
      for (const project of projects) {
        await storage.deleteProject(project.id);
      }
      res.json({ message: 'تم حذف جميع البيانات بنجاح' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Global Settings Routes
  app.get('/api/global-settings', async (req, res) => {
    try {
      const settings = await storage.getAllGlobalSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching global settings:', error);
      res.status(500).json({ error: 'Failed to fetch global settings' });
    }
  });

  app.post('/api/global-settings', async (req, res) => {
    try {
      const { key, value, description } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }

      const setting = await storage.setGlobalSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      console.error('Error saving global setting:', error);
      res.status(500).json({ error: 'Failed to save global setting' });
    }
  });

  app.delete('/api/global-settings/:key', async (req, res) => {
    try {
      await storage.deleteGlobalSetting(req.params.key);
      res.json({ message: 'Global setting deleted successfully' });
    } catch (error) {
      console.error('Error deleting global setting:', error);
      res.status(500).json({ error: 'Failed to delete global setting' });
    }
  });

  // Project Settings Routes
  app.get('/api/projects/:projectId/settings', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      // Project settings not implemented yet - return defaults
      const settings = { projectId, defaultProvider: 'gemini', defaultModel: 'gemini-1.5-flash' };
      res.json(settings);
    } catch (error) {
      console.error('Error fetching project settings:', error);
      res.status(500).json({ error: 'Failed to fetch project settings' });
    }
  });

  app.post('/api/projects/:projectId/settings', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      // Project settings not implemented yet - return success
      const settings = { projectId, ...req.body, updatedAt: new Date().toISOString() };
      res.json(settings);
    } catch (error) {
      console.error('Error saving project settings:', error);
      res.status(500).json({ error: 'Failed to save project settings' });
    }
  });

  // Chat History Routes
  app.post('/api/projects/:projectId/chat-history', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const { original, translated, model, provider } = req.body;
      if (!original || !translated) {
        return res.status(400).json({ error: 'Original and translated text are required' });
      }

      // Chat history not implemented yet - return success
      const chatEntry = { id: Date.now(), projectId, original, translated, model, provider, timestamp: new Date().toISOString() };

      res.json(chatEntry);
    } catch (error) {
      console.error('Error saving chat history:', error);
      res.status(500).json({ error: 'Failed to save chat history' });
    }
  });

  app.get('/api/projects/:projectId/chat-history', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }

      const { original } = req.query;
      // Chat history not implemented yet - return empty array
      const history: any[] = [];
      res.json(history);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  });

  // AI Models Management
  app.get('/api/models', async (req, res) => {
    try {
      const models = await storage.getAllAiModels();
      res.json(models);
    } catch (error) {
      console.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  });

  app.post('/api/models/import', async (req, res) => {
    try {
      const { provider } = req.body;
      // Model import not implemented yet - return mock success
      const importedModels: any[] = [];
      res.json({ success: true, count: importedModels.length });
    } catch (error) {
      console.error('Error importing models:', error);
      res.status(500).json({ error: 'Failed to import models' });
    }
  });

  app.patch('/api/models/:modelId', async (req, res) => {
    try {
      const { modelId } = req.params;
      const updates = req.body;
      await storage.updateAiModel(parseInt(modelId), updates);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating model:', error);
      res.status(500).json({ error: 'Failed to update model' });
    }
  });

  app.get('/api/usage-stats', async (req, res) => {
    try {
      // Usage stats not implemented yet - return empty
      const stats = { totalUsage: 0, providers: [], models: [] };
      res.json(stats);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      res.status(500).json({ error: 'Failed to fetch usage stats' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
