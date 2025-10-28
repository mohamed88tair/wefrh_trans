import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { TranslationItem } from '@shared/schema';

interface TranslationTableProps {
  items: TranslationItem[];
  onUpdateItem: (id: number, updates: Partial<TranslationItem>) => void;
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
}

export default function TranslationTable({ 
  items, 
  onUpdateItem, 
  selectedItems, 
  onSelectionChange 
}: TranslationTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredItems = useMemo(() => {
    if (!searchQuery || !items) return items || [];
    
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item?.key?.toLowerCase()?.includes(query) ||
      item?.originalText?.toLowerCase()?.includes(query) ||
      (item?.translatedText && item.translatedText.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select only items in the current page, not all filtered items
      const currentPageIds = paginatedItems.map(item => item.id);
      const newSelection = [...new Set([...selectedItems, ...currentPageIds])];
      onSelectionChange(newSelection);
    } else {
      // Deselect only items in the current page
      const currentPageIds = paginatedItems.map(item => item.id);
      const newSelection = selectedItems.filter(id => !currentPageIds.includes(id));
      onSelectionChange(newSelection);
    }
  };

  const handleItemSelect = (id: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedItems, id]);
    } else {
      onSelectionChange(selectedItems.filter(itemId => itemId !== id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'translated':
        return (
          <Badge className="bg-accent text-white">
            <i className="fas fa-check ml-1"></i>
            مترجم
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge className="bg-warning text-white">
            <i className="fas fa-eye ml-1"></i>
            يحتاج مراجعة
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <i className="fas fa-exclamation-triangle ml-1"></i>
            خطأ
          </Badge>
        );
      default:
        return (
          <Badge className="bg-warning text-white">
            <i className="fas fa-exclamation-triangle ml-1"></i>
            غير مترجم
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4 space-x-reverse">
            <h2 className="text-lg font-semibold text-gray-900">جدول الترجمة</h2>
            <Badge variant="secondary">
              {filteredItems.length} عنصر
            </Badge>
          </div>
          
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="relative">
              <Input
                type="text"
                placeholder="البحث في النصوص..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 w-64"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-50 border-b">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedItems.includes(item.id))}
                  indeterminate={paginatedItems.some(item => selectedItems.includes(item.id)) && !paginatedItems.every(item => selectedItems.includes(item.id))}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-48">المفتاح</TableHead>
              <TableHead>النص الأصلي</TableHead>
              <TableHead>الترجمة</TableHead>
              <TableHead className="w-32">الحالة</TableHead>
              <TableHead className="w-24">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item) => (
              <TableRow key={item.id} className="hover:bg-gray-50">
                <TableCell>
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={(checked) => handleItemSelect(item.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                    {item.key}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="max-w-md">
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {item.originalText}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-md">
                    <Textarea
                      value={item.translatedText || ''}
                      onChange={(e) => onUpdateItem(item.id, { 
                        translatedText: e.target.value,
                        status: e.target.value ? 'translated' : 'untranslated'
                      })}
                      placeholder="يحتاج ترجمة..."
                      className="min-h-[60px] resize-none text-sm"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(item.status)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateItem(item.id, { status: 'needs_review' })}
                      title="مراجعة"
                    >
                      <i className="fas fa-edit text-sm"></i>
                    </Button>
                    {item.status !== 'translated' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-accent hover:text-accent/90"
                        title="ترجمة"
                      >
                        <i className="fas fa-language text-sm"></i>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            عرض {Math.min((currentPage - 1) * itemsPerPage + 1, filteredItems.length)}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} من أصل {filteredItems.length} عنصر
          </div>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <i className="fas fa-chevron-right ml-2"></i>
              السابق
            </Button>
            
            <span className="text-sm text-gray-600">
              صفحة {currentPage} من {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              التالي
              <i className="fas fa-chevron-left mr-2"></i>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
