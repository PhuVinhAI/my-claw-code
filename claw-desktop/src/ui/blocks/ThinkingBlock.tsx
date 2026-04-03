// ThinkingBlock Component - Display AI reasoning/thinking process
import { Brain, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ thinking, isStreaming = false }: ThinkingBlockProps) {
  // Always expanded when streaming, auto-collapse when complete
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-collapse when streaming completes
  useEffect(() => {
    if (!isStreaming && isExpanded) {
      // Collapse after a short delay when streaming finishes
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 500); // 500ms delay for smooth transition
      
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  return (
    <div className="my-3 w-full">
      <div
        className={cn(
          'rounded-lg border border-purple-200 dark:border-purple-800/50',
          'bg-purple-50/50 dark:bg-purple-950/20',
          'transition-all duration-200'
        )}
      >
        {/* Header - Always visible */}
        <button
          onClick={() => !isStreaming && setIsExpanded(!isExpanded)}
          disabled={isStreaming}
          className={cn(
            'w-full flex items-center gap-2.5 p-3',
            !isStreaming && 'hover:bg-purple-100/50 dark:hover:bg-purple-900/20',
            'transition-colors duration-150',
            'text-left',
            isStreaming && 'cursor-default'
          )}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
          ) : (
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
          )}
          
          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
            {isStreaming ? 'Đang suy luận...' : 'Quá trình suy luận'}
          </span>

          {/* Expand/Collapse indicator - only show when complete */}
          {!isStreaming && thinking && (
            <svg
              className={cn(
                'h-4 w-4 text-purple-600 dark:text-purple-400 transition-transform duration-200 shrink-0 ml-auto',
                isExpanded && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {/* Content - Always visible when streaming, collapsible when complete */}
        {thinking && (isStreaming || isExpanded) && (
          <div className="px-3 pb-3 pt-0">
            <div
              className={cn(
                'text-sm text-purple-800 dark:text-purple-200',
                'whitespace-pre-wrap break-words',
                'leading-relaxed',
                'rounded-md bg-white/50 dark:bg-black/20 p-3',
                'border border-purple-200/50 dark:border-purple-800/30'
              )}
            >
              {thinking}
            </div>
          </div>
        )}

        {/* Streaming indicator when no content yet */}
        {isStreaming && !thinking && (
          <div className="px-3 pb-3 pt-0">
            <div className="flex items-center gap-2 text-xs text-purple-600/70 dark:text-purple-400/70">
              <div className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
