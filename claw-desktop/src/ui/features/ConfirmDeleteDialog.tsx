// ConfirmDeleteDialog — Premium confirmation dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../../components/ui/dialog';
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
      <DialogContent showCloseButton={false} className="sm:max-w-[400px] p-0 gap-0 overflow-hidden border-none shadow-none ring-1 ring-border">
        {/* Body */}
        <div className="px-8 pt-10 pb-8 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-destructive/10 mx-auto mb-6">
            <Trash2 className="w-8 h-8 text-destructive" />
          </div>
          <DialogHeader className="gap-3">
            <DialogTitle className="text-xl font-bold">Xác nhận xóa</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground px-2">
              Bạn có chắc chắn muốn xóa hội thoại <span className="font-semibold text-foreground italic">"{sessionTitle}"</span>? 
              Dữ liệu sẽ bị xóa vĩnh viễn và không thể khôi phục.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 border-t border-border/60">
          <DialogClose
            render={
              <button className="h-14 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors border-r border-border/60" />
            }
          >
            Hủy bỏ
          </DialogClose>
          <button
            onClick={handleConfirm}
            className="h-14 text-sm font-bold text-destructive hover:bg-destructive/5 transition-colors"
          >
            Xác nhận xóa
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
