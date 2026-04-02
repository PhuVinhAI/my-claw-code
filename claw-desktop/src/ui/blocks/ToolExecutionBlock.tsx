// ToolExecutionBlock Component
import { Terminal, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ToolExecutionBlockProps {
  toolName: string;
  toolInput: string;
  toolOutput?: string;
  isError?: boolean;
  isPending?: boolean;
}

export function ToolExecutionBlock({
  toolName,
  toolInput,
  toolOutput,
  isError = false,
  isPending = false,
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
  const StatusIcon = isPending ? Loader2 : isError ? XCircle : CheckCircle2;

  return (
    <div className="flex text-sm bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full flex-row items-start gap-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusIcon
          className={cn(
            'h-5 w-5 shrink-0 mt-0.5',
            isPending && 'animate-spin text-blue-500',
            isError && 'text-destructive',
            !isPending && !isError && 'text-green-500'
          )}
        />
        <ToolIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <div className="flex-1 w-full min-w-0">
        <p className={cn('font-medium', isError && 'text-destructive')}>
          {toolName}
        </p>
        {toolInput && (
          <pre className="mt-1 text-xs text-muted-foreground overflow-auto max-h-20">
            {toolInput}
          </pre>
        )}
        {toolOutput && (
          <details className="group/details mt-2">
            <summary className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none list-none flex items-center gap-1 w-fit">
              Xem kết quả
            </summary>
            <pre className="mt-1.5 bg-muted/50 border border-border/50 p-2 rounded-md text-[11px] font-mono max-h-60 overflow-auto whitespace-pre-wrap text-foreground/80">
              {toolOutput}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
