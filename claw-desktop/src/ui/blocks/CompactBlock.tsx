import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

interface CompactBlockProps {
  status: 'started' | 'completed';
  estimatedTokens?: number;
  maxTokens?: number;
  removedCount?: number;
  summary?: string;
  newEstimatedTokens?: number;
}

export function CompactBlock({
  status,
  estimatedTokens,
  maxTokens,
  removedCount,
  summary,
  newEstimatedTokens,
}: CompactBlockProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Animation cho progress bar khi started
  useEffect(() => {
    if (status === 'started') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);
      return () => clearInterval(interval);
    } else if (status === 'completed') {
      setProgress(100);
    }
  }, [status]);

  if (status === 'started') {
    const percentage = maxTokens ? Math.round((estimatedTokens! / maxTokens) * 100) : 0;
    
    return (
      <div className="my-1.5 sm:my-2 bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/20 border-b border-border/30">
          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-blue-400 shrink-0" />
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-xs sm:text-sm text-foreground/90">
            {t('compact.compacting')}
          </span>
          <span className="text-muted-foreground/30 leading-4">|</span>
          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground/70">
            {estimatedTokens?.toLocaleString()} / {maxTokens?.toLocaleString()} ({percentage}%)
          </span>
        </div>
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/5">
          <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full bg-blue-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Completed
  const savedTokens = estimatedTokens && newEstimatedTokens 
    ? estimatedTokens - newEstimatedTokens 
    : 0;
  const savedPercentage = estimatedTokens 
    ? Math.round((savedTokens / estimatedTokens) * 100) 
    : 0;

  return (
    <div className="my-1.5 sm:my-2 bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/20 border-b border-border/30">
        <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
        <span className="font-semibold text-xs sm:text-sm text-foreground/90">
          {t('compact.completed')}
        </span>
        <span className="text-muted-foreground/30 leading-4">|</span>
        <span className="text-[10px] sm:text-xs text-muted-foreground/70">
          {t('compact.removed')}: {removedCount}
        </span>
        <span className="text-muted-foreground/30 leading-4 hidden sm:inline">|</span>
        <span className="font-mono text-[10px] sm:text-xs text-muted-foreground/70 hidden sm:inline">
          -{savedTokens.toLocaleString()} ({savedPercentage}%)
        </span>
        <span className="text-muted-foreground/30 leading-4 hidden sm:inline">|</span>
        <span className="font-mono text-[10px] sm:text-xs text-foreground/80 hidden sm:inline">
          {newEstimatedTokens?.toLocaleString()} / {maxTokens?.toLocaleString()}
        </span>
      </div>

      {/* Mobile stats (visible on small screens) */}
      <div className="sm:hidden px-3 py-2 bg-muted/5 border-b border-border/20 flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground/70">
          {t('compact.saved')}: <span className="font-mono text-foreground/80">-{savedTokens.toLocaleString()} ({savedPercentage}%)</span>
        </span>
        <span className="font-mono text-muted-foreground/70">
          {newEstimatedTokens?.toLocaleString()} / {maxTokens?.toLocaleString()}
        </span>
      </div>

      {/* Summary (collapsible) */}
      {summary && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-muted/5 hover:bg-muted/10 transition-colors text-left border-b border-border/20"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
            )}
            <span className="text-[10px] sm:text-xs text-muted-foreground/80 font-medium">
              {isExpanded ? t('compact.hideSummary') : t('compact.viewSummary')}
            </span>
          </button>

          {isExpanded && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/5">
              <pre className="text-[10px] sm:text-xs text-foreground/80 font-mono whitespace-pre-wrap bg-muted/20 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded overflow-auto max-h-64 leading-relaxed">
                {summary}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
