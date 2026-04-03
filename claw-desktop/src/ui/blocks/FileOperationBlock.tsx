// FileOperationBlock — Clean inline file operation indicator
import { FileText, FilePlus, FileEdit, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileOperationBlockProps {
  toolName: 'read_file' | 'write_file' | 'edit_file';
  filePath: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function FileOperationBlock({
  toolName,
  filePath,
  isError = false,
  isPending = false,
  isCancelled = false,
}: FileOperationBlockProps) {
  const Icon = toolName === 'write_file' ? FilePlus : toolName === 'edit_file' ? FileEdit : FileText;
  const label = toolName === 'write_file' ? 'Tạo file' : toolName === 'edit_file' ? 'Sửa file' : 'Đọc file';
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  return (
    <div className="flex items-center gap-3 p-3 my-1.5 bg-muted/30 border border-border/50 rounded-xl text-sm transition-colors hover:bg-muted/50">
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          isPending && 'animate-spin text-primary',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500'
        )}
      />
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn('font-medium text-foreground', isError && 'text-destructive')}>{label}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-mono truncate flex-1 text-muted-foreground text-[13px]">{filePath}</span>
      {isCancelled && <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-md">Đã dừng</span>}
    </div>
  );
}
