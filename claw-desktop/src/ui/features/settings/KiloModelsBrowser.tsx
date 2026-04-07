// KiloModelsBrowser - Browse and add models from Kilo Gateway
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../../../core/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Check, Search, Filter, BarChart3, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface KiloModel {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    input: number;
    output: number;
  };
  isFree?: boolean;
}

interface KiloModelsBrowserProps {
  models: KiloModel[];
  existingModels: Model[];
  onAddModel: (model: Model) => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KiloModelsBrowser({ models, existingModels, onAddModel, isOpen, onOpenChange }: KiloModelsBrowserProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFree, setFilterFree] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'context'>('name');
  const [minContext, setMinContext] = useState<number>(0);
  const [maxContext, setMaxContext] = useState<number>(Infinity);

  // Extract unique providers from models
  const providers = Array.from(new Set(models.map(m => m.provider).filter(Boolean))) as string[];

  const handleAddModel = async (kiloModel: KiloModel) => {
    try {
      await onAddModel({
        id: kiloModel.id,
        name: kiloModel.name,
        max_context: kiloModel.context_length,
      });
    } catch (error) {
      console.error('Failed to add model:', error);
    }
  };

  // Filter and sort models
  const filteredModels = models
    .filter(model => {
      const matchesSearch = !searchQuery || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFree = !filterFree || model.isFree;
      const matchesProvider = filterProvider === 'all' || model.provider === filterProvider;
      
      const contextLength = model.context_length || 0;
      const matchesContext = contextLength >= minContext && contextLength <= maxContext;
      
      return matchesSearch && matchesFree && matchesProvider && matchesContext;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'context':
          return (b.context_length || 0) - (a.context_length || 0);
        default:
          return 0;
      }
    });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('kiloModelsBrowser.title')}
            <span className="text-xs text-muted-foreground font-normal">
              ({filteredModels.length}/{models.length})
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="space-y-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('kiloModelsBrowser.searchPlaceholder')}
              className="h-8 text-xs pl-8"
            />
          </div>
          
          {/* Filter buttons row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterFree(!filterFree)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                filterFree 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              <Filter className="w-3 h-3" />
              {t('kiloModelsBrowser.filterFree')}
            </button>
            
            {/* Provider filter */}
            <div className="relative">
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="pl-2.5 pr-8 py-1.5 rounded-md text-xs bg-muted hover:bg-muted/80 text-foreground border-0 outline-none cursor-pointer appearance-none"
              >
                <option value="all">{t('kiloModelsBrowser.allProviders')}</option>
                {providers.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
            
            {/* Sort by */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="pl-2.5 pr-8 py-1.5 rounded-md text-xs bg-muted hover:bg-muted/80 text-foreground border-0 outline-none cursor-pointer appearance-none"
              >
                <option value="name">{t('kiloModelsBrowser.sortByName')}</option>
                <option value="context">{t('kiloModelsBrowser.sortByContext')}</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
            
            {/* Context length filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{t('kiloModelsBrowser.contextLabel')}</span>
              <Input
                type="number"
                value={minContext === 0 ? '' : minContext}
                onChange={(e) => setMinContext(e.target.value ? parseInt(e.target.value) : 0)}
                placeholder={t('kiloModelsBrowser.minPlaceholder')}
                className="h-7 text-xs w-16"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <Input
                type="number"
                value={maxContext === Infinity ? '' : maxContext}
                onChange={(e) => setMaxContext(e.target.value ? parseInt(e.target.value) : Infinity)}
                placeholder={t('kiloModelsBrowser.maxPlaceholder')}
                className="h-7 text-xs w-16"
              />
              {(minContext > 0 || maxContext < Infinity) && (
                <button
                  onClick={() => {
                    setMinContext(0);
                    setMaxContext(Infinity);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('kiloModelsBrowser.clear')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 min-h-0">
          {filteredModels.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {t('kiloModelsBrowser.noModelsFound')}
            </div>
          ) : (
            filteredModels.map((model) => {
              const alreadyAdded = existingModels.some(m => m.id === model.id);
              return (
                <div
                  key={model.id}
                  className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-xs truncate">{model.name}</p>
                      {model.isFree && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                          FREE
                        </span>
                      )}
                      {model.provider && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                          {model.provider}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{model.id}</p>
                    {model.context_length && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        {(model.context_length / 1000).toFixed(0)}K tokens
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyAdded ? "outline" : "default"}
                    disabled={alreadyAdded}
                    onClick={() => handleAddModel(model)}
                    className="h-7 text-xs shrink-0"
                  >
                    {alreadyAdded ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        {t('kiloModelsBrowser.added')}
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        {t('kiloModelsBrowser.add')}
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
