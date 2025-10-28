import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { smartTranslate, needsTranslation, processComplexText, createTranslationPrompt } from '@/lib/delivery-dictionary';

interface AdvancedTranslationTableProps {
  projectId: number;
  onUpdateItem: (id: number, updates: any) => void;
  apiSettings: any[];
  selectedProvider?: string;
  selectedModel?: string;
}

type FilterType = 'all' | 'needs_translation' | 'translated' | 'no_translation_needed';

export default function AdvancedTranslationTable({
  projectId,
  onUpdateItem,
  apiSettings,
  selectedProvider = 'gemini',
  selectedModel = 'gemini-2.5-flash'
}: AdvancedTranslationTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());

  const itemsPerPage = 50;

  // Fetch data
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['translation-items', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/items`);
      if (!response.ok) throw new Error('فشل في تحميل البيانات');
      return response.json();
    },
    enabled: !!projectId,
    refetchInterval: 5000, // تحديث كل 5 ثوان
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await fetch(`/api/projects/${projectId}/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('فشل في التحديث');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['translation-items', projectId] });
    },
  });

  // Process and filter items
  const processedItems = useMemo(() => {
    if (!items) return [];
    
    return items.map((item: any) => ({
      ...item,
      needsTranslation: needsTranslation(item.originalText),
      processedText: processComplexText(item.originalText),
      smartTranslation: smartTranslate(item.originalText),
    }));
  }, [items]);

  // Filter items based on current filter
  const filteredItems = useMemo(() => {
    let filtered = processedItems;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.key?.toLowerCase().includes(query) ||
        item.originalText?.toLowerCase().includes(query) ||
        item.translatedText?.toLowerCase().includes(query) ||
        item.processedText?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    switch (filter) {
      case 'needs_translation':
        filtered = filtered.filter(item => item.needsTranslation && !item.translatedText);
        break;
      case 'translated':
        filtered = filtered.filter(item => item.translatedText && item.translatedText.trim());
        break;
      case 'no_translation_needed':
        filtered = filtered.filter(item => !item.needsTranslation);
        break;
      default: // 'all'
        break;
    }

    return filtered;
  }, [processedItems, searchQuery, filter]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, page]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    const total = processedItems.length;
    const needsTranslation = processedItems.filter(item => item.needsTranslation).length;
    const translated = processedItems.filter(item => item.translatedText?.trim()).length;
    const noTranslationNeeded = processedItems.filter(item => !item.needsTranslation).length;
    const progress = total > 0 ? Math.round((translated / needsTranslation) * 100) : 0;

    return {
      total,
      needsTranslation,
      translated,
      noTranslationNeeded,
      progress: isNaN(progress) ? 0 : progress,
      remaining: needsTranslation - translated
    };
  }, [processedItems]);

  // Handle item update
  const handleUpdateItem = async (id: number, updates: any) => {
    try {
      updateItemMutation.mutate({ id, updates });
      onUpdateItem(id, updates);
    } catch (error) {
      toast({
        title: "خطأ في التحديث",
        description: "فشل في حفظ التغييرات",
        variant: "destructive",
      });
    }
  };

  // Smart translation function
  const performSmartTranslation = async (text: string): Promise<string | null> => {
    // Check cache first
    if (translationCache.has(text)) {
      return translationCache.get(text)!;
    }

    // Try dictionary translation first
    const dictionaryTranslation = smartTranslate(text);
    if (dictionaryTranslation) {
      translationCache.set(text, dictionaryTranslation);
      return dictionaryTranslation;
    }

    // Use AI translation as fallback
    const activeSettings = apiSettings.find(s => s.provider === selectedProvider);
    if (!activeSettings?.apiKey) {
      throw new Error('مفتاح API غير متوفر');
    }

    try {
      const prompt = createTranslationPrompt([text]);
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [text],
          provider: selectedProvider,
          model: selectedModel,
          prompt,
        }),
      });

      if (!response.ok) throw new Error('فشل في الترجمة');
      
      const result = await response.json();
      const translation = result.translations?.[0];
      
      if (translation) {
        translationCache.set(text, translation);
        return translation;
      }
    } catch (error) {
      console.error('Translation error:', error);
    }

    return null;
  };

  // Batch translation
  const handleBatchTranslation = async () => {
    const itemsToTranslate = selectedItems.length > 0
      ? processedItems.filter(item => selectedItems.includes(item.id) && item.needsTranslation && !item.translatedText)
      : processedItems.filter(item => item.needsTranslation && !item.translatedText);

    if (itemsToTranslate.length === 0) {
      toast({
        title: "لا توجد عناصر للترجمة",
        description: "جميع العناصر المحددة مترجمة بالفعل أو لا تحتاج ترجمة",
      });
      return;
    }

    setIsTranslating(true);
    setTranslationProgress({ current: 0, total: itemsToTranslate.length });

    try {
      let completed = 0;
      const batchSize = 5; // ترجمة 5 عناصر في كل دفعة

      for (let i = 0; i < itemsToTranslate.length; i += batchSize) {
        const batch = itemsToTranslate.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (item) => {
            try {
              const translation = await performSmartTranslation(item.processedText);
              if (translation) {
                await handleUpdateItem(item.id, {
                  translatedText: translation,
                  status: 'translated'
                });
              }
              completed++;
              setTranslationProgress({ current: completed, total: itemsToTranslate.length });
            } catch (error) {
              console.error(`خطأ في ترجمة العنصر ${item.id}:`, error);
            }
          })
        );

        // تأخير قصير بين الدفعات لتجنب تجاوز حدود API
        if (i + batchSize < itemsToTranslate.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "تمت الترجمة بنجاح",
        description: `تم ترجمة ${completed} عنصر من أصل ${itemsToTranslate.length}`,
      });

    } catch (error) {
      toast({
        title: "خطأ في الترجمة",
        description: "فشل في إكمال عملية الترجمة",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
      setTranslationProgress({ current: 0, total: 0 });
      refetch();
    }
  };

  // Auto-apply smart translations for visible items
  useEffect(() => {
    paginatedItems.forEach(item => {
      if (item.needsTranslation && !item.translatedText && item.smartTranslation) {
        // Auto-suggest dictionary translation
        const suggestion = document.getElementById(`suggestion-${item.id}`);
        if (suggestion) {
          suggestion.style.display = 'block';
        }
      }
    });
  }, [paginatedItems]);

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
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">إجمالي العناصر</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.needsTranslation}</div>
              <div className="text-sm text-gray-600">يحتاج ترجمة</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.translated}</div>
              <div className="text-sm text-gray-600">مترجم</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.noTranslationNeeded}</div>
              <div className="text-sm text-gray-600">لا يحتاج ترجمة</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.progress}%</div>
              <div className="text-sm text-gray-600">نسبة الإنجاز</div>
              <Progress value={stats.progress} className="mt-2 h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <Input
              placeholder="البحث في النصوص والمفاتيح..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Filter */}
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

          {/* Batch Actions */}
          <Button
            onClick={handleBatchTranslation}
            disabled={isTranslating || stats.remaining === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTranslating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ترجمة...
              </>
            ) : (
              <>
                <i className="fas fa-language mr-2"></i>
                ترجمة {selectedItems.length > 0 ? 'المحدد' : 'الكل'}
              </>
            )}
          </Button>
        </div>

        {/* Translation Progress */}
        {isTranslating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>جارٍ الترجمة...</span>
              <span>{translationProgress.current} / {translationProgress.total}</span>
            </div>
            <Progress 
              value={(translationProgress.current / translationProgress.total) * 100} 
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
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedItems(filteredItems.map(item => item.id));
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-48">المفتاح</TableHead>
                <TableHead>النص الأصلي</TableHead>
                <TableHead>الترجمة العربية</TableHead>
                <TableHead className="w-32">الحالة</TableHead>
                <TableHead className="w-24">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item: any) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
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
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
                      {item.key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className={`font-medium ${item.needsTranslation ? 'text-blue-700' : 'text-gray-600'}`}>
                        {item.processedText}
                      </div>
                      {item.needsTranslation && (
                        <Badge variant="outline" className="text-xs">
                          يحتاج ترجمة
                        </Badge>
                      )}
                      {!item.needsTranslation && (
                        <Badge variant="secondary" className="text-xs">
                          لا يحتاج ترجمة
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Textarea
                        value={item.translatedText || ''}
                        onChange={(e) => handleUpdateItem(item.id, {
                          translatedText: e.target.value,
                          status: e.target.value.trim() ? 'translated' : 'untranslated'
                        })}
                        placeholder={item.needsTranslation ? "اكتب الترجمة..." : "لا يحتاج ترجمة"}
                        className="min-h-[60px] text-sm"
                        dir="rtl"
                        disabled={!item.needsTranslation}
                      />
                      
                      {/* Smart suggestion */}
                      {item.smartTranslation && !item.translatedText && (
                        <div id={`suggestion-${item.id}`} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-700">اقتراح: {item.smartTranslation}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateItem(item.id, {
                                translatedText: item.smartTranslation,
                                status: 'translated'
                              })}
                              className="text-xs h-6"
                            >
                              تطبيق
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      item.translatedText?.trim() ? 'default' : 
                      item.needsTranslation ? 'destructive' : 'secondary'
                    }>
                      {item.translatedText?.trim() ? 'مترجم' : 
                       item.needsTranslation ? 'غير مترجم' : 'لا يحتاج'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.needsTranslation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            const translation = await performSmartTranslation(item.processedText);
                            if (translation) {
                              handleUpdateItem(item.id, {
                                translatedText: translation,
                                status: 'translated'
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "خطأ في الترجمة",
                              description: "فشل في ترجمة هذا العنصر",
                              variant: "destructive",
                            });
                          }
                        }}
                        title="ترجمة تلقائية"
                      >
                        <i className="fas fa-robot text-sm"></i>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 border-t px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              عرض {Math.min((page - 1) * itemsPerPage + 1, filteredItems.length)}-{Math.min(page * itemsPerPage, filteredItems.length)} من أصل {filteredItems.length} عنصر
            </div>
            
            <div className="flex items-center space-x-2 space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <i className="fas fa-chevron-right ml-2"></i>
                السابق
              </Button>
              
              <span className="text-sm text-gray-600">
                صفحة {page} من {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                التالي
                <i className="fas fa-chevron-left mr-2"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}