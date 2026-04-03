// Settings Screen - Styled like SessionList
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AISettingsTab } from '../features/settings/AISettingsTab';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t } = useTranslation();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - styled like SessionList header */}
      <div className="shrink-0 flex flex-col gap-4 px-6 pt-5 pb-3 border-b border-border/50 bg-background">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={t('settings.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('settings.title')}
            </span>
          </div>
        </div>
      </div>

      {/* Content - with padding like SessionList body */}
      <div className="flex-1 overflow-hidden">
        <AISettingsTab />
      </div>
    </div>
  );
}
