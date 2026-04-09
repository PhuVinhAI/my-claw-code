// Onboarding Types
export type ProviderId = 'nvidia' | 'gemini' | 'cerebras' | 'kilo' | 'openrouter' | 'antigravity';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  requiresApiKey: boolean;
  apiKeyUrl?: string;
  setupInstructions?: string[];
}

export interface OnboardingState {
  step: number;
  selectedProvider: ProviderId | null;
  apiKey: string;
  selectedModels: Array<{
    id: string;
    name: string;
    max_context?: number;
  }>;
}
