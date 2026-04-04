// REPLBlock - Python REPL execution with collapsible code
import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Code, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../store/useChatStore';
import { useTerminalStream } from './useTerminalStream';
import { open } from '@tauri-apps/plugin-shell';
import 'xterm/css/xterm.css';
import './xterm-custom.css';

interface REPLBlockProps {
  code: string;
  language?: string; // Add language param
  toolInput?: string; // Add to parse timeout
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
  toolUseId?: string;
  output?: string;
}

export function REPLBlock({
  code,
  language = 'python',
  toolInput,
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

  // Parse input for timeout
  let inputParams: any = {};
  if (toolInput) {
    try {
      inputParams = JSON.parse(toolInput);
    } catch {}
  }

  // Subscribe to stream events
  useTerminalStream(xtermRef.current, toolUseId, !output);

  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const isDark = document.documentElement.classList.contains('dark');

  // Initialize xterm.js for output
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Get theme colors from CSS variables
    const isDark = document.documentElement.classList.contains('dark');
    
    const term = new Terminal({
      cursorBlink: false,
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
      rows: 15,
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

    // Restore historical output
    if (output) {
      term.write(output);
    }

    // Handle user input (for interactive Python prompts)
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
      <div className="bg-muted/10 rounded-lg border border-border/30 w-full overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/20 border-b border-border/30">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400" />
            <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
            <span className="text-xs sm:text-sm font-semibold text-foreground/90">{language.toUpperCase()} REPL</span>
          </div>
        </div>
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/5">
          <p className="text-xs sm:text-sm text-red-400 font-mono">Đã dừng bởi người dùng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/10 rounded-lg border border-border/30 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/20 border-b border-border/30">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <StatusIcon
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4',
              isPending && 'animate-spin text-blue-400',
              isError && 'text-red-400',
              !isPending && !isError && 'text-emerald-400'
            )}
          />
          <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
          <span className="text-xs sm:text-sm font-semibold text-foreground/90">{language.toUpperCase()} REPL</span>
          
          {/* Show timeout if specified */}
          {inputParams.timeout_ms && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground/60">timeout: {inputParams.timeout_ms}ms</span>
            </>
          )}
        </div>
      </div>

      {/* Collapsible Code Section */}
      <div className="border-b border-border/20">
        <button
          onClick={() => setIsCodeExpanded(!isCodeExpanded)}
          className="w-full flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-muted/5 hover:bg-muted/10 transition-colors text-left"
        >
          {isCodeExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/70" />
          )}
          <span className="text-[10px] sm:text-xs text-muted-foreground/80 font-mono">
            {isCodeExpanded ? 'Ẩn code Python' : 'Xem code Python'}
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground/50">({code.split('\n').length} dòng)</span>
        </button>
        
        {isCodeExpanded && (
          <div className="border-t border-border/20">
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight as any}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: 'transparent',
                padding: '1rem 1.25rem',
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  fontSize: '0.8125rem',
                  lineHeight: '1.7',
                },
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>

      {/* Output Terminal */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/5">
        <div className="text-[10px] sm:text-xs text-muted-foreground/70 mb-1.5 sm:mb-2 font-mono">Output:</div>
        <div 
          ref={terminalRef}
          className="w-full xterm-container rounded-md overflow-hidden border border-border/20"
          style={{ height: '300px' }}
        />
      </div>
    </div>
  );
}
