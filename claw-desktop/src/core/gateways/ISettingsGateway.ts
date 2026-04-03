// Settings Gateway Interface
import { Settings, Provider, Model } from '../entities';

export interface ISettingsGateway {
  // Check onboarding
  checkOnboardingComplete(): Promise<boolean>;

  // Settings CRUD
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  // Provider CRUD
  addProvider(provider: Provider): Promise<void>;
  updateProvider(provider: Provider): Promise<void>;
  deleteProvider(providerId: string): Promise<void>;

  // Model CRUD
  addModel(providerId: string, model: Model): Promise<void>;
  updateModel(providerId: string, model: Model): Promise<void>;
  deleteModel(providerId: string, modelId: string): Promise<void>;

  // Selected model
  setSelectedModel(providerId: string, modelId: string): Promise<void>;
  getSelectedModelInfo(): Promise<{ provider: Provider; model: Model } | null>;
}
