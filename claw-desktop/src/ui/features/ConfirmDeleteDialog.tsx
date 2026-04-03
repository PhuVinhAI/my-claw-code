// ConfirmDeleteDialog — Clean, Vercel-style confirmation dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

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
      <DialogContent showCloseButton={false} className="sm:max-w-[400px] p-0 gap-0 overflow-hidden bg-background border-border shadow-lg">
        {/* Body */}
        <div className="p-6">
          <DialogHeader className="text-left gap-1.5">
            <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">
              Xóa hội thoại
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-normal">
              Bạn có chắc chắn muốn xóa hội thoại <span className="font-medium text-foreground">"{sessionTitle}"</span>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-muted/40 border-t border-border">
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            className="h-9 px-4 font-medium bg-transparent shadow-none"
          >
            Hủy
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
            className="h-9 px-4 font-medium bg-red-600 text-white hover:bg-red-700 shadow-none border-transparent transition-colors"
          >
            Xóa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
