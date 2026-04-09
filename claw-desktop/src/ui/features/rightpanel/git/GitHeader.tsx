import { RotateCw, Upload, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../../lib/utils';

interface GitHeaderProps {
  currentBranch: string | null;
  isLoading: boolean;
  isPushing: boolean;
  hasUnpushedCommits: boolean;
  onRefresh: () => void;
  onPush: () => void;
}

export function GitHeader({ currentBranch, isLoading, isPushing, hasUnpushedCommits, onRefresh, onPush }: GitHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
      <div className="flex items-center gap-2 text-xs">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
        </svg>
        <span className="text-muted-foreground">{t('gitPanel.local')}</span>
        <span className="text-foreground">{currentBranch || 'main'}</span>
      </div>
      
      <div className="flex items-center gap-1">
        {/* Push Button - Only show when there are unpushed commits */}
        {hasUnpushedCommits && (
          <button 
            onClick={onPush}
            disabled={isPushing}
            className="px-2 py-0.5 text-xs flex items-center gap-1 hover:bg-accent rounded transition-colors disabled:opacity-50"
            title={t('gitPanel.push')}
          >
            {isPushing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            <span>{t('gitPanel.push')}</span>
          </button>
        )}
        
        {/* Refresh Button */}
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="p-0.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
          title={t('gitPanel.refresh')}
        >
          <RotateCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}
