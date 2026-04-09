// ModelsBrowser - Reusable component for browsing and adding models
// Works with Kilo, OpenRouter, and any OpenAI-compatible provider
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from '../../../core/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Check, Search, Filter, BarChart3, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ModelInfo } from './fetchModels';

interface ModelsBrowserProps {
  models: ModelInfo[];
  existingModels: Model[];
  onAddModel: (model: Model) => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  isLoading?: boolean;
}

export function ModelsBrowser({ 
  models, 
  existingModels, 
  onAddModel, 
  isOpen, 
  onOpenChange,
  title,
  isLoading = false,
}: ModelsBrowserProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFree, setFilterFree] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'context'>('name');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [minContext, setMinContext] = useState<number>(0);
  const [maxContext, setMaxContext] = useState<number>(Infinity);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Extract unique providers from models
  const providers = Array.from(new Set(models.map(m => m.provider).filter(Boolean))) as string[];
  
  // Initialize selected providers and active tab
  useEffect(() => {
    if (providers.length > 0 && selectedProviders.length === 0) {
      setSelectedProviders(providers);
      setActiveTab(providers[0]);
    }
  }, [providers.length]);

  // Close provider dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddModel = async (modelInfo: ModelInfo) => {
    try {
      await onAddModel({
        id: modelInfo.id,
        name: modelInfo.name,
        max_context: modelInfo.context_length,
      });
    } catch (error) {
      console.error('Failed to add model:', error);
    }
  };
  
  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev => 
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  // Filter models by active tab and other filters
  const filteredModels = models
    .filter(model => {
      // If filterFree is active, show all free models regardless of tab
      if (filterFree) {
        const matchesSearch = !searchQuery || 
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesFree = model.isFree;
        
        const contextLength = model.context_length || 0;
        const matchesContext = contextLength >= minContext && contextLength <= maxContext;
        
        return matchesSearch && matchesFree && matchesContext;
      }
      
      // Otherwise, filter by active tab (provider)
      if (!model.provider || model.provider !== activeTab) return false;
      
      const matchesSearch = !searchQuery || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const contextLength = model.context_length || 0;
      const matchesContext = contextLength >= minContext && contextLength <= maxContext;
      
      return matchesSearch && matchesContext;
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
            {title || t('modelsBrowser.title')}
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-xs text-muted-foreground font-normal">
                ({filteredModels.length}/{models.length})
              </span>
            )}
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
              placeholder={t('modelsBrowser.searchPlaceholder')}
              className="h-8 text-xs pl-8"
              disabled={isLoading}
            />
          </div>
          
          {/* Filter buttons row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Free filter - only show if there are free models */}
            {models.some(m => m.isFree) && (
              <button
                onClick={() => setFilterFree(!filterFree)}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                  filterFree 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80 text-muted-foreground",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <Filter className="w-3 h-3" />
                {t('modelsBrowser.filterFree')}
              </button>
            )}
            
            {/* Provider toggle dropdown */}
            {providers.length > 0 && (
              <div className="relative" ref={providerDropdownRef}>
                <button
                  onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                    selectedProviders.length < providers.length
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Filter className="w-3 h-3" />
                  {t('modelsBrowser.toggleProviders')} ({selectedProviders.length}/{providers.length})
                  <ChevronDown className={cn(
                    "w-3 h-3 transition-transform",
                    showProviderDropdown && "rotate-180"
                  )} />
                </button>
                
                {/* Provider toggle dropdown */}
                {showProviderDropdown && (
                  <div className="absolute top-full mt-1 left-0 w-56 rounded-lg border border-border/30 bg-popover shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-1.5 max-h-64 overflow-y-auto space-y-0.5">
                      {providers.map(provider => (
                        <button
                          key={provider}
                          onClick={() => toggleProvider(provider)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors flex items-center gap-2",
                            "text-popover-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center shrink-0",
                            selectedProviders.includes(provider)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}>
                            {selectedProviders.includes(provider) && (
                              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          {provider}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Sort by */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors bg-muted hover:bg-muted/80 text-muted-foreground",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <BarChart3 className="w-3 h-3" />
                {sortBy === 'name' ? t('modelsBrowser.sortByName') : t('modelsBrowser.sortByContext')}
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
                      {t('modelsBrowser.sortByName')}
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
                      {t('modelsBrowser.sortByContext')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Context length filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{t('modelsBrowser.contextLabel')}</span>
              <Input
                type="number"
                value={minContext === 0 ? '' : minContext}
                onChange={(e) => setMinContext(e.target.value ? parseInt(e.target.value) : 0)}
                placeholder={t('modelsBrowser.minPlaceholder')}
                className="h-7 text-xs w-16"
                disabled={isLoading}
              />
              <span className="text-xs text-muted-foreground">-</span>
              <Input
                type="number"
                value={maxContext === Infinity ? '' : maxContext}
                onChange={(e) => setMaxContext(e.target.value ? parseInt(e.target.value) : Infinity)}
                placeholder={t('modelsBrowser.maxPlaceholder')}
                className="h-7 text-xs w-16"
                disabled={isLoading}
              />
              {(minContext > 0 || maxContext < Infinity) && (
                <button
                  onClick={() => {
                    setMinContext(0);
                    setMaxContext(Infinity);
                  }}
                  disabled={isLoading}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('modelsBrowser.clear')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Provider Tabs - Hide when filterFree is active */}
        {!filterFree && selectedProviders.length > 0 && (
          <div className="relative -mx-2 px-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pb-2">
              {selectedProviders.map(provider => {
                const providerModels = models.filter(m => m.provider === provider);
                const modelCount = providerModels.length;
                
                return (
                  <button
                    key={provider}
                    onClick={() => setActiveTab(provider)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 border",
                      activeTab === provider
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border-border"
                    )}
                  >
                    <span>{provider}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 text-[10px] font-semibold rounded",
                      activeTab === provider
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {modelCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Models List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('modelsBrowser.loading')}</p>
              </div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {t('modelsBrowser.noModelsFound')}
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
                      {model.isVirtual && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400">
                          AUTO
                        </span>
                      )}
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
                    {model.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{model.description}</p>
                    )}
                    {model.context_length && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        {(model.context_length / 1000).toFixed(0)}K tokens
                      </p>
                    )}
                    {/* Only show pricing for models that have it (e.g., OpenRouter) */}
                    {model.pricing && !model.isFree && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ${model.pricing.input.toFixed(6)}/1K in · ${model.pricing.output.toFixed(6)}/1K out
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
                        {t('modelsBrowser.added')}
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        {t('modelsBrowser.add')}
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
