// DelegationBlock - Specialized UI for Skill/Agent delegation
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

  // Cancelled state
  if (isCancelled) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800 w-full">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 shrink-0 text-destructive" />
          <Icon className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
          <p className="font-medium text-sm text-destructive">
            {toolName === 'Skill' ? 'Kích hoạt Skill:' : 'Ủy quyền Agent:'}
          </p>
          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 truncate flex-1">
            {name}
          </span>
          <span className="text-xs text-destructive shrink-0">Đã dừng bởi người dùng</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800 w-full">
      {/* Single line: Status + Icon + Label + Name */}
      <div className="flex items-center gap-2">
        <StatusIcon
          className={cn(
            'h-5 w-5 shrink-0',
            isPending && 'animate-spin text-blue-500',
            isError && 'text-destructive',
            !isPending && !isError && 'text-green-500'
          )}
        />
        <Icon className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
        <p className={cn('font-medium text-sm', isError && 'text-destructive')}>
          {toolName === 'Skill' ? 'Kích hoạt Skill:' : 'Ủy quyền Agent:'}
        </p>
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 truncate flex-1">
          {name}
        </span>
        {isPending && (
          <span className="text-xs text-muted-foreground shrink-0 animate-pulse">
            Đang xử lý...
          </span>
        )}
      </div>
    </div>
  );
}
