// XTermBlock - Real terminal widget using xterm.js
import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { Terminal as TerminalIcon, CheckCircle2, XCircle, Loader2, StopCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/useChatStore';
import { useTerminalStream } from './useTerminalStream';
import { Button } from '../../components/ui/button';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import 'xterm/css/xterm.css';
import './xterm-custom.css';

interface XTermBlockProps {
  toolName: 'bash' | 'PowerShell';
  command: string;
  toolInput?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
  isTimedOut?: boolean;
  isDetached?: boolean;
  toolUseId?: string;
  output?: string;
}

export function XTermBlock({
  toolName,
  command,
  toolInput,
  isError = false,
  isPending = false,
  isCancelled = false,
  isTimedOut = false,
  isDetached = false,
  toolUseId,
  output,
}: XTermBlockProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cancelToolExecution = useChatStore((state) => state.cancelToolExecution);
  const detachToolExecution = useChatStore((state) => state.detachToolExecution);
  const isGenerating = useChatStore((state) => state.state.status !== 'IDLE');
  const { t } = useTranslation();
  
  const [isExpanded, setIsExpanded] = useState(false);

  let inputParams: any = {};
  if (toolInput) {
    try {
      inputParams = JSON.parse(toolInput);
    } catch {}
  }

  useTerminalStream(xtermRef.current, toolUseId, !output);

  const StatusIcon = isPending ? Loader2 : isDetached ? Loader2 : (isError || isCancelled || isTimedOut) ? XCircle : CheckCircle2;

  const handleStop = async () => {
    if (toolUseId) {
      // Can stop both pending and detached tools
      await cancelToolExecution(toolUseId);
    }
  };
  
  const handleDetach = async () => {
    if (toolUseId && isPending) {
      await detachToolExecution(toolUseId);
    }
  };
  
  const handleOpenInTerminal = async () => {
    try {
      await invoke('open_external_terminal');
      console.log('[XTermBlock] External terminal opened successfully');
    } catch (e) {
      console.error('[XTermBlock] Failed to open external terminal:', e);
      // Show error to user
      alert(`Không thể mở terminal: ${e}`);
    }
  };

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current || !isExpanded) return;

    const isDark = document.documentElement.classList.contains('dark');
    
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: 'transparent',
        foreground: isDark ? '#e5e5e5' : '#262626',
        cursor: isDark ? '#60a5fa' : '#3b82f6',
        cursorAccent: isDark ? '#1e293b' : '#f8fafc',
        black: isDark ? '#1a1a1a' : '#525252',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: isDark ? '#d4d4d4' : '#737373',
        brightBlack: isDark ? '#525252' : '#a3a3a3',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: isDark ? '#fafafa' : '#171717',
      },
      rows: 24,
      cols: 80,
      convertEol: true,
      scrollback: 1000,
      scrollOnUserInput: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    const clipboardAddon = new ClipboardAddon();
    term.loadAddon(clipboardAddon);
    
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      open(uri).catch(err => {
        console.error('Failed to open URL:', err);
      });
    });
    term.loadAddon(webLinksAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (output) {
      term.write(output);
    }

    term.onData(async (data) => {
      if (!toolUseId) return;
      const { sendToolInput } = useChatStore.getState();
      await sendToolInput(toolUseId, data);
    });

    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [toolUseId, isExpanded]);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isCancelled || isTimedOut) {
    const statusText = isTimedOut ? t('terminal.timedOut') : t('terminal.stoppedByUser');
    const statusColor = isTimedOut ? 'text-orange-400' : 'text-red-400';
    
    return (
      <div className="bg-muted/10 rounded-lg border border-border/30 w-full overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/20 border-b border-border/30">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <XCircle className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", statusColor)} />
            <TerminalIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
            <span className="text-xs sm:text-sm font-semibold text-foreground/90">{toolName}</span>
          </div>
          <span className={cn("text-xs sm:text-sm", statusColor)}>{statusText}</span>
        </div>
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/5 font-mono text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-emerald-400 select-none">{toolName === 'PowerShell' ? 'PS>' : '$'}</span>
            <pre className="flex-1 text-foreground/80 whitespace-pre-wrap break-all">{command}</pre>
          </div>
        </div>
      </div>
    );
  }

  const getShellPrompt = () => {
    switch (toolName) {
      case 'PowerShell':
        return 'PS>';
      default:
        return '$';
    }
  };

  return (
    <div className="bg-muted/10 rounded-lg border border-border/30 w-full overflow-hidden font-mono">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/20 border-b border-border/30">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <StatusIcon
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0',
              isPending && 'animate-spin text-blue-400',
              isDetached && 'animate-pulse text-yellow-400',
              isCancelled && 'text-orange-400',
              isTimedOut && 'text-orange-400',
              isError && !isCancelled && !isTimedOut && 'text-red-400',
              !isPending && !isError && !isDetached && !isCancelled && !isTimedOut && 'text-emerald-400'
            )}
          />
          <TerminalIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-foreground/90">{toolName}</span>
          
          {isDetached && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-[10px] sm:text-xs text-yellow-400">{t('terminal.detached')}</span>
            </>
          )}
          
          {isCancelled && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-[10px] sm:text-xs text-orange-400 font-medium">{t('terminal.cancelled')}</span>
            </>
          )}
          
          {isTimedOut && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-[10px] sm:text-xs text-orange-400 font-medium">{t('terminal.timedOut')}</span>
            </>
          )}
          
          {inputParams.timeout && (
            <>
              <span className="text-muted-foreground/30 hidden sm:inline">|</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground/60 hidden sm:inline">
                {t('terminal.timeout')}: {Math.round(inputParams.timeout / 1000)}{t('terminal.seconds')}
              </span>
            </>
          )}
          
          {inputParams.description && (
            <>
              <span className="text-muted-foreground/30 hidden lg:inline">|</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground/60 truncate max-w-[150px] sm:max-w-xs hidden lg:inline">
                {t('terminal.description')}: {inputParams.description}
              </span>
            </>
          )}
        </div>
        
        {/* Show buttons if:
            1. Tool is pending (not detached yet) - show both Detach and Stop
            2. Tool is detached - show only Stop (can kill detached process)
            3. Tool is detached AND AI still generating - show Stop
        */}
        {toolUseId && (isPending || (isDetached && isGenerating)) && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isPending && !isDetached && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDetach}
                className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30"
              >
                <StopCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">{t('terminal.detach')}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
            >
              <StopCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">{t('terminal.stop')}</span>
            </Button>
          </div>
        )}
      </div>

      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/5 border-b border-border/20">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-emerald-400 select-none shrink-0 text-xs sm:text-sm">{getShellPrompt()}</span>
          <pre className="flex-1 text-foreground/80 text-xs sm:text-sm whitespace-pre-wrap break-all">{command}</pre>
          <button
            onClick={handleOpenInTerminal}
            className="shrink-0 p-1 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 rounded transition-colors"
            title={t('terminal.openInTerminal')}
          >
            <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div 
            ref={terminalRef}
            className="w-full xterm-container"
            style={{ height: '300px', maxHeight: '500px' }}
          />
          
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 text-center border-t border-border/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>{t('terminal.clickToCollapse')}</span>
          </button>
        </>
      )}
      
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 text-center border-t border-border/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2"
        >
          <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span>{t('terminal.clickToExpand')}</span>
        </button>
      )}
    </div>
  );
}
