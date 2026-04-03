// TauriSettingsGateway - Adapter implementing ISettingsGateway
import { invoke } from '@tauri-apps/api/core';
import { ISettingsGateway } from '../../core/gateways';
import { Settings, Provider, Model } from '../../core/entities';

export class TauriSettingsGateway implements ISettingsGateway {
  async checkOnboardingComplete(): Promise<boolean> {
    return await invoke('check_onboarding_complete');
  }

  async getSettings(): Promise<Settings> {
    return await invoke('get_settings');
  }

  async saveSettings(settings: Settings): Promise<void> {
    await invoke('save_settings', { settings });
  }

  async addProvider(provider: Provider): Promise<void> {
    await invoke('add_provider', { provider });
  }

  async updateProvider(provider: Provider): Promise<void> {
    await invoke('update_provider', { provider });
  }

  async deleteProvider(providerId: string): Promise<void> {
    await invoke('delete_provider', { providerId });
  }

  async addModel(providerId: string, model: Model): Promise<void> {
    await invoke('add_model', { providerId, model });
  }

  async updateModel(providerId: string, model: Model): Promise<void> {
    await invoke('update_model', { providerId, model });
  }

  async deleteModel(providerId: string, modelId: string): Promise<void> {
    await invoke('delete_model', { providerId, modelId });
  }

  async setSelectedModel(providerId: string, modelId: string): Promise<void> {
    await invoke('set_selected_model', { providerId, modelId });
  }

  async getSelectedModelInfo(): Promise<{ provider: Provider; model: Model } | null> {
    return await invoke('get_selected_model_info');
  }
}
