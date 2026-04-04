// Onboarding Screen - First-time setup wizard
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Provider } from '../../core/entities';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Sparkles, ArrowRight, Check, ExternalLink } from 'lucide-react';

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
      // Filter to only show Kilo provider in onboarding
      const kiloProvider = settings.providers.filter(p => p.id === 'kilo');
      setProviders(kiloProvider);
      // Auto-select Kilo provider
      if (kiloProvider.length > 0 && !selectedProviderId) {
        setSelectedProviderId('kilo');
        console.log('[ONBOARDING] Auto-selected Kilo provider');
      }
    }
  }, [settings, selectedProviderId]);

  const handleComplete = async () => {
    if (!apiKey.trim()) {
      alert('Vui lòng nhập API key');
      return;
    }

    setLoading(true);
    try {
      // Find Kilo provider
      const provider = providers.find(p => p.id === 'kilo');
      if (!provider) {
        throw new Error('Kilo provider not found');
      }

      // Update provider with API key
      const updatedProvider = { ...provider, api_key: apiKey };
      await updateProvider(updatedProvider);

      // Auto-select first model of Kilo provider
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl lg:max-w-2xl xl:max-w-3xl">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6 sm:space-y-8 lg:space-y-12">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl lg:rounded-2xl bg-primary/10 mb-4 sm:mb-6 lg:mb-8">
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 sm:mb-4 lg:mb-6 tracking-tight">
                Chào mừng đến với Claw
              </h1>
              <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-muted-foreground max-w-md lg:max-w-xl mx-auto leading-relaxed px-4">
                Cấu hình nhà cung cấp AI để bắt đầu
              </p>
            </div>

            <div className="max-w-xs sm:max-w-sm mx-auto pt-2 lg:pt-4">
              <Button 
                onClick={() => setStep(1)} 
                className="w-full h-11 sm:h-12 lg:h-14 text-base lg:text-lg" 
                size="lg"
              >
                Bắt đầu cấu hình
                <ArrowRight className="ml-2 lg:ml-3 w-5 h-5 lg:w-6 lg:h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Kilo Provider Info (Skip selection, go directly to API key) */}
        {step === 1 && (
          <div className="space-y-6 sm:space-y-8 lg:space-y-10">
            <div className="text-center space-y-2 sm:space-y-3 lg:space-y-4">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold">
                Kilo AI Gateway
              </h2>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-md lg:max-w-xl mx-auto px-4">
                Nhập API key để bắt đầu sử dụng mô hình AI miễn phí
              </p>
            </div>

            <div className="max-w-xl lg:max-w-2xl mx-auto space-y-4 sm:space-y-5 lg:space-y-6">
              <div className="space-y-2 lg:space-y-3">
                <label className="block text-base sm:text-lg font-medium">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập API key của bạn..."
                  className="h-11 sm:h-12 lg:h-14 text-sm sm:text-base font-mono bg-background"
                  autoFocus
                />
                <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    API key sẽ được lưu trữ an toàn trên máy tính của bạn
                  </p>
                  <a
                    href="https://app.kilo.ai/profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:underline whitespace-nowrap"
                  >
                    Lấy API key
                    <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 lg:gap-3 pt-2 lg:pt-4">
              <div className="h-1.5 w-12 sm:h-2 sm:w-14 lg:w-16 rounded-full bg-primary" />
              <div className="h-1.5 w-12 sm:h-2 sm:w-14 lg:w-16 rounded-full bg-primary" />
            </div>

            <div className="pt-2 lg:pt-4 max-w-xs sm:max-w-sm mx-auto">
              <Button 
                onClick={handleComplete}
                disabled={!apiKey.trim() || loading}
                className="w-full h-11 sm:h-12 lg:h-14 text-base lg:text-lg font-medium" 
                size="lg"
              >
                {loading ? 'Đang xử lý...' : 'Hoàn tất và bắt đầu'}
                <Check className="ml-2 lg:ml-3 w-5 h-5 lg:w-6 lg:h-6" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
