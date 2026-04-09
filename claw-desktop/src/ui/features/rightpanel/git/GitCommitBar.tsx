import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GitCommit, ChevronDown, Loader2, Sparkles, Square } from 'lucide-react';
import { cn } from '../../../../lib/utils';

type CommitAction = 'commit' | 'commitAndPush' | 'commitAndSync';

interface GitCommitBarProps {
  stagedCount: number;
  onCommit: (message: string) => Promise<void>;
  onCommitAndPush: (message: string) => Promise<void>;
  onCommitAndSync: (message: string) => Promise<void>;
}

export function GitCommitBar({
  stagedCount,
  onCommit,
  onCommitAndPush,
  onCommitAndSync,
}: GitCommitBarProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAction, setSelectedAction] = useState<CommitAction>('commit');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canCommit = message.trim().length > 0;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = async () => {
    if (!canCommit || isCommitting) return;
    
    setIsCommitting(true);
    try {
      // Auto stage all if nothing is staged
      if (stagedCount === 0) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_stage_all');
      }
      
      switch (selectedAction) {
        case 'commit':
          await onCommit(message);
          break;
        case 'commitAndPush':
          await onCommitAndPush(message);
          break;
        case 'commitAndSync':
          await onCommitAndSync(message);
          break;
      }
      setMessage('');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAction();
    }
  };

  const handleGenerateCommitMessage = async () => {
    if (isCommitting) return;
    
    // If already generating, cancel it
    if (isGenerating) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('cancel_prompt');
      } catch (error) {
        console.error('Failed to cancel generation:', error);
      }
      setIsGenerating(false);
      return;
    }
    
    setIsGenerating(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[GitCommitBar] Calling git_generate_commit_message...');
      const generatedMessage = await invoke<string>('git_generate_commit_message');
      console.log('[GitCommitBar] Generated message:', generatedMessage);
      setMessage(generatedMessage);
    } catch (error) {
      console.error('[GitCommitBar] Failed to generate commit message:', error);
    } finally {
      setIsGenerating(false);
      console.log('[GitCommitBar] Generation complete, isGenerating set to false');
    }
  };

  const actions: { value: CommitAction; label: string; icon: React.ReactNode }[] = [
    { 
      value: 'commit', 
      label: t('gitPanel.commit'),
      icon: <GitCommit className="w-3.5 h-3.5" />
    },
    { 
      value: 'commitAndPush', 
      label: t('gitPanel.commitAndPush'),
      icon: (
        <div className="flex items-center gap-0.5">
          <GitCommit className="w-3.5 h-3.5" />
          <span className="text-[10px]">→</span>
        </div>
      )
    },
    { 
      value: 'commitAndSync', 
      label: t('gitPanel.commitAndSync'),
      icon: (
        <div className="flex items-center gap-0.5">
          <GitCommit className="w-3.5 h-3.5" />
          <span className="text-[10px]">↕</span>
        </div>
      )
    },
  ];

  const currentAction = actions.find(a => a.value === selectedAction)!;

  return (
    <div className="flex flex-col border-b border-border bg-background shrink-0">
      {/* Commit Message Textarea with AI Button Inside */}
      <div className="px-3 py-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('gitPanel.commitMessagePlaceholder')}
            className="w-full bg-muted/50 border border-border rounded pl-2 pr-9 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-y-auto min-h-[32px] max-h-[120px]"
            rows={1}
            disabled={isCommitting || isGenerating}
          />
          {/* AI Generate Button - Inside textarea border, top-right */}
          <button
            onClick={handleGenerateCommitMessage}
            disabled={isCommitting}
            title={isGenerating ? t('common.cancel') : t('gitPanel.generateCommitMessage')}
            className={cn(
              'absolute right-2.5 top-1.5 p-1 rounded hover:bg-background/80 transition-colors',
              isCommitting
                ? 'text-muted-foreground cursor-not-allowed'
                : isGenerating
                ? 'text-red-500'
                : 'text-primary'
            )}
          >
            {isGenerating ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      
      {/* Action Buttons - Full Width */}
      <div className="px-3 pb-2 flex items-center gap-2">
        {/* Main Commit Button - Flex Grow */}
        <button
          onClick={handleAction}
          disabled={!canCommit || isCommitting}
          className={cn(
            'flex-1 px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-2 transition-colors',
            canCommit && !isCommitting
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isCommitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t('common.loading')}...</span>
            </>
          ) : (
            <>
              {currentAction.icon}
              <span>{currentAction.label}</span>
            </>
          )}
        </button>

        {/* Dropdown Toggle */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isCommitting}
            className={cn(
              'px-2 py-2 rounded text-xs transition-colors',
              !isCommitting
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded shadow-lg z-50 min-w-[200px]">
              {actions.map((action) => (
                <button
                  key={action.value}
                  onClick={() => {
                    setSelectedAction(action.value);
                    setShowDropdown(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-xs text-left flex items-center gap-2 hover:bg-accent transition-colors first:rounded-t last:rounded-b',
                    selectedAction === action.value && 'bg-accent'
                  )}
                >
                  {action.icon}
                  <span className="flex-1">{action.label}</span>
                  {selectedAction === action.value && (
                    <span className="text-primary text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
