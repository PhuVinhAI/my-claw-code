import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TerminalTab {
  id: string;
  title: string;
  shell: 'powershell' | 'bash' | 'cmd';
  cwd?: string;
  output: string;
  isActive: boolean;
  createdAt: number;
}

interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  isPanelOpen: boolean;
  
  // Actions
  createTab: (shell?: 'powershell' | 'bash' | 'cmd', cwd?: string) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabOutput: (id: string, output: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  togglePanel: () => void;
  clearTabOutput: (id: string) => void;
  resetAllTerminals: () => void; // Reset all terminals when switching session
}

const getDefaultShell = (): 'powershell' | 'bash' | 'cmd' => {
  // Always return PowerShell on Windows
  if (typeof window !== 'undefined') {
    // Check if running on Windows via Tauri
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) {
      return 'powershell';
    }
  }
  return 'bash';
};

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      isPanelOpen: false,

      createTab: (shell, cwd) => {
        const id = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const defaultShell = shell || getDefaultShell();
        const title = `${defaultShell} ${get().tabs.length + 1}`;
        
        const newTab: TerminalTab = {
          id,
          title,
          shell: defaultShell,
          cwd,
          output: '',
          isActive: true,
          createdAt: Date.now(),
        };

        set((state) => ({
          tabs: [...state.tabs.map(t => ({ ...t, isActive: false })), newTab],
          activeTabId: id,
          isPanelOpen: true,
        }));

        return id;
      },

      closeTab: (id) => {
        // Dispose XTerm instance when tab is closed
        import('../ui/features/terminal/TerminalTab').then(({ disposeTerminalInstance }) => {
          disposeTerminalInstance(id);
        });
        
        // Kill terminal process
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('kill_terminal', { terminalId: id }).catch(err => {
            console.error('[TerminalStore] Failed to kill terminal:', err);
          });
        });
        
        set((state) => {
          const tabs = state.tabs.filter(t => t.id !== id);
          const wasActive = state.activeTabId === id;

          let newActiveId = state.activeTabId;
          if (wasActive && tabs.length > 0) {
            // Activate the next tab or the last one
            const closedIndex = state.tabs.findIndex(t => t.id === id);
            newActiveId = tabs[Math.min(closedIndex, tabs.length - 1)]?.id || null;
          } else if (tabs.length === 0) {
            newActiveId = null;
          }

          return {
            tabs: tabs.map(t => ({ ...t, isActive: t.id === newActiveId })),
            activeTabId: newActiveId,
            isPanelOpen: tabs.length > 0 ? state.isPanelOpen : false,
          };
        });
      },

      setActiveTab: (id) => {
        set((state) => ({
          tabs: state.tabs.map(t => ({ ...t, isActive: t.id === id })),
          activeTabId: id,
        }));
      },

      updateTabTitle: (id, title) => {
        set((state) => ({
          tabs: state.tabs.map(t => t.id === id ? { ...t, title } : t),
        }));
      },

      updateTabOutput: (id, chunk) => {
        set((state) => ({
          tabs: state.tabs.map(t => 
            t.id === id ? { ...t, output: t.output + chunk } : t
          ),
        }));
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const tabs = [...state.tabs];
          const [removed] = tabs.splice(fromIndex, 1);
          tabs.splice(toIndex, 0, removed);
          return { tabs };
        });
      },

      togglePanel: () => {
        set((state) => ({ isPanelOpen: !state.isPanelOpen }));
      },

      clearTabOutput: (id) => {
        // Clear terminal if it exists (handled by component)
        set((state) => ({
          tabs: state.tabs.map(t => t.id === id ? { ...t, output: '' } : t),
        }));
      },

      resetAllTerminals: () => {
        // Dispose all XTerm instances
        import('../ui/features/terminal/TerminalTab').then(({ disposeTerminalInstance }) => {
          const { tabs } = get();
          tabs.forEach(tab => {
            disposeTerminalInstance(tab.id);
          });
        });
        
        // Kill all terminal processes
        const { tabs } = get();
        tabs.forEach(tab => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('kill_terminal', { terminalId: tab.id }).catch(err => {
              console.error('[TerminalStore] Failed to kill terminal:', err);
            });
          });
        });
        
        // Clear all tabs and close panel
        set({
          tabs: [],
          activeTabId: null,
          isPanelOpen: false,
        });
      },
    }),
    {
      name: 'terminal-storage',
      partialize: (state) => ({
        // Persist panel state AND output (for restore after toggle/switch)
        isPanelOpen: state.isPanelOpen,
        tabs: state.tabs.map(({ id, title, shell, cwd, createdAt, isActive, output }) => ({
          id,
          title,
          shell,
          cwd,
          createdAt,
          isActive,
          output, // ← Lưu output để restore khi mount lại
        })),
        activeTabId: state.activeTabId,
      }),
    }
  )
);
