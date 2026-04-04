// XTermBlock - Real terminal widget using xterm.js
import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { Terminal as TerminalIcon, CheckCircle2, XCircle, Loader2, StopCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/useChatStore';
import { useTerminalStream } from './useTerminalStream';
import { Button } from '../../components/ui/button';
import { open } from '@tauri-apps/plugin-shell';
import { useTranslation } from 'react-i18next';
import 'xterm/css/xterm.css';
import './xterm-custom.css';

interface XTermBlockProps {
  toolName: 'bash' | 'PowerShell';
  command: string;
  toolInput?: string; // Add to parse timeout and description
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
  isDetached?: boolean; // NEW: Tool is running in background
  toolUseId?: string;
  output?: string; // Historical output from saved session
}

export function XTermBlock({
  toolName,
  command,
  toolInput,
  isError = false,
  isPending = false,
  isCancelled = false,
  isDetached = false,
  toolUseId,
  output,
}: XTermBlockProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cancelToolExecution = useChatStore((state) => state.cancelToolExecution);
  const detachToolExecution = useChatStore((state) => state.detachToolExecution);
  const { t } = useTranslation();
  
  // Collapse state - mặc định collapsed
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse input for additional params
  let inputParams: any = {};
  if (toolInput) {
    try {
      inputParams = JSON.parse(toolInput);
    } catch {}
  }

  // Subscribe to stream events directly (bypass store concatenation)
  // Only listen if no historical output (means it's a new/active command)
  useTerminalStream(xtermRef.current, toolUseId, !output);

  const StatusIcon = isPending ? Loader2 : isDetached ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  const handleStop = async () => {
    if (toolUseId && isPending) {
      await cancelToolExecution(toolUseId);
    }
  };
  
  const handleDetach = async () => {
    if (toolUseId && isPending) {
      await detachToolExecution(toolUseId);
    }
  };

  // Initialize xterm.js ONCE (only when expanded)
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current || !isExpanded) return;

    // Get theme colors from CSS variables
    const isDark = document.documentElement.classList.contains('dark');
    
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: 'transparent', // Use CSS background
        foreground: isDark ? '#e5e5e5' : '#262626',
        cursor: isDark ? '#60a5fa' : '#3b82f6', // blue-400/500
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
      convertEol: true, // Auto convert \n to \r\n
      scrollback: 1000, // Keep history
      scrollOnUserInput: true,
      // Enable text selection for copy
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    // Add clipboard addon - enables copy with Ctrl+C when text is selected
    const clipboardAddon = new ClipboardAddon();
    term.loadAddon(clipboardAddon);
    
    // Add web links addon - makes URLs clickable
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      // Open link in external browser using Tauri shell plugin
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

    // Restore historical output if exists (from saved session)
    if (output) {
      term.write(output);
    }

    // Handle keyboard input
    term.onData(async (data) => {
      if (!toolUseId) return;
      const { sendToolInput } = useChatStore.getState();
      await sendToolInput(toolUseId, data);
    });

    // Cleanup
    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [toolUseId, isExpanded]);

  // Resize on window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="bg-muted/10 rounded-lg border border-border/30 w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <XCircle className="h-4 w-4 text-red-400" />
            <TerminalIcon className="h-4 w-4 text-muted-foreground/70" />
            <span className="text-sm font-semibold text-foreground/90">{toolName}</span>
          </div>
          <span className="text-sm text-red-400">{t('terminal.stoppedByUser')}</span>
        </div>
        <div className="px-4 py-3 bg-muted/5 font-mono text-sm">
          <div className="flex items-center gap-2">
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              isPending && 'animate-spin text-blue-400',
              isDetached && 'animate-pulse text-yellow-400',
              isError && 'text-red-400',
              !isPending && !isError && !isDetached && 'text-emerald-400'
            )}
          />
          <TerminalIcon className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-sm font-semibold text-foreground/90">{toolName}</span>
          
          {/* Show detached status */}
          {isDetached && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-xs text-yellow-400">{t('terminal.detached')}</span>
            </>
          )}
          
          {/* Show timeout if specified */}
          {inputParams.timeout && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-xs text-muted-foreground/60">timeout: {inputParams.timeout}s</span>
            </>
          )}
          
          {/* Show description if specified */}
          {inputParams.description && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-xs text-muted-foreground/60 truncate max-w-xs">{inputParams.description}</span>
            </>
          )}
        </div>
        
        {/* Action buttons - only show when pending */}
        {isPending && toolUseId && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDetach}
              className="h-7 px-2 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950/30"
            >
              <StopCircle className="h-3.5 w-3.5 mr-1" />
              {t('terminal.detach')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
            >
              <StopCircle className="h-3.5 w-3.5 mr-1" />
              {t('terminal.stop')}
            </Button>
          </div>
        )}
      </div>

      {/* Command Input Line */}
      <div className="px-4 py-2.5 bg-muted/5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 select-none shrink-0">{getShellPrompt()}</span>
          <pre className="flex-1 text-foreground/80 text-sm whitespace-pre-wrap break-all">{command}</pre>
        </div>
      </div>

      {/* XTerm Terminal Widget - Only render when expanded */}
      {isExpanded && (
        <>
          <div 
            ref={terminalRef}
            className="w-full xterm-container"
            style={{ height: '300px', maxHeight: '500px' }}
          />
          
          {/* Collapse button when expanded */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full px-4 py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 text-center border-t border-border/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            <span>{t('terminal.clickToCollapse')}</span>
          </button>
        </>
      )}
      
      {/* Collapsed state - clickable to expand */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full px-4 py-3 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 text-center border-t border-border/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          <span>{t('terminal.clickToExpand')}</span>
        </button>
      )}
    </div>
  );
}
