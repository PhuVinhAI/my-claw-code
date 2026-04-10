// Antigravity Claude Proxy Setup Component
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Model } from '../../../core/entities';
import { cn } from '../../../lib/utils';
import { fetchAntigravityModels, AntigravityModel } from './fetchAntigravityModels';

interface AntigravitySetupProps {
  existingModels: Model[];
  onAddModel: (model: Model) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  baseUrl?: string;
  autoStart?: boolean;
  onAutoStartChange?: (enabled: boolean) => void;
}

// Skeleton loading component
function ModelSkeleton() {
  return (
    <div className="flex items-center justify-between p-2 rounded-md border border-border animate-pulse">
      <div className="flex-1 min-w-0 mr-2">
        <div className="h-3 bg-muted rounded w-3/4 mb-1.5"></div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 bg-muted rounded w-1/2"></div>
          <div className="h-2.5 bg-muted rounded w-12"></div>
        </div>
      </div>
      <div className="h-7 w-16 bg-muted rounded"></div>
    </div>
  );
}

export function AntigravitySetup({ existingModels, onAddModel, isOpen, onOpenChange, baseUrl = 'http://localhost:8080', autoStart = true, onAutoStartChange }: AntigravitySetupProps) {
  const { t } = useTranslation();
  const [models, setModels] = useState<AntigravityModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'claude' | 'gemini' | 'all'>('all');

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedModels = await fetchAntigravityModels(baseUrl);
      setModels(fetchedModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      console.error('[ANTIGRAVITY] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen, baseUrl]);

  const handleAddModel = (model: AntigravityModel) => {
    onAddModel({
      id: model.id,
      name: model.name,
      max_context: model.max_context,
    });
  };

  const isModelAdded = (modelId: string) => {
    return existingModels.some((m) => m.id === modelId);
  };

  const filteredModels = models.filter((model) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'claude') return model.id.toLowerCase().includes('claude');
    if (selectedTab === 'gemini') return model.id.toLowerCase().includes('gemini');
    return true;
  });

  const claudeCount = models.filter(m => m.id.toLowerCase().includes('claude')).length;
  const geminiCount = models.filter(m => m.id.toLowerCase().includes('gemini')).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('antigravity.title', 'Antigravity Claude Proxy')}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t('antigravity.subtitle', 'Free Claude & Gemini models via Google Cloud Code')}
          </p>
        </DialogHeader>

        {/* Auto-start Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium">{t('antigravity.autoStart', 'Tự động khởi động')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('antigravity.autoStartDesc', 'Tự động kết nối Antigravity khi mở app')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => onAutoStartChange?.(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Warning */}
        <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <strong>{t('antigravity.warning')}</strong>{' '}
              {t('antigravity.warningText')}
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold">{t('antigravity.setup')}</h4>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>
              {t('antigravity.step1')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">npm install -g antigravity-claude-proxy@latest</code>
            </li>
            <li>
              {t('antigravity.step2')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">antigravity-claude-proxy start</code>
            </li>
            <li>
              {t('antigravity.step3')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">antigravity-claude-proxy accounts add</code>
            </li>
            <li>
              {t('antigravity.step4')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">http://localhost:8080</code>
            </li>
            <li>
              {t('antigravity.step5')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">test</code> {t('antigravity.step5Note')}
            </li>
          </ol>
          <a
            href="https://github.com/badrisnarayanan/antigravity-claude-proxy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t('antigravity.docs')}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Model Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex gap-2 flex-1">
            <button
              onClick={() => setSelectedTab('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                selectedTab === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t('antigravity.allTab')} ({models.length})
            </button>
            <button
              onClick={() => setSelectedTab('claude')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                selectedTab === 'claude'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t('antigravity.claudeTab')} ({claudeCount})
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
              {t('antigravity.geminiTab')} ({geminiCount})
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadModels}
            disabled={loading}
            className="h-7 text-xs"
            title={t('antigravity.refresh')}
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 min-h-0">
          {loading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <ModelSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mb-2" />
              <p className="text-sm text-destructive font-medium">{t('antigravity.loadError')}</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <Button size="sm" variant="outline" onClick={loadModels} className="mt-3">
                <RefreshCw className="w-3 h-3 mr-1" />
                {t('antigravity.retry')}
              </Button>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">{t('antigravity.noModelsFound')}</p>
            </div>
          ) : (
            filteredModels.map((model) => {
              const added = isModelAdded(model.id);
              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
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
                        {t('antigravity.added')}
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        {t('antigravity.add')}
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
