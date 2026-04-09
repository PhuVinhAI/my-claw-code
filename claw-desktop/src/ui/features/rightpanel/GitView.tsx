import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGitStore } from '../../../store/useGitStore';
import { useChatStore } from '../../../store/useChatStore';
import { GitHeader } from './git/GitHeader';
import { GitFilterBar, type FilterType } from './git/GitFilterBar';
import { GitFileList } from './git/GitFileList';
import { GitNoRepository } from './git/GitNoRepository';
import { ConfirmDialog } from './git/ConfirmDialog';
import { GitCommitBar } from './git/GitCommitBar';

export function GitView() {
  const { t } = useTranslation();
  const workspacePath = useChatStore((state) => state.workspacePath);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  // Use unique key: "path:staged" or "path:unstaged"
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fileDiffs, setFileDiffs] = useState<Map<string, string>>(new Map());
  const [loadingDiffs, setLoadingDiffs] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<FilterType>('uncommitted');
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<'all' | string>('all');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [hasUnpushedCommits, setHasUnpushedCommits] = useState(false);
  
  // Helper to create unique key for file (includes staged status)
  const getFileKey = (path: string, staged: boolean) => `${path}:${staged ? 'staged' : 'unstaged'}`;
  
  const {
    currentBranch,
    changes,
    stagedChanges,
    isLoading,
    error,
    stageFile,
    unstageFile,
    discardChanges,
    commit,
    commitAndPush,
    commitAndSync,
    refresh,
  } = useGitStore();

  useEffect(() => {
    // Refresh git when workspace path or session changes
    console.log('[GitView] Workspace or session changed, refreshing git...', { workspacePath, currentSessionId });
    refresh();
    
    // Start git file watcher
    const startWatcher = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_start_watch');
        console.log('[GitView] Git watcher started');
      } catch (error) {
        console.error('[GitView] Failed to start git watcher:', error);
      }
    };
    
    startWatcher();
    
    // Listen for git change events
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen('git-changed', () => {
        console.log('[GitView] Git changed event received, refreshing...');
        refresh();
      });
      
      return unlisten;
    };
    
    let unlistenPromise = setupListener();
    
    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [workspacePath, currentSessionId]); // Re-run when workspace or session changes

  // Check for unpushed commits whenever changes update
  useEffect(() => {
    const checkUnpushed = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const hasUnpushed = await invoke<boolean>('git_has_unpushed_commits');
        setHasUnpushedCommits(hasUnpushed);
      } catch (error) {
        // Ignore errors, just don't show push button
        setHasUnpushedCommits(false);
      }
    };
    
    checkUnpushed();
  }, [changes, stagedChanges]);

  // Check if error is "not a git repository"
  const isNotGitRepo = error?.includes('could not find repository') || error?.includes('NotFound');

  const allChanges = [...stagedChanges, ...changes];
  const totalAdditions = allChanges.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = allChanges.reduce((sum, c) => sum + c.deletions, 0);

  // Filter changes based on selected filter
  const filteredChanges = allChanges.filter(change => {
    // Skip files with no actual changes (0 additions and 0 deletions)
    if (change.additions === 0 && change.deletions === 0) {
      return false;
    }
    
    switch (filterType) {
      case 'unstaged':
        return !change.staged;
      case 'staged':
        return change.staged;
      case 'uncommitted':
      default:
        return true;
    }
  });

  const toggleSelectFile = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    // Get unique paths from filtered changes (a file can appear in both staged and unstaged)
    const uniquePaths = new Set(filteredChanges.map(c => c.path));
    const allPathsSelected = uniquePaths.size > 0 && 
      Array.from(uniquePaths).every(path => selectedFiles.has(path));
    
    if (allPathsSelected) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(uniquePaths);
    }
  };

  const handleDiscardClick = (target: 'all' | string) => {
    setDiscardTarget(target);
    setDiscardDialogOpen(true);
  };

  const handleDiscardConfirm = async () => {
    if (discardTarget === 'all') {
      // Discard all selected files
      for (const path of selectedFiles) {
        await discardChanges(path);
      }
      setSelectedFiles(new Set());
    } else {
      // Discard single file
      await discardChanges(discardTarget);
      setSelectedFiles(prev => {
        const next = new Set(prev);
        next.delete(discardTarget);
        return next;
      });
    }
    setDiscardDialogOpen(false);
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('git_push');
      await refresh();
      // Re-check unpushed commits after push
      const hasUnpushed = await invoke<boolean>('git_has_unpushed_commits');
      setHasUnpushedCommits(hasUnpushed);
    } catch (error) {
      console.error('Push failed:', error);
    } finally {
      setIsPushing(false);
    }
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const toggleExpand = async (path: string, staged: boolean) => {
    const fileKey = getFileKey(path, staged);
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileKey)) {
      newExpanded.delete(fileKey);
    } else {
      newExpanded.add(fileKey);
      
      // Fetch diff if not already loaded
      if (!fileDiffs.has(fileKey) && !loadingDiffs.has(fileKey)) {
        setLoadingDiffs(prev => new Set(prev).add(fileKey));
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const diff = await invoke<string>('git_get_diff', { 
            path, 
            staged 
          });
          
          setFileDiffs(prev => new Map(prev).set(fileKey, diff));
        } catch (err) {
          console.error('Failed to get diff:', err);
          setFileDiffs(prev => new Map(prev).set(fileKey, `Error loading diff: ${err}`));
        } finally {
          setLoadingDiffs(prev => {
            const next = new Set(prev);
            next.delete(fileKey);
            return next;
          });
        }
      }
    }
    setExpandedFiles(newExpanded);
  };

  const handleStageToggle = async (path: string, staged: boolean) => {
    if (staged) {
      await unstageFile(path);
    } else {
      await stageFile(path);
    }
  };

  // Show placeholder if not a git repository
  if (isNotGitRepo) {
    return <GitNoRepository />;
  }

  return (
    <div className="flex flex-col w-full h-full bg-background overflow-hidden">
      <GitHeader 
        currentBranch={currentBranch}
        isPushing={isPushing}
        hasUnpushedCommits={hasUnpushedCommits}
        onPush={handlePush}
      />

      {/* Commit Bar - Below Header */}
      <GitCommitBar
        stagedCount={stagedChanges.length}
        onCommit={commit}
        onCommitAndPush={commitAndPush}
        onCommitAndSync={commitAndSync}
      />

      {/* Error (only show non-repo errors) */}
      {error && !isNotGitRepo && (
        <div className="px-3 py-1.5 bg-red-500/10 text-red-500 text-xs border-b border-red-500/20 shrink-0">
          {error}
        </div>
      )}

      <GitFilterBar
        filterType={filterType}
        filteredCount={filteredChanges.length}
        selectedCount={selectedFiles.size}
        totalAdditions={totalAdditions}
        totalDeletions={totalDeletions}
        allSelected={(() => {
          const uniquePaths = new Set(filteredChanges.map(c => c.path));
          return uniquePaths.size > 0 && Array.from(uniquePaths).every(path => selectedFiles.has(path));
        })()}
        onFilterChange={setFilterType}
        onToggleSelectAll={toggleSelectAll}
        onDiscardSelected={() => handleDiscardClick('all')}
      />

      <GitFileList
        changes={filteredChanges}
        selectedFiles={selectedFiles}
        expandedFiles={expandedFiles}
        fileDiffs={fileDiffs}
        loadingDiffs={loadingDiffs}
        copiedPath={copiedPath}
        isLoading={isLoading}
        getFileKey={getFileKey}
        onToggleSelect={toggleSelectFile}
        onToggleExpand={toggleExpand}
        onCopyPath={copyPath}
        onDiscard={handleDiscardClick}
        onStageToggle={handleStageToggle}
      />

      <ConfirmDialog
        isOpen={discardDialogOpen}
        title={t('gitPanel.discardConfirmTitle')}
        message={
          discardTarget === 'all' 
            ? t('gitPanel.discardConfirmMultiple', { count: selectedFiles.size })
            : t('gitPanel.discardConfirmSingle', { file: discardTarget })
        }
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardDialogOpen(false)}
      />
    </div>
  );
}
