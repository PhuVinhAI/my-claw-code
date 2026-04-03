// Onboarding Screen - First-time setup wizard
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Provider } from '../../core/entities';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Sparkles, ArrowRight, Check } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const { loadSettings, settings, updateProvider, setSelectedModel } = useSettingsStore();

  // Load default providers on mount
  useEffect(() => {
    const load = async () => {
      try {
        console.log('[ONBOARDING] Loading settings...');
        await loadSettings();
        console.log('[ONBOARDING] Settings loaded:', settings);
      } catch (error) {
        console.error('[ONBOARDING] Failed to load settings:', error);
      }
    };
    load();
  }, [loadSettings]);

  useEffect(() => {
    console.log('[ONBOARDING] Settings changed:', settings);
    if (settings?.providers) {
      console.log('[ONBOARDING] Providers:', settings.providers);
      setProviders(settings.providers);
      // Auto-select first provider
      if (settings.providers.length > 0 && !selectedProviderId) {
        setSelectedProviderId(settings.providers[0].id);
        console.log('[ONBOARDING] Auto-selected provider:', settings.providers[0].id);
      }
    }
  }, [settings, selectedProviderId]);

  const handleSelectProvider = () => {
    if (!selectedProviderId) {
      alert('Vui lòng chọn nhà cung cấp');
      return;
    }
    setStep(2);
  };

  const handleComplete = async () => {
    if (!apiKey.trim()) {
      alert('Vui lòng nhập API key');
      return;
    }

    setLoading(true);
    try {
      // Find selected provider
      const provider = providers.find(p => p.id === selectedProviderId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Update provider with API key
      const updatedProvider = { ...provider, api_key: apiKey };
      await updateProvider(updatedProvider);

      // Auto-select first model of this provider
      if (provider.models.length > 0) {
        await setSelectedModel(provider.id, provider.models[0].id);
      }

      onComplete();
    } catch (error) {
      alert(`Lỗi: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-8">
      <div className="w-full max-w-4xl">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-12">
            <div>
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/10 mb-8">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-5xl font-bold mb-4 tracking-tight">Chào mừng đến với Claw</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Cấu hình nhà cung cấp AI để bắt đầu
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <Button onClick={() => setStep(1)} className="w-full h-14 text-lg" size="lg">
                Bắt đầu cấu hình
                <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Select Provider */}
        {step === 1 && (
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Chọn nhà cung cấp AI</h2>
              <p className="text-muted-foreground">
                Chọn một trong các nhà cung cấp AI có sẵn
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={`
                    w-full flex items-start gap-4 p-6 rounded-xl border-2 transition-all text-left
                    ${selectedProviderId === provider.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 bg-background'
                    }
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 mt-0.5
                    ${selectedProviderId === provider.id
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30'
                    }
                  `}>
                    {selectedProviderId === provider.id && (
                      <div className="w-3 h-3 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-semibold mb-2">{provider.name}</p>
                    <p className="text-sm text-muted-foreground truncate font-mono mb-2">
                      {provider.base_url}
                    </p>
                    {provider.models.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Mô hình mặc định: {provider.models[0].name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-2 w-16 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-border" />
              <div className="h-2 w-16 rounded-full bg-muted" />
              <div className="w-2 h-2 rounded-full bg-border" />
              <div className="h-2 w-16 rounded-full bg-muted" />
            </div>

            <div className="max-w-md mx-auto">
              <Button 
                onClick={handleSelectProvider} 
                disabled={!selectedProviderId}
                className="w-full h-12 text-base" 
                size="lg"
              >
                Tiếp theo
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Enter API Key */}
        {step === 2 && (
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Nhập API Key</h2>
              <p className="text-muted-foreground">
                Nhập API key của {selectedProvider?.name} để tiếp tục
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-6 rounded-xl bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground mb-1">Nhà cung cấp đã chọn</p>
                <p className="text-xl font-semibold mb-2">{selectedProvider?.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{selectedProvider?.base_url}</p>
              </div>

              <div className="space-y-3">
                <label className="block text-base font-medium">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập API key của bạn..."
                  className="h-14 text-base font-mono bg-background"
                  autoFocus
                />
                <p className="text-sm text-muted-foreground">
                  API key sẽ được lưu trữ an toàn trên máy tính của bạn
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-2 w-16 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-border" />
              <div className="h-2 w-16 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-border" />
              <div className="h-2 w-16 rounded-full bg-muted" />
            </div>

            <div className="max-w-md mx-auto">
              <Button
                onClick={handleComplete}
                disabled={!apiKey.trim() || loading}
                className="w-full h-12 text-base"
                size="lg"
              >
                {loading ? 'Đang xử lý...' : 'Hoàn tất và bắt đầu'}
                <Check className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
