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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchInputRef.current && onSearchChange) {
      searchInputRef.current.focus();
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
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#888888] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-all duration-150",
          className
        )}
      >
        {typeof trigger === 'string' ? <span>{trigger}</span> : trigger}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute bottom-full left-0 mb-2 w-max max-w-[280px] rounded-xl border border-[#3e3e42] bg-[#252526] animate-in fade-in slide-in-from-bottom-2 duration-150 z-[100] flex flex-col shadow-xl",
            dropdownClassName
          )}
        >
          {/* Sticky Search/Filter Section */}
          {showSearchFilter && onSearchChange && (
            <div className="sticky top-0 bg-[#252526] z-10 border-b border-[#3e3e42]/30 p-2">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full px-3 py-2 pr-9 text-sm bg-[#1e1e1e] border border-[#333333] rounded-lg focus:outline-none focus:border-[#454545] transition-all text-[#e0e0e0] placeholder:text-[#666666]"
                  onClick={(e) => e.stopPropagation()}
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
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-[#2a2a2a] transition-colors",
                      selectedProviders.length > 0
                        ? "text-[#0078d4]"
                        : "text-[#888888] hover:text-[#e0e0e0]"
                    )}
                    title="Filter by provider"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {selectedProviders.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 bg-[#0078d4] rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {/* Provider Filter Dropdown */}
              {showProviderFilter && providers && providers.length > 1 && onProviderFilterChange && (
                <div className="mt-2">
                  <div className="bg-[#1e1e1e] rounded-lg p-2 border border-[#3e3e42]/30">
                    <div className="text-xs font-medium text-[#888888] mb-2 px-1">{filterByProviderLabel}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {providers.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProviderFilter(provider.id);
                          }}
                          className={cn(
                            "px-2.5 py-1 text-xs rounded-md transition-all duration-150",
                            selectedProviders.includes(provider.id)
                              ? "bg-[#0078d4] text-[#ffffff] font-medium"
                              : "bg-[#2a2a2a] text-[#888888] hover:bg-[#333333] hover:text-[#e0e0e0]"
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
              <div className="px-3 py-4 text-sm text-[#888888] text-center">
                {noModelsFoundLabel}
              </div>
            ) : (
              Object.entries(groupedOptions).map(([groupName, groupOptions], groupIndex) => (
            <div key={groupName}>
              {groupName !== 'default' && (
                <div className="px-3 py-2 text-xs font-semibold text-[#888888]">
                  {groupName}
                </div>
              )}
              <div className="space-y-1">
                {groupOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-sm transition-colors duration-150",
                      isSelected(option.id)
                        ? multiSelect
                          ? "bg-[#0078d4]/10 text-[#0078d4] font-semibold"
                          : "bg-[#37373d] text-[#ffffff] font-semibold"
                        : "text-[#cccccc] hover:bg-[#2a2d2e] hover:text-[#ffffff]"
                    )}
                    title={option.label}
                  >
                    {multiSelect && (
                      <div
                        className={cn(
                          "h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0",
                          isSelected(option.id)
                            ? "bg-[#0078d4] border-[#0078d4] text-[#ffffff]"
                            : "border-[#888888]"
                        )}
                      >
                        {isSelected(option.id) && (
                          <svg
                            className="h-3 w-3"
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
                    <span className="truncate min-w-0 flex-1 text-left">{option.label}</span>
                  </button>
                ))}
              </div>
              {groupIndex < Object.entries(groupedOptions).length - 1 && (
                <div className="my-1 h-px bg-[#3e3e42]" />
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
