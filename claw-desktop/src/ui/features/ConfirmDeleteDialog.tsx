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
      <DialogContent showCloseButton={false} className="sm:max-w-[380px] p-0 gap-0 overflow-hidden bg-[#1e1e1e] border-[#3e3e42] shadow-lg">
        {/* Body */}
        <div className="p-5">
          <DialogHeader className="text-left gap-1.5">
            <DialogTitle className="text-base font-semibold text-[#e0e0e0] tracking-tight">
              Xóa hội thoại
            </DialogTitle>
            <DialogDescription className="text-sm text-[#888888] leading-normal">
              Bạn có chắc chắn muốn xóa hội thoại <span className="font-medium text-[#cccccc]">"{sessionTitle}"</span>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#252526] border-t border-[#3e3e42]">
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            className="h-8 px-3 text-xs font-medium bg-transparent border-[#3e3e42] text-[#cccccc] hover:bg-[#2a2a2a] hover:text-[#e0e0e0] shadow-none"
          >
            Hủy
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
            className="h-8 px-3 text-xs font-medium bg-[#c9302c] text-[#ffffff] hover:bg-[#ac2925] shadow-none border-transparent transition-colors"
          >
            Xóa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
