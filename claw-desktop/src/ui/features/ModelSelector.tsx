// Model Selector - Dropdown grouped by provider using CustomDropdown
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/useSettingsStore';
import { CustomDropdown, DropdownOption } from '../../components/ui/custom-dropdown';
import { Bot } from 'lucide-react';

export function ModelSelector() {
  const { t } = useTranslation();
  const { settings, loadSettings, setSelectedModel } = useSettingsStore();
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

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
    
    // Split only at FIRST colon to separate provider:modelId
    // This preserves model IDs like "qwen/qwen3.6-plus:free"
    const colonIndex = value.indexOf(':');
    if (colonIndex === -1) return;
    
    const providerId = value.substring(0, colonIndex);
    const modelId = value.substring(colonIndex + 1); // Keep everything after first colon
    
    console.log('[ModelSelector] Setting model:', { providerId, modelId });
    
    try {
      await setSelectedModel(providerId, modelId);
      setSelectedValue(value);
    } catch (error) {
      console.error('Failed to set selected model:', error);
    }
  };

  const getSelectedModelName = () => {
    if (!settings.selected_model) return t('modelSelector.selectModel');
    
    const provider = settings.providers.find(p => p.id === settings.selected_model?.provider_id);
    const model = provider?.models.find(m => m.id === settings.selected_model?.model_id);
    
    if (!model) return t('modelSelector.selectModel');
    
    // Remove provider prefix from model name (e.g., "Qwen: Qwen3.6 Plus" -> "Qwen3.6 Plus")
    let displayName = model.name;
    const colonIndex = displayName.indexOf(':');
    if (colonIndex !== -1) {
      displayName = displayName.substring(colonIndex + 1).trim();
    }
    
    // Truncate if too long (max 20 chars for compact display)
    if (displayName.length > 20) {
      displayName = displayName.substring(0, 17) + '...';
    }
    
    return displayName;
  };

  const options: DropdownOption[] = settings.providers
    .filter(provider => provider.api_key && provider.api_key.trim() !== '')
    .flatMap((provider) =>
      provider.models.map((model) => ({
        id: `${provider.id}:${model.id}`,
        label: model.name,
        group: provider.name,
        providerId: provider.id, // Add provider ID for filtering
      }))
    );

  // Get unique providers for filter buttons
  const availableProviders = Array.from(
    new Set(
      settings.providers
        .filter(p => p.api_key && p.api_key.trim() !== '')
        .map(p => ({ id: p.id, name: p.name }))
    )
  );

  // Filter options based on search term AND selected providers
  const filteredOptions = options.filter(option => {
    // Search filter
    const matchesSearch = searchTerm.trim() === '' ||
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.group?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Provider filter
    const matchesProvider = selectedProviders.length === 0 ||
      selectedProviders.includes((option as any).providerId);
    
    return matchesSearch && matchesProvider;
  });

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-muted-foreground bg-muted/50">
        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span>{t('modelSelector.noModels')}</span>
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
      options={filteredOptions}
      value={selectedValue}
      onChange={handleValueChange}
      dropdownClassName="max-h-[350px] sm:max-h-[400px] overflow-y-auto"
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('modelSelector.searchPlaceholder')}
      providers={availableProviders}
      selectedProviders={selectedProviders}
      onProviderFilterChange={setSelectedProviders}
      filterByProviderLabel={t('modelSelector.filterByProvider')}
      noModelsFoundLabel={t('modelSelector.noModelsFound')}
    />
  );
}
