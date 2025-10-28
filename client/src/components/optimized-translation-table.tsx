import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

type FilterType = 'all' | 'needs_translation' | 'translated' | 'no_translation_needed';

interface OptimizedTranslationTableProps {
  projectId: number;
  onUpdateItem: (id: number, updates: any) => void;
}

export function OptimizedTranslationTable({ projectId, onUpdateItem }: OptimizedTranslationTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

  // Refs for optimization
  const translationQueue = useRef<number[]>([]);
  const batchSize = useRef(5); // Process 5 items at once to save API calls
  const debouncedUpdates = useRef<{ [key: number]: NodeJS.Timeout }>({});
  
  const itemsPerPage = 50;

  // Fetch data
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId, 'items'],
    enabled: !!projectId
  });

  const { data: apiSettings = [] } = useQuery({
    queryKey: ['/api/settings']
  });

  // Type guard for apiSettings
  const settingsArray = Array.isArray(apiSettings) ? apiSettings : [];

  // Get selected provider and model
  const selectedProvider = settingsArray.find((s: any) => s.provider)?.provider || 'gemini';
  const selectedModel = 'gemini-1.5-flash'; // Use fastest, cheapest model

  // Optimized mutation with proper cache update
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update item');
      return response.json();
    },
    onSuccess: (data, { id, updates }) => {
      // Update cache immediately instead of invalidating
      queryClient.setQueryData(['/api/projects', projectId, 'items'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((item: any) => 
          item.id === id ? { ...item, ...updates } : item
        );
      });
    }
  });

  // Process items for display
  const processedItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map((item: any, index: number) => ({
      ...item,
      rowNumber: index + 1,
      needsTranslate: item.cleanedText && 
                     item.cleanedText.trim() && 
                     item.cleanedText !== item.originalText &&
                     !item.cleanedText.match(/^[\d\s\-_.,;:!?\(\)\[\]{}]+$/),
      displayStatus: item.translatedText?.trim() ? 'translated' : 
                    (item.cleanedText && item.cleanedText.trim() && 
                     item.cleanedText !== item.originalText &&
                     !item.cleanedText.match(/^[\d\s\-_.,;:!?\(\)\[\]{}]+$/)) ? 'needs_translation' : 'no_translation_needed'
    }));
  }, [items]);

  // Filter and paginate
  const filteredItems = useMemo(() => {
    let filtered = processedItems;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item: any) =>
        item.key?.toLowerCase().includes(query) ||
        item.originalText?.toLowerCase().includes(query) ||
        item.translatedText?.toLowerCase().includes(query) ||
        item.cleanedText?.toLowerCase().includes(query)
      );
    }

    switch (filter) {
      case 'needs_translation':
        filtered = filtered.filter((item: any) => item.needsTranslate && !item.translatedText?.trim());
        break;
      case 'translated':
        filtered = filtered.filter((item: any) => item.translatedText?.trim());
        break;
      case 'no_translation_needed':
        filtered = filtered.filter((item: any) => !item.needsTranslate);
        break;
    }

    return filtered;
  }, [processedItems, searchQuery, filter]);

  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, page]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    const total = processedItems.length;
    const translated = processedItems.filter((item: any) => item.translatedText?.trim()).length;
    const needsTranslation = processedItems.filter((item: any) => item.needsTranslate && !item.translatedText?.trim()).length;
    const noTranslationNeeded = processedItems.filter((item: any) => !item.needsTranslate).length;
    
    return {
      total,
      translated,
      remaining: needsTranslation,
      noTranslationNeeded,
      progress: total > 0 ? Math.round((translated / total) * 100) : 0
    };
  }, [processedItems]);

  // Debounced update function to reduce API calls
  const debouncedUpdate = useCallback((id: number, updates: any) => {
    // Update UI immediately
    queryClient.setQueryData(['/api/projects', projectId, 'items'], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((item: any) => 
        item.id === id ? { ...item, ...updates } : item
      );
    });

    // Clear previous timeout
    if (debouncedUpdates.current[id]) {
      clearTimeout(debouncedUpdates.current[id]);
    }

    // Set new timeout for server update
    debouncedUpdates.current[id] = setTimeout(() => {
      updateItemMutation.mutate({ id, updates });
      delete debouncedUpdates.current[id];
    }, 1500); // Wait 1.5 seconds before saving
  }, [projectId, queryClient, updateItemMutation]);

  // Optimized batch translation with cost savings
  const performBatchTranslation = async (itemsToTranslate: any[]) => {
    if (itemsToTranslate.length === 0) return;

    setIsTranslating(true);
    setTranslationProgress({ current: 0, total: itemsToTranslate.length });

    const activeSettings = settingsArray.find((s: any) => s.provider === selectedProvider);
    if (!activeSettings?.apiKey) {
      toast({
        title: "مفتاح API مفقود",
        description: "يرجى إدخال مفتاح API في الإعدادات",
        variant: "destructive",
      });
      setIsTranslating(false);
      return;
    }

    // Group similar texts to save API calls
    const groupedTexts = groupSimilarTexts(itemsToTranslate);
    let processedCount = 0;

    for (const group of groupedTexts) {
      if (!isTranslating || isPaused) break;

      try {
        // Translate representative text for the group
        const representativeText = group.texts[0];
        const response = await fetch('/api/translate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: representativeText,
            provider: selectedProvider,
            model: selectedModel,
          }),
        });

        if (!response.ok) throw new Error('Translation failed');
        
        const result = await response.json();
        const baseTranslation = result.translatedText;

        // Apply translation to all items in group
        for (const item of group.items) {
          if (!isTranslating || isPaused) break;

          let finalTranslation = baseTranslation;
          
          // Adjust translation for slight variations
          if (item.cleanedText !== representativeText) {
            finalTranslation = adjustTranslationForVariation(baseTranslation, item.cleanedText, representativeText);
          }

          // Update immediately in UI
          queryClient.setQueryData(['/api/projects', projectId, 'items'], (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((oldItem: any) => 
              oldItem.id === item.id 
                ? { ...oldItem, translatedText: finalTranslation, status: 'translated' }
                : oldItem
            );
          });

          // Save to server
          updateItemMutation.mutate({ 
            id: item.id, 
            updates: { translatedText: finalTranslation, status: 'translated' }
          });

          processedCount++;
          setTranslationProgress({ current: processedCount, total: itemsToTranslate.length });

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        toast({
          title: "تمت ترجمة مجموعة",
          description: `تم ترجمة ${group.items.length} عنصر متشابه بطلب واحد`,
        });

        // Delay between groups to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error('Translation error:', error);
        toast({
          title: "خطأ في الترجمة",
          description: `فشل في ترجمة مجموعة من النصوص`,
          variant: "destructive",
        });
      }
    }

    setIsTranslating(false);
    setIsPaused(false);
    toast({
      title: "اكتملت الترجمة",
      description: `تم ترجمة ${processedCount} عنصر بنجاح`,
    });
  };

  // Group similar texts to save API calls
  const groupSimilarTexts = (items: any[]) => {
    const groups: { texts: string[], items: any[] }[] = [];
    
    for (const item of items) {
      if (!item.cleanedText || item.translatedText?.trim()) continue;
      
      // Find existing group with similar text
      let foundGroup = groups.find(group => 
        calculateSimilarity(group.texts[0], item.cleanedText) > 0.7
      );
      
      if (foundGroup) {
        foundGroup.items.push(item);
      } else {
        groups.push({
          texts: [item.cleanedText],
          items: [item]
        });
      }
    }
    
    return groups;
  };

  // Calculate text similarity
  const calculateSimilarity = (text1: string, text2: string): number => {
    if (text1 === text2) return 1;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const common = words1.filter(word => words2.includes(word)).length;
    const total = Math.max(words1.length, words2.length);
    
    return total > 0 ? common / total : 0;
  };

  // Adjust translation for text variations
  const adjustTranslationForVariation = (baseTranslation: string, targetText: string, baseText: string): string => {
    // Simple adjustment - in practice you might want more sophisticated logic
    if (targetText.includes(baseText)) {
      return baseTranslation;
    }
    
    // For minor variations, return base translation
    const similarity = calculateSimilarity(targetText, baseText);
    if (similarity > 0.8) {
      return baseTranslation;
    }
    
    return baseTranslation;
  };

  // Listen for external control events
  useEffect(() => {
    const handleStartBatch = () => {
      const untranslatedItems = processedItems.filter(item => 
        item.needsTranslate && !item.translatedText?.trim()
      );
      performBatchTranslation(untranslatedItems);
    };

    const handleStartSelected = () => {
      if (selectedItems.length > 0) {
        const selectedItemsData = processedItems.filter(item => 
          selectedItems.includes(item.id) && item.needsTranslate && !item.translatedText?.trim()
        );
        performBatchTranslation(selectedItemsData);
      } else {
        toast({
          title: "لا توجد عناصر محددة",
          description: "يرجى تحديد عناصر للترجمة أولاً",
          variant: "destructive",
        });
      }
    };

    const handlePause = () => setIsPaused(true);
    const handleResume = () => setIsPaused(false);
    const handleStop = () => {
      setIsTranslating(false);
      setIsPaused(false);
      setTranslationProgress({ current: 0, total: 0 });
    };

    window.addEventListener('startBatchTranslation', handleStartBatch);
    window.addEventListener('startSelectedTranslation', handleStartSelected);
    window.addEventListener('pauseTranslation', handlePause);
    window.addEventListener('resumeTranslation', handleResume);
    window.addEventListener('stopTranslation', handleStop);

    return () => {
      window.removeEventListener('startBatchTranslation', handleStartBatch);
      window.removeEventListener('startSelectedTranslation', handleStartSelected);
      window.removeEventListener('pauseTranslation', handlePause);
      window.removeEventListener('resumeTranslation', handleResume);
      window.removeEventListener('stopTranslation', handleStop);
    };
  }, [processedItems, selectedItems, isTranslating]);

  // Update translation status in sidebar
  useEffect(() => {
    const statusElement = document.getElementById('translation-status');
    const progressElement = document.getElementById('translation-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (statusElement) {
      if (isTranslating) {
        statusElement.textContent = isPaused ? 'متوقف مؤقتاً' : 'جاري الترجمة...';
        if (progressElement) progressElement.style.display = 'block';
        if (progressBar) progressBar.style.width = `${(translationProgress.current / translationProgress.total) * 100}%`;
        if (progressText) progressText.textContent = `${translationProgress.current} / ${translationProgress.total}`;
      } else {
        statusElement.textContent = 'جاهز للبدء';
        if (progressElement) progressElement.style.display = 'none';
      }
    }
  }, [isTranslating, isPaused, translationProgress]);

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">حدث خطأ في تحميل البيانات</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'items'] })}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats and controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="text-sm text-gray-600">
            المجموع: {stats.total} | مترجم: {stats.translated} | باقي: {stats.remaining}
          </div>
          <Progress value={stats.progress} className="w-32" />
          <span className="text-sm font-medium">{stats.progress}%</span>
        </div>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="البحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48"
          />
          
          <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({stats.total})</SelectItem>
              <SelectItem value="needs_translation">يحتاج ترجمة ({stats.remaining})</SelectItem>
              <SelectItem value="translated">مترجم ({stats.translated})</SelectItem>
              <SelectItem value="no_translation_needed">لا يحتاج ترجمة ({stats.noTranslationNeeded})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedItems(paginatedItems.map(item => item.id));
                    } else {
                      setSelectedItems([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>المفتاح</TableHead>
              <TableHead>النص الأصلي</TableHead>
              <TableHead>النص المنظف</TableHead>
              <TableHead>الترجمة العربية</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  لا توجد بيانات
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.rowNumber}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-xs truncate">
                    {item.key}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-sm text-gray-700 break-words">
                      {item.originalText}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-sm text-blue-700 break-words">
                      {item.cleanedText}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <Textarea
                      value={item.translatedText || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        debouncedUpdate(item.id, {
                          translatedText: newValue,
                          status: newValue.trim() ? 'translated' : 'needs_translation'
                        });
                      }}
                      placeholder={item.needsTranslate ? "اكتب الترجمة..." : "لا يحتاج ترجمة"}
                      className="min-h-[60px] text-sm resize-none"
                      dir="rtl"
                      disabled={!item.needsTranslate}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      item.translatedText?.trim() ? 'default' : 
                      item.needsTranslate ? 'destructive' : 'secondary'
                    }>
                      {item.translatedText?.trim() ? 'مترجم' : 
                       item.needsTranslate ? 'يحتاج ترجمة' : 'لا يحتاج ترجمة'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.needsTranslate && !item.translatedText?.trim() && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/translate-text', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                text: item.cleanedText,
                                provider: selectedProvider,
                                model: selectedModel,
                              }),
                            });

                            if (!response.ok) throw new Error('Translation failed');
                            
                            const result = await response.json();
                            const translation = result.translatedText;
                            
                            if (translation?.trim()) {
                              // Update immediately in UI
                              queryClient.setQueryData(['/api/projects', projectId, 'items'], (oldData: any) => {
                                if (!oldData) return oldData;
                                return oldData.map((oldItem: any) => 
                                  oldItem.id === item.id 
                                    ? { ...oldItem, translatedText: translation.trim(), status: 'translated' }
                                    : oldItem
                                );
                              });
                              
                              // Save to server
                              updateItemMutation.mutate({ 
                                id: item.id, 
                                updates: { translatedText: translation.trim(), status: 'translated' }
                              });
                              
                              toast({
                                title: "تمت الترجمة",
                                description: `"${item.cleanedText}" → "${translation.trim()}"`,
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "خطأ في الترجمة",
                              description: "فشل في ترجمة النص",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={isTranslating}
                      >
                        ترجم
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            صفحة {page} من {totalPages} ({filteredItems.length} عنصر)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}