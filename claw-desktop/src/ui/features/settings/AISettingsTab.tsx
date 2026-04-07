// AI Settings Tab - Simple list layout
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Provider, Model } from '../../../core/entities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Trash2, X, Check, ChevronDown, ChevronRight, Eye, EyeOff, Download, Loader2, BarChart3 } from 'lucide-react';
import { ConfirmDeleteProviderDialog } from './ConfirmDeleteProviderDialog';
import { KiloModelsBrowser, KiloModel } from './KiloModelsBrowser';
import { fetchKiloModels } from './fetchKiloModels';
import { AntigravitySetup } from './AntigravitySetup';
import { cn } from '../../../lib/utils';

export function AISettingsTab() {
  const { t } = useTranslation();
  const { settings, addProvider, updateProvider, deleteProvider, addModel, updateModel, deleteModel } = useSettingsStore();
  
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showAddModel, setShowAddModel] = useState<string | null>(null); // provider ID
  const [editingModel, setEditingModel] = useState<{ providerId: string; model: Model } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  
  // Kilo browser state
  const [kiloBrowserOpen, setKiloBrowserOpen] = useState<string | null>(null);
  const [kiloModels, setKiloModels] = useState<KiloModel[]>([]);
  const [kiloLoading, setKiloLoading] = useState(false);
  
  // Antigravity setup state
  const [antigravitySetupOpen, setAntigravitySetupOpen] = useState<string | null>(null);

  // Provider form state
  const [providerForm, setProviderForm] = useState<Partial<Provider>>({
    id: '',
    name: '',
    api_key: '',
    base_url: '',
    models: [],
  });

  // Model form state
  const [modelForm, setModelForm] = useState<Partial<Model>>({ id: '', name: '' });
  
  // Show/hide API key
  const [showApiKey, setShowApiKey] = useState(false);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  const toggleProvider = (providerId: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(providerId)) {
      newExpanded.delete(providerId);
    } else {
      newExpanded.add(providerId);
    }
    setExpandedProviders(newExpanded);
  };

  const handleSaveProvider = async () => {
    if (!providerForm.id || !providerForm.name || !providerForm.api_key || !providerForm.base_url) {
      alert(t('settings.fillAllFields'));
      return;
    }

    try {
      if (editingProvider) {
        await updateProvider(providerForm as Provider);
      } else {
        await addProvider(providerForm as Provider);
      }
      setProviderForm({ id: '', name: '', api_key: '', base_url: '', models: [] });
      setShowProviderForm(false);
      setEditingProvider(null);
    } catch (error) {
      alert(`${t('common.error')}: ${error}`);
    }
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setProviderForm(provider);
    setShowProviderForm(true);
  };

  const handleCancelProviderForm = () => {
    setShowProviderForm(false);
    setEditingProvider(null);
    setProviderForm({ id: '', name: '', api_key: '', base_url: '', models: [] });
    setShowApiKey(false);
  };

  const handleSaveModel = async () => {
    if (!modelForm.id || !modelForm.name) {
      alert(t('settings.fillAllFields'));
      return;
    }

    const providerId = editingModel?.providerId || showAddModel;
    if (!providerId) return;

    try {
      if (editingModel) {
        await updateModel(providerId, modelForm as Model);
      } else {
        await addModel(providerId, modelForm as Model);
      }
      setModelForm({ id: '', name: '' });
      setShowAddModel(null);
      setEditingModel(null);
    } catch (error) {
      alert(`${t('common.error')}: ${error}`);
    }
  };

  const handleEditModel = (providerId: string, model: Model) => {
    setEditingModel({ providerId, model });
    setModelForm(model);
    setShowAddModel(providerId);
  };

  const handleCancelModelForm = () => {
    setShowAddModel(null);
    setEditingModel(null);
    setModelForm({ id: '', name: '' });
  };

  const handleDeleteProvider = async (providerId: string) => {
    const provider = settings.providers.find((p) => p.id === providerId);
    if (!provider) return;
    
    setProviderToDelete(provider);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteProvider = async () => {
    if (!providerToDelete) return;
    
    try {
      await deleteProvider(providerToDelete.id);
      setProviderToDelete(null);
    } catch (error) {
      alert(`${t('common.error')}: ${error}`);
    }
  };

  const handleDeleteModel = async (providerId: string, modelId: string) => {
    if (!confirm(t('settings.confirmDeleteModel'))) return;
    try {
      await deleteModel(providerId, modelId);
    } catch (error) {
      alert(`${t('common.error')}: ${error}`);
    }
  };
  
  const handleFetchKiloModels = async (providerId: string) => {
    if (kiloModels.length > 0) {
      setKiloBrowserOpen(providerId);
      return;
    }
    
    setKiloLoading(true);
    try {
      const models = await fetchKiloModels();
      setKiloModels(models);
      setKiloBrowserOpen(providerId);
    } catch (error) {
      alert(`${t('kiloModelsBrowser.loadError')}: ${error}`);
    } finally {
      setKiloLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">{t('settings.aiProviders')}</h2>
          <p className="text-xs text-muted-foreground">{t('settings.aiProvidersDescription')}</p>
        </div>
        <Button onClick={() => setShowProviderForm(true)} size="sm" className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('settings.addProvider')}
        </Button>
      </div>

      {/* Provider Form */}
      {showProviderForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {editingProvider ? t('settings.editProvider') : t('settings.addProvider')}
            </h3>
            <button
              onClick={handleCancelProviderForm}
              className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">{t('settings.providerId')}</label>
                <Input
                  value={providerForm.id}
                  onChange={(e) => setProviderForm({ ...providerForm, id: e.target.value })}
                  placeholder="openai"
                  className="h-8 text-xs"
                  disabled={!!editingProvider}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">{t('settings.providerName')}</label>
                <Input
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  placeholder="OpenAI"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">{t('settings.apiKey')}</label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="h-8 text-xs font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">{t('settings.baseUrl')}</label>
              <Input
                value={providerForm.base_url}
                onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveProvider} size="sm" className="h-7 text-xs">
                <Check className="w-3 h-3 mr-1" />
                {editingProvider ? t('common.save') : t('settings.addProvider')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelProviderForm} className="h-7 text-xs">
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Providers List */}
      <div className="space-y-2">
        {settings.providers.length === 0 ? (
          <div className="text-center py-12 rounded-lg border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">{t('settings.noProviders')}</p>
          </div>
        ) : (
          settings.providers.map((provider) => {
            const isExpanded = expandedProviders.has(provider.id);
            const isKiloProvider = provider.id === 'kilo' || provider.base_url?.includes('kilo.ai');
            const isAntigravityProvider = provider.id === 'antigravity' || provider.base_url?.includes('localhost:8080');
            
            return (
              <div key={provider.id} className="rounded-lg border border-border bg-card">
                {/* Provider Header */}
                <div className="flex items-center justify-between p-3">
                  <button
                    onClick={() => toggleProvider(provider.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{provider.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{provider.models.length} {t('settings.models')}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditProvider(provider)}
                      className="h-7 w-7 p-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Provider Details (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-3">
                    {/* Base URL */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('settings.baseUrl')}</p>
                      <p className="text-xs font-mono truncate">{provider.base_url}</p>
                    </div>

                    {/* Models Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium">{t('settings.models')}</p>
                        <div className="flex items-center gap-1">
                          {isKiloProvider && (
                            <Button
                              onClick={() => handleFetchKiloModels(provider.id)}
                              size="sm"
                              variant="outline"
                              disabled={kiloLoading}
                              className="h-6 text-xs px-2"
                            >
                              {kiloLoading ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  {t('kiloModelsBrowser.loading')}
                                </>
                              ) : (
                                <>
                                  <Download className="w-3 h-3 mr-1" />
                                  Kilo
                                </>
                              )}
                            </Button>
                          )}
                          {isAntigravityProvider && (
                            <Button
                              onClick={() => setAntigravitySetupOpen(provider.id)}
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs px-2"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Quick Add
                            </Button>
                          )}
                          <Button
                            onClick={() => setShowAddModel(provider.id)}
                            size="sm"
                            className="h-6 text-xs px-2"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {t('settings.addModel')}
                          </Button>
                        </div>
                      </div>

                      {/* Kilo Browser */}
                      {isKiloProvider && kiloBrowserOpen === provider.id && (
                        <KiloModelsBrowser
                          models={kiloModels}
                          existingModels={provider.models}
                          onAddModel={(model) => addModel(provider.id, model)}
                          isOpen={true}
                          onOpenChange={(open) => !open && setKiloBrowserOpen(null)}
                        />
                      )}

                      {/* Antigravity Setup */}
                      {isAntigravityProvider && antigravitySetupOpen === provider.id && (
                        <AntigravitySetup
                          existingModels={provider.models}
                          onAddModel={(model) => addModel(provider.id, model)}
                          isOpen={true}
                          onOpenChange={(open) => !open && setAntigravitySetupOpen(null)}
                        />
                      )}

                      {/* Add/Edit Model Form */}
                      {showAddModel === provider.id && (
                        <div className="mb-3 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium">
                              {editingModel ? t('settings.editModel') : t('settings.addModel')}
                            </p>
                            <button
                              onClick={handleCancelModelForm}
                              className="flex items-center justify-center h-5 w-5 rounded-md hover:bg-muted"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium mb-1">{t('settings.modelId')}</label>
                                <Input
                                  value={modelForm.id}
                                  onChange={(e) => setModelForm({ ...modelForm, id: e.target.value })}
                                  placeholder="gpt-4"
                                  className="h-7 text-xs font-mono"
                                  disabled={!!editingModel}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">{t('settings.modelName')}</label>
                                <Input
                                  value={modelForm.name}
                                  onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                                  placeholder="GPT-4"
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1">{t('settings.maxContext')}</label>
                              <Input
                                type="number"
                                value={modelForm.max_context || ''}
                                onChange={(e) => setModelForm({ ...modelForm, max_context: e.target.value ? parseInt(e.target.value) : undefined })}
                                placeholder="128000"
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleSaveModel} size="sm" className="h-6 text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                {editingModel ? t('common.save') : t('settings.addModel')}
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleCancelModelForm} className="h-6 text-xs">
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Models List */}
                      {provider.models.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">{t('settings.noModels')}</p>
                      ) : (
                        <div className="space-y-1">
                          {provider.models.map((model) => (
                            <div
                              key={model.id}
                              className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{model.name}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground font-mono truncate">{model.id}</p>
                                  {model.max_context && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <BarChart3 className="w-3 h-3" />
                                      {(model.max_context / 1000).toFixed(0)}K
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditModel(provider.id, model)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteModel(provider.id, model.id)}
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirm Delete Dialog */}
      {providerToDelete && (
        <ConfirmDeleteProviderDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          providerName={providerToDelete.name}
          modelCount={providerToDelete.models.length}
          onConfirm={confirmDeleteProvider}
        />
      )}
    </div>
  );
}
