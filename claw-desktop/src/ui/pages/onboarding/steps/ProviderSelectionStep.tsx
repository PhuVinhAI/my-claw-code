// Provider Selection Step - Step 1
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { ArrowRight } from 'lucide-react';
import { ProviderCard } from '../components/ProviderCard';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ProviderId, ProviderInfo } from '../types';

interface ProviderSelectionStepProps {
  selectedProvider: ProviderId | null;
  onSelectProvider: (provider: ProviderId) => void;
  onNext: () => void;
  onBack: () => void;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'nvidia',
    name: 'NVIDIA AI',
    description: 'Truy cập các model AI mạnh mẽ từ NVIDIA với hiệu suất cao và độ trễ thấp',
    icon: '🟢',
    requiresApiKey: true,
    apiKeyUrl: 'https://build.nvidia.com/settings/api-keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Model AI tiên tiến từ Google với khả năng xử lý ngôn ngữ tự nhiên mạnh mẽ',
    icon: '✨',
    requiresApiKey: true,
    apiKeyUrl: 'https://aistudio.google.com/api-keys',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    description: 'AI inference nhanh nhất thế giới với tốc độ ~3000 tokens/sec',
    icon: '⚡',
    requiresApiKey: true,
    apiKeyUrl: 'https://cloud.cerebras.ai/platform',
  },
  {
    id: 'kilo',
    name: 'Kilo AI Gateway',
    description: 'Gateway thống nhất cho hàng trăm AI models từ nhiều providers khác nhau',
    icon: '🚀',
    requiresApiKey: true,
    apiKeyUrl: 'https://app.kilo.ai/profile',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Truy cập nhiều AI models với giá cả cạnh tranh và metadata chi tiết',
    icon: '🔀',
    requiresApiKey: true,
    apiKeyUrl: 'https://openrouter.ai/workspaces/default/keys',
  },
  {
    id: 'antigravity',
    name: 'Antigravity Claude Proxy',
    description: 'Sử dụng Claude miễn phí thông qua proxy local (cần cài đặt)',
    icon: '🌌',
    requiresApiKey: false,
  },
];

export function ProviderSelectionStep({
  selectedProvider,
  onSelectProvider,
  onNext,
  onBack,
}: ProviderSelectionStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-semibold">
          Chọn AI Provider
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Chọn nhà cung cấp AI bạn muốn sử dụng. Bạn có thể thêm nhiều providers sau.
        </p>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            selected={selectedProvider === provider.id}
            onSelect={() => onSelectProvider(provider.id)}
          />
        ))}
      </div>

      {/* Progress */}
      <ProgressIndicator totalSteps={3} currentStep={0} />

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
          disabled={!selectedProvider}
          className="flex-1 h-10 text-sm"
        >
          Tiếp tục
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
