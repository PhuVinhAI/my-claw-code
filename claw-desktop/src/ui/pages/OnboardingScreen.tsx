// Onboarding Screen - Antigravity Setup Wizard
import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Model } from '../../core/entities';
import { Button } from '../../components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, ArrowRight, Check, ExternalLink, Server, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface OnboardingScreenProps {
  onComplete: () => void;
}

// Predefined Antigravity models
const ANTIGRAVITY_MODELS = {
  claude: [
    { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)', max_context: 200000 },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', max_context: 200000 },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', max_context: 1000000 },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', max_context: 1000000 },
    { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', max_context: 1000000 },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', max_context: 1000000 },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', max_context: 1000000 },
    { id: 'gemini-3-flash-agent', name: 'Gemini 3 Flash Agent', max_context: 1000000 },
    { id: 'gemini-3-pro-high', name: 'Gemini 3 Pro High', max_context: 1000000 },
    { id: 'gemini-3-pro-low', name: 'Gemini 3 Pro Low', max_context: 1000000 },
    { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', max_context: 1000000 },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', max_context: 1000000 },
    { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro High', max_context: 1000000 },
    { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro Low', max_context: 1000000 },
  ],
};

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [selectedTab, setSelectedTab] = useState<'claude' | 'gemini'>('claude');
  const [loading, setLoading] = useState(false);
  const { loadSettings, addModel, setSelectedModel } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      alert('Vui lòng chọn ít nhất 1 model');
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
                Cấu hình Antigravity proxy để sử dụng Claude & Gemini miễn phí
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

        {/* Step 1: Setup Instructions & Test */}
        {step === 1 && (
          <div className="space-y-6 sm:space-y-8">
            <div className="text-center space-y-2 sm:space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-blue-500/20 mb-2">
                <Server className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold">
                Cài đặt Antigravity Proxy
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-4">
                Sử dụng Claude & Gemini miễn phí qua Google Cloud Code
              </p>
            </div>

            {/* Warning */}
            <div className="max-w-xl mx-auto px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Cảnh báo:</strong> Google có thể cấm tài khoản vi phạm ToS. Sử dụng tài khoản phụ.
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="max-w-xl mx-auto space-y-4">
              <h3 className="text-sm font-semibold">Các bước cài đặt:</h3>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                <li>
                  Cài đặt proxy:
                  <code className="block mt-1 px-3 py-2 rounded bg-muted text-foreground font-mono text-xs">
                    npm install -g antigravity-claude-proxy@latest
                  </code>
                </li>
                <li>
                  Khởi động proxy:
                  <code className="block mt-1 px-3 py-2 rounded bg-muted text-foreground font-mono text-xs">
                    antigravity-claude-proxy start
                  </code>
                </li>
                <li>
                  Thêm tài khoản Google:
                  <code className="block mt-1 px-3 py-2 rounded bg-muted text-foreground font-mono text-xs">
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
                Xem hướng dẫn đầy đủ
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Test Connection */}
            <div className="max-w-xl mx-auto space-y-3">
              <Button
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full h-11 text-base"
                variant={testResult === 'success' ? 'outline' : 'default'}
              >
                {testing ? 'Đang kiểm tra...' : testResult === 'success' ? 'Kết nối thành công!' : 'Kiểm tra kết nối'}
                {testResult === 'success' && <CheckCircle className="ml-2 w-5 h-5" />}
              </Button>

              {testResult === 'error' && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-red-800 dark:text-red-300">
                      <strong>Lỗi kết nối:</strong> {testError}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress & Navigation */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="h-2 w-14 rounded-full bg-primary" />
              <div className="h-2 w-14 rounded-full bg-muted" />
            </div>

            <div className="pt-2 max-w-xs sm:max-w-sm mx-auto">
              <Button 
                onClick={() => setStep(2)}
                disabled={testResult !== 'success'}
                className="w-full h-11 text-base" 
                size="lg"
              >
                Tiếp tục
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Models */}
        {step === 2 && (
          <div className="space-y-6 sm:space-y-8">
            <div className="text-center space-y-2 sm:space-y-3">
              <h2 className="text-2xl sm:text-3xl font-semibold">
                Chọn Models
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-4">
                Chọn các model bạn muốn sử dụng
              </p>
            </div>

            {/* Model Tabs */}
            <div className="max-w-xl mx-auto">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSelectedTab('claude')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    selectedTab === 'claude'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Claude ({ANTIGRAVITY_MODELS.claude.length})
                </button>
                <button
                  onClick={() => setSelectedTab('gemini')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    selectedTab === 'gemini'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Gemini ({ANTIGRAVITY_MODELS.gemini.length})
                </button>
              </div>

              {/* Models List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {ANTIGRAVITY_MODELS[selectedTab].map((model) => {
                  const isSelected = selectedModels.some(m => m.id === model.id);
                  return (
                    <div
                      key={model.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
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
                        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Count */}
            <div className="text-center text-sm text-muted-foreground">
              Đã chọn: {selectedModels.length} model(s)
            </div>

            {/* Progress & Navigation */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="h-2 w-14 rounded-full bg-primary" />
              <div className="h-2 w-14 rounded-full bg-primary" />
            </div>

            <div className="flex gap-3 pt-2 max-w-sm mx-auto">
              <Button 
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-11 text-base"
              >
                Quay lại
              </Button>
              <Button 
                onClick={handleComplete}
                disabled={selectedModels.length === 0 || loading}
                className="flex-1 h-11 text-base"
              >
                {loading ? 'Đang xử lý...' : 'Hoàn tất'}
                <Check className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
