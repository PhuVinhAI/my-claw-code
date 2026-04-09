// Model Selection Step - Step 3
import { useState, useEffect, useRef } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Check, AlertCircle, RefreshCw, Loader2, Search, Filter, BarChart3, ChevronDown } from 'lucide-react';
import { ModelCard } from '../components/ModelCard';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ProviderId } from '../types';
import { fetchModels, ModelInfo } from '../../../features/settings/fetchModels';
import { fetchAntigravityModels, AntigravityModel } from '../../../features/settings/fetchAntigravityModels';
import { cn } from '../../../../lib/utils';

interface ModelSelectionStepProps {
  provider: ProviderId;
  apiKey: string;
  selectedModels: Array<{ id: string; name: string; max_context?: number }>;
  onToggleModel: (model: { id: string; name: string; max_context?: number }) => void;
  onComplete: () => void;
  onBack: () => void;
  loading: boolean;
  onModelsLoaded: (models: Array<{ id: string; name: string; max_context?: number }>) => void;
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

const PROVIDER_CONFIG = {
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    name: 'NVIDIA AI',
  },
  kilo: {
    baseUrl: 'https://api.kilo.ai/api/gateway',
    name: 'Kilo AI Gateway',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api',
    name: 'OpenRouter',
  },
  antigravity: {
    baseUrl: 'http://localhost:8080',
    name: 'Antigravity',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    name: 'Google Gemini',
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    name: 'Cerebras',
  },
};

