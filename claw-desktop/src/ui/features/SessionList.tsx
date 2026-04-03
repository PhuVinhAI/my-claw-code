// SessionList — Sidebar with search, skeleton loading, lazy scroll
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { SessionItem } from './SessionItem';
import { Plus, Search, Settings, Sun, Moon, MessageSquareDashed, SearchX } from 'lucide-react';

const PAGE_SIZE = 20;

// Skeleton row
function SessionSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 bg-foreground/[0.06] rounded-md w-3/4" />
        <div className="h-2 bg-foreground/[0.04] rounded-md w-1/3" />
      </div>
    </div>
  );
}

export function SessionList() {
  const { sessions, currentSessionId, isLoadingSessions, createNewSession } = useChatStore();
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isDark, setIsDark] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize and handle theme
  useEffect(() => {
    const isDarkSet = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    setIsDark(isDarkSet);
    if (isDarkSet) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Filter sessions by search
  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  // Lazy slice
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Scroll handler for lazy loading
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    const threshold = 100;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  // Reset visible count when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* 1. HEADER */}
      <div className="shrink-0 flex flex-col gap-4 px-3 pt-5 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Lịch sử hội thoại
          </span>
          <button
            onClick={createNewSession}
            className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Hội thoại mới"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="relative group px-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm hội thoại..."
            className="w-full h-9 pl-8 pr-3 text-sm bg-background border border-input rounded-md placeholder:text-muted-foreground text-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* 2. BODY (SESSIONS LIST) */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-3"
      >
        {isLoadingSessions ? (
          // Skeleton loading
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70%] px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/30 mb-4">
              {search.trim() ? (
                <SearchX className="h-5 w-5 text-muted-foreground" />
              ) : (
                <MessageSquareDashed className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              {search.trim() ? 'Không tìm thấy kết quả' : 'Chưa có hội thoại'}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[200px] leading-relaxed">
              {search.trim() 
                ? 'Thử sử dụng một từ khóa tìm kiếm khác.' 
                : 'Bắt đầu trò chuyện bằng cách tạo một hội thoại mới.'}
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
            {/* Load more indicator */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {filtered.length - visibleCount} hội thoại nữa...
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. FOOTER */}
      <div className="shrink-0 flex items-center justify-between p-3 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <button
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors group"
          title="Cài đặt"
        >
          <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
          <span>Cài đặt</span>
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Đổi giao diện (Sáng/Tối)"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
