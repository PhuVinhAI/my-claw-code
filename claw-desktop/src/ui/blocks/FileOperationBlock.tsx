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
    <div className="flex items-center gap-3 py-2.5 text-sm text-muted-foreground">
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          isPending && 'animate-spin text-primary',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500'
        )}
      />
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      <span className={cn('font-semibold text-foreground/80', isError && 'text-destructive')}>{label}</span>
      <span className="text-border">·</span>
      <span className="font-mono truncate flex-1 text-muted-foreground/40 text-xs pl-1">{filePath}</span>
      {isCancelled && <span className="text-destructive font-medium">Đã dừng</span>}
    </div>
  );
}
