// Onboarding Screen - Multi-provider setup wizard
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProviderSelectionStep } from './steps/ProviderSelectionStep';
import { ProviderSetupStep } from './steps/ProviderSetupStep';
import { ModelSelectionStep } from './steps/ModelSelectionStep';
import { ProviderId } from './types';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Array<{
    id: string;
    name: string;
    max_context?: number;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const { loadSettings, updateProvider, addModel, setSelectedModel } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleModel = (model: { id: string; name: string; max_context?: number }) => {
    const exists = selectedModels.find(m => m.id === model.id);
    if (exists) {
      setSelectedModels(selectedModels.filter(m => m.id !== model.id));
    } else {
      setSelectedModels([...selectedModels, model]);
    }
  };

  // Reset state when provider changes
  const handleSelectProvider = (provider: ProviderId) => {
    setSelectedProvider(provider);
    // Reset all provider-specific state
    setApiKey('');
    setSetupComplete(false);
    setSelectedModels([]);
  };

  // Auto-select model if only 1 available (but still show the screen)
  const handleModelsLoaded = (models: Array<{ id: string; name: string; max_context?: number }>) => {
    if (models.length === 1) {
      // Auto-select the only model
      setSelectedModels([models[0]]);
    }
  };

  const handleCompleteWithModels = async (models: Array<{ id: string; name: string; max_context?: number }>) => {
    if (!selectedProvider || models.length === 0) return;

    setLoading(true);
    try {
      // Update provider with API key (if not Antigravity)
      if (selectedProvider !== 'antigravity' && apiKey) {
        await updateProvider({
          id: selectedProvider,
          name: getProviderName(selectedProvider),
          api_key: apiKey,
          base_url: getProviderBaseUrl(selectedProvider),
          models: [],
        });
      }

      // Add all selected models
      for (const model of models) {
        await addModel(selectedProvider, model);
      }

      // Auto-select first model
      await setSelectedModel(selectedProvider, models[0].id);

      onComplete();
    } catch (error) {
      console.error('[ONBOARDING] Error completing setup:', error);
      alert('Có lỗi xảy ra: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await handleCompleteWithModels(selectedModels);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-2xl">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <WelcomeStep onNext={() => setStep(1)} />
        )}

        {/* Step 1: Provider Selection */}
        {step === 1 && (
          <ProviderSelectionStep
            selectedProvider={selectedProvider}
            onSelectProvider={handleSelectProvider}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}

        {/* Step 2: Provider Setup */}
        {step === 2 && selectedProvider && (
          <ProviderSetupStep
            provider={selectedProvider}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onNext={() => setStep(3)}
            onBack={() => {
              // Reset state when going back to provider selection
              setApiKey('');
              setSetupComplete(false);
              setSelectedModels([]);
              setStep(1);
            }}
            setupComplete={setupComplete}
            onSetupComplete={() => setSetupComplete(true)}
          />
        )}

        {/* Step 3: Model Selection */}
        {step === 3 && selectedProvider && (
          <ModelSelectionStep
            provider={selectedProvider}
            apiKey={apiKey}
            selectedModels={selectedModels}
            onToggleModel={handleToggleModel}
            onComplete={handleComplete}
            onBack={() => setStep(2)}
            loading={loading}
            onModelsLoaded={handleModelsLoaded}
          />
        )}
      </div>
    </div>
  );
}

// Helper functions
function getProviderName(provider: ProviderId): string {
  const names: Record<ProviderId, string> = {
    nvidia: 'NVIDIA AI',
    kilo: 'Kilo AI Gateway',
    openrouter: 'OpenRouter',
    antigravity: 'Antigravity Claude Proxy',
    gemini: 'Google Gemini',
  };
  return names[provider];
}

function getProviderBaseUrl(provider: ProviderId): string {
  const urls: Record<ProviderId, string> = {
    nvidia: 'https://integrate.api.nvidia.com/v1',
    kilo: 'https://api.kilo.ai/api/gateway',
    openrouter: 'https://openrouter.ai/api',
    antigravity: 'http://localhost:8080',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  };
  return urls[provider];
}
