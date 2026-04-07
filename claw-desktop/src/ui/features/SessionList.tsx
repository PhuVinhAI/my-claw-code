// SessionList — Sidebar with search, skeleton loading, lazy scroll
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { SessionItem } from './SessionItem';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Plus, Search, Settings, Sun, Moon, MessageSquareDashed, SearchX, PanelLeftClose } from 'lucide-react';


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
  const { sessions, currentSessionId, isLoadingSessions, createNewSession } = useChatStore();
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
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
          <div className="relative group flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('sessionList.searchPlaceholder')}
              className="w-full h-7 pl-6 pr-2 text-xs bg-transparent border-none rounded-sm placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
        <button
          onClick={createNewSession}
          className="flex items-center justify-center p-1.5 ml-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={t('sessionList.newChat')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 pt-2 pb-1">
         <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t('sessionList.title')}
         </span>
      </div>


      {/* Body */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-1.5 sm:px-2 py-2 sm:py-3"
      >
        {isLoadingSessions ? (
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70%] px-3 sm:px-4 text-center">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border bg-muted/30 mb-3 sm:mb-4">
              {search.trim() ? (
                <SearchX className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              ) : (
                <MessageSquareDashed className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              {search.trim() ? t('sessionList.noResults') : t('sessionList.noConversations')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 sm:mt-1.5 max-w-[180px] sm:max-w-[200px] leading-relaxed">
              {search.trim() 
                ? t('sessionList.noResultsHint')
                : t('sessionList.noConversationsHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
              />
            ))}
            {hasMore && (
              <div className="flex justify-center py-3 sm:py-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('sessionList.loadMore', { count: filtered.length - visibleCount })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between p-3">
        <button
          onClick={onOpenSettings}
          className="flex flex-1 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors group"
          title={t('sessionList.settings')}
        >
          <Settings className="w-4 h-4 text-muted-foreground transition-transform group-hover:rotate-45" />
          <span className="text-foreground text-[11px] font-semibold leading-tight">
            {t('sessionList.settings')}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <div className="scale-75 origin-right">
             <LanguageSelector />
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('sessionList.theme')}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
