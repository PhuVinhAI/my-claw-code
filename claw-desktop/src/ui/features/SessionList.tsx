// SessionList — Sidebar with search, skeleton loading, lazy scroll
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { SessionItem } from './SessionItem';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Plus, Settings, Sun, Moon, PanelLeftClose, FolderPlus, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';





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
  const { sessions, currentSessionId, isLoadingSessions, createNewSession, recentWorkspaces } = useChatStore();

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

    sessions.forEach((s) => {

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

    const uniqueKeys = Array.from(new Set(keys)).sort();
    if (hasHome && !uniqueKeys.includes('home')) uniqueKeys.push('home');


    return { groups, keys: uniqueKeys };
  }, [sessions, recentWorkspaces]);



  const handleNewSessionInWorkspace = async (workspacePath: string) => {
    if (workspacePath !== 'home') {
      await setWorkMode('workspace', workspacePath);
    } else {
      await setWorkMode('normal');
    }
  };


  const visibleCountForGroup = (groupKey: string) => {
    return visibleCount; // Currently applying global visible count for simplicity, can be localized per group
  };

  const toggleGroup = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  return (

    <div className="flex flex-col h-full bg-[#141414] relative">
      <div className="shrink-0 flex items-center justify-between px-3 pt-4 pb-2">
        <div className="flex flex-1 items-center gap-2">
          {onCloseSidebar && (
            <button
              onClick={onCloseSidebar}
              className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={t('sessionList.closeSidebar', 'Close Sidebar')}
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={createNewSession}
          className="flex items-center justify-center p-1.5 ml-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={t('sessionList.newChat')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-1.5 sm:px-2 py-2 sm:py-3"
      >
        <div className="mb-4 mt-2 px-2">
            <button
              onClick={async () => {
                const { invoke } = await import('@tauri-apps/api/core');
                try {
                  const path = await invoke<string | null>('select_and_set_workspace');
                  if (path) await setWorkMode('workspace', path);
                } catch (e) {
                  console.error(e);
                }
              }}
              className="flex w-full items-center gap-2 px-2 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors opacity-80 hover:opacity-100"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t('sessionList.openWorkspace')}</span>
            </button>
        </div>

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
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/70 transition-transform duration-200 shrink-0", collapsedGroups[groupKey] && "-rotate-90")} />
                      <span className="text-xs font-semibold text-muted-foreground/80 lowercase tracking-wide truncate select-none" title={groupKey}>
                        {groupName}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNewSessionInWorkspace(groupKey); }}

                      className="opacity-0 group-hover/folder:opacity-100 p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                      title={t('sessionList.newChat')}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
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
                            isActive={session.id === currentSessionId}
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
