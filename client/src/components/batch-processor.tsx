// Enhanced Batch Processing Component with Automatic Continuation
// Supports Gemini, OpenAI GPT, DeepSeek, and other AI providers

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, Square, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getModelConfig, getOptimalDelay } from '@/lib/multi-provider-translator';

interface BatchProcessorProps {
  items: any[];
  provider: string;
  model: string;
  onUpdateItem: (id: number, updates: any) => Promise<void>;
  onComplete: () => void;
}

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  processedItems: number;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  isRunning: boolean;
  isPaused: false;
  startTime?: number;
  estimatedTimeRemaining?: number;
}

export default function BatchProcessor({ 
  items, 
  provider, 
  model, 
  onUpdateItem, 
  onComplete 
}: BatchProcessorProps) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<BatchProgress>({
    currentBatch: 0,
    totalBatches: 0,
    processedItems: 0,
    totalItems: 0,
    successfulItems: 0,
    failedItems: 0,
    isRunning: false,
    isPaused: false
  });

  const processingRef = useRef<{
    active: boolean;
    paused: boolean;
    shouldStop: boolean;
  }>({
    active: false,
    paused: false,
    shouldStop: false
  });

  // Enhanced batch processing with automatic continuation
  const startBatchProcessing = async () => {
    if (!items.length) {
      toast({
        title: "لا توجد عناصر للترجمة",
        description: "لا توجد عناصر محددة للمعالجة الدفعية",
        variant: "destructive"
      });
      return;
    }

    // Reset and initialize processing state
    processingRef.current = { active: true, paused: false, shouldStop: false };
    
    const modelConfig = getModelConfig(provider, model);
    const BATCH_SIZE = modelConfig.batchSize;
    
    // Create batches
    const batches = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push({
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        items: items.slice(i, i + BATCH_SIZE),
        startId: items[i]?.id,
        endId: items[Math.min(i + BATCH_SIZE - 1, items.length - 1)]?.id
      });
    }

    setProgress({
      currentBatch: 0,
      totalBatches: batches.length,
      processedItems: 0,
      totalItems: items.length,
      successfulItems: 0,
      failedItems: 0,
      isRunning: true,
      isPaused: false,
      startTime: Date.now()
    });

    console.log(`🚀 بدء المعالجة الدفعية: ${items.length} عنصر في ${batches.length} دفعة`);
    console.log(`📊 المزود: ${provider}, النموذج: ${model}, حجم الدفعة: ${BATCH_SIZE}`);

    try {
      let totalSuccessful = 0;
      let totalFailed = 0;
      let totalProcessed = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Check for pause/stop signals
        while (processingRef.current.paused && !processingRef.current.shouldStop) {
          console.log('⏸️ المعالجة متوقفة مؤقتاً، انتظار...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (processingRef.current.shouldStop) {
          console.log('🛑 تم إيقاف المعالجة بواسطة المستخدم');
          break;
        }

        const batchInfo = batches[batchIndex];
        const batch = batchInfo.items;
        
        console.log(`🔄 معالجة الدفعة ${batchInfo.batchNumber}/${batches.length} (${batch.length} عنصر)`);

        try {
          // Prepare batch data
          const batchData: Record<string, string> = {};
          batch.forEach((item: any) => {
            batchData[`item_${item.id}`] = item.originalText || item.cleanedText;
          });

          // Send batch request with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

          const response = await fetch('/api/translate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batchData,
              provider,
              model,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json();
            const translations = result.translations || {};

            let batchSuccessful = 0;
            let batchFailed = 0;

            // Process translations
            for (const item of batch) {
              const translation = translations[`item_${item.id}`];
              
              if (translation && translation.trim()) {
                await onUpdateItem(item.id, {
                  translatedText: translation.trim(),
                  status: 'translated'
                });
                batchSuccessful++;
                console.log(`✅ نجحت ترجمة العنصر ${item.id}`);
              } else {
                batchFailed++;
                console.log(`❌ فشلت ترجمة العنصر ${item.id}`);
              }
            }

            totalSuccessful += batchSuccessful;
            totalFailed += batchFailed;
            totalProcessed += batch.length;

            console.log(`📊 ملخص الدفعة ${batchInfo.batchNumber}: نجح ${batchSuccessful}/${batch.length}`);

          } else {
            // Handle batch failure
            console.error(`❌ فشلت الدفعة ${batchInfo.batchNumber}:`, response.status);
            totalFailed += batch.length;
            totalProcessed += batch.length;
          }

        } catch (batchError) {
          console.error(`❌ خطأ في الدفعة ${batchInfo.batchNumber}:`, batchError);
          totalFailed += batch.length;
          totalProcessed += batch.length;
        }

        // Update progress
        const currentTime = Date.now();
        const elapsed = progress.startTime ? currentTime - progress.startTime : 0;
        const itemsPerMs = totalProcessed / elapsed;
        const remainingItems = items.length - totalProcessed;
        const estimatedTimeRemaining = remainingItems > 0 ? remainingItems / itemsPerMs : 0;

        setProgress(prev => ({
          ...prev,
          currentBatch: batchIndex + 1,
          processedItems: totalProcessed,
          successfulItems: totalSuccessful,
          failedItems: totalFailed,
          estimatedTimeRemaining
        }));

        // Smart delay between batches
        if (batchIndex < batches.length - 1) {
          const delay = getOptimalDelay(provider, model, BATCH_SIZE);
          console.log(`⏳ انتظار ${delay}ms قبل الدفعة التالية`);
          
          // Ensure processing state remains active during delay
          processingRef.current.active = true;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Double-check state after delay
          if (!processingRef.current.active || processingRef.current.shouldStop) {
            console.log('⚠️ تم مقاطعة المعالجة أثناء التأخير');
            break;
          }
        }
      }

      // Complete processing
      const successRate = totalSuccessful / items.length * 100;
      
      toast({
        title: "تمت المعالجة الدفعية بنجاح",
        description: `تم معالجة ${totalProcessed} عنصر، نجح ${totalSuccessful} (${successRate.toFixed(1)}%)`,
      });

      onComplete();

    } catch (error: any) {
      console.error('خطأ في المعالجة الدفعية:', error);
      toast({
        title: "خطأ في المعالجة الدفعية",
        description: error.message || "فشل في إكمال المعالجة",
        variant: "destructive",
      });
    } finally {
      setProgress(prev => ({ ...prev, isRunning: false, isPaused: false }));
      processingRef.current = { active: false, paused: false, shouldStop: false };
    }
  };

  const pauseProcessing = () => {
    processingRef.current.paused = true;
    setProgress(prev => ({ ...prev, isPaused: true }));
    console.log('⏸️ تم إيقاف المعالجة مؤقتاً');
  };

  const resumeProcessing = () => {
    processingRef.current.paused = false;
    setProgress(prev => ({ ...prev, isPaused: false }));
    console.log('▶️ تم استئناف المعالجة');
  };

  const stopProcessing = () => {
    processingRef.current.shouldStop = true;
    processingRef.current.active = false;
    setProgress(prev => ({ ...prev, isRunning: false, isPaused: false }));
    console.log('🛑 تم إيقاف المعالجة نهائياً');
  };

  const progressPercentage = progress.totalItems > 0 
    ? (progress.processedItems / progress.totalItems) * 100 
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            المعالج الدفعي المحسن
          </div>
          <Badge variant="outline">
            {provider}/{model}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Display */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>التقدم: {progress.processedItems}/{progress.totalItems}</span>
            <span>{progressPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>الدفعة الحالية:</span>
                <span>{progress.currentBatch}/{progress.totalBatches}</span>
              </div>
              <div className="flex justify-between">
                <span>نجح:</span>
                <Badge variant="default">{progress.successfulItems}</Badge>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>العناصر المعالجة:</span>
                <span>{progress.processedItems}</span>
              </div>
              <div className="flex justify-between">
                <span>فشل:</span>
                <Badge variant="destructive">{progress.failedItems}</Badge>
              </div>
            </div>
          </div>
          
          {progress.estimatedTimeRemaining && (
            <div className="text-sm text-gray-500">
              الوقت المتوقع المتبقي: {Math.round(progress.estimatedTimeRemaining / 1000)} ثانية
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!progress.isRunning ? (
            <Button onClick={startBatchProcessing} className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              بدء المعالجة الدفعية
            </Button>
          ) : (
            <>
              {progress.isPaused ? (
                <Button onClick={resumeProcessing} variant="default">
                  <Play className="h-4 w-4 mr-2" />
                  استئناف
                </Button>
              ) : (
                <Button onClick={pauseProcessing} variant="secondary">
                  <Pause className="h-4 w-4 mr-2" />
                  إيقاف مؤقت
                </Button>
              )}
              <Button onClick={stopProcessing} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                إيقاف
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}