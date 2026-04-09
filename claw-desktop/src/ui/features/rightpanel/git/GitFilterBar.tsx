import { ChevronDown, Check, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu';

export type FilterType = 'uncommitted' | 'unstaged' | 'staged' | 'branch';

interface GitFilterBarProps {
  filterType: FilterType;
  filteredCount: number;
  selectedCount: number;
  totalAdditions: number;
  totalDeletions: number;
  allSelected: boolean;
  onFilterChange: (filter: FilterType) => void;
  onToggleSelectAll: () => void;
  onDiscardSelected: () => void;
}

export function GitFilterBar({
  filterType,
  filteredCount,
  selectedCount,
  totalAdditions,
  totalDeletions,
  allSelected,
  onFilterChange,
  onToggleSelectAll,
  onDiscardSelected,
}: GitFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/5 shrink-0">
      <div className="flex items-center gap-2">
        {/* Select All Checkbox */}
        <button
          onClick={onToggleSelectAll}
          className="p-0.5 hover:bg-accent rounded transition-colors"
          title={t('gitPanel.selectAll')}
        >
          <div className={cn(
            'w-3.5 h-3.5 border rounded flex items-center justify-center',
            allSelected ? 'bg-primary border-primary' : 'border-border'
          )}>
            {allSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
          </div>
        </button>

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs hover:bg-accent px-2 py-0.5 rounded transition-colors">
            <span className="font-medium">
              {filteredCount} {t(`gitPanel.filter.${filterType}`)}
            </span>
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => onFilterChange('uncommitted')}>
              <div className="flex items-center justify-between w-full">
                <span>{t('gitPanel.filter.uncommitted')}</span>
                {filterType === 'uncommitted' && <Check className="w-3 h-3" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('unstaged')}>
              <div className="flex items-center justify-between w-full">
                <span>{t('gitPanel.filter.unstaged')}</span>
                {filterType === 'unstaged' && <Check className="w-3 h-3" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('staged')}>
              <div className="flex items-center justify-between w-full">
                <span>{t('gitPanel.filter.staged')}</span>
                {filterType === 'staged' && <Check className="w-3 h-3" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange('branch')}>
              <div className="flex items-center justify-between w-full">
                <span>{t('gitPanel.filter.branch')}</span>
                {filterType === 'branch' && <Check className="w-3 h-3" />}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Stats - Only show when there are changes */}
        {(totalAdditions > 0 || totalDeletions > 0) && (
          <>
            <span className="text-green-500 text-xs">+{totalAdditions}</span>
            <span className="text-red-500 text-xs">-{totalDeletions}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {selectedCount > 0 && (
          <button
            onClick={onDiscardSelected}
            className="p-0.5 hover:bg-accent rounded transition-colors"
            title={t('gitPanel.discardSelected')}
          >
            <Undo2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
