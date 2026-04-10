import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTerminalStore } from '../../../store/useTerminalStore';
import 'xterm/css/xterm.css';
import '../../../ui/blocks/xterm-custom.css';

interface TerminalTabProps {
  tabId: string;
}

export function TerminalTab({ tabId }: TerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellSpawnedRef = useRef(false); // Track if shell already spawned
  
  const tab = useTerminalStore((state) => state.tabs.find(t => t.id === tabId));
  const updateTabOutput = useTerminalStore((state) => state.updateTabOutput);

  // Watch for clear output action
  useEffect(() => {
    if (tab && tab.output === '' && xtermRef.current) {
      xtermRef.current.clear();
    }
  }, [tab?.output]);

  // Initialize terminal (only once per tabId)
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');
    
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: isDark ? '#0a0a0a' : '#ffffff',
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
      scrollback: 50000,
      scrollOnUserInput: true,
      allowTransparency: false,
      windowsMode: false, // CRITICAL: Must be false to enable reflow on resize
      windowOptions: {
        setWinLines: false,
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      open(uri).catch(err => {
        console.error('Failed to open URL:', err);
      });
    });
    term.loadAddon(webLinksAddon);
    
    term.open(terminalRef.current);
    
    // Enable right-click to copy selection
    term.attachCustomKeyEventHandler((event) => {
      // Allow Ctrl+C to copy when there's a selection
      if (event.ctrlKey && event.key === 'c' && term.hasSelection()) {
        return false; // Let browser handle copy
      }
      return true;
    });
    
    // Handle right-click context menu for copy
    terminalRef.current.addEventListener('contextmenu', (e) => {
      if (term.hasSelection()) {
        // Allow default context menu when there's selection (for copy)
        return;
      }
      // Prevent context menu when no selection
      e.preventDefault();
    });
    
    // Fit after a short delay to ensure container is rendered
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    // CRITICAL: Restore previous output from store when mounting
    if (tab && tab.output) {
      term.write(tab.output);
    }

    // Handle terminal data (user input) - forward to backend PTY
    term.onData(async (data) => {
      try {
        await invoke('send_terminal_input', {
          terminalId: tabId,
          input: data,
        });
      } catch (e) {
        console.error('[Terminal] Failed to send input:', e);
      }
    });

    // Listen for output chunks from backend PTY
    const unlistenPromise = listen<{ tool_use_id: string; chunk: string; turn_id: string }>(
      'stream_event',
      (event) => {
        const payload = event.payload;
        
        // Check if this is for our terminal (turn_id === terminal_id)
        if (payload.turn_id === tabId) {
          term.write(payload.chunk);
          
          // Update stored output
          updateTabOutput(tabId, payload.chunk);
        }
      }
    );

    // Spawn interactive shell session (only once)
    if (!shellSpawnedRef.current) {
      shellSpawnedRef.current = true;
      
      const shellType = tab?.shell || 'powershell';
      const cwd = tab?.cwd; // Get cwd from tab config
      
      invoke('spawn_terminal_shell', {
        terminalId: tabId,
        shell: shellType,
        cwd: cwd || null, // Pass cwd to backend
      }).catch(err => {
        console.error('[Terminal] Failed to spawn shell:', err);
        term.writeln(`\x1b[31mFailed to spawn ${shellType}: ${err}\x1b[0m`);
        shellSpawnedRef.current = false; // Allow retry
      });
    }

    return () => {
      unlistenPromise.then(unlisten => unlisten());
      
      // DO NOT kill terminal on unmount - only kill when tab is closed (via closeTab action)
      // This allows terminal to keep running when RightPanel is toggled closed
      
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      shellSpawnedRef.current = false;
    };
  }, [tabId]); // ONLY depend on tabId, not tab object

  // Handle resize - both window resize and container resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      if (!xtermRef.current || !terminalRef.current || !tab?.isActive) return;

      // Debounce resize to avoid losing content during drag
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          if (!fitAddonRef.current || !terminalRef.current || !xtermRef.current) return;

          // Fit terminal to container
          fitAddonRef.current.fit();

          // Get new dimensions
          const cols = xtermRef.current.cols;
          const rows = xtermRef.current.rows;

          // Notify backend PTY about resize (send SIGWINCH)
          invoke('resize_terminal', {
            terminalId: tabId,
            cols,
            rows,
          }).catch(err => {
            console.error('[Terminal] Failed to resize PTY:', err);
          });

        } catch (e) {
          console.error('[Terminal] Resize failed:', e);
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    
    // Fit when tab becomes active
    if (tab?.isActive && fitAddonRef.current) {
      setTimeout(() => {
        handleResize();
      }, 100);
    }

    // Watch for container size changes (e.g., sidebar resize)
    let resizeObserver: ResizeObserver | null = null;
    if (terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (tab?.isActive) {
          handleResize();
        }
      });
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [tab?.isActive, tabId]);

  if (!tab) return null;

  return (
    <div 
      ref={terminalRef}
      className="w-full h-full xterm-container overflow-hidden"
    />
  );
}
