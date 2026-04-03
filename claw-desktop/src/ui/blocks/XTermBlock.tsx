// XTermBlock - Real terminal widget using xterm.js
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, CheckCircle2, XCircle, Loader2, StopCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/useChatStore';
import { useTerminalStream } from './useTerminalStream';
import { Button } from '../../components/ui/button';
import 'xterm/css/xterm.css';
import './xterm-custom.css';

interface XTermBlockProps {
  toolName: 'bash' | 'PowerShell';
  command: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
  toolUseId?: string;
  output?: string; // Historical output from saved session
}

export function XTermBlock({
  toolName,
  command,
  isError = false,
  isPending = false,
  isCancelled = false,
  toolUseId,
  output,
}: XTermBlockProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cancelToolExecution = useChatStore((state) => state.cancelToolExecution);

  // Subscribe to stream events directly (bypass store concatenation)
  // Only listen if no historical output (means it's a new/active command)
  useTerminalStream(xtermRef.current, toolUseId, !output);

  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  const handleStop = async () => {
    if (toolUseId && isPending) {
      await cancelToolExecution(toolUseId);
    }
  };

  // Initialize xterm.js ONCE
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#0f172a', // slate-900
        foreground: '#cbd5e1', // slate-300
        cursor: '#22c55e', // green-400
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#cbd5e1',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#e2e8f0',
      },
      rows: 24,
      cols: 80,
      convertEol: true, // Auto convert \n to \r\n
      scrollback: 1000, // Keep history
      scrollOnUserInput: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
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
  }, [toolUseId]);

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
      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 w-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <TerminalIcon className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">{toolName}</span>
          </div>
          <span className="text-xs text-red-300">Đã dừng bởi người dùng</span>
        </div>
        <div className="px-3 py-2 font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className="text-green-400 select-none">{toolName === 'PowerShell' ? 'PS>' : '$'}</span>
            <pre className="flex-1 text-slate-200 whitespace-pre-wrap break-all">{command}</pre>
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
    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 w-full overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              isPending && 'animate-spin text-blue-400',
              isError && 'text-red-400',
              !isPending && !isError && 'text-green-400'
            )}
          />
          <TerminalIcon className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">{toolName}</span>
        </div>
        
        {/* Stop button - only show when pending */}
        {isPending && toolUseId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStop}
            className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <StopCircle className="h-3.5 w-3.5 mr-1" />
            Dừng
          </Button>
        )}
      </div>

      {/* Command Input Line */}
      <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-green-400 select-none shrink-0">{getShellPrompt()}</span>
          <pre className="flex-1 text-slate-200 text-sm whitespace-pre-wrap break-all">{command}</pre>
        </div>
      </div>

      {/* XTerm Terminal Widget */}
      <div 
        ref={terminalRef}
        className="w-full xterm-container"
        style={{ height: '400px' }}
      />
    </div>
  );
}
