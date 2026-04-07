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
      <DialogContent showCloseButton={false} className="max-w-[380px] p-0 gap-0 overflow-hidden bg-card border-border shadow-xl">
        {/* Body */}
        <div className="p-5">
          <DialogHeader className="text-left gap-1.5">
            <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
              Xóa hội thoại
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-normal">
              Bạn có chắc chắn muốn xóa hội thoại <span className="font-medium text-foreground">"{sessionTitle}"</span>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-muted/30 border-t border-border">
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            className="h-8 px-3 text-xs font-medium bg-transparent border-border text-foreground hover:bg-muted hover:text-foreground shadow-none"
          >
            Hủy
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
            className="h-8 px-3 text-xs font-medium bg-red-600 text-white hover:bg-red-700 shadow-none border-transparent transition-colors"
          >
            Xóa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
