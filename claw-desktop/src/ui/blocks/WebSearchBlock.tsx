// WebSearchBlock - Specialized UI for WebSearch/WebFetch
import { Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WebSearchResult {
  title?: string;
  url?: string;
  snippet?: string;
}

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

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full space-y-2">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 shrink-0 text-destructive" />
          <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-destructive">
              {toolName === 'WebSearch' ? 'Tìm kiếm web' : 'Lấy nội dung web'}
            </p>
          </div>
        </div>
        <div className="pl-12">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {toolName === 'WebSearch' ? 'Truy vấn:' : 'URL:'}
            </span>
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground/80 truncate max-w-md">
              {toolName === 'WebSearch' ? query : url || query}
            </code>
          </div>
          <p className="text-xs text-destructive mt-2">Đã dừng bởi người dùng</p>
        </div>
      </div>
    );
  }

  // Try to parse search results
  let results: WebSearchResult[] = [];
  if (output && toolName === 'WebSearch') {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed.results)) {
        results = parsed.results;
      }
    } catch {
      // Fallback to plain text
    }
  }

  return (
    <div className="bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full">
      {/* Single line: Status + Icon + Label + Query/URL + Result Count */}
      <div className="flex items-center gap-2">
        <StatusIcon
          className={cn(
            'h-5 w-5 shrink-0',
            isPending && 'animate-spin text-blue-500',
            isError && 'text-destructive',
            !isPending && !isError && 'text-green-500'
          )}
        />
        <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className={cn('font-medium text-sm', isError && 'text-destructive')}>
          {toolName === 'WebSearch' ? 'Tìm kiếm web:' : 'Lấy nội dung web:'}
        </p>
        <span className="text-sm font-mono text-foreground/80 truncate flex-1">
          {toolName === 'WebSearch' ? query : url || query}
        </span>
        {!isPending && !isError && results.length > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {results.length} kết quả
          </span>
        )}
      </div>
    </div>
  );
}
