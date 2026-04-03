// REPLBlock - Python REPL execution with collapsible code
import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Code, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTerminalStream } from './useTerminalStream';
import 'xterm/css/xterm.css';
import './xterm-custom.css';

interface REPLBlockProps {
  code: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
  toolUseId?: string;
  output?: string;
}

export function REPLBlock({
  code,
  isError = false,
  isPending = false,
  isCancelled = false,
  toolUseId,
  output,
}: REPLBlockProps) {
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Subscribe to stream events
  useTerminalStream(xtermRef.current, toolUseId, !output);

  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;

  // Initialize xterm.js for output
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#0f172a',
        foreground: '#cbd5e1',
        cursor: '#22c55e',
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
      rows: 15,
      cols: 80,
      convertEol: true,
      scrollback: 1000,
      disableStdin: true, // Read-only for REPL output
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Restore historical output
    if (output) {
      term.write(output);
    }

    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [toolUseId, output]);

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

  if (isCancelled) {
    return (
      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 w-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <Code className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Python REPL</span>
          </div>
        </div>
        <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/50">
          <p className="text-xs text-red-300 font-mono">Đã dừng bởi người dùng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 w-full overflow-hidden">
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
          <Code className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Python REPL</span>
        </div>
      </div>

      {/* Collapsible Code Section */}
      <div className="border-b border-slate-800">
        <button
          onClick={() => setIsCodeExpanded(!isCodeExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900/50 hover:bg-slate-800/50 transition-colors text-left"
        >
          {isCodeExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-xs text-slate-400 font-mono">
            {isCodeExpanded ? 'Ẩn code Python' : 'Xem code Python'}
          </span>
          <span className="text-xs text-slate-500">({code.split('\n').length} dòng)</span>
        </button>
        
        {isCodeExpanded && (
          <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 max-h-96 overflow-auto">
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{code}</pre>
          </div>
        )}
      </div>

      {/* Output Terminal */}
      <div className="px-3 py-2 bg-slate-900/30">
        <div className="text-xs text-slate-400 mb-2 font-mono">Output:</div>
        <div 
          ref={terminalRef}
          className="w-full xterm-container"
          style={{ height: '300px' }}
        />
      </div>
    </div>
  );
}
