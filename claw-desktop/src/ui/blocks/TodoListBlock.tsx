// TodoListBlock Component - Hiển thị TodoWrite tool output
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TodoWriteOutput {
  oldTodos?: TodoItem[];
  newTodos: TodoItem[];
  verificationNudgeNeeded?: boolean;
}

interface TodoListBlockProps {
  output: TodoWriteOutput;
}

export function TodoListBlock({ output }: TodoListBlockProps) {
  const { t } = useTranslation();
  const { newTodos = [], verificationNudgeNeeded } = output;

  if (!Array.isArray(newTodos) || newTodos.length === 0) {
    return (
      <div className="bg-muted/40 dark:bg-muted/20 rounded-lg p-2.5 sm:p-3 border w-full">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          <span className="font-semibold text-xs sm:text-sm">{t('todoList.empty')}</span>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return CheckCircle2;
      case 'in_progress':
        return Clock;
      case 'pending':
        return Circle;
    }
  };

  const getStatusColor = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'in_progress':
        return 'text-blue-500';
      case 'pending':
        return 'text-muted-foreground';
    }
  };

  const getStatusLabel = (status: TodoItem['status']) => {
    return t(`todoList.${status === 'completed' ? 'completed' : status === 'in_progress' ? 'inProgress' : 'pending'}`);
  };

  return (
    <div className="bg-muted/40 dark:bg-muted/20 rounded-lg p-2.5 sm:p-3 border w-full space-y-2 sm:space-y-3">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
        <span className="font-semibold text-xs sm:text-sm">{t('todoList.title')}</span>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {newTodos.map((todo, idx) => {
          const StatusIcon = getStatusIcon(todo.status);
          const statusColor = getStatusColor(todo.status);

          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2 sm:gap-2.5 p-1.5 sm:p-2 rounded-md transition-colors',
                'hover:bg-muted/60 dark:hover:bg-muted/30'
              )}
            >
              <StatusIcon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 mt-0.5', statusColor)} />
              <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                <p
                  className={cn(
                    'text-xs sm:text-sm',
                    todo.status === 'completed' && 'line-through text-muted-foreground'
                  )}
                >
                  {todo.content}
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md font-medium',
                      todo.status === 'completed' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                      todo.status === 'in_progress' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                      todo.status === 'pending' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {getStatusLabel(todo.status)}
                  </span>
                  <span className="text-muted-foreground">{todo.activeForm}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {verificationNudgeNeeded && (
        <div className="flex items-start gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300">
            {t('todoList.verificationHint')}
          </p>
        </div>
      )}
    </div>
  );
}
