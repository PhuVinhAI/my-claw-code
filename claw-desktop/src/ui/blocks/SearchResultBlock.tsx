// SearchResultBlock — Clean inline search indicator
import { Search, FileSearch, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const Icon = toolName === 'grep_search' ? Search : FileSearch;
  const label = toolName === 'grep_search' ? t('search.grepSearch') : t('search.globSearch');
  const resultCount = output ? output.split('\n').filter((l) => l.trim()).length : 0;

  return (
    <div className="flex items-center gap-2 p-2 my-1.5 bg-muted/30 border border-border/50 rounded-lg text-xs transition-colors hover:bg-muted/50">
      <StatusIcon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          isPending && 'animate-spin text-primary',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500'
        )}
      />
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className={cn('font-medium text-foreground', isError && 'text-destructive')}>{label}</span>
      <span className="text-muted-foreground/40">|</span>
      <span className="font-mono truncate flex-1 text-muted-foreground text-[11px]">{pattern}</span>
      {!isPending && !isError && !isCancelled && (
        <span className="text-[10px] font-medium bg-foreground/5 text-foreground/70 px-1.5 py-0.5 rounded-md">{t('search.results', { count: resultCount })}</span>
      )}
      {isCancelled && (
        <span className="text-destructive text-[10px] font-medium bg-destructive/10 px-1.5 py-0.5 rounded-md">
          {t('search.stopped')}
        </span>
      )}
      {isError && !isCancelled && (
        <span className="text-destructive text-[10px] font-medium bg-destructive/10 px-1.5 py-0.5 rounded-md">
          {t('search.error')}
        </span>
      )}
    </div>
  );
}
