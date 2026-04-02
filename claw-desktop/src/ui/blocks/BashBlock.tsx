// BashBlock - Specialized UI for bash/PowerShell/REPL execution
import { Terminal, CheckCircle2, XCircle, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

interface BashBlockProps {
  toolName: 'bash' | 'PowerShell' | 'REPL';
  command: string;
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function BashBlock({
  toolName,
  command,
  output,
  isError = false,
  isPending = false,
  isCancelled = false,
}: BashBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Cancelled state - simplified UI
  if (isCancelled) {
    return (
      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 w-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <Terminal className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">{toolName}</span>
          </div>
        </div>
        <div className="px-3 py-2 font-mono text-sm">
          <div className="flex items-start gap-2">
            <span className="text-green-400 select-none">{toolName === 'PowerShell' ? 'PS>' : toolName === 'REPL' ? '>>>' : '$'}</span>
            <pre className="flex-1 text-slate-200 whitespace-pre-wrap break-all">{command}</pre>
          </div>
        </div>
        <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/50">
          <p className="text-xs text-red-300 font-mono">Đã dừng bởi người dùng</p>
        </div>
      </div>
    );
  }

  const getShellPrompt = () => {
    switch (toolName) {
      case 'PowerShell':
        return 'PS>';
      case 'REPL':
        return '>>>';
      default:
        return '$';
    }
  };

  return (
    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              isPending && 'animate-spin text-blue-400',
              isError && 'text-red-400',
              !isPending && !isError && 'text-green-400'
            )}
          />
          <Terminal className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">{toolName}</span>
        </div>
        <button
          onClick={() => handleCopy(command)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
          title="Copy command"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      </div>

      {/* Command */}
      <div className="px-3 py-2 font-mono text-sm">
        <div className="flex items-start gap-2">
          <span className="text-green-400 select-none">{getShellPrompt()}</span>
          <pre className="flex-1 text-slate-200 whitespace-pre-wrap break-all">{command}</pre>
        </div>
      </div>

      {/* Output */}
      {output && (
        <div className="border-t border-slate-700">
          <details className="group" open={!isPending}>
            <summary className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 cursor-pointer select-none bg-slate-800/50 hover:bg-slate-800 transition-colors">
              {isPending ? 'Đang chạy...' : isError ? 'Lỗi' : 'Kết quả'}
            </summary>
            <div className="px-3 py-2 max-h-96 overflow-auto">
              <pre
                className={cn(
                  'font-mono text-xs whitespace-pre-wrap break-all',
                  isError ? 'text-red-300' : 'text-slate-300'
                )}
              >
                {output}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
