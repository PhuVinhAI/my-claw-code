// Toast Component - App style notifications
import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // milliseconds, 0 = no auto-dismiss
  onClose: (id: string) => void;
}

export function Toast({ id, type, message, duration = 5000, onClose }: ToastProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    error: <AlertCircle className="w-4 h-4" />,
    success: <CheckCircle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
  };

  const styles = {
    error: 'bg-red-950/90 border-red-800/50 text-red-200',
    success: 'bg-emerald-950/90 border-emerald-800/50 text-emerald-200',
    info: 'bg-blue-950/90 border-blue-800/50 text-blue-200',
    warning: 'bg-yellow-950/90 border-yellow-800/50 text-yellow-200',
  };

  const iconStyles = {
    error: 'text-red-400',
    success: 'text-emerald-400',
    info: 'text-blue-400',
    warning: 'text-yellow-400',
  };

  // Translate message if it's a translation key
  const displayMessage = message.startsWith('errors.') || message.startsWith('success.') 
    ? t(message) 
    : message;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border backdrop-blur-sm shadow-lg',
        'animate-in slide-in-from-right-5 fade-in duration-200',
        'min-w-[300px] max-w-[500px]',
        styles[type]
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', iconStyles[type])}>
        {icons[type]}
      </div>
      <div className="flex-1 text-sm break-words leading-relaxed min-w-0">
        {displayMessage}
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-current/60 hover:text-current transition-colors rounded-sm hover:bg-white/10 p-0.5 self-start"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
