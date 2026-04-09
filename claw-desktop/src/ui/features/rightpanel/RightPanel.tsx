import { Terminal, GitBranch } from 'lucide-react';
import { useRightPanelStore } from '../../../store/useRightPanelStore';
import { TerminalView } from './TerminalView';
import { GitView } from './GitView';
import { cn } from '../../../lib/utils';

export function RightPanel() {
  const { activeTab, setActiveTab } = useRightPanelStore();

  return (
    <div className="flex flex-col w-full h-full bg-background border-l border-border">
      {/* Compact Icon Tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-background shrink-0">
        <button
          onClick={() => setActiveTab('terminal')}
          className={cn(
            'p-1.5 rounded transition-colors',
            activeTab === 'terminal'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
          title="Terminal"
        >
          <Terminal className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setActiveTab('git')}
          className={cn(
            'p-1.5 rounded transition-colors',
            activeTab === 'git'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
          title="Git"
        >
          <GitBranch className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {activeTab === 'terminal' && <TerminalView />}
        {activeTab === 'git' && <GitView />}
        {!activeTab && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Select a tab
          </div>
        )}
      </div>
    </div>
  );
}
