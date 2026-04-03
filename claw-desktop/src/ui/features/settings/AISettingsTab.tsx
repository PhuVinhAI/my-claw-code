// AI Settings Tab - CRUD providers and models (Inline forms)
import { useState } from 'react';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Provider, Model } from '../../../core/entities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';
import { Plus, Trash2, X, Check, Save } from 'lucide-react';

export function AISettingsTab() {
  const { settings, addProvider, deleteProvider, addModel, deleteModel, setSelectedModel } = useSettingsStore();
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddModel, setShowAddModel] = useState<string | null>(null);

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
      <div className="p-8">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  const handleAddProvider = async () => {
    if (!newProvider.id || !newProvider.name || !newProvider.api_key || !newProvider.base_url) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      await addProvider(newProvider as Provider);
      setNewProvider({ id: '', name: '', api_key: '', base_url: '', models: [] });
      setShowAddProvider(false);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleAddModel = async (providerId: string) => {
    if (!newModel.id || !newModel.name) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      await addModel(providerId, newModel as Model);
      setNewModel({ id: '', name: '' });
      setShowAddModel(null);
    } catch (error) {
      alert(`Lỗi: ${error}`);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Bạn có chắc muốn xóa nhà cung cấp này?')) return;
    try {
      await deleteProvider(providerId);
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
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Cài đặt AI</h2>
          <p className="text-muted-foreground mt-1">
            Quản lý nhà cung cấp và mô hình AI
          </p>
        </div>
        {!showAddProvider && (
          <Button onClick={() => setShowAddProvider(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm nhà cung cấp
          </Button>
        )}
      </div>

      {/* Add Provider Form (Inline) */}
      {showAddProvider && (
        <Card className="p-6 mb-4 border-2 border-primary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Thêm nhà cung cấp mới</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddProvider(false);
                setNewProvider({ id: '', name: '', api_key: '', base_url: '', models: [] });
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">ID (ví dụ: openai)</label>
              <Input
                value={newProvider.id}
                onChange={(e) => setNewProvider({ ...newProvider, id: e.target.value })}
                placeholder="openai"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tên hiển thị</label>
              <Input
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                placeholder="OpenAI"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <Input
                type="password"
                value={newProvider.api_key}
                onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Base URL</label>
              <Input
                value={newProvider.base_url}
                onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <Button onClick={handleAddProvider} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Lưu nhà cung cấp
            </Button>
          </div>
        </Card>
      )}

      {/* Providers List */}
      <div className="space-y-4">
        {settings.providers.length === 0 && !showAddProvider && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              Chưa có nhà cung cấp nào. Hãy thêm nhà cung cấp đầu tiên.
            </p>
          </Card>
        )}

        {settings.providers.map((provider) => (
          <Card key={provider.id} className="p-6">
            {/* Provider Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{provider.name}</h3>
                <p className="text-sm text-muted-foreground">{provider.base_url}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteProvider(provider.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Add Model Form (Inline) */}
            {showAddModel === provider.id && (
              <div className="mb-4 p-4 rounded-lg border-2 border-primary bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">Thêm mô hình mới</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddModel(null);
                      setNewModel({ id: '', name: '' });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID mô hình</label>
                    <Input
                      value={newModel.id}
                      onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                      placeholder="gpt-4"
                      className="h-9"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tên hiển thị</label>
                    <Input
                      value={newModel.name}
                      onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                      placeholder="GPT-4"
                      className="h-9"
                    />
                  </div>

                  <Button onClick={() => handleAddModel(provider.id)} size="sm" className="w-full">
                    <Save className="w-3 h-3 mr-2" />
                    Lưu mô hình
                  </Button>
                </div>
              </div>
            )}

            {/* Models List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Mô hình</span>
                {showAddModel !== provider.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModel(provider.id)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Thêm mô hình
                  </Button>
                )}
              </div>

              {provider.models.length === 0 && showAddModel !== provider.id && (
                <p className="text-sm text-muted-foreground py-2">
                  Chưa có mô hình nào
                </p>
              )}

              {provider.models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isSelected(provider.id, model.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isSelected(provider.id, model.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectModel(provider.id, model.id)}
                      >
                        Chọn
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteModel(provider.id, model.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
