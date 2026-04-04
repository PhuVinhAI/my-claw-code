// Model Selector - Dropdown grouped by provider using CustomDropdown
import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { CustomDropdown, DropdownOption } from '../../components/ui/custom-dropdown';
import { Bot } from 'lucide-react';

export function ModelSelector() {
  const { settings, loadSettings, setSelectedModel } = useSettingsStore();
  const [selectedValue, setSelectedValue] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings?.selected_model) {
      setSelectedValue(`${settings.selected_model.provider_id}:${settings.selected_model.model_id}`);
    }
  }, [settings]);

  if (!settings) return null;

  const handleValueChange = async (value: string | string[]) => {
    if (typeof value !== 'string') return;
    const [providerId, modelId] = value.split(':');
    try {
      await setSelectedModel(providerId, modelId);
      setSelectedValue(value);
    } catch (error) {
      console.error('Failed to set selected model:', error);
    }
  };

  const getSelectedModelName = () => {
    if (!settings.selected_model) return 'Chọn mô hình';
    
    const provider = settings.providers.find(p => p.id === settings.selected_model?.provider_id);
    const model = provider?.models.find(m => m.id === settings.selected_model?.model_id);
    
    return model?.name || 'Chọn mô hình';
  };

  const options: DropdownOption[] = settings.providers
    .filter(provider => provider.api_key && provider.api_key.trim() !== '')
    .flatMap((provider) =>
      provider.models.map((model) => ({
        id: `${provider.id}:${model.id}`,
        label: model.name,
        group: provider.name,
      }))
    );

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-muted-foreground bg-muted/50">
        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span>Chưa có mô hình</span>
      </div>
    );
  }

  return (
    <CustomDropdown
      trigger={
        <>
          <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="truncate min-w-0 flex-1 text-left text-xs sm:text-sm" title={getSelectedModelName()}>
            {getSelectedModelName()}
          </span>
        </>
      }
      options={options}
      value={selectedValue}
      onChange={handleValueChange}
      dropdownClassName="max-h-[350px] sm:max-h-[400px] overflow-y-auto"
    />
  );
}
