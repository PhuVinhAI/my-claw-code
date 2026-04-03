// AI Settings Tab - Sidebar + Content layout
import { useState } from 'react';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Provider, Model } from '../../../core/entities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Trash2, X, Check, Bot, Sparkles } from 'lucide-react';
import { ConfirmDeleteProviderDialog } from './ConfirmDeleteProviderDialog';

export function AISettingsTab() {
  const { settings, addProvider, deleteProvider, addModel, deleteModel, setSelectedModel } = useSettingsStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    settings?.providers[0]?.id || null
  );
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);

  // New provider form state
  const [newProvider, setNewProvider] = useState<Partial<Provider>>({
    id: '',
    name: '',
    api_key: '',
    base_url: '',
    models: [],
  });

  // New model form state
  const [newModel, setNewModel] = useState<Partial<Model>>({ id: '', name: '' });

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  const selectedProvider = settings.providers.find((p) => p.id === selectedProviderId);

  const handleAddProvider = async () => {
    if (!newProvider.id || !newProvider.name || !newProvider.api_key || !newProvider.base_url) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      await addProvider(newProvider as Provider);
      setNewProvider({ id: '', name: '', api_key: '', base_url: '', models: [] });
      setShowAddProvider(false);
      setSelectedProviderId(newProvider.id!);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleAddModel = async () => {
    if (!newModel.id || !newModel.name || !selectedProviderId) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      await addModel(selectedProviderId, newModel as Model);
      setNewModel({ id: '', name: '' });
      setShowAddModel(false);
    } catch (error) {
      alert(`Lỗi: ${error}`);
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

  const handleSelectModel = async (providerId: string, modelId: string) => {
    try {
      await setSelectedModel(providerId, modelId);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const isSelected = (providerId: string, modelId: string) => {
    return (
      settings.selected_model?.provider_id === providerId &&
      settings.selected_model?.model_id === modelId
    );
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Providers List */}
      <div className="w-72 border-r border-border flex flex-col bg-muted/20">
        {/* Sidebar Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Nhà cung cấp</h3>
            <button
              onClick={() => setShowAddProvider(true)}
              className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              title="Thêm nhà cung cấp"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Quản lý các API provider
          </p>
        </div>

        {/* Providers List */}
        <div className="flex-1 overflow-y-auto p-3">
          {settings.providers.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-3">
                <Bot className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Chưa có nhà cung cấp</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {settings.providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`group relative rounded-lg transition-all ${
                    selectedProviderId === provider.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-muted'
                  }`}
                >
                  <button
                    onClick={() => setSelectedProviderId(provider.id)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                          selectedProviderId === provider.id
                            ? 'bg-primary-foreground/10'
                            : 'bg-primary/10'
                        }`}
                      >
                        <Bot
                          className={`w-5 h-5 ${
                            selectedProviderId === provider.id ? 'text-primary-foreground' : 'text-primary'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{provider.name}</p>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            selectedProviderId === provider.id
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {provider.models.length} mô hình
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Delete button - show on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProvider(provider.id);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-md transition-all ${
                      selectedProviderId === provider.id
                        ? 'opacity-0 group-hover:opacity-100 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground'
                        : 'opacity-0 group-hover:opacity-100 bg-destructive/10 hover:bg-destructive/20 text-destructive'
                    }`}
                    title="Xóa nhà cung cấp"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {showAddProvider ? (
          /* Add Provider Form */
          <div className="p-10 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2">Thêm nhà cung cấp mới</h2>
                <p className="text-muted-foreground text-lg">Nhập thông tin API của nhà cung cấp AI</p>
              </div>
              <button
                onClick={() => {
                  setShowAddProvider(false);
                  setNewProvider({ id: '', name: '', api_key: '', base_url: '', models: [] });
                }}
                className="flex items-center justify-center h-11 w-11 rounded-xl hover:bg-muted transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-7">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-base font-medium mb-3">ID nhà cung cấp</label>
                  <Input
                    value={newProvider.id}
                    onChange={(e) => setNewProvider({ ...newProvider, id: e.target.value })}
                    placeholder="openai"
                    className="h-12 text-base"
                  />
                </div>

                <div>
                  <label className="block text-base font-medium mb-3">Tên hiển thị</label>
                  <Input
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    placeholder="OpenAI"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-medium mb-3">API Key</label>
                <Input
                  type="password"
                  value={newProvider.api_key}
                  onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="h-12 text-base font-mono"
                />
              </div>

              <div>
                <label className="block text-base font-medium mb-3">Base URL</label>
                <Input
                  value={newProvider.base_url}
                  onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="h-12 text-base font-mono"
                />
              </div>

              <div className="flex gap-3 pt-6">
                <Button onClick={handleAddProvider} size="lg" className="h-12 px-6 text-base">
                  <Check className="w-5 h-5 mr-2" />
                  Lưu nhà cung cấp
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowAddProvider(false);
                    setNewProvider({ id: '', name: '', api_key: '', base_url: '', models: [] });
                  }}
                  className="h-12 px-6 text-base"
                >
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        ) : showAddModel && selectedProvider ? (
          /* Add Model Form */
          <div className="p-10 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2">Thêm mô hình mới</h2>
                <p className="text-muted-foreground text-lg">
                  Thêm mô hình AI cho {selectedProvider.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModel(false);
                  setNewModel({ id: '', name: '' });
                }}
                className="flex items-center justify-center h-11 w-11 rounded-xl hover:bg-muted transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-7">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-base font-medium mb-3">ID mô hình</label>
                  <Input
                    value={newModel.id}
                    onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                    placeholder="gpt-4"
                    className="h-12 text-base font-mono"
                  />
                </div>

                <div>
                  <label className="block text-base font-medium mb-3">Tên hiển thị</label>
                  <Input
                    value={newModel.name}
                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                    placeholder="GPT-4"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <Button onClick={handleAddModel} size="lg" className="h-12 px-6 text-base">
                  <Check className="w-5 h-5 mr-2" />
                  Lưu mô hình
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowAddModel(false);
                    setNewModel({ id: '', name: '' });
                  }}
                  className="h-12 px-6 text-base"
                >
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        ) : selectedProvider ? (
          /* Provider Details */
          <div className="p-10 max-w-4xl mx-auto">
            {/* Provider Header */}
            <div className="flex items-start gap-5 mb-10 pb-8 border-b border-border">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{selectedProvider.name}</h2>
                <p className="text-muted-foreground font-mono">{selectedProvider.base_url}</p>
              </div>
            </div>

            {/* Models Section */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Mô hình</h3>
                  <p className="text-muted-foreground">
                    Quản lý các mô hình AI từ {selectedProvider.name}
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddModel(true)}
                  size="lg"
                  className="h-11"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Thêm mô hình
                </Button>
              </div>

              {/* Models List */}
              {selectedProvider.models.length === 0 ? (
                <div className="text-center py-16 px-8 rounded-xl border-2 border-dashed border-border">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-muted mb-4">
                    <Bot className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-lg">Chưa có mô hình nào</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {selectedProvider.models.map((model) => {
                    const selected = isSelected(selectedProvider.id, model.id);
                    return (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-5 rounded-xl border transition-all ${
                          selected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {selected && (
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary">
                              <Check className="w-5 h-5 text-primary-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-base">{model.name}</p>
                            <p className="text-sm text-muted-foreground font-mono mt-0.5">{model.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!selected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectModel(selectedProvider.id, model.id)}
                              className="h-10"
                            >
                              Chọn
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteModel(selectedProvider.id, model.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 w-10 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Chọn nhà cung cấp để xem chi tiết</p>
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
