import { useState, useMemo, useCallback } from 'react';
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
import { cleanText, translateWithDictionary, needsTranslation } from '@/lib/smart-translator';

interface TranslationTableProps {
  projectId: number;
  onUpdateItem: (id: number, updates: any) => void;
  apiSettings?: any[];
  selectedProvider?: string;
  selectedModel?: string;
}

type FilterType = 'all' | 'needs_translation' | 'translated' | 'no_translation_needed';

interface TranslationItem {
  id: number;
  key: string;
  originalText: string;
  translatedText: string | null;
  status: string;
}

export default function FixedTranslationTable({
  projectId,
  onUpdateItem,
  apiSettings = [],
  selectedProvider = 'gemini',
  selectedModel = 'gemini-2.5-flash'
}: TranslationTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });

  const itemsPerPage = 50;

  // Fetch data
  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['translation-items', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/items`);
      if (!response.ok) throw new Error('Failed to fetch items');
      return response.json();
    },
    enabled: !!projectId,
  });

  // Simple update mutation without automatic refresh
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('فشل في التحديث');
      return response.json();
    }
  });

  // Process items
  const processedItems = useMemo(() => {
    if (!items) return [];
    
    return items.map((item: TranslationItem) => {
      const cleaned = cleanText(item.originalText);
      const smartSuggestion = translateWithDictionary(item.originalText);
      const needsTranslate = needsTranslation(item.originalText);
      
      return {
        ...item,
        cleanedText: cleaned,
        smartSuggestion,
        needsTranslate,
      };
    });
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = processedItems;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item: any) =>
        item.key?.toLowerCase().includes(query) ||
        item.originalText?.toLowerCase().includes(query) ||
        item.translatedText?.toLowerCase().includes(query)
      );
    }

    // Status filter
    switch (filter) {
      case 'needs_translation':
        result = result.filter((item: any) => item.needsTranslate && !item.translatedText?.trim());
        break;
      case 'translated':
        result = result.filter((item: any) => item.translatedText?.trim());
        break;
      case 'no_translation_needed':
        result = result.filter((item: any) => !item.needsTranslate);
        break;
    }

    return result;
  }, [processedItems, searchQuery, filter]);

  // Pagination
  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, page]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    const total = processedItems.length;
    const needsTranslation = processedItems.filter((item: any) => item.needsTranslate).length;
    const translated = processedItems.filter((item: any) => item.translatedText?.trim()).length;
    const noTranslationNeeded = processedItems.filter((item: any) => !item.needsTranslate).length;
    const progress = needsTranslation > 0 ? Math.round((translated / needsTranslation) * 100) : 0;

    return {
      total,
      needsTranslation,
      translated,
      noTranslationNeeded,
      progress,
      remaining: needsTranslation - translated
    };
  }, [processedItems]);

  // Simple update function
  const handleUpdateItem = useCallback(async (id: number, updates: any) => {
    // Update locally immediately
    onUpdateItem(id, updates);
    
    // Save to server without blocking UI
    try {
      await updateItemMutation.mutateAsync({ id, updates });
    } catch (error) {
      console.error('Save failed:', error);
      // Optionally revert local change here
    }
  }, [onUpdateItem, updateItemMutation]);

  // Single translation
  const translateSingle = useCallback(async (item: any) => {
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

      if (response.ok) {
        const result = await response.json();
        const translation = result.translatedText;
        
        if (translation && translation.trim()) {
          await handleUpdateItem(item.id, {
            translatedText: translation.trim(),
            status: 'translated'
          });
          
          toast({
            title: "تمت الترجمة",
            description: `"${item.cleanedText}" → "${translation.trim()}"`,
          });
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "خطأ في الترجمة",
        description: error instanceof Error ? error.message : "فشل في الترجمة",
        variant: "destructive",
      });
    }
  }, [selectedProvider, selectedModel, handleUpdateItem, toast]);

  // Batch translation with controls
  const handleBatchTranslation = useCallback(async () => {
    const itemsToTranslate = selectedItems.length > 0 
      ? filteredItems.filter((item: any) => selectedItems.includes(item.id) && item.needsTranslate && !item.translatedText?.trim())
      : filteredItems.filter((item: any) => item.needsTranslate && !item.translatedText?.trim());

    if (itemsToTranslate.length === 0) {
      toast({
        title: "لا توجد عناصر للترجمة",
        description: "جميع العناصر مترجمة بالفعل أو لا تحتاج ترجمة",
      });
      return;
    }

    setIsTranslating(true);
    setIsPaused(false);
    setTranslationProgress({ current: 0, total: itemsToTranslate.length });
    
    console.log('Translation started, isTranslating:', true); // Debug log

    try {
      let completed = 0;

      for (const item of itemsToTranslate) {
        // Check pause state
        while (isPaused && isTranslating) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Check stop state
        if (!isTranslating) {
          break;
        }
        
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

          if (response.ok) {
            const result = await response.json();
            const translation = result.translatedText;
            
            if (translation && translation.trim()) {
              await handleUpdateItem(item.id, {
                translatedText: translation.trim(),
                status: 'translated'
              });
            }
          }
        } catch (error) {
          console.error(`خطأ في ترجمة: ${item.cleanedText}`, error);
        }
        
        completed++;
        setTranslationProgress({ current: completed, total: itemsToTranslate.length });
        
        // Small delay between translations
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: "تمت الترجمة",
        description: `تم ترجمة ${completed} عنصر من أصل ${itemsToTranslate.length}`,
      });
    } catch (error) {
      console.error('Batch translation error:', error);
      toast({
        title: "خطأ في الترجمة الدفعية",
        description: error instanceof Error ? error.message : "فشل في الترجمة",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
      setIsPaused(false);
      setTranslationProgress({ current: 0, total: 0 });
    }
  }, [selectedItems, filteredItems, selectedProvider, selectedModel, handleUpdateItem, toast, isPaused, isTranslating]);

  if (isLoading) {
    return <div className="flex justify-center p-8">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">إجمالي العناصر</div>
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
            <div className="text-2xl font-bold text-orange-600">{stats.remaining}</div>
            <div className="text-sm text-gray-600">متبقي</div>
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

          <div className="flex items-center gap-2">
            <Button
              onClick={handleBatchTranslation}
              disabled={isTranslating || stats.remaining === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <i className="fas fa-language mr-2"></i>
              ترجمة {selectedItems.length > 0 ? 'المحدد' : 'الكل'}
            </Button>
            
            {isTranslating && (
              <>
                <Button 
                  onClick={() => setIsPaused(!isPaused)} 
                  variant="outline"
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  {isPaused ? (
                    <>
                      <i className="fas fa-play mr-2"></i>
                      استئناف
                    </>
                  ) : (
                    <>
                      <i className="fas fa-pause mr-2"></i>
                      إيقاف مؤقت
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={() => {
                    setIsTranslating(false);
                    setIsPaused(false);
                    setTranslationProgress({ current: 0, total: 0 });
                  }} 
                  variant="destructive"
                >
                  <i className="fas fa-stop mr-2"></i>
                  إيقاف
                </Button>
              </>
            )}
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
                    checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedItems(filteredItems.map((item: any) => item.id));
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>النص المراد ترجمته</TableHead>
                <TableHead>الترجمة العربية</TableHead>
                <TableHead className="w-32">الحالة</TableHead>
                <TableHead className="w-32">إجراءات</TableHead>
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
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-sm text-gray-600">المفتاح: {item.key}</div>
                      <div className="text-sm">{item.cleanedText}</div>
                      {item.smartSuggestion && (
                        <div className="text-xs text-blue-600 bg-blue-50 p-1 rounded">
                          اقتراح: {item.smartSuggestion}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={item.translatedText || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        onUpdateItem(item.id, {
                          translatedText: newValue,
                          status: newValue.trim() ? 'translated' : 'needs_translation'
                        });
                      }}
                      onBlur={(e) => {
                        const newValue = e.target.value;
                        handleUpdateItem(item.id, {
                          translatedText: newValue,
                          status: newValue.trim() ? 'translated' : 'needs_translation'
                        });
                      }}
                      placeholder="اكتب الترجمة هنا..."
                      className="text-right min-h-[80px] resize-none"
                      dir="rtl"
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
                    <div className="flex gap-1">
                      {item.needsTranslate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => translateSingle(item)}
                          className="text-xs"
                        >
                          <i className="fas fa-language mr-1"></i>
                          ترجمة
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            السابق
          </Button>
          <span className="flex items-center px-4">
            الصفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}