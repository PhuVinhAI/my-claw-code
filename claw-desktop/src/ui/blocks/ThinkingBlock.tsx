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
    <div className="my-2">
      {/* Header */}
      <button
        onClick={() => !isStreaming && setIsExpanded(!isExpanded)}
        disabled={isStreaming}
        className={cn(
          'flex items-center gap-2 py-1.5 text-xs text-muted-foreground/60 transition-colors duration-150',
          !isStreaming && 'hover:text-muted-foreground cursor-pointer',
          isStreaming && 'cursor-default'
        )}
      >
        {isStreaming ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Brain className="h-3 w-3" />
        )}
        <span className="font-medium">
          {isStreaming ? 'Đang suy luận…' : 'Suy luận'}
        </span>
        {!isStreaming && thinking && (
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {/* Content */}
      {thinking && (isStreaming || isExpanded) && (
        <div className="pl-5 border-l border-border/30 ml-1.5 mt-1">
          <div className="text-xs text-muted-foreground/50 whitespace-pre-wrap break-words leading-relaxed py-1">
            {thinking}
          </div>
        </div>
      )}

      {/* Streaming indicator when no content */}
      {isStreaming && !thinking && (
        <div className="pl-5 ml-1.5 mt-1">
          <div className="flex gap-1 text-muted-foreground/30">
            <span className="animate-bounce text-xs" style={{ animationDelay: '0ms' }}>●</span>
            <span className="animate-bounce text-xs" style={{ animationDelay: '150ms' }}>●</span>
            <span className="animate-bounce text-xs" style={{ animationDelay: '300ms' }}>●</span>
          </div>
        </div>
      )}
    </div>
  );
}
