// Onboarding Screen - Antigravity Setup Wizard
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Model } from '../../core/entities';
import { Button } from '../../components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, ArrowRight, Check, ExternalLink, Server, AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchAntigravityModels, AntigravityModel } from '../features/settings/fetchAntigravityModels';

interface OnboardingScreenProps {
  onComplete: () => void;
}

// Skeleton loading component
function ModelSkeleton() {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-md border border-border animate-pulse">
      <div className="flex-1 min-w-0 mr-2">
        <div className="h-3.5 bg-muted rounded w-3/4 mb-1.5"></div>
        <div className="flex items-center gap-2">
          <div className="h-3 bg-muted rounded w-1/2"></div>
          <div className="h-3 bg-muted rounded w-12"></div>
        </div>
      </div>
      <div className="h-4 w-4 bg-muted rounded"></div>
    </div>
  );
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [selectedTab, setSelectedTab] = useState<'claude' | 'gemini' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AntigravityModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const { loadSettings, addModel, setSelectedModel } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Fetch models when entering step 2
  useEffect(() => {
    if (step === 2 && models.length === 0) {
      loadModels();
    }
  }, [step]);

  const loadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const fetchedModels = await fetchAntigravityModels('http://localhost:8080');
      setModels(fetchedModels);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Failed to fetch models');
      console.error('[ONBOARDING] Error fetching models:', err);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    setTestError('');

    try {
      await invoke('test_antigravity_connection', { 
        baseUrl: 'http://localhost:8080' 
      });
      setTestResult('success');
    } catch (error) {
      setTestResult('error');
      setTestError(String(error));
    } finally {
      setTesting(false);
    }
  };

  const handleToggleModel = (model: Model) => {
    const exists = selectedModels.find(m => m.id === model.id);
    if (exists) {
      setSelectedModels(selectedModels.filter(m => m.id !== model.id));
    } else {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const handleComplete = async () => {
    if (selectedModels.length === 0) {
      alert(t('onboarding.selectAtLeastOne'));
      return;
    }

    setLoading(true);
    try {
      // Add all selected models to Antigravity provider
      for (const model of selectedModels) {
        await addModel('antigravity', model);
      }

      // Auto-select first model
      await setSelectedModel('antigravity', selectedModels[0].id);

      onComplete();
    } catch (error) {
      alert(t('onboarding.error', { error: String(error) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-2xl">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-8">
            <div>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl font-bold mb-4 tracking-tight">
                {t('onboarding.welcome')}
              </h1>
              <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                {t('onboarding.subtitle')}
              </p>
            </div>

            <div className="max-w-xs mx-auto pt-4">
              <Button 
                onClick={() => setStep(1)} 
                className="w-full h-11 text-sm" 
                size="lg"
              >
                {t('onboarding.start')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Setup Instructions & Test */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-blue-500/10 mb-2">
                <Server className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-semibold">
                {t('onboarding.setupTitle')}
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {t('onboarding.setupSubtitle')}
              </p>
            </div>

            {/* Warning */}
            <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>{t('antigravity.warning')}</strong> {t('antigravity.warningText')}
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t('onboarding.setupSteps')}</h3>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                <li>
                  {t('antigravity.step1')}
                  <code className="block mt-1.5 px-3 py-2 rounded-md bg-muted text-foreground font-mono text-xs">
                    npm install -g antigravity-claude-proxy@latest
                  </code>
                </li>
                <li>
                  {t('antigravity.step2')}
                  <code className="block mt-1.5 px-3 py-2 rounded-md bg-muted text-foreground font-mono text-xs">
                    antigravity-claude-proxy start
                  </code>
                </li>
                <li>
                  {t('antigravity.step3')}
                  <code className="block mt-1.5 px-3 py-2 rounded-md bg-muted text-foreground font-mono text-xs">
                    antigravity-claude-proxy accounts add
                  </code>
                </li>
              </ol>
              <a
                href="https://github.com/badrisnarayanan/antigravity-claude-proxy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                {t('antigravity.docs')}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Test Connection */}
            <div className="space-y-2.5">
              <Button
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full h-10 text-sm"
                variant={testResult === 'success' ? 'outline' : 'default'}
              >
                {testing ? t('onboarding.testing') : testResult === 'success' ? t('onboarding.connectionSuccess') : t('onboarding.testConnection')}
                {testResult === 'success' && <CheckCircle className="ml-2 w-4 h-4" />}
              </Button>

              {testResult === 'error' && (
                <div className="px-3 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-red-800 dark:text-red-300">
                      <strong>{t('onboarding.connectionError')}</strong> {testError}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress & Navigation */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className="h-1.5 w-12 rounded-full bg-primary" />
              <div className="h-1.5 w-12 rounded-full bg-muted" />
            </div>

            <div className="pt-2 max-w-xs mx-auto">
              <Button 
                onClick={() => setStep(2)}
                disabled={testResult !== 'success'}
                className="w-full h-10 text-sm" 
                size="lg"
              >
                {t('onboarding.continue')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Models */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-semibold">
                Chọn Models
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Chọn các model bạn muốn sử dụng
              </p>
            </div>

            {/* Model Tabs */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-2 flex-1">
                  <button
                    onClick={() => setSelectedTab('all')}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      selectedTab === 'all'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    All ({models.length})
                  </button>
                  <button
                    onClick={() => setSelectedTab('claude')}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      selectedTab === 'claude'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    Claude ({models.filter(m => m.id.toLowerCase().includes('claude')).length})
                  </button>
                  <button
                    onClick={() => setSelectedTab('gemini')}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      selectedTab === 'gemini'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    Gemini ({models.filter(m => m.id.toLowerCase().includes('gemini')).length})
                  </button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadModels}
                  disabled={modelsLoading}
                  className="h-7 text-xs"
                >
                  <RefreshCw className={cn('w-3 h-3', modelsLoading && 'animate-spin')} />
                </Button>
              </div>

              {/* Models List */}
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {modelsLoading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <ModelSkeleton key={i} />
                    ))}
                  </div>
                ) : modelsError ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                    <p className="text-sm text-destructive font-medium">{t('antigravity.loadError')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{modelsError}</p>
                    <Button size="sm" variant="outline" onClick={loadModels} className="mt-3">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      {t('antigravity.retry')}
                    </Button>
                  </div>
                ) : models.filter(model => {
                  if (selectedTab === 'all') return true;
                  if (selectedTab === 'claude') return model.id.toLowerCase().includes('claude');
                  if (selectedTab === 'gemini') return model.id.toLowerCase().includes('gemini');
                  return true;
                }).length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">{t('antigravity.noModelsFound')}</p>
                  </div>
                ) : (
                  models.filter(model => {
                    if (selectedTab === 'all') return true;
                    if (selectedTab === 'claude') return model.id.toLowerCase().includes('claude');
                    if (selectedTab === 'gemini') return model.id.toLowerCase().includes('gemini');
                    return true;
                  }).map((model) => {
                    const isSelected = selectedModels.some(m => m.id === model.id);
                    return (
                      <div
                        key={model.id}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer",
                          isSelected 
                            ? "border-primary/50 bg-accent" 
                            : "border-border hover:bg-muted"
                        )}
                        onClick={() => handleToggleModel(model)}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="font-medium text-sm truncate">{model.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground font-mono truncate">{model.id}</p>
                            <span className="text-xs text-muted-foreground">
                              {(model.max_context / 1000).toFixed(0)}K
                            </span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Count */}
            <div className="text-center text-sm text-muted-foreground">
              Đã chọn: {selectedModels.length} model(s)
            </div>

            {/* Progress & Navigation */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className="h-1.5 w-12 rounded-full bg-primary" />
              <div className="h-1.5 w-12 rounded-full bg-primary" />
            </div>

            <div className="flex gap-2.5 pt-2 max-w-sm mx-auto">
              <Button 
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-10 text-sm"
              >
                Quay lại
              </Button>
              <Button 
                onClick={handleComplete}
                disabled={selectedModels.length === 0 || loading}
                className="flex-1 h-10 text-sm"
              >
                {loading ? 'Đang xử lý...' : 'Hoàn tất'}
                <Check className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
