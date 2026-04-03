// ToolExecutionBlock — Clean single-line tool indicator
import { Terminal, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface ToolExecutionBlockProps {
  toolName: string;
  toolInput: string;
  toolOutput?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function ToolExecutionBlock({
  toolName,
  toolInput,
  isError = false,
  isPending = false,
  isCancelled = false,
}: ToolExecutionBlockProps) {
  const { t } = useTranslation();
  const getToolIcon = () => {
    switch (toolName) {
      case 'bash': case 'REPL': case 'PowerShell': return Terminal;
      case 'read_file': case 'write_file': case 'edit_file': return FileText;
      default: return Terminal;
    }
  };

  const ToolIcon = getToolIcon();
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Parse input to extract meaningful info
  let displayLabel = '';
  let displayValue = toolInput;
  
  try {
    const parsed = JSON.parse(toolInput);
    if (toolName === 'Sleep' && parsed.duration_ms) {
      displayLabel = t('toolExecution.duration'); displayValue = `${parsed.duration_ms}ms`;
    } else if (toolName === 'Config') {
      displayLabel = parsed.setting ? t('toolExecution.setting') : t('toolExecution.getConfig'); displayValue = parsed.setting || '';
    } else if (toolName === 'ToolSearch' && parsed.query) {
      displayLabel = t('toolExecution.searchTool'); displayValue = `"${parsed.query}"`;
    } else if (parsed.query) {
      displayLabel = t('toolExecution.query'); displayValue = parsed.query;
    } else if (parsed.command) {
      displayLabel = t('toolExecution.command'); displayValue = parsed.command;
    } else if (parsed.path) {
      displayLabel = t('toolExecution.path'); displayValue = parsed.path;
    } else {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        displayLabel = key; displayValue = String(value);
      }
    }
  } catch { displayValue = toolInput; }

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
      <ToolIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn('font-medium text-foreground', isError && 'text-destructive')}>
        {toolName}
      </span>
      {displayLabel && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{displayLabel}:</span>
        </>
      )}
      {displayValue && (
        <span className="font-mono truncate flex-1 text-muted-foreground text-[13px]">
          {displayValue.length > 60 ? displayValue.substring(0, 60) + '…' : displayValue}
        </span>
      )}
      {isCancelled && <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-md">{t('toolExecution.stopped')}</span>}
    </div>
  );
}
