// ChatInput Component
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store';
import { Textarea } from '../../components/ui/textarea';
import { Send, Square, FolderOpen, ChevronDown, Sparkles, FolderSync, History } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuGroup } from '../../components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { WorkMode } from '../../core/entities/WorkMode';
import { invoke } from '@tauri-apps/api/core';
import { ModelSelector } from './ModelSelector';

export function ChatInput() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false); // Tools dropdown
  const modeRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const { state, messages, sendPrompt, stopGeneration, workMode, workspacePath, setWorkMode, selectedTools, setSelectedTools, recentWorkspaces } = useChatStore();
  const isGenerating = state.status !== 'IDLE';
  const isEmpty = messages.length === 0;

  // Available tools for Normal mode
  const availableTools = [
    { id: 'WebSearch', label: t('tools.webSearch') },
    { id: 'WebFetch', label: t('tools.webFetch') },
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const currentInput = input;
    setInput('');
    await sendPrompt(currentInput);
  };

  const handleStop = () => {
    if (stopGeneration) stopGeneration();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = async (newMode: WorkMode) => {
    setModeOpen(false);
    if (newMode === workMode) return;

    if (newMode === 'workspace') {
      if (recentWorkspaces && recentWorkspaces.length > 0) {
        // Tự động mở path mở gần nhất thay vì hỏi
        await setWorkMode('workspace', recentWorkspaces[0]);
      } else {
        try {
          const selectedPath = await invoke<string | null>('select_and_set_workspace');
          if (selectedPath) {
            await setWorkMode('workspace', selectedPath);
          }
        } catch (e) {
          console.error('Failed to select workspace:', e);
          alert(t('chatInput.selectWorkspaceError', { error: String(e) }));
        }
      }
    } else {
      await setWorkMode('normal');
    }
  };

  const handleSelectNewFolder = async () => {
    try {
      const selectedPath = await invoke<string | null>('select_and_set_workspace');
      if (selectedPath) {
        await setWorkMode('workspace', selectedPath);
      }
    } catch (e) {
      console.error('Failed to select workspace:', e);
      alert(t('chatInput.selectWorkspaceError', { error: String(e) }));
    }
  };

  const handleToolToggle = async (toolId: string) => {
    const newTools = selectedTools.includes(toolId)
      ? selectedTools.filter(t => t !== toolId)
      : [...selectedTools, toolId];
    
    await setSelectedTools(newTools);
  };

  // ── Shared input card ──
  const inputCard = (
    <div className="flex flex-col rounded-2xl bg-background border-2 border-border transition-all duration-200 focus-within:border-primary">
      
      {/* Workspace bar */}
      {workMode === 'workspace' && (
        <div className="flex items-center justify-between px-5 pt-4 text-sm font-medium text-muted-foreground border-b border-border/50 pb-2 mx-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate" title={workspacePath || ''}>
              {workspacePath || t('chatInput.noWorkspace')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={handleSelectNewFolder}
              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title={t('chatInput.selectFolder')}
            >
              <FolderSync className="w-4 h-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title={t('chatInput.recentFolders')}
              >
                <History className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('chatInput.recentFoldersTitle')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(!recentWorkspaces || recentWorkspaces.length === 0) && (
                    <DropdownMenuItem disabled>{t('chatInput.recentFoldersEmpty')}</DropdownMenuItem>
                  )}
                  {recentWorkspaces?.map(path => (
                    <DropdownMenuItem
                      key={path}
                      onClick={() => setWorkMode('workspace', path)}
                      className="cursor-pointer"
                      title={path}
                    >
                      <FolderOpen className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium text-foreground">
                          {path.split(/[/\\]/).pop() || path}
                        </span>
                        <span className="truncate text-xs text-muted-foreground opacity-80">
                          {path}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Textarea */}
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('chatInput.placeholder')}
        className={cn(
          "w-full resize-none border-none shadow-none placeholder:text-muted-foreground focus-visible:ring-0",
          "bg-transparent text-foreground",
          workMode === 'normal' ? "rounded-t-2xl rounded-b-none" : "!rounded-none",
          isEmpty
            ? "min-h-[80px] max-h-[300px] px-5 pt-5 pb-3 text-lg leading-relaxed"
            : "min-h-[60px] max-h-[250px] px-5 pt-4 pb-2 text-base leading-relaxed"
        )}
        rows={1}
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <div className="flex items-center gap-3">
          {/* Custom mode dropdown */}
          <div className="relative" ref={modeRef}>
            <button
              onClick={() => setModeOpen(!modeOpen)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
            >
              <span>{t(`workMode.${workMode}`)}</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                modeOpen && "rotate-180"
              )} />
            </button>

            {/* Dropdown */}
            {modeOpen && (
              <div className="absolute bottom-full left-0 mb-2 min-w-[200px] rounded-xl border border-border bg-popover p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
                {(['normal', 'workspace'] as WorkMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150",
                      workMode === mode
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {mode === 'workspace' && <FolderOpen className="h-4 w-4" />}
                    {mode === 'normal' && <Sparkles className="h-4 w-4" />}
                    <span>{t(`workMode.${mode}`)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="h-4 w-px bg-border" />

          {/* Tools dropdown (Normal mode only) */}
          {workMode === 'normal' && (
            <>
              <div className="relative" ref={toolsRef}>
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
                >
                  <span>{t('chatInput.tools', { count: selectedTools.length })}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    toolsOpen && "rotate-180"
                  )} />
                </button>

                {/* Tools Dropdown */}
                {toolsOpen && (
                  <div className="absolute bottom-full left-0 mb-2 min-w-[200px] rounded-xl border border-border bg-popover p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
                    {availableTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolToggle(tool.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150",
                          selectedTools.includes(tool.id)
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-[4px] border flex items-center justify-center",
                          selectedTools.includes(tool.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}>
                          {selectedTools.includes(tool.id) && (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span>{tool.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-4 w-px bg-border" />
            </>
          )}

          {/* Model Selector */}
          <ModelSelector />
        </div>

        {/* Send / Stop */}
        {isGenerating ? (
          <button
            onClick={handleStop}
            className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 bg-red-500 text-white hover:bg-red-600 hover:scale-105 shadow-md animate-in fade-in zoom-in"
            title={t('chatInput.stop')}
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-primary text-primary-foreground hover:opacity-90 hover:scale-105"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            title={t('chatInput.send')}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  // ── Empty state: centered ──
  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            {workMode === 'workspace' ? t('chatInput.emptyTitleWorkspace') : t('chatInput.emptyTitleNormal')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            {workMode === 'workspace'
              ? t('chatInput.emptySubtitleWorkspace')
              : t('chatInput.emptySubtitleNormal')}
          </p>
        </div>
        <div className="w-full max-w-3xl">
          {inputCard}
        </div>
      </div>
    );
  }

  // ── Has messages: sticky bottom ──
  return (
    <div
      className="sticky bottom-0 z-10 pointer-events-none px-4 pb-4 pt-6"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--background) 60%)' }}
    >
      <div className="max-w-3xl mx-auto pointer-events-auto">
        {inputCard}
      </div>
    </div>
  );
}
