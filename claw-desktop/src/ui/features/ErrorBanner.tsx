// Error Banner Component
import { AlertCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store';

export function ErrorBanner() {
  const { t } = useTranslation();
  const errorMessage = useChatStore((s) => s.errorMessage);

  if (!errorMessage) return null;

  const handleDismiss = () => {
    useChatStore.setState({ errorMessage: null });
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 shadow-lg max-w-md">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
        <p className="text-sm text-red-800 dark:text-red-200 flex-1">
          {t(errorMessage)}
        </p>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
