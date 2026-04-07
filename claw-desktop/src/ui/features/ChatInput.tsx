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
    <div className="flex flex-col rounded-xl sm:rounded-2xl bg-card border border-border transition-all duration-200 shadow-lg">
      {/* Header - Hiển thị workspace context */}
      {workMode === 'workspace' && workspacePath && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="font-medium">{workspacePath.split(/[/\\]/).pop() || workspacePath}</span>
          </div>
        </div>
      )}
      {workMode === 'normal' && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="font-medium">{t('sessionList.home')}</span>
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
          "!bg-transparent text-foreground chat-input-scroll",
          "!rounded-none leading-relaxed",
          isEmpty
            ? "min-h-[60px] sm:min-h-[70px] lg:min-h-[80px] max-h-[250px] sm:max-h-[280px] lg:max-h-[300px] px-4 sm:px-5 pt-4 sm:pt-5 pb-2 sm:pb-3 text-base sm:text-lg leading-relaxed"
            : "min-h-[50px] sm:min-h-[55px] lg:min-h-[60px] max-h-[200px] sm:max-h-[230px] lg:max-h-[250px] px-4 sm:px-5 pt-3 sm:pt-4 pb-2 text-sm sm:text-base leading-relaxed"
        )}
        rows={1}
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 pb-2 sm:pb-3 pt-1 sm:pt-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">


          {/* Tools dropdown */}
          {workMode === 'normal' && (
            <>
              <div className="relative" ref={toolsRef}>
                <button
                  onClick={() => setToolsOpen(!toolsOpen)}
                  className="flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
                >
                  <span>{t('chatInput.tools', { count: selectedTools.length })}</span>
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200",
                    toolsOpen && "rotate-180"
                  )} />
                </button>

                {toolsOpen && (
                  <div className="absolute bottom-full left-0 mb-2 min-w-[180px] sm:min-w-[200px] rounded-xl border border-border/30 bg-popover p-1 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50 shadow-xl">
                    {availableTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolToggle(tool.id)}
                        className={cn(
                          "flex w-full items-center gap-2 sm:gap-3 rounded-sm px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors duration-150",
                          selectedTools.includes(tool.id)
                            ? "bg-accent text-accent-foreground font-semibold"
                            : "text-popover-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-[4px] border flex items-center justify-center",
                          selectedTools.includes(tool.id)
                            ? "bg-foreground border-foreground text-background"
                            : "border-muted-foreground"
                        )}>
                          {selectedTools.includes(tool.id) && (
                            <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

              <div className="h-3 sm:h-4 w-px bg-border" />
            </>
          )}

          {/* Model Selector */}
          <ModelSelector />

          {/* Token Counter - Only show if model has max_context */}
          {maxContext && currentTokenUsage && (
            <>
              <div className="h-3 sm:h-4 w-px bg-border" />
              <TokenCounter usage={currentTokenUsage} maxContext={maxContext} />
            </>
          )}
        </div>

        {/* Send / Stop */}
        {isGenerating ? (
          <button
            onClick={handleStop}
            className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-md flex items-center justify-center transition-all duration-200 bg-red-500/10 text-red-500 hover:bg-red-500/20"

            title={t('chatInput.stop')}
          >
            <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-md flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-foreground/10 text-foreground hover:bg-foreground/20"
                : "bg-transparent text-muted-foreground/50 cursor-not-allowed"

            )}
            title={t('chatInput.send')}
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        )}
      </div>
    </div>
  );

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16 sm:pb-20">
        <div className="mb-8 sm:mb-10 lg:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-3 sm:mb-4">
            {workMode === 'workspace' ? t('chatInput.emptyTitleWorkspace') : t('chatInput.emptyTitleNormal')}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-md lg:max-w-lg mx-auto px-4">
            {workMode === 'workspace'
              ? t('chatInput.emptySubtitleWorkspace')
              : t('chatInput.emptySubtitleNormal')}
          </p>
        </div>
        <div className="w-full max-w-2xl lg:max-w-3xl flex flex-col gap-2 relative">
          {inputCard}
        </div>

      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-10 pointer-events-none px-4 sm:px-6 pb-6 pt-8 bg-gradient-to-t from-background via-background/80 to-transparent">
      <div className="max-w-2xl lg:max-w-3xl mx-auto pointer-events-auto flex flex-col gap-2 relative">
        {inputCard}
      </div>
    </div>
  );
}
