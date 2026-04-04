// ThinkingBlock — Minimal collapsible thinking indicator
import { Brain, Loader2, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ thinking, isStreaming = false }: ThinkingBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    if (isStreaming && !userInteracted) {
      setIsExpanded(true);
    }
  }, [isStreaming, userInteracted]);
  
  useEffect(() => {
    if (!isStreaming && isExpanded && !userInteracted) {
      const timer = setTimeout(() => setIsExpanded(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isExpanded, userInteracted]);
  
  const handleToggle = () => {
    if (!isStreaming) {
      setUserInteracted(true);
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="my-2 sm:my-3">
      <button
        onClick={handleToggle}
        disabled={isStreaming}
        className={cn(
          'flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2 text-xs sm:text-sm text-muted-foreground transition-colors duration-150',
          !isStreaming && 'hover:text-foreground cursor-pointer',
          isStreaming && 'cursor-default'
        )}
      >
        {isStreaming ? (
          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-primary" />
        ) : (
          <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
        )}
        <span className="font-semibold text-foreground/80">
          {isStreaming ? t('thinking.streaming') : t('thinking.title')}
        </span>
        {!isStreaming && thinking && (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {thinking && (isStreaming || isExpanded) && (
        <div className="border-l-2 border-border/80 ml-1.5 sm:ml-2 mt-1 pl-3 sm:pl-4">
          <div className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap break-words leading-[1.7] sm:leading-[1.8] py-1">
            {thinking}
          </div>
        </div>
      )}

      {isStreaming && !thinking && (
        <div className="border-l-2 border-border/80 ml-1.5 sm:ml-2 mt-1 pl-3 sm:pl-4">
          <div className="flex gap-1 sm:gap-1.5 text-muted-foreground py-1.5 sm:py-2">
            <span className="animate-bounce text-xs sm:text-sm" style={{ animationDelay: '0ms' }}>●</span>
            <span className="animate-bounce text-xs sm:text-sm" style={{ animationDelay: '150ms' }}>●</span>
            <span className="animate-bounce text-xs sm:text-sm" style={{ animationDelay: '300ms' }}>●</span>
          </div>
        </div>
      )}
    </div>
  );
}
