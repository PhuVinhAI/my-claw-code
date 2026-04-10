// CustomDropdown - Reusable dropdown component
import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropdownOption {
  id: string;
  label: string;
  icon?: ReactNode;
  group?: string;
  providerId?: string; // For provider filtering
  description?: string; // For showing additional info
}

interface Provider {
  id: string;
  name: string;
}

interface CustomDropdownProps {
  trigger: string | ReactNode;
  options: DropdownOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  multiSelect?: boolean;
  className?: string;
  dropdownClassName?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  providers?: Provider[];
  selectedProviders?: string[];
  onProviderFilterChange?: (providers: string[]) => void;
  filterByProviderLabel?: string;
  noModelsFoundLabel?: string;
  align?: 'start' | 'end'; // Align dropdown to start (left) or end (right)
}

export function CustomDropdown({
  trigger,
  options,
  value,
  onChange,
  multiSelect = false,
  className,
  dropdownClassName,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search...',
  providers,
  selectedProviders = [],
  onProviderFilterChange,
  filterByProviderLabel = 'Filter by provider:',
  noModelsFoundLabel = 'No models found',
  align = 'start',
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showProviderFilter, setShowProviderFilter] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowProviderFilter(false);
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowProviderFilter(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchInputRef.current && onSearchChange) {
      // Clear search when opening
      onSearchChange('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open, onSearchChange]);

  const handleSelect = (optionId: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionId)
        ? currentValues.filter((v) => v !== optionId)
        : [...currentValues, optionId];
      onChange(newValues);
    } else {
      onChange(optionId);
      setOpen(false);
    }
  };

  const toggleProviderFilter = (providerId: string) => {
    if (!onProviderFilterChange) return;
    
    const newSelected = selectedProviders.includes(providerId)
      ? selectedProviders.filter(id => id !== providerId)
      : [...selectedProviders, providerId];
    
    onProviderFilterChange(newSelected);
  };

  const isSelected = (optionId: string) => {
    if (multiSelect) {
      return Array.isArray(value) && value.includes(optionId);
    }
    return value === optionId;
  };

  // Group options by group property
  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || 'default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(option);
    return acc;
  }, {} as Record<string, DropdownOption[]>);

  // Show search/filter only if there are many options
  const showSearchFilter = options.length > 10;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          className
        )}
      >
        {typeof trigger === 'string' ? <span>{trigger}</span> : trigger}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute bottom-full mb-1.5 w-max max-w-[280px] rounded-lg border border-border/30 bg-popover animate-in fade-in slide-in-from-bottom-2 duration-150 z-[100] flex flex-col shadow-xl",
            align === 'end' ? 'right-0' : 'left-0',
            dropdownClassName
          )}
        >
          {/* Sticky Search/Filter Section */}
          {showSearchFilter && onSearchChange && (
            <div className="sticky top-0 bg-popover z-10 border-b border-border/20 p-1.5">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full px-2.5 py-1.5 pr-8 text-xs bg-card border border-input rounded-md focus:outline-none focus:border-border transition-all text-foreground placeholder:text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      onSearchChange('');
                      searchInputRef.current?.blur();
                    }
                  }}
                />
                
                {/* Filter Icon Button */}
                {providers && providers.length > 1 && onProviderFilterChange && (
                  <button
                    ref={filterButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProviderFilter(!showProviderFilter);
                    }}
                    className={cn(
                      "absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors",
                      selectedProviders.length > 0
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={selectedProviders.length > 0 ? `Đang lọc ${selectedProviders.length} provider` : "Lọc theo provider"}
                  >
                    <Filter className="h-3 w-3" />
                    {selectedProviders.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 bg-primary rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {/* Provider Filter Dropdown */}
              {showProviderFilter && providers && providers.length > 1 && onProviderFilterChange && (
                <div className="mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="bg-card rounded-md p-1.5 border border-border/20">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <div className="text-[10px] font-medium text-muted-foreground">{filterByProviderLabel}</div>
                      {selectedProviders.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onProviderFilterChange([]);
                          }}
                          className="text-[10px] text-primary hover:text-primary/80 font-medium"
                        >
                          Xóa bộ lọc
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {providers.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProviderFilter(provider.id);
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[10px] rounded-sm transition-colors",
                            selectedProviders.includes(provider.id)
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          {provider.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scrollable Options List */}
          <div className="overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                {noModelsFoundLabel}
              </div>
            ) : (
              Object.entries(groupedOptions).map(([groupName, groupOptions], groupIndex) => (
            <div key={groupName}>
              {groupName !== 'default' && (
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {groupName}
                </div>
              )}
              <div className="space-y-0.5">
                {groupOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
                      isSelected(option.id)
                        ? multiSelect
                          ? "bg-primary/10 text-primary font-semibold"
                          : "bg-accent text-accent-foreground font-semibold"
                        : "text-popover-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={option.description || option.label}
                  >
                    {multiSelect && (
                      <div
                        className={cn(
                          "h-3.5 w-3.5 rounded-[3px] border flex items-center justify-center shrink-0",
                          isSelected(option.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}
                      >
                        {isSelected(option.id) && (
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    )}
                    {option.icon && <div className="shrink-0">{option.icon}</div>}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {groupIndex < Object.entries(groupedOptions).length - 1 && (
                <div className="my-1 h-px bg-border/30" />
              )}
            </div>
          ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
