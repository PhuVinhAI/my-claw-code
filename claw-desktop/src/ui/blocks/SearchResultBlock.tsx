// SearchResultBlock — Clean inline search indicator
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
  const label = toolName === 'grep_search' ? 'Tìm nội dung' : 'Tìm file';
  const resultCount = output ? output.split('\n').filter((l) => l.trim()).length : 0;

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
      <span className="font-mono truncate flex-1 opacity-60">{pattern}</span>
      {!isPending && !isError && !isCancelled && (
        <span className="opacity-40">{resultCount} kết quả</span>
      )}
      {isCancelled && <span className="text-destructive/70">Đã dừng</span>}
    </div>
  );
}
