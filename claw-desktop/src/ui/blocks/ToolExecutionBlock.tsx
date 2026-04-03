// ToolExecutionBlock — Clean single-line tool indicator
import { Terminal, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
      displayLabel = 'Thời gian'; displayValue = `${parsed.duration_ms}ms`;
    } else if (toolName === 'Config') {
      displayLabel = parsed.setting ? 'Cài đặt' : 'Lấy cấu hình'; displayValue = parsed.setting || '';
    } else if (toolName === 'ToolSearch' && parsed.query) {
      displayLabel = 'Tìm tool'; displayValue = `"${parsed.query}"`;
    } else if (parsed.query) {
      displayLabel = 'Truy vấn'; displayValue = parsed.query;
    } else if (parsed.command) {
      displayLabel = 'Lệnh'; displayValue = parsed.command;
    } else if (parsed.path) {
      displayLabel = 'Đường dẫn'; displayValue = parsed.path;
    } else {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        displayLabel = key; displayValue = String(value);
      }
    }
  } catch { displayValue = toolInput; }

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
      <ToolIcon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      <span className={cn('font-semibold text-foreground/80', isError && 'text-destructive')}>
        {toolName}
      </span>
      {displayLabel && (
        <>
          <span className="text-border">·</span>
          <span className="text-muted-foreground/60">{displayLabel}</span>
        </>
      )}
      {displayValue && (
        <span className="font-mono truncate flex-1 text-muted-foreground/40 text-xs pl-1">
          {displayValue.length > 60 ? displayValue.substring(0, 60) + '…' : displayValue}
        </span>
      )}
      {isCancelled && <span className="text-destructive font-medium">Đã dừng</span>}
    </div>
  );
}
