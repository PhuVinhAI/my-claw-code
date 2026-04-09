import { useTranslation } from 'react-i18next';
import type { GitFileChange } from '../../../../store/useGitStore';
import { GitFileItem } from './GitFileItem';

interface GitFileListProps {
  changes: GitFileChange[];
  selectedFiles: Set<string>;
  expandedFiles: Set<string>;
  fileDiffs: Map<string, string>;
  loadingDiffs: Set<string>;
  copiedPath: string | null;
  isLoading: boolean;
  getFileKey: (path: string, staged: boolean) => string;
  onToggleSelect: (path: string) => void;
  onToggleExpand: (path: string, staged: boolean) => void;
  onCopyPath: (path: string) => void;
  onDiscard: (path: string) => void;
  onStageToggle: (path: string, staged: boolean) => void;
}

export function GitFileList({
  changes,
  selectedFiles,
  expandedFiles,
  fileDiffs,
  loadingDiffs,
  copiedPath,
  isLoading,
  getFileKey,
  onToggleSelect,
  onToggleExpand,
  onCopyPath,
  onDiscard,
  onStageToggle,
}: GitFileListProps) {
  const { t } = useTranslation();

  // Separate staged and unstaged changes
  const stagedChanges = changes.filter(c => c.staged);
  const unstagedChanges = changes.filter(c => !c.staged);

  if (changes.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <svg className="w-12 h-12 mb-3 opacity-20" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <p className="text-sm">{t('gitPanel.noChanges')}</p>
        <p className="text-xs mt-1">{t('gitPanel.workingTreeClean')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {/* Staged Changes Section */}
      {stagedChanges.length > 0 && (
        <div className="mb-4">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b border-border">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
              <span className="text-xs font-medium text-foreground">
                {t('gitPanel.stagedChanges')} ({stagedChanges.length})
              </span>
            </div>
          </div>
          {stagedChanges.map((change) => {
            const fileKey = getFileKey(change.path, change.staged);
            return (
              <GitFileItem
                key={fileKey}
                change={change}
                isSelected={selectedFiles.has(change.path)}
                isExpanded={expandedFiles.has(fileKey)}
                copiedPath={copiedPath}
                diffContent={fileDiffs.get(fileKey)}
                isLoadingDiff={loadingDiffs.has(fileKey)}
                onToggleSelect={() => onToggleSelect(change.path)}
                onToggleExpand={() => onToggleExpand(change.path, change.staged)}
                onCopyPath={() => onCopyPath(change.path)}
                onDiscard={() => onDiscard(change.path)}
                onStageToggle={() => onStageToggle(change.path, change.staged)}
              />
            );
          })}
        </div>
      )}

      {/* Unstaged Changes Section */}
      {unstagedChanges.length > 0 && (
        <div>
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b border-border">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                <path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
              </svg>
              <span className="text-xs font-medium text-foreground">
                {t('gitPanel.unstagedChanges')} ({unstagedChanges.length})
              </span>
            </div>
          </div>
          {unstagedChanges.map((change) => {
            const fileKey = getFileKey(change.path, change.staged);
            return (
              <GitFileItem
                key={fileKey}
                change={change}
                isSelected={selectedFiles.has(change.path)}
                isExpanded={expandedFiles.has(fileKey)}
                copiedPath={copiedPath}
                diffContent={fileDiffs.get(fileKey)}
                isLoadingDiff={loadingDiffs.has(fileKey)}
                onToggleSelect={() => onToggleSelect(change.path)}
                onToggleExpand={() => onToggleExpand(change.path, change.staged)}
                onCopyPath={() => onCopyPath(change.path)}
                onDiscard={() => onDiscard(change.path)}
                onStageToggle={() => onStageToggle(change.path, change.staged)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
