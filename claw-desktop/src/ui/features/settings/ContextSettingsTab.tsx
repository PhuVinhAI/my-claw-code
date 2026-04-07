// Context Settings Tab - Auto-compact configuration
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { toast } from 'sonner';
import { Slider } from '../../../components/ui/slider';
import { Button } from '../../../components/ui/button';
import { Info, Save } from 'lucide-react';

export function ContextSettingsTab() {
  const { t } = useTranslation();
  const { settings, updateCompactConfig } = useSettingsStore();
  
  const [thresholdRatio, setThresholdRatio] = useState(80);
  const [preserveMessages, setPreserveMessages] = useState(4);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings?.compact_config) {
      setThresholdRatio(Math.round(settings.compact_config.threshold_ratio * 100));
      setPreserveMessages(settings.compact_config.preserve_recent_messages);
    } else {
      // Default values nếu chưa có settings
      setThresholdRatio(80);
      setPreserveMessages(4);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateCompactConfig({
        threshold_ratio: thresholdRatio / 100,
        preserve_recent_messages: preserveMessages,
      });
      toast.success(t('common.success'));
    } catch (error) {
      console.error('Failed to save compact config:', error);
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate example values
  const exampleMaxTokens = 128000;
  const exampleThreshold = Math.round(exampleMaxTokens * (thresholdRatio / 100));

  const hasChanges = 
    thresholdRatio !== Math.round((settings?.compact_config?.threshold_ratio || 0.80) * 100) ||
    preserveMessages !== (settings?.compact_config?.preserve_recent_messages || 4);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold mb-1">{t('settings.contextSettings')}</h2>
        <p className="text-xs text-muted-foreground">{t('settings.contextSettingsDescription')}</p>
      </div>

      <div className="space-y-5">
          {/* Threshold Setting */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-medium">
                  {t('compact.settings.threshold')}
                </label>
                <span className="text-sm font-mono text-muted-foreground">
                  {thresholdRatio}%
                </span>
              </div>
              
              <Slider
                value={[thresholdRatio]}
                onValueChange={(value: number | readonly number[]) => {
                  const val = Array.isArray(value) ? value[0] : value;
                  setThresholdRatio(val);
                }}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
            </div>
            
            {/* Info box */}
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t('compact.settings.thresholdHint')}
                  </p>
                  <div className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5 mt-2">
                    <div>Ví dụ: Model {exampleMaxTokens.toLocaleString()} tokens</div>
                    <div>Ngưỡng {thresholdRatio}% = {exampleThreshold.toLocaleString()} tokens</div>
                    <div className="font-medium">→ Compact khi đạt ~{exampleThreshold.toLocaleString()} tokens</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preserve Messages Setting */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-medium">
                  {t('compact.settings.preserveMessages')}
                </label>
                <span className="text-sm font-mono text-muted-foreground">
                  {preserveMessages} {t('compact.settings.preserveMessagesUnit')}
                </span>
              </div>
              
              <Slider
                value={[preserveMessages]}
                onValueChange={(value: number | readonly number[]) => {
                  const val = Array.isArray(value) ? value[0] : value;
                  setPreserveMessages(val);
                }}
                min={2}
                max={20}
                step={1}
                className="w-full"
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              {t('compact.settings.preserveMessagesHint')}
            </p>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="pt-2">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                size="sm"
                className="h-9 text-sm gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? t('common.loading') : t('compact.settings.saveChanges')}
              </Button>
            </div>
          )}
        </div>
      </div>
  );
}
