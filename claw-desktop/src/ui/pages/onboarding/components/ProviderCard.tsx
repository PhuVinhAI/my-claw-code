// Provider Card - Selectable card for each provider
import { Check, Cpu, Zap, Network, Server, Sparkles, Gauge } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { ProviderInfo } from '../types';

interface ProviderCardProps {
  provider: ProviderInfo;
  selected: boolean;
  onSelect: () => void;
}

// Icon mapping for providers
const PROVIDER_ICONS = {
  nvidia: Cpu,
  gemini: Sparkles,
  cerebras: Gauge,
  kilo: Zap,
  openrouter: Network,
  antigravity: Server,
};

export function ProviderCard({ provider, selected, onSelect }: ProviderCardProps) {
  const IconComponent = PROVIDER_ICONS[provider.id as keyof typeof PROVIDER_ICONS] || Server;
  
  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative w-full p-4 rounded-lg border-2 transition-all text-left',
        'hover:border-primary/50 hover:bg-accent/50',
        selected 
          ? 'border-primary bg-accent' 
          : 'border-border bg-card'
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      
      {/* Icon */}
      <div className="mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <IconComponent className="w-5 h-5 text-primary" />
        </div>
      </div>
      
      {/* Name */}
      <h3 className="font-semibold text-base mb-1">{provider.name}</h3>
      
      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {provider.description}
      </p>
      
      {/* Badge */}
      {provider.requiresApiKey && (
        <div className="mt-2 inline-block px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
          Cần API Key
        </div>
      )}
    </button>
  );
}
