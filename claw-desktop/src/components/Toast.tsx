// Toast Component - VS Code style notifications
import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  };

  const bgColors = {
    error: 'bg-red-900/90 border-red-700',
    success: 'bg-green-900/90 border-green-700',
    info: 'bg-blue-900/90 border-blue-700',
    warning: 'bg-yellow-900/90 border-yellow-700',
  };

  // Translate message if it's a translation key
  const displayMessage = message.startsWith('errors.') || message.startsWith('success.') 
    ? t(message) 
    : message;

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-md border
        ${bgColors[type]}
        shadow-lg backdrop-blur-sm
        animate-in slide-in-from-right-5 fade-in
        min-w-[300px] max-w-[500px]
      `}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1 text-sm text-gray-100 break-words">{displayMessage}</div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
