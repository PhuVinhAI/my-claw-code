import { useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../../../store/useTerminalStore';
import { TerminalTab } from '../terminal/TerminalTab';
import { Plus, X, Terminal as TerminalIcon, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';

export function TerminalView() {
  const { t } = useTranslation();
  const tabs = useTerminalStore((state) => state.tabs);
  const createTab = useTerminalStore((state) => state.createTab);
  const closeTab = useTerminalStore((state) => state.closeTab);
  const setActiveTab = useTerminalStore((state) => state.setActiveTab);
  const clearTabOutput = useTerminalStore((state) => state.clearTabOutput);
  const reorderTabs = useTerminalStore((state) => state.reorderTabs);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(192); // 48 * 4 = 192px (w-48)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleNewTerminal = (shell?: 'powershell' | 'bash' | 'cmd') => {
    createTab(shell);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      reorderTabs(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle sidebar resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing || !sidebarRef.current) return;

    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const startX = sidebarRect.left;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new width based on mouse position relative to sidebar start
      const newWidth = e.clientX - startX;
      
      if (newWidth >= 150 && newWidth <= 400) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  return (
    <div className="flex w-full h-full bg-background overflow-hidden">
      {/* Left Sidebar - Terminal List */}
      <div 
        ref={sidebarRef}
        className="border-r border-border bg-muted/10 flex flex-col shrink-0 relative"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className="p-0.5 hover:bg-accent rounded transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 5H2v1h12V5zM2 8h12v1H2V8zm0 3h12v1H2v-1z"/>
              </svg>
            </button>
          </div>
          <button
            onClick={() => handleNewTerminal()}
            className="p-0.5 hover:bg-accent rounded transition-colors"
            title={t('terminalPanel.newTerminal')}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Terminal Count */}
        <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wide">
          {tabs.length} {tabs.length === 1 ? t('terminalPanel.terminal') : t('terminalPanel.terminals')}
        </div>

        {/* Terminal List */}
        <div className="flex-1 overflow-y-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors',
                'hover:bg-accent/50',
                tab.isActive && 'bg-accent'
              )}
            >
              <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground/90 flex-1 truncate">
                {tab.title}
              </span>
              <button
                onClick={(e) => handleCloseTab(e, tab.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            'absolute top-0 right-0 w-1 h-full cursor-col-resize z-50',
            'hover:bg-accent/50 transition-colors',
            isResizing && 'bg-accent'
          )}
        >
          <div 
            className={cn(
              'absolute top-1/2 -translate-y-1/2 right-0 w-1 h-12 bg-accent/30 rounded-l-full',
              'opacity-0 hover:opacity-100 transition-opacity'
            )}
          />
        </div>
      </div>

      {/* Right Side - Terminal Tabs & Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center bg-muted/20 border-b border-border shrink-0 overflow-hidden">
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-thin min-w-0">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-pointer transition-colors shrink-0',
                  'hover:bg-accent/50',
                  tab.isActive && 'bg-background',
                  dragOverIndex === index && 'bg-accent',
                  draggedIndex === index && 'opacity-50'
                )}
              >
                <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground/90 max-w-[100px] truncate">
                  {tab.shell}
                </span>
                
                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity"
                  >
                    <MoreVertical className="h-3 w-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => clearTabOutput(tab.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      {t('terminalPanel.clearOutput')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="text-red-400"
                    >
                      <X className="h-3.5 w-3.5 mr-2" />
                      {t('terminalPanel.closeTab')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 min-h-0 w-full relative bg-background overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <TerminalIcon className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">{t('terminalPanel.noTerminals')}</p>
              <button
                onClick={() => handleNewTerminal()}
                className="mt-3 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                {t('terminalPanel.createFirst')}
              </button>
            </div>
          ) : (
            tabs.map((tab) => (
              <div
                key={tab.id}
                className="absolute inset-0 w-full h-full"
                style={{ display: tab.isActive ? 'block' : 'none' }}
              >
                <TerminalTab tabId={tab.id} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
