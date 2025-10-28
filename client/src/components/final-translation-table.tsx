import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type FilterType = 'all' | 'needs_translation' | 'translated' | 'no_translation_needed';

interface TranslationTableProps {
  projectId: number;
  selectedProvider: string;
  selectedModel: string;
  onUpdateItem: (id: number, updates: any) => void;
}

export function FinalTranslationTable({ 
  projectId, 
  selectedProvider = 'gemini', 
  selectedModel = 'gemini-1.5-pro', 
  onUpdateItem 
}: TranslationTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [localTranslations, setLocalTranslations] = useState<Record<number, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

  // Fetch project items
  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['/api/projects', projectId, 'items'],
    enabled: !!projectId
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await fetch(`/api/projects/${projectId}/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'items'] });
    },
  });

  // Clean text function
  const cleanText = (text: string): string => {
    if (typeof text !== 'string') return '';
    return text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Process and filter items
  const processedItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];

    return items.map((item: any) => ({
      ...item,
      cleanedText: cleanText(item.originalText || ''),
      needsTranslate: (() => {
        if (!item.originalText || typeof item.originalText !== 'string') return false;
        const cleaned = cleanText(item.originalText);
        const hasTranslation = item.translatedText && item.translatedText.trim() !== '';
        const hasEnglish = /[a-zA-Z]/.test(cleaned);
        return hasEnglish && !hasTranslation && cleaned.length > 1;
      })()
    }));
  }, [items]);

  // Filter items based on search and filter
  const filteredItems = useMemo(() => {
    if (!processedItems) return [];

    let filtered = processedItems;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item: any) => 
        item.cleanedText?.toLowerCase().includes(query) ||
        item.translatedText?.toLowerCase().includes(query) ||
        item.key?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (filter) {
      case 'needs_translation':
        filtered = filtered.filter((item: any) => item.needsTranslate);
        break;
      case 'translated':
        filtered = filtered.filter((item: any) => 
          item.translatedText && item.translatedText.trim() !== ''
        );
        break;
      case 'no_translation_needed':
        filtered = filtered.filter((item: any) => !item.needsTranslate);
        break;
      default:
        break;
    }

    return filtered;
  }, [processedItems, searchQuery, filter]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Calculate statistics
  const stats = useMemo(() => {
    if (!processedItems) return { total: 0, needsTranslation: 0, translated: 0, noTranslationNeeded: 0, progress: 0, remaining: 0 };

    const total = processedItems.length;
    const needsTranslation = processedItems.filter((item: any) => item.needsTranslate).length;
    const translated = processedItems.filter((item: any) => 
      item.translatedText && item.translatedText.trim() !== ''
    ).length;
    const noTranslationNeeded = total - needsTranslation - translated;
    const progress = total > 0 ? Math.round((translated / total) * 100) : 0;

    return {
      total,
      needsTranslation,
      translated,
      noTranslationNeeded,
      progress,
      remaining: needsTranslation
    };
  }, [processedItems]);

  // Translation control functions
  const pauseTranslation = () => {
    setIsPaused(true);
    if (window.translationControl) {
      window.translationControl.paused = true;
    }
  };

  const resumeTranslation = () => {
    setIsPaused(false);
    if (window.translationControl) {
      window.translationControl.paused = false;
    }
  };

  const stopTranslation = () => {
    setIsTranslating(false);
    setIsPaused(false);
    setTranslationProgress({ current: 0, total: 0 });
    if (window.translationControl) {
      window.translationControl.active = false;
    }
  };

  // Simplified batch translation
  const handleBatchTranslation = async () => {
    console.log('🚀 بدء الترجمة المجمعة المبسطة');
    
    const allItems = items || [];
    if (allItems.length === 0) {
      toast({
        title: "خطأ",
        description: "لا توجد عناصر للترجمة",
        variant: "destructive"
      });
      return;
    }

    // Find items that need translation
    const itemsToTranslate = Array.isArray(allItems) ? allItems.filter((item: any) => {
      if (!item.originalText || typeof item.originalText !== 'string') return false;
      
      const cleaned = cleanText(item.originalText);
      const hasTranslation = item.translatedText && item.translatedText.trim() !== '';
      const hasEnglish = /[a-zA-Z]/.test(cleaned);
      
      return hasEnglish && !hasTranslation && cleaned.length > 1;
    }) : [];

    console.log(`📊 العثور على ${itemsToTranslate.length} عنصر يحتاج ترجمة من أصل ${allItems.length}`);

    if (itemsToTranslate.length === 0) {
      toast({
        title: "لا توجد عناصر للترجمة",
        description: "جميع العناصر مترجمة بالفعل",
        variant: "destructive"
      });
      return;
    }

    setIsTranslating(true);
    setIsPaused(false);
    setTranslationProgress({ current: 0, total: itemsToTranslate.length });

    window.translationControl = { active: true, paused: false };

    const BATCH_SIZE = 50;
    const batchProvider = selectedProvider || 'gemini';
    const batchModel = selectedModel || 'gemini-1.5-pro';

    // Create batches
    const batches = [];
    for (let i = 0; i < itemsToTranslate.length; i += BATCH_SIZE) {
      batches.push(itemsToTranslate.slice(i, i + BATCH_SIZE));
    }

    console.log(`📦 تقسيم إلى ${batches.length} دفعة بحجم ${BATCH_SIZE} عنصر`);

    let completed = 0;
    let successfulBatches = 0;

    try {
      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Check control state
        if (!window.translationControl?.active) {
          console.log('🛑 إيقاف بناءً على طلب المستخدم');
          break;
        }

        // Handle pause
        while (window.translationControl?.paused) {
          console.log('⏸️ مؤقت - انتظار...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!window.translationControl?.active) break;
        }

        console.log(`🔄 معالجة الدفعة ${batchIndex + 1}/${batches.length}`);

        // Prepare batch data
        const batchData: Record<string, string> = {};
        batch.forEach((item: any) => {
          batchData[`item_${item.id}`] = cleanText(item.originalText);
        });

        try {
          const response = await fetch('/api/translate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batchData,
              provider: batchProvider,
              model: batchModel,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const translations = result.translations || {};
            
            // Process successful translations
            for (const item of batch) {
              const translation = translations[`item_${item.id}`];
              if (translation && translation.trim()) {
                // Update local state
                setLocalTranslations(prev => ({
                  ...prev,
                  [item.id]: translation
                }));
                
                // Update cache
                queryClient.setQueryData(['/api/projects', projectId, 'items'], (oldData: any) => {
                  if (!oldData) return oldData;
                  return oldData.map((oldItem: any) => 
                    oldItem.id === item.id 
                      ? { ...oldItem, translatedText: translation, status: 'translated' }
                      : oldItem
                  );
                });
                
                // Save to server
                updateItemMutation.mutate({ 
                  id: item.id, 
                  updates: { translatedText: translation.trim(), status: 'translated' }
                });
              }
              
              completed++;
              setTranslationProgress({ current: completed, total: itemsToTranslate.length });
            }

            successfulBatches++;
            console.log(`✅ نجحت الدفعة ${batchIndex + 1}/${batches.length}`);
            
          } else {
            console.error(`❌ فشلت الدفعة ${batchIndex + 1}, status: ${response.status}`);
            
            // Fallback: try individual items in this batch
            for (const item of batch) {
              try {
                const individualData = { [`item_${item.id}`]: cleanText(item.originalText) };
                const individualResponse = await fetch('/api/translate-batch', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    batchData: individualData,
                    provider: batchProvider,
                    model: batchModel,
                  }),
                });
                
                if (individualResponse.ok) {
                  const individualResult = await individualResponse.json();
                  const translation = individualResult.translations[`item_${item.id}`];
                  if (translation && translation.trim()) {
                    setLocalTranslations(prev => ({
                      ...prev,
                      [item.id]: translation
                    }));
                    
                    queryClient.setQueryData(['/api/projects', projectId, 'items'], (oldData: any) => {
                      if (!oldData) return oldData;
                      return oldData.map((oldItem: any) => 
                        oldItem.id === item.id 
                          ? { ...oldItem, translatedText: translation, status: 'translated' }
                          : oldItem
                      );
                    });
                    
                    updateItemMutation.mutate({ 
                      id: item.id, 
                      updates: { translatedText: translation.trim(), status: 'translated' }
                    });
                  }
                }
              } catch (individualError) {
                console.error(`فشل العنصر ${item.id}:`, individualError);
              }
              
              completed++;
              setTranslationProgress({ current: completed, total: itemsToTranslate.length });
            }
          }

          // Add delay between batches - only if not the last batch
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error: any) {
          console.error(`خطأ في الدفعة ${batchIndex + 1}:`, error);
          
          // Skip items in this batch but continue processing
          for (const item of batch) {
            completed++;
            setTranslationProgress({ current: completed, total: itemsToTranslate.length });
          }
        }
      }

      // Final completion message
      const successRate = batches.length > 0 ? (successfulBatches / batches.length * 100) : 0;
      toast({
        title: "تمت الترجمة",
        description: `تم معالجة ${completed} عنصر في ${batches.length} دفعات (نجح ${successfulBatches} دفعة، ${successRate.toFixed(1)}%)`,
      });

    } catch (error: any) {
      toast({
        title: "خطأ في الترجمة",
        description: error.message || "فشل في إكمال الترجمة",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
      setTranslationProgress({ current: 0, total: 0 });
      refetch();
    }
  };

  // Global translation controls
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).translationControls = {
        startTranslation: () => {
          if (!isTranslating) {
            handleBatchTranslation();
          }
        },
        startSelectedTranslation: () => {
          if (!isTranslating && selectedItems.length > 0) {
            handleBatchTranslation();
          }
        },
        pauseTranslation: () => {
          console.log('Pause requested');
          pauseTranslation();
        },
        resumeTranslation: () => {
          console.log('Resume requested');
          resumeTranslation();
        },
        stopTranslation: () => {
          console.log('Stop requested');
          stopTranslation();
        },
        getStatus: () => ({
          isTranslating,
          isPaused,
          progress: translationProgress,
          selectedCount: selectedItems.length
        })
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).translationControls;
      }
    };
  }, [isTranslating, isPaused, translationProgress, selectedItems.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>جارٍ تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 ml-[10px] mr-[10px]">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">إجمالي العناصر</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.needsTranslation}</div>
            <div className="text-sm text-gray-600">يحتاج ترجمة</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.translated}</div>
            <div className="text-sm text-gray-600">مترجم</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.noTranslationNeeded}</div>
            <div className="text-sm text-gray-600">لا يحتاج ترجمة</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.progress}%</div>
            <div className="text-sm text-gray-600">نسبة الإنجاز</div>
            <Progress value={stats.progress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="البحث في النصوص والمفاتيح..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">عرض الكل ({stats.total})</SelectItem>
              <SelectItem value="needs_translation">يحتاج ترجمة ({stats.remaining})</SelectItem>
              <SelectItem value="translated">مترجم ({stats.translated})</SelectItem>
              <SelectItem value="no_translation_needed">لا يحتاج ترجمة ({stats.noTranslationNeeded})</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-sm text-gray-600">
            استخدم أزرار التحكم في القائمة الجانبية لبدء الترجمة
          </div>
        </div>

        {isTranslating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                {isPaused ? (
                  <>
                    <i className="fas fa-pause text-orange-500"></i>
                    متوقف مؤقتاً...
                  </>
                ) : (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                    جارٍ الترجمة...
                  </>
                )}
              </span>
              <span>{translationProgress.current} / {translationProgress.total}</span>
            </div>
            <Progress 
              value={translationProgress.total > 0 ? (translationProgress.current / translationProgress.total) * 100 : 0} 
              className="h-2" 
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedItems.length > 0 && paginatedItems.every((item: any) => selectedItems.includes(item.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        // Select only items on current page
                        const currentPageIds = paginatedItems.map((item: any) => item.id);
                        setSelectedItems(prev => Array.from(new Set([...prev, ...currentPageIds])));
                      } else {
                        // Deselect only items on current page
                        const currentPageIds = paginatedItems.map((item: any) => item.id);
                        setSelectedItems(prev => prev.filter(id => !currentPageIds.includes(id)));
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="border-r">النص المراد ترجمته</TableHead>
                <TableHead className="border-r">الترجمة العربية</TableHead>
                <TableHead className="border-r">الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item: any, index: number) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell>
                    <span className="text-gray-500 font-mono text-sm">
                      {(page - 1) * itemsPerPage + index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedItems(prev => [...prev, item.id]);
                        } else {
                          setSelectedItems(prev => prev.filter(id => id !== item.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className={`font-medium ${item.needsTranslate ? 'text-blue-700' : 'text-gray-600'}`}>
                      {item.cleanedText}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={localTranslations[item.id] || item.translatedText || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setLocalTranslations(prev => ({
                          ...prev,
                          [item.id]: newValue
                        }));
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        updateItemMutation.mutate({ 
                          id: item.id, 
                          updates: {
                            translatedText: newValue,
                            status: newValue.trim() ? 'translated' : 'needs_translation'
                          }
                        });
                      }}
                      placeholder={item.needsTranslate ? "اكتب الترجمة..." : "لا يحتاج ترجمة"}
                      className="min-h-[60px] text-sm"
                      dir="rtl"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.translatedText && item.translatedText.trim() ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          مترجم
                        </span>
                      ) : item.needsTranslate ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                          يحتاج ترجمة
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                          لا يحتاج ترجمة
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (onUpdateItem) {
                          onUpdateItem(item.id, {
                            translatedText: localTranslations[item.id] || item.translatedText || '',
                            status: localTranslations[item.id] || item.translatedText ? 'translated' : 'needs_translation'
                          });
                        }
                      }}
                    >
                      حفظ
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-6 py-3 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              عرض {(page - 1) * itemsPerPage + 1} إلى {Math.min(page * itemsPerPage, filteredItems.length)} من أصل {filteredItems.length} عنصر
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                السابق
              </Button>
              <span className="px-3 py-1 text-sm">
                الصفحة {page} من {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                التالي
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}