// WebSearchBlock — Web search with expandable results
import { useState } from 'react';
import { Globe, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, ExternalLink, Clock } from 'lucide-react';
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

interface SearchHit {
  title: string;
  url: string;
}

interface WebSearchOutput {
  query: string;
  results: Array<{ content?: SearchHit[] } | string>;
  durationSeconds?: number;
}

interface WebFetchOutput {
  bytes: number;
  code: number;
  codeText: string;
  result: string;
  durationMs: number;
  url: string;
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
  const [isExpanded, setIsExpanded] = useState(false);
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const label = t(`webSearch.${toolName === 'WebSearch' ? 'search' : 'fetch'}`);
  const displayText = toolName === 'WebSearch' ? query : url || query;

  // Parse output
  let parsedOutput: WebSearchOutput | WebFetchOutput | null = null;
  let searchHits: SearchHit[] = [];
  let resultCount = 0;
  let duration: string | null = null;

  if (output && !isPending) {
    try {
      parsedOutput = JSON.parse(output);
      
      if (parsedOutput && toolName === 'WebSearch' && 'results' in parsedOutput) {
        const searchOutput = parsedOutput as WebSearchOutput;
        // Extract hits from results array
        for (const item of searchOutput.results) {
          if (typeof item === 'object' && 'content' in item && Array.isArray(item.content)) {
            searchHits.push(...item.content);
          }
        }
        resultCount = searchHits.length;
        if (searchOutput.durationSeconds) {
          duration = `${searchOutput.durationSeconds.toFixed(2)}s`;
        }
      } else if (parsedOutput && toolName === 'WebFetch' && 'durationMs' in parsedOutput) {
        const fetchOutput = parsedOutput as WebFetchOutput;
        resultCount = 1;
        if (fetchOutput.durationMs) {
          duration = `${fetchOutput.durationMs}ms`;
        }
      }
    } catch {}
  }

  const hasResults = !isPending && !isError && !isCancelled && parsedOutput && (searchHits.length > 0 || (toolName === 'WebFetch' && 'result' in parsedOutput));

  return (
    <div className="my-2 bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="group flex items-center gap-3 px-4 py-3 bg-muted/20 border-b border-border/30">
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
        <span className="text-muted-foreground/30">|</span>
        <span className="font-mono truncate flex-1 text-muted-foreground/70 text-xs">{displayText}</span>
        
        {duration && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        )}
        
        {hasResults && resultCount > 0 && (
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

      {/* Expandable Results */}
      {hasResults && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 bg-muted/5 hover:bg-muted/10 transition-colors text-left border-b border-border/20"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
            )}
            <span className="text-xs text-muted-foreground/80 font-medium">
              {isExpanded ? t('webSearch.hideResults') : t('webSearch.showResults')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-4 py-3 bg-muted/5 max-h-96 overflow-auto">
              {toolName === 'WebSearch' && searchHits.length > 0 && (
                <div className="space-y-2">
                  {searchHits.map((hit, idx) => (
                    <a
                      key={idx}
                      href={hit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/20 transition-colors group/link"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground/90 group-hover/link:text-blue-400 transition-colors">
                          {hit.title}
                        </div>
                        <div className="text-xs text-muted-foreground/60 truncate font-mono mt-0.5">
                          {hit.url}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {toolName === 'WebFetch' && parsedOutput && 'result' in parsedOutput && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground/70">{t('webSearch.status')}:</span>
                    <span className={cn(
                      'font-medium px-2 py-0.5 rounded-md',
                      parsedOutput.code >= 200 && parsedOutput.code < 300
                        ? 'bg-emerald-400/10 text-emerald-400'
                        : 'bg-red-400/10 text-red-400'
                    )}>
                      {parsedOutput.code} {parsedOutput.codeText}
                    </span>
                    <span className="text-muted-foreground/70">|</span>
                    <span className="text-muted-foreground/70">{parsedOutput.bytes} {t('webSearch.bytes')}</span>
                  </div>
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {parsedOutput.result}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

