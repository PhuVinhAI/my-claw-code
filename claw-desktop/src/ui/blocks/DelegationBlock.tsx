// DelegationBlock — Clean inline delegation indicator
import { Zap, Bot, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DelegationBlockProps {
  toolName: 'Skill' | 'Agent';
  name: string;
  description?: string;
  prompt?: string;
  output?: string;
  isError?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

export function DelegationBlock({
  toolName,
  name,
  isError = false,
  isPending = false,
  isCancelled = false,
}: DelegationBlockProps) {
  const StatusIcon = isPending ? Loader2 : (isError || isCancelled) ? XCircle : CheckCircle2;
  const Icon = toolName === 'Skill' ? Zap : Bot;
  const label = toolName === 'Skill' ? 'Skill' : 'Agent';

  return (
    <div className="flex items-center gap-3 p-3 my-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm transition-colors hover:bg-indigo-500/10">
      <StatusIcon
        className={cn(
          'h-4 w-4 shrink-0',
          isPending && 'animate-spin text-indigo-500',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500'
        )}
      />
      <Icon className="h-4 w-4 shrink-0 text-indigo-500/70" />
      <span className={cn('font-medium text-foreground', isError && 'text-destructive')}>{label}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-medium flex-1 text-foreground/80">{name}</span>
      {isPending && <span className="text-xs text-indigo-500 animate-pulse">Đang xử lý…</span>}
      {isCancelled && <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-md">Đã dừng</span>}
    </div>
  );
}
