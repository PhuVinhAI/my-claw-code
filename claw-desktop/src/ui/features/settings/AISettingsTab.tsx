// AI Settings Tab - Sidebar + Content layout
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Provider, Model } from '../../../core/entities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Trash2, X, Check, Bot, Sparkles, AlertCircle, Pencil, Eye, EyeOff, Download, Loader2 } from 'lucide-react';
import { ConfirmDeleteProviderDialog } from './ConfirmDeleteProviderDialog';
import { KiloModelsBrowser, KiloModel } from './KiloModelsBrowser';
import { fetchKiloModels } from './fetchKiloModels';
import { cn } from '../../../lib/utils';

export function AISettingsTab() {
  const { t } = useTranslation();
  const { settings, addProvider, updateProvider, deleteProvider, addModel, updateModel, deleteModel } = useSettingsStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    settings?.providers[0]?.id || null
  );
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  
  // Kilo browser state
  const [kiloBrowserOpen, setKiloBrowserOpen] = useState(false);
  const [kiloModels, setKiloModels] = useState<KiloModel[]>([]);
  const [kiloLoading, setKiloLoading] = useState(false);

  // Provider form state (for both add and edit)
  const [providerForm, setProviderForm] = useState<Partial<Provider>>({
    id: '',
    name: '',
    api_key: '',
    base_url: '',
    models: [],
  });

  // Model form state (for both add and edit)
  const [modelForm, setModelForm] = useState<Partial<Model>>({ id: '', name: '' });
  
  // Show/hide API key
  const [showApiKey, setShowApiKey] = useState(false);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm sm:text-base text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  const selectedProvider = settings.providers.find((p) => p.id === selectedProviderId);

  const handleSaveProvider = async () => {
    if (!providerForm.id || !providerForm.name || !providerForm.api_key || !providerForm.base_url) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      if (editingProvider) {
        await updateProvider(providerForm as Provider);
      } else {
        await addProvider(providerForm as Provider);
        setSelectedProviderId(providerForm.id!);
      }
      setProviderForm({ id: '', name: '', api_key: '', base_url: '', models: [] });
      setShowProviderForm(false);
      setEditingProvider(null);
    } catch (error) {
      alert(`Lỗi: ${error}`);
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
    if (!modelForm.id || !modelForm.name || !selectedProviderId) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      if (editingModel) {
        await updateModel(selectedProviderId, modelForm as Model);
      } else {
        await addModel(selectedProviderId, modelForm as Model);
      }
      setModelForm({ id: '', name: '' });
      setShowAddModel(false);
      setEditingModel(null);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleEditModel = (model: Model) => {
    setEditingModel(model);
    setModelForm(model);
    setShowAddModel(true);
  };

  const handleCancelModelForm = () => {
    setShowAddModel(false);
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
      if (selectedProviderId === providerToDelete.id) {
        setSelectedProviderId(settings.providers[0]?.id || null);
      }
      setProviderToDelete(null);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleDeleteModel = async (providerId: string, modelId: string) => {
    if (!confirm('Bạn có chắc muốn xóa mô hình này?')) return;
    try {
      await deleteModel(providerId, modelId);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };
  
  const handleFetchKiloModels = async () => {
    if (kiloModels.length > 0) {
      // Already fetched, just open
      setKiloBrowserOpen(true);
      return;
    }
    
    setKiloLoading(true);
    try {
      const models = await fetchKiloModels();
      setKiloModels(models);
      setKiloBrowserOpen(true);
    } catch (error) {
      alert(`Không thể tải models: ${error}`);
    } finally {
      setKiloLoading(false);
    }
  };

  const isKiloProvider = selectedProvider?.id === 'kilo' || selectedProvider?.base_url?.includes('kilo.ai');

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar - Providers List - responsive width */}
      <div className="w-56 sm:w-60 lg:w-64 border-r border-border flex flex-col bg-background">
        {/* Sidebar Header */}
        <div className="px-2 sm:px-3 pt-3 sm:pt-4 pb-2 sm:pb-3 border-b border-border/50 bg-background">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nhà cung cấp
            </span>
            <button
              onClick={() => setShowProviderForm(true)}
              className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Thêm nhà cung cấp"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Providers List */}
        <div className="flex-1 overflow-y-auto px-1.5 sm:px-2 py-2 sm:py-3">
          {settings.providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[70%] px-3 sm:px-4 text-center">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border bg-muted/30 mb-3 sm:mb-4">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-foreground">Chưa có provider</p>
              <p className="text-xs text-muted-foreground mt-1 sm:mt-1.5 max-w-[160px] sm:max-w-[180px] leading-relaxed">
                Thêm API provider để bắt đầu
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {settings.providers.map((provider) => (
                <div
                  key={provider.id}
                  className={cn(
                    "group relative rounded-lg transition-all",
                    selectedProviderId === provider.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <button
                    onClick={() => setSelectedProviderId(provider.id)}
                    className="w-full text-left px-2 sm:px-3 py-2 sm:py-2.5"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div
                        className={cn(
                          "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-md shrink-0",
                          "bg-primary/10"
                        )}
                      >
                        <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium text-xs sm:text-sm truncate",
                          selectedProviderId === provider.id && "text-foreground"
                        )}>
                          {provider.name}
                        </p>
                        <p className="text-xs truncate text-muted-foreground">
                          {provider.models.length} mô hình
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProvider(provider.id);
                    }}
                    className={cn(
                      "absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-md transition-all",
                      "opacity-0 group-hover:opacity-100 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                    )}
                    title="Xóa"
                  >
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-background">
        {showProviderForm ? (
          /* Provider Form (Add/Edit) */
          <div className="p-4 sm:p-5 lg:p-6 max-w-xl lg:max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-5 lg:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-0.5 sm:mb-1">
                  {editingProvider ? 'Chỉnh sửa provider' : 'Thêm provider mới'}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {editingProvider ? 'Cập nhật thông tin API' : 'Nhập thông tin API provider'}
                </p>
              </div>
              <button
                onClick={handleCancelProviderForm}
                className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">ID</label>
                  <Input
                    value={providerForm.id}
                    onChange={(e) => setProviderForm({ ...providerForm, id: e.target.value })}
                    placeholder="openai"
                    className="h-9 sm:h-10 text-sm"
                    disabled={!!editingProvider}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Tên</label>
                  <Input
                    value={providerForm.name}
                    onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                    placeholder="OpenAI"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">API Key</label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={providerForm.api_key}
                    onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                    placeholder="sk-..."
                    className="h-9 sm:h-10 text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Base URL</label>
                <Input
                  value={providerForm.base_url}
                  onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="h-9 sm:h-10 text-sm font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2 sm:pt-4">
                <Button onClick={handleSaveProvider} size="sm" className="h-8 sm:h-9 text-sm">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {editingProvider ? 'Cập nhật' : 'Lưu'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancelProviderForm} className="h-8 sm:h-9 text-sm">
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        ) : showAddModel && selectedProvider ? (
          /* Add/Edit Model Form */
          <div className="p-4 sm:p-5 lg:p-6 max-w-xl lg:max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-5 lg:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-0.5 sm:mb-1">
                  {editingModel ? 'Chỉnh sửa mô hình' : 'Thêm mô hình'}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {editingModel ? 'Cập nhật thông tin' : `Cho ${selectedProvider.name}`}
                </p>
              </div>
              <button
                onClick={handleCancelModelForm}
                className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">ID</label>
                  <Input
                    value={modelForm.id}
                    onChange={(e) => setModelForm({ ...modelForm, id: e.target.value })}
                    placeholder="gpt-4"
                    className="h-9 sm:h-10 text-sm font-mono"
                    disabled={!!editingModel}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Tên</label>
                  <Input
                    value={modelForm.name}
                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                    placeholder="GPT-4"
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 sm:pt-4">
                <Button onClick={handleSaveModel} size="sm" className="h-8 sm:h-9 text-sm">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {editingModel ? 'Cập nhật' : 'Lưu'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancelModelForm} className="h-8 sm:h-9 text-sm">
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        ) : selectedProvider ? (
          /* Provider Details */
          <div className="p-4 sm:p-5 lg:p-6 max-w-2xl lg:max-w-3xl mx-auto">
            {/* Provider Header */}
            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-5 lg:mb-6 pb-4 sm:pb-5 border-b border-border">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1 gap-2">
                  <h2 className="text-lg sm:text-xl font-semibold truncate">{selectedProvider.name}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProvider(selectedProvider)}
                    className="h-7 sm:h-8 text-xs sm:text-sm shrink-0"
                  >
                    <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                    Sửa
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-mono mb-2 truncate">
                  {selectedProvider.base_url}
                </p>

                {/* API Key Status */}
                {(!selectedProvider.api_key || selectedProvider.api_key.trim() === '') ? (
                  <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800">
                    <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-500" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Chưa có API key
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-green-100 dark:bg-green-950/30 border border-green-300 dark:border-green-800">
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600 dark:text-green-500" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Đã cấu hình
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Models Section */}
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-0.5">Mô hình</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedProvider.models.length} mô hình
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isKiloProvider && (
                    <Button 
                      onClick={handleFetchKiloModels}
                      size="sm" 
                      variant="outline"
                      disabled={kiloLoading}
                      className="h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      {kiloLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 animate-spin" />
                          {t('kiloModelsBrowser.loading')}
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                          {t('kiloModelsBrowser.loadFromKilo')}
                        </>
                      )}
                    </Button>
                  )}
                  <Button onClick={() => setShowAddModel(true)} size="sm" className="h-8 sm:h-9 text-xs sm:text-sm">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                    Thêm
                  </Button>
                </div>
              </div>

              {/* Kilo Models Browser (inline) - Hiện ở dưới header, trước danh sách models */}
              {isKiloProvider && (
                <KiloModelsBrowser
                  models={kiloModels}
                  existingModels={selectedProvider.models}
                  onAddModel={(model) => addModel(selectedProvider.id, model)}
                  isOpen={kiloBrowserOpen}
                  onOpenChange={setKiloBrowserOpen}
                />
              )}

              {/* Models List */}
              {selectedProvider.models.length === 0 ? (
                <div className="text-center py-10 sm:py-12 px-4 sm:px-6 rounded-lg border-2 border-dashed border-border">
                  <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted mb-2 sm:mb-3">
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Chưa có mô hình</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedProvider.models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="font-medium text-xs sm:text-sm truncate">{model.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{model.id}</p>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModel(model)}
                          className="hover:bg-muted h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(selectedProvider.id, model.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted mb-2 sm:mb-3">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Chọn provider</p>
            </div>
          </div>
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
