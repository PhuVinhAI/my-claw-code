// FileOperationBlock — Clean inline file operation indicator
import { FileText, FilePlus, FileEdit, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const Icon = toolName === 'write_file' ? FilePlus : toolName === 'edit_file' ? FileEdit : FileText;
  const label = t(`fileOperation.${toolName === 'write_file' ? 'write' : toolName === 'edit_file' ? 'edit' : 'read'}`);
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 my-2 bg-muted/20 border border-border/30 rounded-lg text-sm transition-all hover:bg-muted/30 hover:border-border/50">
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          isPending && 'animate-spin text-blue-400',
          isError && 'text-red-400',
          isCancelled && 'text-red-400',
          !isPending && !isError && !isCancelled && 'text-emerald-400'
        )}
      />
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span className={cn('font-semibold text-foreground/90', isError && 'text-red-400')}>{label}</span>
      <span className="text-muted-foreground/30">·</span>
      <span className="font-mono truncate flex-1 text-muted-foreground/70 text-xs">{filePath}</span>
      {isCancelled && (
        <span className="text-red-400 text-xs font-medium bg-red-400/10 px-2 py-1 rounded-md border border-red-400/20">
          {t('fileOperation.stopped')}
        </span>
      )}
    </div>
  );
}
