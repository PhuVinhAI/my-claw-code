// WebSearchBlock — Clean inline web search indicator
import { Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const label = t(`webSearch.${toolName === 'WebSearch' ? 'search' : 'fetch'}`);
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
    <div className="group flex items-center gap-3 px-4 py-3 my-2 bg-muted/20 border border-border/30 rounded-lg text-sm transition-all hover:bg-muted/30 hover:border-border/50">
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          isPending && 'animate-spin text-blue-400',
          isError && 'text-red-400',
          isCancelled && 'text-red-400',
          !isPending && !isError && !isCancelled && 'text-emerald-400'
        )}
      />
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span className={cn('font-semibold text-foreground/90', isError && 'text-red-400')}>{label}</span>
      <span className="text-muted-foreground/30">·</span>
      <span className="font-mono truncate flex-1 text-muted-foreground/70 text-xs">{displayText}</span>
      {!isPending && !isError && !isCancelled && resultCount > 0 && (
        <span className="text-xs font-medium bg-emerald-400/10 text-emerald-400 px-2 py-1 rounded-md border border-emerald-400/20">
          {t('webSearch.results', { count: resultCount })}
        </span>
      )}
      {isCancelled && (
        <span className="text-red-400 text-xs font-medium bg-red-400/10 px-2 py-1 rounded-md border border-red-400/20">
          {t('webSearch.stopped')}
        </span>
      )}
    </div>
  );
}
