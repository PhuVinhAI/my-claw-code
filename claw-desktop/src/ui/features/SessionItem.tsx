// SessionItem — Clean session row
import { useState } from 'react';
import { SessionMetadata } from '../../core/entities';
import { useChatStore } from '../../store/useChatStore';
import { MoreHorizontal, Trash2, Edit2, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface SessionItemProps {
  session: SessionMetadata;
  isActive: boolean;
}

export function SessionItem({ session, isActive }: SessionItemProps) {
  const { switchSession, deleteSession, renameSession } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleClick = () => {
    // Don't switch session if menu is open, editing, or already active
    if (!isEditing && !isActive && !menuOpen) {
      switchSession(session.id);
    }
  };

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      renameSession(session.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteSession(session.id);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="flex-1 min-w-0 h-9 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-primary"
          autoFocus
        />
        <button onClick={handleRename} className="h-8 w-8 flex items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setIsEditing(false)} className="h-8 w-8 flex items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      onClick={handleClick}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm truncate',
          isActive ? 'font-semibold text-foreground' : 'font-medium'
        )}>
          {session.title}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(session.updated_at)}
        </p>
      </div>

      {/* Context menu trigger */}
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-150',
            menuOpen
              ? 'opacity-100 bg-muted-foreground/20 text-foreground'
              : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
          )}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Inline dropdown */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div 
              className="absolute right-0 top-full mt-1 min-w-[120px] rounded-xl border border-border/30 bg-popover/95 backdrop-blur-xl p-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setIsEditing(true); setEditTitle(session.title); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                <span>Đổi tên</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa</span>
              </button>
            </div>
          </>
        )}
      </div>
      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sessionTitle={session.title}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
