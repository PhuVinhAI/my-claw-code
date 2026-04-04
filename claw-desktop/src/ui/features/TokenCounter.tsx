// Token Counter Component
import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TokenUsage } from '../../core/entities';

interface TokenCounterProps {
  usage: TokenUsage | null;
  maxContext?: number; // Max context length from model
}

export function TokenCounter({ usage, maxContext }: TokenCounterProps) {
  const { totalTokens, colorClass } = useMemo(() => {
    if (!usage) {
      return { totalTokens: 0, percentage: 0, colorClass: 'text-muted-foreground' };
    }

    const total = usage.input_tokens + usage.output_tokens;
    
    if (!maxContext) {
      return { 
        totalTokens: total, 
        percentage: 0, 
        colorClass: 'text-muted-foreground' 
      };
    }

    const pct = (total / maxContext) * 100;
    
    let color = 'text-muted-foreground';
    if (pct >= 90) {
      color = 'text-red-500 dark:text-red-400';
    } else if (pct >= 70) {
      color = 'text-amber-500 dark:text-amber-400';
    }

    return { totalTokens: total, percentage: pct, colorClass: color };
  }, [usage, maxContext]);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className={cn(
      "flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium transition-colors",
      colorClass
    )}>
      <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      <span>
        {formatNumber(totalTokens)}
        {maxContext && (
          <span className="opacity-70">
            /{formatNumber(maxContext)}
          </span>
        )}
      </span>
    </div>
  );
}
