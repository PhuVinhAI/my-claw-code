// ConfirmDeleteProviderDialog — Confirmation dialog for deleting provider
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';

interface ConfirmDeleteProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  modelCount: number;
  onConfirm: () => void;
}

export function ConfirmDeleteProviderDialog({
  open,
  onOpenChange,
  providerName,
  modelCount,
  onConfirm,
}: ConfirmDeleteProviderDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px] p-0 gap-0 overflow-hidden bg-background border-border shadow-lg">
        {/* Body */}
        <div className="p-5 sm:p-6">
          <DialogHeader className="text-left gap-1.5">
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
              Xóa nhà cung cấp
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-normal">
              Bạn có chắc chắn muốn xóa nhà cung cấp <span className="font-medium text-foreground">"{providerName}"</span>
              {modelCount > 0 && (
                <> cùng với <span className="font-medium text-foreground">{modelCount} mô hình</span></>
              )}? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 px-5 sm:px-6 py-3 sm:py-4 bg-muted/40 border-t border-border">
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}
            className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-medium bg-transparent shadow-none"
          >
            Hủy
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
            className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-none border-transparent transition-colors"
          >
            Xóa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
