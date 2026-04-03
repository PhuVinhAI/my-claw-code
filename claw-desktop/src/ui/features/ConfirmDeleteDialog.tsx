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
      <DialogContent showCloseButton={false} className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Body */}
        <div className="px-7 pt-8 pb-6">
          <DialogHeader className="items-center text-center gap-4">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-red-500/10">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg">Xóa hội thoại?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Hội thoại{' '}
                <span className="font-medium text-foreground">"{sessionTitle}"</span>{' '}
                sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="flex border-t border-border/40">
          <DialogClose
            render={
              <button className="flex-1 h-12 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-r border-border/40" />
            }
          >
            Hủy bỏ
          </DialogClose>
          <button
            onClick={handleConfirm}
            className="flex-1 h-12 text-sm font-medium text-red-500 hover:bg-red-500/5 transition-colors"
          >
            Xóa
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
