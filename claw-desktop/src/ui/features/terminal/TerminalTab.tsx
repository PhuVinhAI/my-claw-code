import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTerminalStore } from '../../../store/useTerminalStore';
import 'xterm/css/xterm.css';
import '../../../ui/blocks/xterm-custom.css';

interface TerminalTabProps {
  tabId: string;
}

// CRITICAL: Store XTerm instances OUTSIDE component to persist across mount/unmount
// This is how VS Code keeps terminal buffer alive when toggling panel
const terminalInstances = new Map<string, {
  term: Terminal;
  fitAddon: FitAddon;
  shellSpawned: boolean;
  unlisten?: () => void;
  onDataDisposable?: { dispose: () => void };
}>();

export function TerminalTab({ tabId }: TerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const tab = useTerminalStore((state) => state.tabs.find(t => t.id === tabId));
  const updateTabOutput = useTerminalStore((state) => state.updateTabOutput);

  // Watch for clear output action
  useEffect(() => {
    const instance = terminalInstances.get(tabId);
    if (tab && tab.output === '' && instance) {
      instance.term.clear();
    }
  }, [tab?.output, tabId]);

  // Initialize or reuse terminal instance
  useEffect(() => {
    if (!terminalRef.current) return;

    // Check if instance already exists (reuse on remount)
    let instance = terminalInstances.get(tabId);
    
    if (!instance) {
      // Create new instance
      console.log('[Terminal] Creating new instance for', tabId);
      
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
        windowsMode: false,
        windowOptions: {
          setWinLines: false,
        },
        // CRITICAL: Enable IME support for Vietnamese and other languages
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      
      // Load Unicode11 addon for proper Vietnamese character support
      const unicode11Addon = new Unicode11Addon();
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = '11'; // Use Unicode 11 for better character support
      
      const webLinksAddon = new WebLinksAddon((event, uri) => {
        event.preventDefault();
        open(uri).catch(err => {
          console.error('Failed to open URL:', err);
        });
      });
      term.loadAddon(webLinksAddon);
      
      // Enable copy
      term.attachCustomKeyEventHandler((event) => {
        if (event.ctrlKey && event.key === 'c' && term.hasSelection()) {
          return false;
        }
        return true;
      });
      
      // Handle terminal input - CRITICAL: Store disposable to prevent duplicate handlers
      const onDataDisposable = term.onData(async (data) => {
        try {
          await invoke('send_terminal_input', {
            terminalId: tabId,
            input: data,
          });
        } catch (e) {
          console.error('[Terminal] Failed to send input:', e);
        }
      });

      // Listen for PTY output
      const unlistenPromise = listen<{ tool_use_id: string; chunk: string; turn_id: string }>(
        'stream_event',
        (event) => {
          const payload = event.payload;
          if (payload.turn_id === tabId) {
            term.write(payload.chunk);
            updateTabOutput(tabId, payload.chunk);
          }
        }
      );

      instance = {
        term,
        fitAddon,
        shellSpawned: false,
        unlisten: undefined,
        onDataDisposable,
      };
      
      unlistenPromise.then(unlisten => {
        const inst = terminalInstances.get(tabId);
        if (inst) inst.unlisten = unlisten;
      });
      
      terminalInstances.set(tabId, instance);
    } else {
      console.log('[Terminal] Reusing existing instance for', tabId);
    }

    // Mount terminal to DOM
    instance.term.open(terminalRef.current);
    
    // Handle right-click copy
    const handleContextMenu = (e: MouseEvent) => {
      if (instance!.term.hasSelection()) {
        return;
      }
      e.preventDefault();
    };
    terminalRef.current.addEventListener('contextmenu', handleContextMenu);
    
    // Fit after mount
    setTimeout(() => {
      instance!.fitAddon.fit();
    }, 100);

    // Spawn shell if not already spawned
    if (!instance.shellSpawned) {
      instance.shellSpawned = true;
      
      const shellType = tab?.shell || 'powershell';
      const cwd = tab?.cwd;
      
      invoke('spawn_terminal_shell', {
        terminalId: tabId,
        shell: shellType,
        cwd: cwd || null,
      }).catch(err => {
        console.error('[Terminal] Failed to spawn shell:', err);
        instance!.term.writeln(`\x1b[31mFailed to spawn ${shellType}: ${err}\x1b[0m`);
        instance!.shellSpawned = false;
      });
    }

    return () => {
      // CRITICAL: DO NOT dispose terminal or remove from map
      // Just cleanup DOM event listeners
      terminalRef.current?.removeEventListener('contextmenu', handleContextMenu);
      
      console.log('[Terminal] Component unmounting, keeping instance alive for', tabId);
    };
  }, [tabId, tab?.shell, tab?.cwd]);

  // Handle resize
  useEffect(() => {
    const instance = terminalInstances.get(tabId);
    if (!instance || !terminalRef.current || !tab?.isActive) return;

    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          if (!terminalRef.current || !instance) return;

          instance.fitAddon.fit();

          const cols = instance.term.cols;
          const rows = instance.term.rows;

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
    
    if (tab?.isActive) {
      setTimeout(handleResize, 100);
    }

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

// Export cleanup function for when tab is actually closed
export function disposeTerminalInstance(tabId: string) {
  const instance = terminalInstances.get(tabId);
  if (instance) {
    console.log('[Terminal] Disposing instance for', tabId);
    instance.unlisten?.();
    instance.onDataDisposable?.dispose(); // Dispose onData handler
    instance.term.dispose();
    terminalInstances.delete(tabId);
  }
}
