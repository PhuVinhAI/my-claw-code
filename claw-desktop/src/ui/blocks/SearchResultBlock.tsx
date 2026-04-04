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
    <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 my-1.5 bg-muted/30 border border-border/50 rounded-xl text-xs sm:text-sm transition-colors hover:bg-muted/50">
      <StatusIcon
        className={cn(
          'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
          isPending && 'animate-spin text-primary',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500'
        )}
      />
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
      <span className={cn('font-medium text-foreground', isError && 'text-destructive')}>{label}</span>
      <span className="text-muted-foreground/40">|</span>
      <span className="font-mono truncate flex-1 text-muted-foreground text-[11px] sm:text-[13px]">{pattern}</span>
      {!isPending && !isError && !isCancelled && (
        <span className="text-[10px] sm:text-xs font-medium bg-foreground/5 text-foreground/70 px-1.5 sm:px-2 py-0.5 rounded-md">{resultCount} kết quả</span>
      )}
      {isCancelled && <span className="text-destructive text-[10px] sm:text-xs font-medium bg-destructive/10 px-1.5 sm:px-2 py-0.5 rounded-md">Đã dừng</span>}
    </div>
  );
}
