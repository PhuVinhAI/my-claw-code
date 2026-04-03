// SessionList — Sidebar with search, skeleton loading, lazy scroll
import { useState, useRef, useCallback, useMemo } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { SessionItem } from './SessionItem';
import { Plus, Search } from 'lucide-react';

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
  const listRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-full bg-muted/30 border-r border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 shrink-0">
        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
          Hội thoại
        </span>
        <button
          onClick={createNewSession}
          className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-all duration-150"
          title="Hội thoại mới"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm hội thoại..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-foreground/[0.03] border border-border/20 rounded-lg placeholder:text-muted-foreground/30 text-foreground outline-none focus:border-foreground/15 transition-colors"
          />
        </div>
      </div>

      {/* Sessions */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 pb-4"
      >
        {isLoadingSessions ? (
          // Skeleton loading
          <div className="space-y-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SessionSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-xs text-muted-foreground/40">
              {search.trim() ? 'Không tìm thấy hội thoại nào' : 'Chưa có hội thoại nào'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {visible.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
              />
            ))}
            {/* Load more indicator */}
            {hasMore && (
              <div className="flex justify-center py-3">
                <span className="text-[10px] text-muted-foreground/30">
                  {filtered.length - visibleCount} hội thoại nữa...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
