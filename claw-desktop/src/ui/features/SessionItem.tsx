// SessionItem — Clean session row
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { switchSession, deleteSession, renameSession } = useChatStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const handleClick = () => {
    if (!isEditing && !isActive && !menuOpen && !deleteDialogOpen && !isInteracting) {
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
    setIsInteracting(true);
    setMenuOpen(false);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteSession(session.id);
    setIsInteracting(false);
  };

  const handleDialogClose = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setTimeout(() => setIsInteracting(false), 100);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('sessionItem.justNow');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(t('sessionItem.locale'), { day: '2-digit', month: '2-digit' });
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1.5 sm:py-2 mb-1 rounded-lg bg-muted border border-border" onClick={(e) => e.stopPropagation()}>
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="flex-1 min-w-0 h-6 sm:h-7 px-1.5 sm:px-2 text-xs sm:text-sm bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
          autoFocus
        />
        <button 
          onClick={handleRename} 
          className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          title={t('sessionItem.save')}
        >
          <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
        <button 
          onClick={() => setIsEditing(false)} 
          className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 flex items-center justify-center rounded-md bg-background border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={t('sessionItem.cancel')}
        >
          <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer transition-colors border border-transparent',
        isActive
          ? 'text-foreground font-semibold'
          : 'text-muted-foreground hover:text-foreground'
      )}
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] truncate">

          {session.title}
        </p>
        <p className="text-[9px] text-muted-foreground opacity-60 truncate">

          {formatDate(session.updated_at)}
        </p>
      </div>

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className={cn(
            'flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md transition-all duration-150',
            menuOpen
              ? 'bg-foreground/10 text-foreground'
              : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-foreground/5'
          )}
        >
          <MoreHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div 
              className="absolute right-0 top-full mt-1 min-w-[120px] rounded-lg border border-border/30 bg-popover p-1 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setIsEditing(true); setEditTitle(session.title); }}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-popover-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t('sessionItem.rename')}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('sessionItem.delete')}</span>
              </button>
            </div>
          </>
        )}
      </div>
      {deleteDialogOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={handleDialogClose}
            sessionTitle={session.title}
            onConfirm={confirmDelete}
          />
        </div>
      )}
    </div>
  );
}
