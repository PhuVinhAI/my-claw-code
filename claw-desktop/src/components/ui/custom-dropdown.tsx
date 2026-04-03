// CustomDropdown - Reusable dropdown component
import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropdownOption {
  id: string;
  label: string;
  icon?: ReactNode;
  group?: string;
}

interface CustomDropdownProps {
  trigger: string | ReactNode;
  options: DropdownOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  multiSelect?: boolean;
  className?: string;
  dropdownClassName?: string;
}

export function CustomDropdown({
  trigger,
  options,
  value,
  onChange,
  multiSelect = false,
  className,
  dropdownClassName,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150",
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
            "absolute bottom-full left-0 mb-2 w-max max-w-[280px] rounded-xl border border-border bg-popover p-2 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50",
            dropdownClassName
          )}
        >
          {Object.entries(groupedOptions).map(([groupName, groupOptions], groupIndex) => (
            <div key={groupName}>
              {groupName !== 'default' && (
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {groupName}
                </div>
              )}
              <div className="space-y-1">
                {groupOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150",
                      isSelected(option.id)
                        ? multiSelect
                          ? "bg-primary/10 text-primary font-semibold"
                          : "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    )}
                    title={option.label}
                  >
                    {multiSelect && (
                      <div
                        className={cn(
                          "h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0",
                          isSelected(option.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
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
                <div className="my-2 h-px bg-border" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
