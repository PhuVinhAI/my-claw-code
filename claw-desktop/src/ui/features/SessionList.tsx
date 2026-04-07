// SessionList — Sidebar with search, skeleton loading, lazy scroll
import { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { SessionItem } from './SessionItem';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Plus, Settings, Sun, Moon, PanelLeftClose, ChevronDown, ChevronRight, X, Search, Filter, Home, FolderOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../components/ui/dropdown-menu';
import { invoke } from '@tauri-apps/api/core';





const PAGE_SIZE = 20;

function SessionSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg animate-pulse">
      <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
        <div className="h-2.5 sm:h-3 bg-foreground/[0.06] rounded-md w-3/4" />
        <div className="h-2 bg-foreground/[0.04] rounded-md w-1/3" />
      </div>
    </div>
  );
}

interface SessionListProps {
  onOpenSettings: () => void;
  onCloseSidebar?: () => void;
}


export function SessionList({ onOpenSettings, onCloseSidebar }: SessionListProps) {

  const { t } = useTranslation();
  const { sessions, currentSessionId, isLoadingSessions, recentWorkspaces, removeWorkspace, workMode, workspacePath } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all'); // 'all' | 'home' | workspace_path
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});


  const [isDark, setIsDark] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isDarkSet = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    setIsDark(isDarkSet);
    if (isDarkSet) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  };

  const { setWorkMode } = useChatStore();

  const hasMore = visibleCount < sessions.length;

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  };

  const groupedSessions = useMemo(() => {
    // Filter sessions theo search query và selected workspace
    let filteredSessions = sessions;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredSessions = filteredSessions.filter(s => 
        s.title.toLowerCase().includes(query) || 
        s.preview.toLowerCase().includes(query)
      );
    }
    
    // Filter by workspace
    if (selectedWorkspace !== 'all') {
      filteredSessions = filteredSessions.filter(s => {
        if (selectedWorkspace === 'home') {
          return s.work_mode !== 'workspace' || !s.workspace_path;
        } else {
          return s.work_mode === 'workspace' && s.workspace_path === selectedWorkspace;
        }
      });
    }

    const groups: Record<string, typeof sessions> = {};
    const keys: string[] = [];

    // Pre-populate with recent workspaces
    if (recentWorkspaces) {
      recentWorkspaces.forEach(wsPath => {
         groups[wsPath] = [];
         keys.push(wsPath);
      });
    }

    let hasHome = false;

    filteredSessions.forEach((s) => {

      let key = 'home';
      if (s.work_mode === 'workspace' && s.workspace_path) {
        key = s.workspace_path;
      } else {
        hasHome = true;
      }

      if (!groups[key]) {
        groups[key] = [];
        if (key !== 'home') {
          keys.push(key);
        }
      }
      groups[key].push(s);
    });

    const uniqueKeys = Array.from(new Set(keys));
    if (hasHome && !uniqueKeys.includes('home')) uniqueKeys.push('home');

    // Sắp xếp: workspace hiện tại lên đầu, home ở giữa, các workspace khác theo thứ tự
    const currentWorkspaceKey = workMode === 'workspace' && workspacePath ? workspacePath : null;
    
    const sortedKeys = uniqueKeys.sort((a, b) => {
      // Current workspace lên đầu
      if (a === currentWorkspaceKey) return -1;
      if (b === currentWorkspaceKey) return 1;
      
      // Home luôn ở vị trí thứ 2 (sau current workspace nếu có)
      if (a === 'home') return currentWorkspaceKey ? 1 : -1;
      if (b === 'home') return currentWorkspaceKey ? -1 : 1;
      
      // Các workspace khác sort theo tên
      return a.localeCompare(b);
    });

    return { groups, keys: sortedKeys };
  }, [sessions, recentWorkspaces, searchQuery, selectedWorkspace, workMode, workspacePath]);



  const handleNewSessionInWorkspace = async (workspacePath: string) => {
    if (workspacePath !== 'home') {
      await setWorkMode('workspace', workspacePath);
    } else {
      await setWorkMode('normal');
    }
  };

  const toggleGroup = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleGoHome = async () => {
    await setWorkMode('normal');
  };

  const handleOpenWorkspace = async () => {
    try {
      const selected = await invoke<string | null>('select_and_set_workspace');
      
      if (selected) {
        // Update work mode state và reload sessions
        await setWorkMode('workspace', selected);
      }
    } catch (e) {
      console.error('Failed to open workspace:', e);
    }
  };

  return (

    <div className="flex flex-col h-full bg-background relative">
      {/* Header - 3 rows: search/filter + home + workspace */}
      <div className="shrink-0 px-3 pt-4 pb-3 space-y-2">
        {/* Row 1: Close + Search + Filter */}
        <div className="flex items-center gap-2">
          {/* Close sidebar button */}
          {onCloseSidebar && (
            <button
              onClick={onCloseSidebar}
              className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title={t('sessionList.closeSidebar', 'Close Sidebar')}
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
          
          {/* Search input - flex-1 */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sessionList.searchPlaceholder')}
              className="w-full h-7 pl-8 pr-2 text-xs bg-card border border-border rounded-md outline-none focus:border-border transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
          
          {/* Filter dropdown button */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Filter className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border/30 p-1.5">
              <DropdownMenuItem 
                onClick={() => setSelectedWorkspace('all')}
                className={cn(
                  "cursor-pointer text-xs px-2 py-1.5 rounded-sm transition-colors mb-1",
                  selectedWorkspace === 'all' 
                    ? "bg-accent text-accent-foreground font-semibold" 
                    : "text-popover-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {t('sessionList.allWorkspaces', 'All')}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSelectedWorkspace('home')}
                className={cn(
                  "cursor-pointer text-xs px-2 py-1.5 rounded-sm transition-colors mb-1",
                  selectedWorkspace === 'home' 
                    ? "bg-accent text-accent-foreground font-semibold" 
                    : "text-popover-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {t('sessionList.home')}
              </DropdownMenuItem>
              {recentWorkspaces && recentWorkspaces.length > 0 && (
                <>
                  <div className="h-px bg-border/30 my-1.5" />
                  {recentWorkspaces.map(wsPath => (
                    <DropdownMenuItem 
                      key={wsPath}
                      onClick={() => setSelectedWorkspace(wsPath)}
                      className={cn(
                        "cursor-pointer text-xs px-2 py-1.5 rounded-sm transition-colors mb-1 last:mb-0",
                        selectedWorkspace === wsPath 
                          ? "bg-accent text-accent-foreground font-semibold" 
                          : "text-popover-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={wsPath}
                    >
                      <span className="truncate">{wsPath.split(/[/\\]/).pop() || wsPath}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Row 2: Home button */}
        <button
          onClick={handleGoHome}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors",
            workMode === 'normal'
              ? "bg-accent text-accent-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={t('sessionList.goHome', 'Go to Home')}
        >
          <Home className="w-3.5 h-3.5" />
          <span>{t('sessionList.home')}</span>
        </button>
        
        {/* Row 3: Open Workspace button */}
        <button
          onClick={handleOpenWorkspace}
          className="w-full flex items-center justify-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={t('sessionList.openWorkspace', 'Open Workspace')}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{t('sessionList.openWorkspace', 'Workspace')}</span>
        </button>
      </div>

      {/* Body */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-1.5 sm:px-2 py-2 sm:py-3"
      >
        {/* Xóa nút "Open Workspace" - không cần nữa */}

        {isLoadingSessions ? (

          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70%] px-3 text-center">
            <p className="text-xs text-muted-foreground">{t('sessionList.noConversations')}</p>

          </div>
        ) : (
          <div className="space-y-4">
            {groupedSessions.keys.map((groupKey) => {
              const groupName = groupKey === 'home' ? t('sessionList.home') : groupKey.split(/[/\\]/).pop() || groupKey;
              return (

                <div key={groupKey} className="group/folder mx-1">
                  <div 
                    className="flex items-center justify-between px-1 mb-1.5 cursor-pointer hover:bg-muted/50 rounded-sm py-1 transition-colors"
                    onClick={(e) => toggleGroup(groupKey, e)}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-xs font-semibold text-muted-foreground/80 lowercase tracking-wide truncate select-none" title={groupKey}>
                        {groupName}
                      </span>
                      {collapsedGroups[groupKey] ? (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70 transition-transform duration-200 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/70 transition-transform duration-200 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleNewSessionInWorkspace(groupKey); }}
                        className="p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                        title={t('sessionList.newChat')}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {groupKey !== 'home' && (
                        <button
                          onClick={async (e) => { e.stopPropagation(); await removeWorkspace(groupKey); }}
                          className="p-0.5 rounded-sm hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all"
                          title={t('sessionList.removeWorkspace', 'Remove workspace from list')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {!collapsedGroups[groupKey] && (
                    <div className="space-y-0.5">
                      {groupedSessions.groups[groupKey].length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground/60 italic">
                          {t('sessionList.noConversations')}
                        </div>
                      ) : (
                        groupedSessions.groups[groupKey].slice(0, visibleCount).map((session) => (
                          <SessionItem
                            key={session.id}
                            session={session}
                            isActive={
                              session.id === currentSessionId &&
                              session.work_mode === workMode &&
                              session.workspace_path === workspacePath
                            }
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>

              );
            })}
            {hasMore && (
              <div className="flex justify-center py-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('sessionList.loadMore', { count: sessions.length - visibleCount })}
                </span>
              </div>
            )}

          </div>
        )}
      </div>


      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-2 py-1.5 border-t border-border/10">
        <div className="flex origin-left scale-[0.85]">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors group"
            title={t('sessionList.settings')}
          >
            <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
            <span className="text-[11px] font-semibold leading-none tracking-wide">
              {t('sessionList.settings')}
            </span>
          </button>
        </div>
        
        <div className="flex items-center gap-0.5 origin-right scale-[0.85]">
           <LanguageSelector />
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('sessionList.theme')}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>


    </div>
  );
}
