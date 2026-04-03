// Settings Screen - Inline settings without sidebar
import { useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AISettingsTab } from '../features/settings/AISettingsTab';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-6 border-b border-border/50">
        <button
          onClick={onBack}
          className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-base font-semibold">Cài đặt</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AISettingsTab />
      </div>
    </div>
  );
}
