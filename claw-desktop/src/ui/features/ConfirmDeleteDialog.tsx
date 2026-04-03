// ConfirmDeleteDialog — Premium confirmation dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Trash2 } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionTitle: string;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  sessionTitle,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px] p-0 gap-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Top Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500/40 via-red-500 to-red-500/40" />

        {/* Body */}
        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Glowing Icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative flex items-center justify-center h-14 w-14 rounded-full bg-red-500/10 border border-red-500/20 shadow-sm">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
          </div>

          <DialogHeader className="gap-2.5 w-full">
            <DialogTitle className="text-xl font-bold text-center text-foreground tracking-tight">
              Xóa hội thoại
            </DialogTitle>
            <DialogDescription className="text-sm text-center text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn hội thoại <br/>
              <span className="font-semibold text-foreground px-1">"{sessionTitle}"</span>?<br/>
              Hành động này sẽ xóa toàn bộ dữ liệu.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions (Grid for perfect alignment) */}
        <div className="grid grid-cols-2 gap-3 px-6 py-5 bg-muted/30 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full h-10 font-medium bg-background"
          >
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            className="w-full h-10 font-medium bg-red-500 text-white hover:bg-red-600 hover:shadow-md hover:shadow-red-500/20 transition-all border-transparent"
          >
            Xóa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
