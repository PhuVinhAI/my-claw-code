import { useState, useEffect } from 'react';
import { RotateCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useGitStore } from '../../../store/useGitStore';

export function GitView() {
  const { t } = useTranslation();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  
  const {
    currentBranch,
    changes,
    stagedChanges,
    isLoading,
    error,
    stageFile,
    unstageFile,
    discardChanges,
    refresh,
  } = useGitStore();

  useEffect(() => {
    refresh();
  }, []);

  // Check if error is "not a git repository"
  const isNotGitRepo = error?.includes('could not find repository') || error?.includes('NotFound');

  const allChanges = [...stagedChanges, ...changes];
  const totalAdditions = allChanges.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = allChanges.reduce((sum, c) => sum + c.deletions, 0);

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFiles(newExpanded);
  };

  // Show placeholder if not a git repository
  if (isNotGitRepo) {
    return (
      <div className="flex flex-col w-full h-full bg-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
            </svg>
            <span className="text-muted-foreground">Source Control</span>
          </div>
        </div>

        {/* Not a Git Repository Placeholder */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <svg className="w-16 h-16 mb-4 text-muted-foreground/30" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <h3 className="text-sm font-medium text-foreground mb-2">{t('gitPanel.noRepository')}</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            {t('gitPanel.noRepositoryHint')}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
              {t('gitPanel.initRepository')}
            </button>
            <button className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent transition-colors">
              {t('gitPanel.cloneRepository')}
            </button>
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            <p>{t('gitPanel.learnMore')} <a href="#" className="text-primary hover:underline">{t('gitPanel.gitVersionControl')}</a></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
          </svg>
          <span className="text-muted-foreground">{t('gitPanel.local')}</span>
          <span className="text-foreground">{currentBranch || 'main'}</span>
        </div>
        <button 
          onClick={refresh}
          disabled={isLoading}
          className="p-0.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
        >
          <RotateCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Error (only show non-repo errors) */}
      {error && !isNotGitRepo && (
        <div className="px-3 py-1.5 bg-red-500/10 text-red-500 text-xs border-b border-red-500/20">
          {error}
        </div>
      )}

      {/* Changes Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/5">
        <div className="flex items-center gap-2 text-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5z"/>
          </svg>
          <span className="font-medium">{allChanges.length} {t('gitPanel.uncommittedChanges')}</span>
          <span className="text-green-500">+{totalAdditions}</span>
          <span className="text-red-500">-{totalDeletions}</span>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {allChanges.map((change) => {
          const isExpanded = expandedFiles.has(change.path);
          const statusIcon = change.status === 'new' ? '●' : change.status === 'modified' ? '◉' : '✕';
          const statusColor = change.status === 'new' ? 'text-green-500' : change.status === 'modified' ? 'text-yellow-500' : 'text-red-500';
          
          return (
            <div key={change.path} className="border-b border-border/50">
              {/* File Row */}
              <div
                onClick={() => toggleExpand(change.path)}
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 cursor-pointer"
              >
                {/* Expand Icon */}
                <div className="shrink-0 flex items-center justify-center w-3 h-3">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>

                {/* Status Icon */}
                <span className={cn("text-xs shrink-0 w-3 text-center", statusColor)}>{statusIcon}</span>

                {/* File Path */}
                <span className="text-xs text-foreground flex-1 truncate font-mono min-w-0">
                  {change.path}
                </span>

                {/* Stats */}
                <div className="flex items-center gap-1.5 text-xs shrink-0">
                  {change.additions > 0 && (
                    <span className="text-green-500">+{change.additions}</span>
                  )}
                  {change.deletions > 0 && (
                    <span className="text-red-500">-{change.deletions}</span>
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
                      discardChanges(change.path);
                    }}
                    className="p-0.5 hover:bg-accent rounded"
                    title={t('gitPanel.discardChanges')}
                  >
                    <RotateCw className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (change.staged) {
                        unstageFile(change.path);
                      } else {
                        stageFile(change.path);
                      }
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
                <div className="px-3 py-2 bg-muted/10 text-xs font-mono">
                  <div className="space-y-0.5">
                    {/* Mock diff lines */}
                    {change.status === 'new' && (
                      <>
                        <div className="text-green-500">+ {t('gitPanel.newFileCreated')}</div>
                        <div className="text-green-500">+ {change.additions} {t('gitPanel.linesAdded')}</div>
                      </>
                    )}
                    {change.status === 'modified' && (
                      <>
                        {change.additions > 0 && (
                          <div className="text-green-500">+ {change.additions} {t('gitPanel.additions')}</div>
                        )}
                        {change.deletions > 0 && (
                          <div className="text-red-500">- {change.deletions} {t('gitPanel.deletions')}</div>
                        )}
                      </>
                    )}
                    {change.status === 'deleted' && (
                      <div className="text-red-500">- {t('gitPanel.fileDeleted')} ({change.deletions} {t('gitPanel.lines')})</div>
                    )}
                    <div className="text-muted-foreground mt-2">{t('gitPanel.clickToViewDiff')}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {allChanges.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <svg className="w-12 h-12 mb-3 opacity-20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <p className="text-sm">{t('gitPanel.noChanges')}</p>
            <p className="text-xs mt-1">{t('gitPanel.workingTreeClean')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
