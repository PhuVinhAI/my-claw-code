// FileOperationBlock — Clean inline file operation indicator
import { FileText, FilePlus, FileEdit, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface FileOperationBlockProps {
  toolName: 'read_file' | 'write_file' | 'edit_file';
  filePath: string;
  toolInput?: string; // JSON string with all parameters
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function FileOperationBlock({
  toolName,
  filePath,
  toolInput,
  isError = false,
  isPending = false,
  isCancelled = false,
}: FileOperationBlockProps) {
  const { t } = useTranslation();
  const Icon = toolName === 'write_file' ? FilePlus : toolName === 'edit_file' ? FileEdit : FileText;
  const label = t(`fileOperation.${toolName === 'write_file' ? 'write' : toolName === 'edit_file' ? 'edit' : 'read'}`);
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Parse additional parameters
  let additionalInfo = '';
  if (toolInput) {
    try {
      const parsed = JSON.parse(toolInput);
      if (toolName === 'read_file') {
        const parts = [];
        if (parsed.offset !== undefined && parsed.limit !== undefined) {
          // Show as range: "lines 10-50"
          parts.push(`${t('toolExecution.lines')} ${parsed.offset}-${parsed.offset + parsed.limit}`);
        } else if (parsed.offset !== undefined) {
          parts.push(`${t('toolExecution.from')} ${parsed.offset}`);
        } else if (parsed.limit !== undefined) {
          parts.push(`${parsed.limit} ${t('toolExecution.lines')}`);
        }
        if (parts.length > 0) additionalInfo = parts.join(', ');
      }
    } catch {}
  }

  return (
    <div className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 my-1.5 sm:my-2 bg-muted/20 border border-border/30 rounded-lg text-xs sm:text-sm transition-all hover:bg-muted/30 hover:border-border/50">
      <StatusIcon
        className={cn(
          'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
          isPending && 'animate-spin text-blue-400',
          isError && 'text-red-400',
          isCancelled && 'text-red-400',
          !isPending && !isError && !isCancelled && 'text-emerald-400'
        )}
      />
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground/70" />
      <span className={cn('font-semibold text-foreground/90', isError && 'text-red-400')}>{label}</span>
      <span className="text-muted-foreground/30">|</span>
      <span className="font-mono truncate flex-1 text-muted-foreground/70 text-[10px] sm:text-xs">{filePath}</span>
      {additionalInfo && (
        <>
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <span className="font-mono text-muted-foreground/60 text-[10px] sm:text-xs hidden sm:inline">{additionalInfo}</span>
        </>
      )}
      {isCancelled && (
        <span className="text-red-400 text-[10px] sm:text-xs font-medium bg-red-400/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-red-400/20">
          {t('fileOperation.stopped')}
        </span>
      )}
      {isError && !isCancelled && (
        <span className="text-red-400 text-[10px] sm:text-xs font-medium bg-red-400/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-red-400/20">
          {t('fileOperation.error')}
        </span>
      )}
    </div>
  );
}