export function ModelSelectionStep({
  provider,
  apiKey,
  selectedModels,
  onToggleModel,
  onComplete,
  onBack,
  loading: completing,
  onModelsLoaded,
}: ModelSelectionStepProps) {
  const [models, setModels] = useState<Array<ModelInfo | AntigravityModel>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'context'>('name');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [minContext, setMinContext] = useState<number>(0);
  const [maxContext, setMaxContext] = useState<number>(Infinity);
  const [filterFree, setFilterFree] = useState(false);
  
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const config = PROVIDER_CONFIG[provider];
  const isAntigravity = provider === 'antigravity';

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      // NVIDIA, Gemini & Cerebras: Use default models (no fetch)
      if (provider === 'nvidia') {
        const defaultModel: ModelInfo = {
          id: 'stepfun-ai/step-3.5-flash',
          name: 'StepFun Step 3.5 Flash',
          context_length: 262144,
          provider: 'NVIDIA',
        };
        setModels([defaultModel]);
        
        // Auto-select default model
        const commonModel = {
          id: defaultModel.id,
          name: defaultModel.name,
          max_context: defaultModel.context_length,
        };
        onModelsLoaded([commonModel]);
        return;
      }

      if (provider === 'gemini') {
        const defaultModels: ModelInfo[] = [
          {
            id: 'gemini-3.1-flash-lite-preview',
            name: 'Gemini 3.1 Flash Lite Preview',
            context_length: 1000000,
            provider: 'Gemini',
          },
          {
            id: 'gemma-4-31b-it',
            name: 'Gemma 4 31B IT',
            context_length: 262144,
            provider: 'Gemini',
          },
        ];
        setModels(defaultModels);
        
        // Convert to common format and notify parent
        const commonModels = defaultModels.map(m => ({
          id: m.id,
          name: m.name,
          max_context: m.context_length,
        }));
        onModelsLoaded(commonModels);
        return;
      }

      if (provider === 'cerebras') {
        const defaultModels: ModelInfo[] = [
          {
            id: 'gpt-oss-120b',
            name: 'GPT OSS 120B',
            context_length: 131000,
            provider: 'Cerebras',
          },
          {
            id: 'zai-glm-4.7',
            name: 'ZAI GLM 4.7',
            context_length: 131000,
            provider: 'Cerebras',
          },
        ];
        setModels(defaultModels);
        
        // Convert to common format and notify parent
        const commonModels = defaultModels.map(m => ({
          id: m.id,
          name: m.name,
          max_context: m.context_length,
        }));
        onModelsLoaded(commonModels);
        return;
      }

      // Other providers: Fetch models
      if (isAntigravity) {
        const antigravityModels = await fetchAntigravityModels(config.baseUrl);
        setModels(antigravityModels);
        
        // Convert to common format and notify parent
        const commonModels = antigravityModels.map(m => ({
          id: m.id,
          name: m.name,
          max_context: m.max_context,
        }));
        onModelsLoaded(commonModels);
      } else {
        const fetchedModels = await fetchModels(config.baseUrl, provider, apiKey);
        setModels(fetchedModels);
        
        // Convert to common format and notify parent
        const commonModels = fetchedModels.map(m => ({
          id: m.id,
          name: m.name,
          max_context: m.context_length,
        }));
        onModelsLoaded(commonModels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      console.error('[ONBOARDING] Error fetching models:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique tabs based on model providers (for Kilo/OpenRouter)
  const providers = Array.from(new Set(
    models
      .map(m => 'provider' in m ? m.provider : undefined)
      .filter(Boolean)
  )) as string[];
  
  const tabs = isAntigravity 
    ? ['all', 'claude', 'gemini']
    : providers.length > 1 
      ? ['all', ...providers]
      : ['all'];

  // Initialize active tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.includes(selectedTab)) {
      setSelectedTab(tabs[0]);
    }
  }, [tabs.length]);

  const filteredModels = models
    .filter(model => {
      // Search filter
      const matchesSearch = !searchQuery || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Free filter
      const matchesFree = !filterFree || ('isFree' in model && model.isFree);
      
      // Tab filter
      let matchesTab = true;
      if (selectedTab !== 'all') {
        if (isAntigravity) {
          matchesTab = model.id.toLowerCase().includes(selectedTab);
        } else {
          matchesTab = 'provider' in model && model.provider === selectedTab;
        }
      }
      
      // Context filter
      const contextLength = ('context_length' in model 
        ? model.context_length 
        : (model as AntigravityModel).max_context) || 0;
      const matchesContext = contextLength >= minContext && contextLength <= maxContext;
      
      return matchesSearch && matchesFree && matchesTab && matchesContext;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'context': {
          const aContext = ('context_length' in a ? a.context_length : (a as AntigravityModel).max_context) || 0;
          const bContext = ('context_length' in b ? b.context_length : (b as AntigravityModel).max_context) || 0;
          return bContext - aContext;
        }
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-semibold">
          Chọn Models
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {provider === 'nvidia' || provider === 'gemini' || provider === 'cerebras'
            ? `${config.name} đã có models mặc định sẵn sàng sử dụng`
            : `Chọn các model bạn muốn sử dụng từ ${config.name}`
          }
        </p>
      </div>

      {/* Search and Filters - Hide for NVIDIA, Gemini & Cerebras (preview only) */}
      {provider !== 'nvidia' && provider !== 'gemini' && provider !== 'cerebras' && (
        <div className="space-y-2.5 max-w-2xl mx-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm models..."
            className="h-8 text-xs pl-8"
            disabled={loading}
          />
        </div>
        
        {/* Filter buttons row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Free filter - only show if there are free models */}
          {models.some(m => 'isFree' in m && m.isFree) && (
            <button
              onClick={() => setFilterFree(!filterFree)}
              disabled={loading}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                filterFree 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80 text-muted-foreground",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Filter className="w-3 h-3" />
              Chỉ Free
            </button>
          )}
          
          {/* Sort by */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              disabled={loading}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors bg-muted hover:bg-muted/80 text-muted-foreground",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              <BarChart3 className="w-3 h-3" />
              {sortBy === 'name' ? 'Sắp xếp: Tên' : 'Sắp xếp: Context'}
              <ChevronDown className={cn(
                "w-3 h-3 transition-transform",
                showSortDropdown && "rotate-180"
              )} />
            </button>
            
            {/* Sort dropdown */}
            {showSortDropdown && (
              <div className="absolute top-full mt-1 left-0 w-40 rounded-lg border border-border/30 bg-popover shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setSortBy('name');
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors",
                      sortBy === 'name'
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "text-popover-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    Theo tên
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('context');
                      setShowSortDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors",
                      sortBy === 'context'
                        ? "bg-accent text-accent-foreground font-semibold"
                        : "text-popover-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    Theo context
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Context length filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Context:</span>
            <Input
              type="number"
              value={minContext === 0 ? '' : minContext}
              onChange={(e) => setMinContext(e.target.value ? parseInt(e.target.value) : 0)}
              placeholder="Min"
              className="h-7 text-xs w-16"
              disabled={loading}
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              value={maxContext === Infinity ? '' : maxContext}
              onChange={(e) => setMaxContext(e.target.value ? parseInt(e.target.value) : Infinity)}
              placeholder="Max"
              className="h-7 text-xs w-16"
              disabled={loading}
            />
            {(minContext > 0 || maxContext < Infinity) && (
              <button
                onClick={() => {
                  setMinContext(0);
                  setMaxContext(Infinity);
                }}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Xóa
              </button>
            )}
          </div>
          
          {/* Refresh button */}
          <Button
            size="sm"
            variant="outline"
            onClick={loadModels}
            disabled={loading}
            className="h-7 text-xs ml-auto"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pb-2">
            {tabs.map(tab => {
              const count = tab === 'all' 
                ? models.length
                : isAntigravity
                  ? models.filter(m => m.id.toLowerCase().includes(tab)).length
                  : models.filter(m => 'provider' in m && m.provider === tab).length;
              
              return (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0',
                    selectedTab === tab
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Models List */}
      <div className="max-w-2xl mx-auto">
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <ModelSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mb-2" />
              <p className="text-sm text-destructive font-medium">Không thể tải models</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <Button size="sm" variant="outline" onClick={loadModels} className="mt-3">
                <RefreshCw className="w-3 h-3 mr-1" />
                Thử lại
              </Button>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Không tìm thấy models</p>
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = selectedModels.some(m => m.id === model.id);
              const maxContext = 'context_length' in model 
                ? model.context_length 
                : (model as AntigravityModel).max_context;
              
              return (
                <ModelCard
                  key={model.id}
                  id={model.id}
                  name={model.name}
                  maxContext={maxContext}
                  selected={isSelected}
                  onToggle={() => onToggleModel({
                    id: model.id,
                    name: model.name,
                    max_context: maxContext,
                  })}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Selected Count */}
      <div className="text-center text-sm text-muted-foreground">
        Đã chọn: {selectedModels.length} model(s) · Hiển thị: {filteredModels.length}/{models.length}
      </div>

      {/* Progress */}
      <ProgressIndicator totalSteps={3} currentStep={2} />

      {/* Navigation */}
      <div className="flex gap-2.5 pt-2 max-w-sm mx-auto">
        <Button 
          onClick={onBack}
          variant="outline"
          className="flex-1 h-10 text-sm"
          disabled={completing}
        >
          Quay lại
        </Button>
        <Button 
          onClick={onComplete}
          disabled={selectedModels.length === 0 || completing}
          className="flex-1 h-10 text-sm"
        >
          {completing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            <>
              Hoàn tất
              <Check className="ml-2 w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
