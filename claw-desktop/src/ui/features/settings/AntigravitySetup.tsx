// Antigravity Claude Proxy Setup Component
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, ExternalLink, Plus, Server } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Model } from '../../../core/entities';
import { cn } from '../../../lib/utils';

interface AntigravitySetupProps {
  existingModels: Model[];
  onAddModel: (model: Model) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AntigravitySetup({ existingModels, onAddModel, isOpen, onOpenChange }: AntigravitySetupProps) {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<'claude' | 'gemini'>('claude');

  const handleAddModel = (model: Model) => {
    onAddModel(model);
  };

  const isModelAdded = (modelId: string) => {
    return existingModels.some((m) => m.id === modelId);
  };

  if (!isOpen) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20">
            <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">
              {t('antigravity.title', 'Antigravity Claude Proxy')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('antigravity.subtitle', 'Free Claude & Gemini models via Google Cloud Code')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 p-0"
          >
            ×
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <strong>{t('antigravity.warning', 'Cảnh báo:')}</strong>{' '}
            {t('antigravity.warningText', 'Google có thể cấm tài khoản vi phạm ToS. Sử dụng tài khoản phụ.')}
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-xs font-semibold mb-2">{t('antigravity.setup', 'Cài đặt:')}</h4>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>
            {t('antigravity.step1', 'Cài đặt:')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">npm install -g antigravity-claude-proxy@latest</code>
          </li>
          <li>
            {t('antigravity.step2', 'Khởi động:')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">antigravity-claude-proxy start</code>
          </li>
          <li>
            {t('antigravity.step3', 'Thêm tài khoản Google:')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">antigravity-claude-proxy accounts add</code>
          </li>
          <li>
            {t('antigravity.step4', 'Sử dụng Base URL:')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">http://localhost:8080</code>
          </li>
          <li>
            {t('antigravity.step5', 'API Key:')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">test</code> {t('antigravity.step5Note', '(bất kỳ giá trị nào)')}
          </li>
        </ol>
        <a
          href="https://github.com/badrisnarayanan/antigravity-claude-proxy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
        >
          {t('antigravity.docs', 'Xem hướng dẫn đầy đủ')}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Model Tabs */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectedTab('claude')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
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
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              selectedTab === 'gemini'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            Gemini ({ANTIGRAVITY_MODELS.gemini.length})
          </button>
        </div>
      </div>

      {/* Models List */}
      <div className="px-4 pb-4">
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {ANTIGRAVITY_MODELS[selectedTab].map((model) => {
            const added = isModelAdded(model.id);
            return (
              <div
                key={model.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all"
              >
                <div className="flex-1 min-w-0 mr-2">
                  <p className="font-medium text-xs truncate">{model.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground font-mono truncate">{model.id}</p>
                    <span className="text-xs text-muted-foreground">
                      {(model.max_context / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={added ? 'outline' : 'default'}
                  onClick={() => handleAddModel(model)}
                  disabled={added}
                  className="h-7 text-xs shrink-0"
                >
                  {added ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {t('antigravity.added', 'Đã thêm')}
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      {t('antigravity.add', 'Thêm')}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
