// Settings Screen - Full-page settings with sidebar tabs
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AISettingsTab } from '../features/settings/AISettingsTab';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Bot, Palette } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SettingsScreenProps {
  onBack: () => void;
}

type Tab = 'ai' | 'appearance';

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ai');
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const tabs = [
    { id: 'ai' as Tab, label: 'Cài đặt AI', icon: Bot },
    { id: 'appearance' as Tab, label: 'Giao diện', icon: Palette },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-9 w-9 p-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-base font-semibold">Cài đặt</span>
        </div>

        {/* Tabs */}
        <div className="flex-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'ai' && <AISettingsTab />}
        {activeTab === 'appearance' && (
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Giao diện</h2>
            <p className="text-muted-foreground">Đang phát triển...</p>
          </div>
        )}
      </div>
    </div>
  );
}
