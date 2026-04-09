// TodoListBlock Component - Hiển thị TodoWrite tool output
import { CheckCircle2, Circle, Clock } from 'lucide-react';
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
  const { newTodos = [] } = output;

  if (!Array.isArray(newTodos) || newTodos.length === 0) {
    return (
      <div className="bg-muted/40 dark:bg-muted/20 rounded-lg p-2 border w-full">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-xs">{t('todoList.empty')}</span>
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
    <div className="bg-muted/40 dark:bg-muted/20 rounded-lg p-2 border w-full space-y-2">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-blue-500" />
        <span className="font-semibold text-xs">{t('todoList.title')}</span>
      </div>

      <div className="space-y-1.5">
        {newTodos.map((todo, idx) => {
          const StatusIcon = getStatusIcon(todo.status);
          const statusColor = getStatusColor(todo.status);

          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2 p-1.5 rounded-md transition-colors',
                'hover:bg-muted/60 dark:hover:bg-muted/30'
              )}
            >
              <StatusIcon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', statusColor)} />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p
                  className={cn(
                    'text-xs',
                    todo.status === 'completed' && 'line-through text-muted-foreground'
                  )}
                >
                  {todo.content}
                </p>
                <div className="flex items-center gap-1.5 text-[10px]">
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

    </div>
  );
}
