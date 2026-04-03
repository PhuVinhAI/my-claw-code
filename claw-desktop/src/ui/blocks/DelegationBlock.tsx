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
    <div className="flex items-center gap-2.5 py-2 text-xs text-muted-foreground">
      <StatusIcon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          isPending && 'animate-spin text-foreground/40',
          isError && 'text-destructive',
          isCancelled && 'text-destructive',
          !isPending && !isError && !isCancelled && 'text-emerald-500/70'
        )}
      />
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />
      <span className={cn('font-medium', isError && 'text-destructive')}>{label}</span>
      <span className="opacity-30">·</span>
      <span className="font-medium opacity-70">{name}</span>
      {isPending && <span className="opacity-40 animate-pulse">Đang xử lý…</span>}
      {isCancelled && <span className="text-destructive/70">Đã dừng</span>}
    </div>
  );
}
