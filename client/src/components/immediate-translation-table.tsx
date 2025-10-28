import { useState, useMemo, useEffect, useRef } from 'react';
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
import { translationOptimizer } from '@/lib/translation-optimizer';

interface ImmediateTranslationTableProps {
  projectId: number;
  onUpdateItem: (id: number, updates: any) => void;
  apiSettings?: any[];
  selectedProvider?: string;
  selectedModel?: string;
}

type FilterType = 'all' | 'needs_translation' | 'translated' | 'no_translation_needed';

export default function ImmediateTranslationTable({
  projectId,
  onUpdateItem,
  apiSettings = [],
  selectedProvider = 'gemini',
  selectedModel = 'gemini-1.5-flash'
}: ImmediateTranslationTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Local state for immediate updates
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingItems, setTranslatingItems] = useState<Set<number>>(new Set());

  const itemsPerPage = 50;

  // Fetch data
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'items'],
    enabled: !!projectId
  });

  // Update local state when server data changes
  useEffect(() => {
    if (items && Array.isArray(items) && items.length !== localItems.length) {
      setLocalItems(items);
    }
  }, [items.length]);

  // Mutation for server updates
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update item');
      return response.json();
    }
  });

  // Immediate local update function
  const updateLocalItem = (id: number, updates: any) => {
    setLocalItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // Process items for display
  const processedItems = useMemo(() => {
    return localItems.map((item: any, index: number) => ({
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
  }, [localItems]);

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

  // Immediate translation function
  const translateItemImmediately = async (item: any) => {
    if (translatingItems.has(item.id)) return; // Prevent duplicate translations
    
    setTranslatingItems(prev => new Set([...prev, item.id]));
    
    try {
      // Check cache first
      const cachedTranslation = translationOptimizer.getCachedTranslation(item.cleanedText);
      if (cachedTranslation) {
        updateLocalItem(item.id, {
          translatedText: cachedTranslation,
          status: 'translated'
        });
        
        // Save to server in background
        setTimeout(() => {
          updateItemMutation.mutate({ 
            id: item.id, 
            updates: { translatedText: cachedTranslation, status: 'translated' }
          });
        }, 100);
        
        toast({
          title: "تمت الترجمة من الذاكرة المؤقتة",
          description: cachedTranslation,
        });
        return;
      }
      
      // Generate optimized prompt
      const attemptIndex = item.translatedText ? Math.floor(Math.random() * 5) : 0;
      const promptText = translationOptimizer.createOptimizedPrompt(item.cleanedText, attemptIndex);
      
      // Call API
      const response = await fetch('/api/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: promptText,
          provider: selectedProvider,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error('فشل في الترجمة');
      }
      
      const result = await response.json();
      let translation = result.translatedText?.trim();
      
      if (translation) {
        // Clean the translation
        translation = translationOptimizer.cleanTranslationResponse(translation);
        
        // Cache for future use
        translationOptimizer.setCachedTranslation(item.cleanedText, translation);
        
        // Update immediately in local state
        updateLocalItem(item.id, {
          translatedText: translation,
          status: 'translated'
        });
        
        // Save to server in background
        setTimeout(() => {
          updateItemMutation.mutate({ 
            id: item.id, 
            updates: { translatedText: translation, status: 'translated' }
          });
        }, 100);
        
        toast({
          title: "تمت الترجمة",
          description: translation,
        });
      } else {
        throw new Error('لم يتم الحصول على ترجمة');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "خطأ في الترجمة",
        description: `فشل في ترجمة: ${item.cleanedText}`,
        variant: "destructive",
      });
    } finally {
      setTranslatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  // Handle manual text editing
  const handleTextChange = (itemId: number, newText: string) => {
    // Update immediately in local state
    updateLocalItem(itemId, {
      translatedText: newText,
      status: newText.trim() ? 'translated' : 'needs_translation'
    });
    
    // Debounced save to server
    setTimeout(() => {
      updateItemMutation.mutate({ 
        id: itemId, 
        updates: {
          translatedText: newText,
          status: newText.trim() ? 'translated' : 'needs_translation'
        }
      });
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        جاري التحميل...
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
            {paginatedItems.length === 0 ? (
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
                      onChange={(e) => handleTextChange(item.id, e.target.value)}
                      placeholder={item.needsTranslate ? "اكتب الترجمة..." : "لا يحتاج ترجمة"}
                      className="min-h-[60px] text-sm resize-none"
                      dir="rtl"
                      disabled={!item.needsTranslate || translatingItems.has(item.id)}
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
                    {item.needsTranslate && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => translateItemImmediately(item)}
                        disabled={translatingItems.has(item.id)}
                        className="h-8 px-2"
                      >
                        {translatingItems.has(item.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        ) : (
                          <i className="fas fa-language text-sm"></i>
                        )}
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