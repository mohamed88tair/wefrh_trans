import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Square } from "lucide-react";

interface NavigationConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: {
    id: number;
    name: string;
    progress: number;
    isTranslating: boolean;
  };
  onContinueInBackground: () => void;
  onPauseAndSwitch: () => void;
  onStopAndSwitch: () => void;
  targetProject: {
    id: number;
    name: string;
  };
}

export function NavigationConfirmationDialog({
  isOpen,
  onClose,
  currentProject,
  onContinueInBackground,
  onPauseAndSwitch,
  onStopAndSwitch,
  targetProject
}: NavigationConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">الترجمة قيد التشغيل</DialogTitle>
          <DialogDescription className="text-right">
            المشروع "{currentProject.name}" يحتوي على ترجمة نشطة. كيف تريد المتابعة؟
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Project Status */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <Badge variant="secondary" className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                جارٍ الترجمة
              </Badge>
              <span className="text-sm font-medium">{currentProject.progress}%</span>
            </div>
            <Progress value={currentProject.progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-right">
              الانتقال إلى: {targetProject.name}
            </p>
          </div>

          {/* Action Options */}
          <div className="space-y-2">
            <Button
              onClick={onContinueInBackground}
              className="w-full justify-start text-right"
              variant="default"
            >
              <Play className="w-4 h-4 ml-2" />
              المتابعة في الخلفية
              <span className="text-xs text-muted-foreground mr-auto">
                (الأفضل للإنتاجية)
              </span>
            </Button>

            <Button
              onClick={onPauseAndSwitch}
              className="w-full justify-start text-right"
              variant="outline"
            >
              <Pause className="w-4 h-4 ml-2" />
              إيقاف مؤقت والانتقال
              <span className="text-xs text-muted-foreground mr-auto">
                (يمكن استئنافها لاحقاً)
              </span>
            </Button>

            <Button
              onClick={onStopAndSwitch}
              className="w-full justify-start text-right"
              variant="destructive"
            >
              <Square className="w-4 h-4 ml-2" />
              إيقاف نهائي والانتقال
              <span className="text-xs text-muted-foreground mr-auto">
                (سيتم فقدان التقدم الحالي)
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}