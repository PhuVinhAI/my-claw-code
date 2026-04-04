import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Sparkles, Info } from 'lucide-react';

export function CompactSettingsSection() {
  const { t } = useTranslation();
  const { settings, updateCompactConfig } = useSettingsStore();
  
  const [thresholdPercent, setThresholdPercent] = useState(
    Math.round((settings?.compact_config?.threshold_ratio || 0.80) * 100)
  );
  const [preserveMessages, setPreserveMessages] = useState(
    settings?.compact_config?.preserve_recent_messages || 4
  );

  const handleSave = async () => {
    try {
      await updateCompactConfig({
        threshold_ratio: thresholdPercent / 100,
        preserve_recent_messages: preserveMessages,
      });
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const hasChanges = 
    thresholdPercent !== Math.round((settings?.compact_config?.threshold_ratio || 0.80) * 100) ||
    preserveMessages !== (settings?.compact_config?.preserve_recent_messages || 4);

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/30">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-1">{t('compact.settings.title')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('compact.settings.description')}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Threshold */}
        <div>
          <label className="block text-xs font-medium mb-2">
            {t('compact.settings.threshold')}
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="50"
              max="95"
              step="5"
              value={thresholdPercent}
              onChange={(e) => setThresholdPercent(parseInt(e.target.value) || 80)}
              className="h-9 text-sm w-24"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <div className="flex-1 text-xs text-muted-foreground">
              {t('compact.settings.thresholdUnit')}
            </div>
          </div>
          <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {t('compact.settings.thresholdHint')}
            </p>
          </div>
        </div>

        {/* Preserve Messages */}
        <div>
          <label className="block text-xs font-medium mb-2">
            {t('compact.settings.preserveMessages')}
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="2"
              max="10"
              value={preserveMessages}
              onChange={(e) => setPreserveMessages(parseInt(e.target.value) || 4)}
              className="h-9 text-sm w-24"
            />
            <span className="text-sm text-muted-foreground">
              {t('compact.settings.preserveMessagesUnit')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {t('compact.settings.preserveMessagesHint')}
          </p>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-2">
            <Button onClick={handleSave} size="sm" className="h-8 text-xs">
              {t('compact.settings.saveChanges')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
