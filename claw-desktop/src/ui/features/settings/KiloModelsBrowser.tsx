// KiloModelsBrowser - Wrapper around ModelsBrowser for Kilo Gateway
// DEPRECATED: Use ModelsBrowser directly instead
import { Model } from '../../../core/entities';
import { ModelsBrowser } from './ModelsBrowser';
import { ModelInfo } from './fetchModels';
import { useTranslation } from 'react-i18next';

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
  isLoading?: boolean;
}

/**
 * @deprecated Use ModelsBrowser directly instead
 * This is a thin wrapper for backward compatibility
 */
export function KiloModelsBrowser({ 
  models, 
  existingModels, 
  onAddModel, 
  isOpen, 
  onOpenChange,
  isLoading = false,
}: KiloModelsBrowserProps) {
  const { t } = useTranslation();
  
  // Convert KiloModel to ModelInfo (they're compatible)
  const modelInfos: ModelInfo[] = models;

  return (
    <ModelsBrowser
      models={modelInfos}
      existingModels={existingModels}
      onAddModel={onAddModel}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('kiloModelsBrowser.title')}
      isLoading={isLoading}
    />
  );
}
