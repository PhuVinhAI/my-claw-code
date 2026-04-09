// Provider Setup Step - Step 2
import { Button } from '../../../../components/ui/button';
import { ArrowRight, Server } from 'lucide-react';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { AntigravitySetupComponent } from '../components/AntigravitySetupComponent';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ProviderId } from '../types';

interface ProviderSetupStepProps {
  provider: ProviderId;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
  setupComplete: boolean;
  onSetupComplete: () => void;
}

const PROVIDER_INFO: Record<ProviderId, {
  name: string;
  icon: string;
  apiKeyUrl?: string;
  linkText?: string;
}> = {
  nvidia: {
    name: 'NVIDIA AI',
    icon: '🟢',
    apiKeyUrl: 'https://build.nvidia.com/settings/api-keys',
    linkText: 'Lấy API key từ NVIDIA',
  },
  kilo: {
    name: 'Kilo AI Gateway',
    icon: '🚀',
    apiKeyUrl: 'https://app.kilo.ai/profile',
    linkText: 'Lấy API key từ Kilo',
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🔀',
    apiKeyUrl: 'https://openrouter.ai/workspaces/default/keys',
    linkText: 'Lấy API key từ OpenRouter',
  },
  antigravity: {
    name: 'Antigravity Claude Proxy',
    icon: '🌌',
  },
};

export function ProviderSetupStep({
  provider,
  apiKey,
  onApiKeyChange,
  onNext,
  onBack,
  setupComplete,
  onSetupComplete,
}: ProviderSetupStepProps) {
  const info = PROVIDER_INFO[provider];
  const isAntigravity = provider === 'antigravity';
  const canProceed = isAntigravity ? setupComplete : apiKey.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-blue-500/10 mb-2">
          <Server className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-semibold">
          Cài đặt {info.name}
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {isAntigravity 
            ? 'Làm theo hướng dẫn để cài đặt và khởi động Antigravity proxy'
            : 'Nhập API key để kết nối với provider'}
        </p>
      </div>

      {/* Setup Content */}
      <div className="max-w-md mx-auto">
        {isAntigravity ? (
          <AntigravitySetupComponent onTestSuccess={onSetupComplete} />
        ) : (
          <div className="space-y-4">
            <ApiKeyInput
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="Nhập API key của bạn"
              linkUrl={info.apiKeyUrl!}
              linkText={info.linkText!}
            />
            
            <div className="text-xs text-muted-foreground">
              API key sẽ được lưu an toàn trên máy của bạn và không được chia sẻ.
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      <ProgressIndicator totalSteps={3} currentStep={1} />

      {/* Navigation */}
      <div className="flex gap-2.5 pt-2 max-w-sm mx-auto">
        <Button 
          onClick={onBack}
          variant="outline"
          className="flex-1 h-10 text-sm"
        >
          Quay lại
        </Button>
        <Button 
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 h-10 text-sm"
        >
          Tiếp tục
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
