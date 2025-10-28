import { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  currentFile?: {
    name: string;
    size: string;
    itemCount: number;
  } | null;
  onRemoveFile?: () => void;
}

export default function FileUpload({ onFileUpload, currentFile, onRemoveFile }: FileUploadProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);

  const handleFileSelect = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.php,.json';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        onFileUpload(target.files[0]);
      }
    };
    input.click();
  }, [onFileUpload]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={handleFileSelect}
      >
        <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2 block"></i>
        <p className="text-sm text-gray-600">اسحب ملف PHP هنا أو انقر للاختيار</p>
        <p className="text-xs text-gray-500 mt-1">يدعم: .php, .json</p>
      </div>
      
      {currentFile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{currentFile.name}</p>
                <p className="text-xs text-gray-500">{currentFile.size} • {currentFile.itemCount} عنصر</p>
              </div>
              {onRemoveFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveFile}
                  className="text-destructive hover:text-destructive/90"
                >
                  <i className="fas fa-times"></i>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
