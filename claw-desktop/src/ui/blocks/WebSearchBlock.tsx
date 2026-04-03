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
    <div className="flex items-center gap-3 p-3 my-1.5 bg-muted/30 border border-border/50 rounded-xl text-sm transition-colors hover:bg-muted/50">
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          isPending && 'animate-spin text-primary',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500'
        )}
      />
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn('font-medium text-foreground', isError && 'text-destructive')}>{label}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-mono truncate flex-1 text-muted-foreground text-[13px]">{displayText}</span>
      {!isPending && !isError && !isCancelled && resultCount > 0 && (
        <span className="text-xs font-medium bg-foreground/5 text-foreground/70 px-2 py-0.5 rounded-md">{t('webSearch.results', { count: resultCount })}</span>
      )}
      {isCancelled && <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-md">{t('webSearch.stopped')}</span>}
    </div>
  );
}
