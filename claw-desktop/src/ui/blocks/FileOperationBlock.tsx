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
    <div className="flex items-center gap-2.5 py-2 text-xs text-muted-foreground">
      <StatusIcon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          isPending && 'animate-spin text-foreground/40',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500/70'
        )}
      />
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />
      <span className={cn('font-medium', isError && 'text-destructive')}>{label}</span>
      <span className="opacity-30">·</span>
      <span className="font-mono truncate flex-1 opacity-60">{filePath}</span>
      {isCancelled && <span className="text-destructive/70">Đã dừng</span>}
    </div>
  );
}
