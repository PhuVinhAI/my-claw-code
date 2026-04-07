// ChatInput Component
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Textarea } from '../../components/ui/textarea';
import { Send, Square, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

import { ModelSelector } from './ModelSelector';
import { TokenCounter } from './TokenCounter';

export function ChatInput() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);

  const toolsRef = useRef<HTMLDivElement>(null);

  const { state, messages, sendPrompt, stopGeneration, workMode, workspacePath, selectedTools, setSelectedTools, currentTokenUsage, lastUserText } = useChatStore();
  const { settings } = useSettingsStore();
  const isGenerating = state.status !== 'IDLE';
  const isEmpty = messages.length === 0;

  // Restore text from lastUserText when it changes (empty turn recovery)
  useEffect(() => {
    if (lastUserText && input === '') {
      console.log('[ChatInput] Restoring text from lastUserText:', lastUserText);
      setInput(lastUserText);
      // Clear lastUserText after restore
      useChatStore.setState({ lastUserText: null });
    }
  }, [lastUserText]); // Only depend on lastUserText, not input

  // Get max_context from selected model
  const maxContext = useMemo(() => {
    if (!settings?.selected_model) return undefined;
    
    const provider = settings.providers.find(p => p.id === settings.selected_model?.provider_id);
    if (!provider) return undefined;
    
    const model = provider.models.find(m => m.id === settings.selected_model?.model_id);
    return model?.max_context;
  }, [settings]);

  const availableTools = [
    { id: 'WebSearch', label: t('tools.webSearch') },
    { id: 'WebFetch', label: t('tools.webFetch') },
    { id: 'REPL', label: t('tools.repl') },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // If AI is generating, stop it first then send
    if (isGenerating) {
      const currentInput = input;
      setInput(''); // Clear input immediately for better UX
      
      // Stop and send in background (non-blocking)
      (async () => {
        try {
          // Stop AI first
          if (stopGeneration) {
            await stopGeneration();
          }
          
          // Small delay to let state settle
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Send new message
          const result = await sendPrompt(currentInput);
          
          // If error, restore text to input
          if (result && typeof result === 'object' && 'error' in result) {
            setInput(result.originalText);
          }
        } catch (e) {
          console.error('[ChatInput] Error in stop-and-send:', e);
        }
      })();
      
      return;
    }
    
    // Normal send
    const currentInput = input;
    setInput('');
    
    try {
      const result = await sendPrompt(currentInput);
      
      // If error, restore text to input
      if (result && typeof result === 'object' && 'error' in result) {
        setInput(result.originalText);
      }
    } catch (e) {
      console.error('[ChatInput] Error sending:', e);
      // Restore text on unexpected error
      setInput(currentInput);
    }
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

  const handleToolToggle = async (toolId: string) => {
    const newTools = selectedTools.includes(toolId)
      ? selectedTools.filter(t => t !== toolId)
      : [...selectedTools, toolId];
    
    await setSelectedTools(newTools);
  };

  const inputCard = (
    <div className="flex flex-col rounded-lg bg-card border border-border transition-all duration-200">
      {/* Header - Chỉ hiển thị khi isEmpty (welcome screen) */}
      {isEmpty && workMode === 'workspace' && workspacePath && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground truncate">{workspacePath.split(/[/\\]/).pop() || workspacePath}</span>
        </div>
      )}
      {isEmpty && workMode === 'normal' && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground">{t('sessionList.home')}</span>
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
          "!bg-transparent text-foreground chat-input-scroll",
          "!rounded-none",
          isEmpty
            ? "min-h-[80px] max-h-[200px] px-3 pt-3 pb-2 text-sm leading-relaxed"
            : "min-h-[60px] max-h-[180px] px-3 pt-2.5 pb-2 text-sm leading-relaxed"
        )}
        rows={1}
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tools dropdown */}
          {workMode === 'normal' && (
            <>
              <div className="relative" ref={toolsRef}>
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <span>{t('chatInput.tools', { count: selectedTools.length })}</span>
                  <ChevronDown className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    toolsOpen && "rotate-180"
                  )} />
                </button>

                {toolsOpen && (
                  <div className="absolute bottom-full left-0 mb-1.5 min-w-[160px] rounded-lg border border-border/30 bg-popover p-1 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50 shadow-xl">
                    {availableTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolToggle(tool.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
                          selectedTools.includes(tool.id)
                            ? "bg-accent text-accent-foreground font-semibold"
                            : "text-popover-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center shrink-0",
                          selectedTools.includes(tool.id)
                            ? "bg-foreground border-foreground text-background"
                            : "border-muted-foreground"
                        )}>
                          {selectedTools.includes(tool.id) && (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

              <div className="h-3.5 w-px bg-border" />
            </>
          )}

          {/* Model Selector */}
          <ModelSelector />

          {/* Token Counter - Only show if model has max_context */}
          {maxContext && currentTokenUsage && (
            <>
              <div className="h-3.5 w-px bg-border" />
              <TokenCounter usage={currentTokenUsage} maxContext={maxContext} />
            </>
          )}
        </div>

        {/* Send / Stop */}
        {isGenerating ? (
          <button
            onClick={handleStop}
            className="h-6 w-6 shrink-0 rounded-md flex items-center justify-center transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20"
            title={t('chatInput.stop')}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "h-6 w-6 shrink-0 rounded-md flex items-center justify-center transition-colors",
              input.trim()
                ? "bg-foreground/10 text-foreground hover:bg-foreground/20"
                : "bg-transparent text-muted-foreground/50 cursor-not-allowed"
            )}
            title={t('chatInput.send')}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            {workMode === 'workspace' ? t('chatInput.emptyTitleWorkspace') : t('chatInput.emptyTitleNormal')}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto whitespace-nowrap">
            {workMode === 'workspace'
              ? t('chatInput.emptySubtitleWorkspace')
              : t('chatInput.emptySubtitleNormal')}
          </p>
        </div>
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {inputCard}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-10 pointer-events-none px-4 pb-4 pt-6 bg-gradient-to-t from-background via-background/80 to-transparent">
      <div className="max-w-2xl mx-auto pointer-events-auto flex flex-col gap-2">
        {inputCard}
      </div>
    </div>
  );
}
