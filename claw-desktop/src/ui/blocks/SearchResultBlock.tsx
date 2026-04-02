// SearchResultBlock - Specialized UI for grep_search/glob_search
import { Search, FileSearch, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchResultBlockProps {
  toolName: 'grep_search' | 'glob_search';
  pattern: string;
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function SearchResultBlock({
  toolName,
  pattern,
  output,
  isError = false,
  isPending = false,
  isCancelled = false,
}: SearchResultBlockProps) {
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const Icon = toolName === 'grep_search' ? Search : FileSearch;

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 shrink-0 text-destructive" />
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="font-medium text-sm text-destructive">
            {toolName === 'grep_search' ? 'Tìm trong nội dung:' : 'Tìm file:'}
          </p>
          <span className="text-sm font-mono text-foreground/80 truncate flex-1">
            {pattern}
          </span>
          <span className="text-xs text-destructive shrink-0">Đã dừng bởi người dùng</span>
        </div>
      </div>
    );
  }

  // Parse output to count results
  const resultCount = output
    ? output.split('\n').filter((line) => line.trim()).length
    : 0;

  return (
    <div className="bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full">
      {/* Single line: Status + Icon + Label + Pattern + Result Count */}
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
          {toolName === 'grep_search' ? 'Tìm trong nội dung:' : 'Tìm file:'}
        </p>
        <span className="text-sm font-mono text-foreground/80 truncate flex-1">
          {pattern}
        </span>
        {!isPending && !isError && (
          <span className="text-xs text-muted-foreground shrink-0">
            {resultCount} kết quả
          </span>
        )}
      </div>
    </div>
  );
}
