// WebSearchBlock — Clean inline web search indicator
import { Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WebSearchBlockProps {
  toolName: 'WebSearch' | 'WebFetch';
  query: string;
  url?: string;
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function WebSearchBlock({
  toolName,
  query,
  url,
  output,
  isError = false,
  isPending = false,
  isCancelled = false,
}: WebSearchBlockProps) {
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const label = toolName === 'WebSearch' ? 'Tìm kiếm web' : 'Lấy nội dung web';
  const displayText = toolName === 'WebSearch' ? query : url || query;

  // Count results
  let resultCount = 0;
  if (output && toolName === 'WebSearch') {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed.results)) resultCount = parsed.results.length;
    } catch {}
  }

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
      <Globe className="h-3.5 w-3.5 shrink-0 opacity-50" />
      <span className={cn('font-medium', isError && 'text-destructive')}>{label}</span>
      <span className="opacity-30">·</span>
      <span className="font-mono truncate flex-1 opacity-60">{displayText}</span>
      {!isPending && !isError && !isCancelled && resultCount > 0 && (
        <span className="opacity-40">{resultCount} kết quả</span>
      )}
      {isCancelled && <span className="text-destructive/70">Đã dừng</span>}
    </div>
  );
}
