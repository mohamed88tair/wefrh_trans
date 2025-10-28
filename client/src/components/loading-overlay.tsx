import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface LoadingOverlayProps {
  open: boolean;
  title?: string;
  message?: string;
  current: number;
  total: number;
  percentage: number;
  onCancel?: () => void;
}

export default function LoadingOverlay({
  open,
  title = "جارٍ الترجمة...",
  message = "يتم ترجمة النصوص باستخدام الذكاء الاصطناعي",
  current,
  total,
  percentage,
  onCancel,
}: LoadingOverlayProps) {
  return (
    <Dialog open={open} modal>
      <DialogContent className="max-w-md" hideCloseButton>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <i className="fas fa-language text-2xl text-white"></i>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 mb-4">{message}</p>
          </div>
          
          <div className="space-y-2">
            <Progress value={percentage} className="w-full" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>{current}</span>
              <span>/</span>
              <span>{total}</span>
            </div>
          </div>
          
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              إلغاء
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
