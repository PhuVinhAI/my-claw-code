import { ChevronDown, ChevronRight, Undo2, Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../../lib/utils';
import type { GitFileChange } from '../../../../store/useGitStore';
import { GitDiffViewer } from './GitDiffViewer';

interface GitFileItemProps {
  change: GitFileChange;
  isSelected: boolean;
  isExpanded: boolean;
  copiedPath: string | null;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onCopyPath: () => void;
  onDiscard: () => void;
  onStageToggle: () => void;
  diffContent?: string;
  isLoadingDiff?: boolean;
}

export function GitFileItem({
  change,
  isSelected,
  isExpanded,
  copiedPath,
  onToggleSelect,
  onToggleExpand,
  onCopyPath,
  onDiscard,
  onStageToggle,
  diffContent,
  isLoadingDiff,
}: GitFileItemProps) {
  const { t } = useTranslation();
  
  const statusIcon = change.status === 'new' ? '●' : change.status === 'modified' ? '◉' : '✕';
  const statusColor = change.status === 'new' ? 'text-green-500' : change.status === 'modified' ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="border-b border-border/50">
      {/* File Row */}
      <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50">
        {/* Checkbox */}
        <button onClick={onToggleSelect} className="shrink-0">
          <div className={cn(
            'w-3.5 h-3.5 border rounded flex items-center justify-center',
            isSelected ? 'bg-primary border-primary' : 'border-border'
          )}>
            {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
          </div>
        </button>

        {/* Expand Icon */}
        <button onClick={onToggleExpand} className="shrink-0 flex items-center justify-center w-3 h-3">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </button>

        {/* Status Icon */}
        <span className={cn("text-xs shrink-0 w-3 text-center", statusColor)}>{statusIcon}</span>

        {/* Copy Path Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyPath();
          }}
          className="shrink-0 p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title={t('gitPanel.copyPath')}
        >
          {copiedPath === change.path ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground" />
          )}
        </button>

        {/* File Path */}
        <span 
          onClick={onToggleExpand}
          className="text-xs text-foreground flex-1 truncate font-mono min-w-0 cursor-pointer"
        >
          {change.path}
        </span>

        {/* Stats or Binary Badge */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {change.is_binary ? (
            <span className="text-purple-500 font-medium">Binary</span>
          ) : (
            <>
              {change.additions > 0 && (
                <span className="text-green-500">+{change.additions}</span>
              )}
              {change.deletions > 0 && (
                <span className="text-red-500">-{change.deletions}</span>
              )}
            </>
          )}
        </div>

        {/* Status Badge */}
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded shrink-0 uppercase font-medium',
          change.status === 'new' && 'bg-green-500/20 text-green-500',
          change.status === 'modified' && 'bg-yellow-500/20 text-yellow-500',
          change.status === 'deleted' && 'bg-red-500/20 text-red-500'
        )}>
          {change.status === 'new' && t('gitPanel.new')}
          {change.status === 'modified' && t('gitPanel.modified')}
          {change.status === 'deleted' && t('gitPanel.deleted')}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            className="p-0.5 hover:bg-accent rounded"
            title={t('gitPanel.discardChanges')}
          >
            <Undo2 className="h-3 w-3 text-muted-foreground" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onStageToggle();
            }}
            className="p-0.5 hover:bg-accent rounded"
            title={change.staged ? t('gitPanel.unstage') : t('gitPanel.stage')}
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              {change.staged ? (
                <path d="M3.75 8a.75.75 0 01.75-.75h7a.75.75 0 010 1.5h-7A.75.75 0 013.75 8z"/>
              ) : (
                <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z"/>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Diff Preview */}
      {isExpanded && (
        <div className="px-3 py-2 bg-muted/10 border-t border-border/50">
          {isLoadingDiff ? (
            <div className="text-muted-foreground text-xs">{t('common.loading')}</div>
          ) : change.is_binary ? (
            <div className="flex items-center gap-2 text-purple-500 text-xs">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.707A1 1 0 0013.707 4L10 .293A1 1 0 009.293 0H4zm5.5 1.5v2a1 1 0 001 1h2l-3-3zM7 6.25a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0V10h-1.5a.75.75 0 010-1.5h1.5V7A.75.75 0 017 6.25z"/>
              </svg>
              <span>{diffContent || t('gitPanel.binaryFile')}</span>
            </div>
          ) : diffContent ? (
            <GitDiffViewer diffContent={diffContent} />
          ) : (
            <div className="text-muted-foreground text-xs">{t('gitPanel.clickToViewDiff')}</div>
          )}
        </div>
      )}
    </div>
  );
}
