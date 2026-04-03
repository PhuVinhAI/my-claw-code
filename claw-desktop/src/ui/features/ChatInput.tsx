// ChatInput Component
import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Send, Square, Bot, FolderOpen, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WorkMode, WorkModeLabels } from '../../core/entities/WorkMode';
import { invoke } from '@tauri-apps/api/core';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [modeOpen, setModeOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false); // Tools dropdown
  const modeRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const { state, messages, sendPrompt, stopGeneration, model, workMode, workspacePath, setWorkMode, selectedTools, setSelectedTools } = useChatStore();
  const isGenerating = state.status !== 'IDLE';
  const isEmpty = messages.length === 0;

  // Available tools for Normal mode
  const availableTools = [
    { id: 'WebSearch', label: 'Tìm kiếm Web' },
    { id: 'WebFetch', label: 'Truy cập Web' },
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
      try {
        const selectedPath = await invoke<string | null>('select_and_set_workspace');
        if (selectedPath) {
          await setWorkMode('workspace', selectedPath);
        }
      } catch (e) {
        console.error('Failed to select workspace:', e);
        alert(`Không thể chọn workspace: ${e}`);
      }
    } else {
      await setWorkMode('normal');
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
    <div className="flex flex-col rounded-2xl bg-muted/40 backdrop-blur-xl border border-border/30 transition-all duration-200 focus-within:border-foreground/15">
      
      {/* Workspace bar */}
      {workMode === 'workspace' && (
        <div className="flex items-center gap-2 px-5 pt-3.5 text-xs text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="truncate opacity-70" title={workspacePath || ''}>
            {workspacePath || 'Chưa chọn workspace'}
          </span>
        </div>
      )}

      {/* Textarea */}
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Hỏi bất cứ điều gì..."
        className={cn(
          "w-full resize-none border-none bg-transparent shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0",
          isEmpty
            ? "min-h-[64px] max-h-[200px] px-5 pt-5 pb-2 text-base leading-relaxed"
            : "min-h-[52px] max-h-[200px] px-5 pt-4 pb-2 text-[15px] leading-relaxed"
        )}
        rows={1}
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-0.5">
        <div className="flex items-center gap-2.5">
          {/* Custom mode dropdown */}
          <div className="relative" ref={modeRef}>
            <button
              onClick={() => setModeOpen(!modeOpen)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-150"
            >
              <span>{WorkModeLabels[workMode]}</span>
              <ChevronDown className={cn(
                "h-3 w-3 transition-transform duration-200",
                modeOpen && "rotate-180"
              )} />
            </button>

            {/* Dropdown */}
            {modeOpen && (
              <div className="absolute bottom-full left-0 mb-1.5 min-w-[170px] rounded-xl border border-border/30 bg-popover/95 backdrop-blur-xl p-1.5 space-y-0.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
                {(['normal', 'workspace'] as WorkMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs transition-colors duration-100",
                      workMode === mode
                        ? "bg-foreground/8 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {mode === 'workspace' && <FolderOpen className="h-3.5 w-3.5" />}
                    {mode === 'normal' && <Sparkles className="h-3.5 w-3.5" />}
                    <span>{WorkModeLabels[mode]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="h-3 w-px bg-border/40" />

          {/* Tools dropdown (Normal mode only) */}
          {workMode === 'normal' && (
            <>
              <div className="relative" ref={toolsRef}>
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-150"
                >
                  <span>Tools ({selectedTools.length})</span>
                  <ChevronDown className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    toolsOpen && "rotate-180"
                  )} />
                </button>

                {/* Tools Dropdown */}
                {toolsOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 min-w-[170px] rounded-xl border border-border/30 bg-popover/95 backdrop-blur-xl p-1.5 space-y-0.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
                    {availableTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolToggle(tool.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs transition-colors duration-100",
                          selectedTools.includes(tool.id)
                            ? "bg-foreground/8 text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "h-3.5 w-3.5 rounded border flex items-center justify-center",
                          selectedTools.includes(tool.id)
                            ? "bg-foreground border-foreground"
                            : "border-muted-foreground/30"
                        )}>
                          {selectedTools.includes(tool.id) && (
                            <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

              <div className="h-3 w-px bg-border/40" />
            </>
          )}

          {/* Model badge */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
            <Bot className="h-3 w-3" />
            <span>{model}</span>
          </div>
        </div>

        {/* Send / Stop */}
        {isGenerating ? (
          <Button
            onClick={handleStop}
            variant="destructive"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full animate-in fade-in zoom-in duration-200"
            title="Dừng AI"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-foreground text-background hover:opacity-85"
                : "bg-muted-foreground/15 text-muted-foreground/30 cursor-not-allowed"
            )}
            title="Gửi tin nhắn"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  // ── Empty state: centered ──
  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-3">
            {workMode === 'workspace' ? 'Hỏi về dự án của bạn' : 'Tôi có thể giúp gì?'}
          </h1>
          <p className="text-base text-muted-foreground/60">
            {workMode === 'workspace'
              ? 'Phân tích code, tìm bug, hoặc refactor trong workspace.'
              : 'Viết code, debug, brainstorm — hỏi bất cứ điều gì.'}
          </p>
        </div>
        <div className="w-full max-w-2xl">
          {inputCard}
        </div>
      </div>
    );
  }

  // ── Has messages: sticky bottom ──
  return (
    <div
      className="sticky bottom-0 z-10 pointer-events-none px-4 pb-4 pt-10"
      style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--background) 35%)' }}
    >
      <div className="max-w-3xl mx-auto pointer-events-auto">
        {inputCard}
      </div>
    </div>
  );
}
