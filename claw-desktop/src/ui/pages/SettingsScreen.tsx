// Settings Screen - Tab-based navigation
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/useSettingsStore';
import { GeneralSettingsTab } from '../features/settings/GeneralSettingsTab';
import { AISettingsTab } from '../features/settings/AISettingsTab';
import { ContextSettingsTab } from '../features/settings/ContextSettingsTab';
import { SkillsSettingsTab } from '../features/settings/SkillsSettingsTab';
import { SkillsStoreTab } from '../features/settings/SkillsStoreTab';
import { ArrowLeft, Bot, MessageSquare, Settings2, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SettingsScreenProps {
  onBack: () => void;
}

type TabType = 'general' | 'ai' | 'context' | 'skills' | 'skills-store';

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t } = useTranslation();
  const { loadSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Navigation */}
      <div className="w-52 border-r border-border/50 flex flex-col bg-background">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border/50">
          <button
            onClick={onBack}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('settings.back')}</span>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-0.5">
            <div className="px-2.5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('settings.generalCategory')}
            </div>
            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm transition-colors",
                activeTab === 'general'
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Settings2 className="w-4 h-4" />
              {t('settings.general.title', 'General')}
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={cn(
                "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm transition-colors",
                activeTab === 'ai'
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Bot className="w-4 h-4" />
              {t('settings.aiProviders')}
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={cn(
                "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm transition-colors",
                activeTab === 'context'
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              {t('settings.contextSettings')}
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={cn(
                "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm transition-colors",
                activeTab === 'skills'
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <BookOpen className="w-4 h-4" />
              {t('settings.skills.title')}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area - Only show active tab */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'skills-store' ? (
          <div className="h-full p-6">
            <SkillsStoreTab onBack={() => setActiveTab('skills')} />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-10 px-6">
            {activeTab === 'general' && <GeneralSettingsTab />}
            {activeTab === 'ai' && <AISettingsTab />}
            {activeTab === 'context' && <ContextSettingsTab />}
            {activeTab === 'skills' && <SkillsSettingsTab onBrowseStore={() => setActiveTab('skills-store')} />}
          </div>
        )}
      </div>
    </div>
  );
}
