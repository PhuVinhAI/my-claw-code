// ToolExecutionBlock Component
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
      case 'bash':
      case 'REPL':
      case 'PowerShell':
        return Terminal;
      case 'read_file':
      case 'write_file':
      case 'edit_file':
        return FileText;
      default:
        return Terminal;
    }
  };

  const ToolIcon = getToolIcon();
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Parse input to extract meaningful info with labels
  let displayLabel = '';
  let displayValue = toolInput;
  
  try {
    const parsed = JSON.parse(toolInput);
    
    // Format based on tool type with proper labels
    if (toolName === 'Sleep' && parsed.duration_ms) {
      displayLabel = 'Thời gian:';
      displayValue = `${parsed.duration_ms}ms`;
    } else if (toolName === 'Config') {
      if (parsed.setting) {
        displayLabel = 'Cài đặt:';
        displayValue = parsed.setting;
      } else {
        displayLabel = 'Lấy cấu hình';
        displayValue = '';
      }
    } else if (toolName === 'ToolSearch' && parsed.query) {
      displayLabel = 'Tìm tool:';
      displayValue = `"${parsed.query}"`;
    } else if (parsed.query) {
      displayLabel = 'Truy vấn:';
      displayValue = parsed.query;
    } else if (parsed.command) {
      displayLabel = 'Lệnh:';
      displayValue = parsed.command;
    } else if (parsed.path) {
      displayLabel = 'Đường dẫn:';
      displayValue = parsed.path;
    } else {
      // Keep first meaningful key-value pair
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        displayLabel = `${key}:`;
        displayValue = String(value);
      }
    }
  } catch {
    // Keep original if not JSON
    displayValue = toolInput;
  }

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="flex text-sm bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full flex-row items-center gap-2.5">
        <XCircle className="h-5 w-5 shrink-0 text-destructive" />
        <ToolIcon className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="font-medium text-destructive">{toolName}</p>
        {displayLabel && (
          <span className="text-xs text-muted-foreground shrink-0">{displayLabel}</span>
        )}
        {displayValue && (
          <span className="text-xs text-foreground/80 truncate flex-1 font-mono">
            {displayValue.length > 80 ? displayValue.substring(0, 80) + '...' : displayValue}
          </span>
        )}
        <span className="text-xs text-destructive shrink-0">Đã dừng bởi người dùng</span>
      </div>
    );
  }

  return (
    <div className="flex text-sm bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full flex-row items-center gap-2.5">
      <StatusIcon
        className={cn(
          'h-5 w-5 shrink-0',
          isPending && 'animate-spin text-blue-500',
          isError && 'text-destructive',
          !isPending && !isError && 'text-green-500'
        )}
      />
      <ToolIcon className="h-5 w-5 text-muted-foreground shrink-0" />
      <p className={cn('font-medium', isError && 'text-destructive')}>
        {toolName}
      </p>
      {displayLabel && (
        <span className="text-xs text-muted-foreground shrink-0">{displayLabel}</span>
      )}
      {displayValue && (
        <span className="text-xs text-foreground/80 truncate flex-1 font-mono">
          {displayValue.length > 80 ? displayValue.substring(0, 80) + '...' : displayValue}
        </span>
      )}
    </div>
  );
}
