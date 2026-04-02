// FileOperationBlock - Specialized UI for file operations
import { FileText, FilePlus, FileEdit, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
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
  const getIcon = () => {
    switch (toolName) {
      case 'write_file':
        return FilePlus;
      case 'edit_file':
        return FileEdit;
      default:
        return FileText;
    }
  };

  const getLabel = () => {
    switch (toolName) {
      case 'write_file':
        return 'Tạo file';
      case 'edit_file':
        return 'Sửa file';
      default:
        return 'Đọc file';
    }
  };

  const Icon = getIcon();
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 shrink-0 text-destructive" />
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="font-medium text-sm text-destructive">{getLabel()}:</p>
          <span className="text-sm font-mono text-foreground/80 truncate flex-1">
            {filePath}
          </span>
          <span className="text-xs text-destructive shrink-0">Đã dừng bởi người dùng</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full">
      {/* Single line: Status + Icon + Label + File Path */}
      <div className="flex items-center gap-2">
        <StatusIcon
          className={cn(
            'h-5 w-5 shrink-0',
            isPending && 'animate-spin text-blue-500',
            isError && 'text-destructive',
            !isPending && !isError && 'text-green-500'
          )}
        />
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className={cn('font-medium text-sm', isError && 'text-destructive')}>
          {getLabel()}:
        </p>
        <span className="text-sm font-mono text-foreground/80 truncate flex-1">
          {filePath}
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}
