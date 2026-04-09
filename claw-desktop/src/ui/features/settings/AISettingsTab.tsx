// AI Settings Tab - Modal-based UI
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Provider, Model } from '../../../core/entities';
import { Button } from '../../../components/ui/button';
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, Download, Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { ConfirmDeleteProviderDialog } from './ConfirmDeleteProviderDialog';
import { ProviderFormDialog } from './ProviderFormDialog';
import { ModelFormDialog } from './ModelFormDialog';
import { ModelsBrowser } from './ModelsBrowser';
import { ModelInfo, fetchModels } from './fetchModels';
import { AntigravitySetup } from './AntigravitySetup';
import { ApiKeyWarning } from './ApiKeyWarning';

export function AISettingsTab() {
  const { t } = useTranslation();
  const { settings, addProvider, updateProvider, deleteProvider, addModel, updateModel, deleteModel } = useSettingsStore();
  
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  
  // Provider dialog state
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  
  // Model dialog state
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<{ providerId: string; model: Model } | null>(null);
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);
  
  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  
  // Models browser state (generic for all providers)
  const [modelsBrowserOpen, setModelsBrowserOpen] = useState<string | null>(null);
  const [browserModels, setBrowserModels] = useState<ModelInfo[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null); // Track which provider is loading
  const [browserTitle, setBrowserTitle] = useState<string>('');
  
  // Antigravity setup state
  const [antigravitySetupOpen, setAntigravitySetupOpen] = useState<string | null>(null);

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

  const handleAddProvider = () => {
    setEditingProvider(null);
    setProviderDialogOpen(true);
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setProviderDialogOpen(true);
  };

  const handleSaveProvider = async (provider: Provider) => {
    if (editingProvider) {
      await updateProvider(provider);
    } else {
      await addProvider(provider);
    }
  };

  const handleAddModel = (providerId: string) => {
    setCurrentProviderId(providerId);
    setEditingModel(null);
    setModelDialogOpen(true);
  };

  const handleEditModel = (providerId: string, model: Model) => {
    setCurrentProviderId(providerId);
    setEditingModel({ providerId, model });
    setModelDialogOpen(true);
  };

  const handleSaveModel = async (model: Model) => {
    if (!currentProviderId) return;
    
    if (editingModel) {
      await updateModel(currentProviderId, model);
    } else {
      await addModel(currentProviderId, model);
    }
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
  
  const handleFetchProviderModels = async (provider: Provider) => {
    // Set loading state for this specific provider
    setLoadingProvider(provider.id);
    setBrowserTitle(t('modelsBrowser.title') + ` - ${provider.name}`);
    
    try {
      const models = await fetchModels(
        provider.base_url,
        provider.id,
        provider.api_key || undefined
      );
      setBrowserModels(models);
      // Only open dialog after successful fetch
      setModelsBrowserOpen(provider.id);
    } catch (error) {
      console.error('[FETCH_MODELS] Failed to fetch models:', error);
      // Don't open dialog on error
      setBrowserModels([]);
    } finally {
      setLoadingProvider(null);
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
        <Button onClick={handleAddProvider} size="sm" className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('settings.addProvider')}
        </Button>
      </div>

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
            const isOpenRouterProvider = provider.id === 'openrouter' || provider.base_url?.includes('openrouter.ai');
            const isNvidiaProvider = provider.id === 'nvidia' || provider.base_url?.includes('nvidia.com');
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
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{provider.name}</p>
                        {!provider.api_key && (
                          <div title="API key missing">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                          </div>
                        )}
                      </div>
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
                      <Pencil className="w-3.5 h-3.5" />
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

                    {/* Kilo API Key Warning */}
                    {isKiloProvider && !provider.api_key && (
                      <ApiKeyWarning
                        messageKey="kilo.apiKeyRequired"
                        linkTextKey="kilo.getYourApiKey"
                        linkUrl="https://app.kilo.ai/profile"
                        onSave={async (apiKey) => {
                          await updateProvider({ ...provider, api_key: apiKey });
                        }}
                      />
                    )}

                    {/* OpenRouter API Key Warning */}
                    {isOpenRouterProvider && !provider.api_key && (
                      <ApiKeyWarning
                        messageKey="openrouter.apiKeyRequired"
                        linkTextKey="openrouter.getYourApiKey"
                        linkUrl="https://openrouter.ai/workspaces/default/keys"
                        onSave={async (apiKey) => {
                          await updateProvider({ ...provider, api_key: apiKey });
                        }}
                      />
                    )}

                    {/* NVIDIA API Key Warning */}
                    {isNvidiaProvider && !provider.api_key && (
                      <ApiKeyWarning
                        messageKey="nvidia.apiKeyRequired"
                        linkTextKey="nvidia.getYourApiKey"
                        linkUrl="https://build.nvidia.com/settings/api-keys"
                        onSave={async (apiKey) => {
                          await updateProvider({ ...provider, api_key: apiKey });
                        }}
                      />
                    )}

                    {/* Gemini API Key Warning */}
                    {provider.id === 'gemini' && !provider.api_key && (
                      <ApiKeyWarning
                        messageKey="gemini.apiKeyRequired"
                        linkTextKey="gemini.getYourApiKey"
                        linkUrl="https://aistudio.google.com/api-keys"
                        onSave={async (apiKey) => {
                          await updateProvider({ ...provider, api_key: apiKey });
                        }}
                      />
                    )}

                    {/* Cerebras API Key Warning */}
                    {provider.id === 'cerebras' && !provider.api_key && (
                      <ApiKeyWarning
                        messageKey="cerebras.apiKeyRequired"
                        linkTextKey="cerebras.getYourApiKey"
                        linkUrl="https://cloud.cerebras.ai/platform"
                        onSave={async (apiKey) => {
                          await updateProvider({ ...provider, api_key: apiKey });
                        }}
                      />
                    )}

                    {/* Models Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium">{t('settings.models')}</p>
                        <div className="flex items-center gap-1">
                          {/* Show "Browse Models" button for Kilo and OpenRouter */}
                          {(isKiloProvider || isOpenRouterProvider) && (
                            <Button
                              onClick={() => handleFetchProviderModels(provider)}
                              size="sm"
                              variant="outline"
                              disabled={loadingProvider === provider.id}
                              className="h-6 text-xs px-2"
                            >
                              {loadingProvider === provider.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  {t('modelsBrowser.loading')}
                                </>
                              ) : (
                                <>
                                  <Download className="w-3 h-3 mr-1" />
                                  {t('settings.browseModels')}
                                </>
                              )}
                            </Button>
                          )}
                          {/* Antigravity quick add */}
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
                            onClick={() => handleAddModel(provider.id)}
                            size="sm"
                            className="h-6 text-xs px-2"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {t('settings.addModel')}
                          </Button>
                        </div>
                      </div>

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
                                  <Pencil className="w-3 h-3" />
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

      {/* Dialogs */}
      <ProviderFormDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        provider={editingProvider}
        onSave={handleSaveProvider}
      />

      <ModelFormDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        model={editingModel?.model || null}
        onSave={handleSaveModel}
      />

      {modelsBrowserOpen && (
        <ModelsBrowser
          models={browserModels}
          existingModels={settings.providers.find(p => p.id === modelsBrowserOpen)?.models || []}
          onAddModel={(model) => addModel(modelsBrowserOpen, model)}
          isOpen={true}
          onOpenChange={(open) => {
            if (!open) {
              setModelsBrowserOpen(null);
              setBrowserModels([]); // Clear cache when closing
            }
          }}
          title={browserTitle}
        />
      )}

      {antigravitySetupOpen && (
        <AntigravitySetup
          existingModels={settings.providers.find(p => p.id === antigravitySetupOpen)?.models || []}
          onAddModel={(model) => addModel(antigravitySetupOpen, model)}
          isOpen={true}
          onOpenChange={(open) => !open && setAntigravitySetupOpen(null)}
        />
      )}

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
