// Model Selector - Dropdown grouped by provider
import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../../components/ui/select';
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

  const handleValueChange = async (value: string | null) => {
    if (!value) return;
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

  return (
    <Select value={selectedValue} onValueChange={handleValueChange}>
      <SelectTrigger size="sm" className="h-8 gap-2 border-border/50 bg-muted/50">
        <Bot className="h-4 w-4 text-primary shrink-0" />
        <SelectValue placeholder="Chọn mô hình">
          <span className="truncate">{getSelectedModelName()}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {settings.providers.length === 0 && (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Chưa có nhà cung cấp nào
          </div>
        )}
        
        {settings.providers.map((provider, index) => (
          <div key={provider.id}>
            {index > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel>{provider.name}</SelectLabel>
              {provider.models.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Chưa có mô hình
                </div>
              )}
              {provider.models.map((model) => (
                <SelectItem key={model.id} value={`${provider.id}:${model.id}`}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
