// Model Card - Selectable card for models
import { Check } from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface ModelCardProps {
  id: string;
  name: string;
  maxContext?: number;
  selected: boolean;
  onToggle: () => void;
}

export function ModelCard({ id, name, maxContext, selected, onToggle }: ModelCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer",
        selected 
          ? "border-primary/50 bg-accent" 
          : "border-border hover:bg-muted"
      )}
      onClick={onToggle}
    >
      <div className="flex-1 min-w-0 mr-2">
        <p className="font-medium text-sm truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground font-mono truncate">{id}</p>
          {maxContext && (
            <span className="text-xs text-muted-foreground">
              {(maxContext / 1000).toFixed(0)}K
            </span>
          )}
        </div>
      </div>
      <div className={cn(
        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
        selected ? "border-primary bg-primary" : "border-muted-foreground"
      )}>
        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
    </div>
  );
}
