// ThinkingBlock — Minimal collapsible thinking indicator
import { Brain, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ thinking, isStreaming = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-collapse when streaming completes
  useEffect(() => {
    if (!isStreaming && isExpanded) {
      const timer = setTimeout(() => setIsExpanded(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  return (
    <div className="my-3">
      {/* Header */}
      <button
        onClick={() => !isStreaming && setIsExpanded(!isExpanded)}
        disabled={isStreaming}
        className={cn(
          'flex items-center gap-3 py-2 text-sm text-muted-foreground transition-colors duration-150',
          !isStreaming && 'hover:text-foreground cursor-pointer',
          isStreaming && 'cursor-default'
        )}
      >
        {isStreaming ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Brain className="h-4 w-4 text-primary" />
        )}
        <span className="font-semibold text-foreground/80">
          {isStreaming ? 'Đang suy luận…' : 'Suy luận'}
        </span>
        {!isStreaming && thinking && (
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {/* Content */}
      {thinking && (isStreaming || isExpanded) && (
        <div className="border-l-2 border-border/80 ml-2 mt-1 pl-4">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-[1.8] py-1">
            {thinking}
          </div>
        </div>
      )}

      {/* Streaming indicator when no content */}
      {isStreaming && !thinking && (
        <div className="border-l-2 border-border/80 ml-2 mt-1 pl-4">
          <div className="flex gap-1.5 text-muted-foreground py-2">
            <span className="animate-bounce text-sm" style={{ animationDelay: '0ms' }}>●</span>
            <span className="animate-bounce text-sm" style={{ animationDelay: '150ms' }}>●</span>
            <span className="animate-bounce text-sm" style={{ animationDelay: '300ms' }}>●</span>
          </div>
        </div>
      )}
    </div>
  );
}
