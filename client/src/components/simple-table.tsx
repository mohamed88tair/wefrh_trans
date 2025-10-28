import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface SimpleTableProps {
  projectId: number;
  onUpdateItem: (id: number, updates: any) => void;
}

export default function SimpleTable({ projectId, onUpdateItem }: SimpleTableProps) {
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // Fetch data directly with a simple query
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['simple-items', projectId, page],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-500">لا توجد عناصر للعرض</p>
          <p className="text-sm text-gray-400 mt-2">Project ID: {projectId}</p>
        </div>
      </div>
    );
  }

  // Paginate items
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  return (
    <div className="bg-white border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">جدول الترجمة</h3>
            <p className="text-sm text-gray-500">إجمالي {items.length} عنصر</p>
          </div>
          <Badge variant="secondary">{paginatedItems.length} عنصر في هذه الصفحة</Badge>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">المفتاح (مرجعي)</TableHead>
              <TableHead>النص المراد ترجمته</TableHead>
              <TableHead>الترجمة العربية</TableHead>
              <TableHead className="w-32">الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
                    '{item.key}'
                  </code>
                  <div className="text-xs text-gray-500 mt-1">مرجعي فقط</div>
                </TableCell>
                <TableCell>
                  <div className="max-w-md">
                    <span className="font-medium text-blue-700">
                      {item.originalText?.replace(/'/g, '') || 'لا يوجد نص'}
                    </span>
                    <div className="text-xs text-gray-500 mt-1">النص المراد ترجمته</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Textarea
                    value={item.translatedText || ''}
                    onChange={(e) => onUpdateItem(item.id, {
                      translatedText: e.target.value,
                      status: e.target.value ? 'translated' : 'untranslated'
                    })}
                    placeholder="مثال: الاسم"
                    className="min-h-[60px] text-sm"
                    dir="rtl"
                  />
                  <div className="text-xs text-gray-500 mt-1">اكتب الترجمة العربية هنا</div>
                </TableCell>
                <TableCell>
                  <Badge variant={item.status === 'translated' ? 'default' : 'secondary'}>
                    {item.status === 'translated' ? 'مترجم' : 'غير مترجم'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t flex justify-between items-center">
        <span className="text-sm text-gray-500">
          صفحة {page} من {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}