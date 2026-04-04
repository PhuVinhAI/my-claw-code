import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

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
      <div className="my-4 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                {t('compact.compacting')}
              </span>
              <span className="text-xs text-blue-700">
                {estimatedTokens?.toLocaleString()} / {maxTokens?.toLocaleString()} tokens ({percentage}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
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
    <div className="my-4 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900">
              {t('compact.completed')}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
            <div className="rounded bg-white/60 p-2">
              <div className="text-gray-600">{t('compact.removed')}</div>
              <div className="font-semibold text-green-700">{removedCount} {t('compact.messages')}</div>
            </div>
            <div className="rounded bg-white/60 p-2">
              <div className="text-gray-600">{t('compact.saved')}</div>
              <div className="font-semibold text-green-700">
                {savedTokens.toLocaleString()} tokens ({savedPercentage}%)
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-700">
            <span>{t('compact.newTokenCount')}</span>
            <span className="font-mono font-medium">
              {newEstimatedTokens?.toLocaleString()} / {maxTokens?.toLocaleString()}
            </span>
          </div>

          {summary && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-green-700 hover:text-green-800 font-medium">
                {t('compact.viewSummary')}
              </summary>
              <div className="mt-2 rounded bg-white/80 p-3 text-gray-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {summary}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
