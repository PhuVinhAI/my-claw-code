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
      // ONLY auto stage all if NOTHING is staged
      // If user has manually staged some files, respect their choice and only commit those
      if (stagedCount === 0) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_stage_all');
      }
      // If stagedCount > 0: Only commit staged files, unstaged files remain untouched
      
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
      
      // Show error toast
      const { useToastStore } = await import('../../../../store/useToastStore');
      const errorMsg = error instanceof Error ? error.message : String(error);
      useToastStore.getState().addToast('error', errorMsg, 5000);
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
    <div className="px-3 py-2 border-b border-border bg-background shrink-0">
      {/* Card Container - Match ChatInput style */}
      <div className="flex flex-col rounded-lg bg-card border border-border">
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('gitPanel.commitMessagePlaceholder')}
            className={cn(
              "w-full resize-none border-none shadow-none bg-transparent",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0",
              "text-xs leading-relaxed px-3 pt-2.5 pb-2 pr-10",
              "min-h-[60px] max-h-[120px] overflow-y-auto",
              "text-foreground chat-input-scroll"
            )}
            rows={1}
            disabled={isCommitting || isGenerating}
          />
          {/* AI Generate Button - Absolute positioned inside */}
          <button
            onClick={handleGenerateCommitMessage}
            disabled={isCommitting}
            title={isGenerating ? t('common.cancel') : t('gitPanel.generateCommitMessage')}
            className={cn(
              'absolute right-3 top-3 p-1 rounded-md transition-colors',
              isCommitting
                ? 'text-muted-foreground cursor-not-allowed'
                : isGenerating
                ? 'text-red-500 hover:bg-red-500/10'
                : 'text-primary hover:bg-primary/10'
            )}
          >
            {isGenerating ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        
        {/* Bottom bar - Match ChatInput bottom bar */}
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1">
          {/* Left side - Empty or minimal info */}
          <div className="flex items-center gap-1.5">
            {/* Có thể để trống hoặc thêm info khác sau */}
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Main Commit Button */}
            <button
              onClick={handleAction}
              disabled={!canCommit || isCommitting}
              className={cn(
                'h-6 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors',
                canCommit && !isCommitting
                  ? 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                  : 'bg-transparent text-muted-foreground/50 cursor-not-allowed'
              )}
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t('common.loading')}</span>
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
                  'h-6 w-6 rounded-md flex items-center justify-center transition-colors',
                  !isCommitting
                    ? 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                    : 'bg-transparent text-muted-foreground/50 cursor-not-allowed'
                )}
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute bottom-full right-0 mb-1.5 min-w-[180px] rounded-lg border border-border/30 bg-popover p-1 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50 shadow-xl">
                  {actions.map((action) => (
                    <button
                      key={action.value}
                      onClick={() => {
                        setSelectedAction(action.value);
                        setShowDropdown(false);
                      }}
                      className={cn(
                        'w-full px-2.5 py-1.5 rounded-sm text-xs text-left flex items-center gap-2 transition-colors',
                        selectedAction === action.value
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'text-popover-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {action.icon}
                      <span className="flex-1">{action.label}</span>
                      {selectedAction === action.value && (
                        <span className="text-primary text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
