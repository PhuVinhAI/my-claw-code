// Settings Store - Zustand
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ISettingsGateway } from '../core/gateways';
import { Settings, Provider, Model } from '../core/entities';
import { TauriSettingsGateway } from '../adapters/tauri';

interface SettingsStore {
  // State
  settings: Settings | null;
  isLoading: boolean;
  gateway: ISettingsGateway;

  // Actions
  getSettings: () => Promise<Settings>;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;

  // Provider CRUD
  addProvider: (provider: Provider) => Promise<void>;
  updateProvider: (provider: Provider) => Promise<void>;
  deleteProvider: (providerId: string) => Promise<void>;

  // Model CRUD
  addModel: (providerId: string, model: Model) => Promise<void>;
  updateModel: (providerId: string, model: Model) => Promise<void>;
  deleteModel: (providerId: string, modelId: string) => Promise<void>;

  // Selected model
  setSelectedModel: (providerId: string, modelId: string) => Promise<void>;
  getSelectedModelInfo: () => Promise<{ provider: Provider; model: Model } | null>;
  
  // Compact config
  updateCompactConfig: (config: { threshold_ratio: number; preserve_recent_messages: number }) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,
  gateway: new TauriSettingsGateway(),

  getSettings: async () => {
    try {
      return await get().gateway.getSettings();
    } catch (error) {
      console.error('Failed to get settings:', error);
      throw error;
    }
  },

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await get().gateway.getSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  saveSettings: async (settings: Settings) => {
    try {
      await get().gateway.saveSettings(settings);
      set({ settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },

  addProvider: async (provider: Provider) => {
    try {
      await get().gateway.addProvider(provider);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to add provider:', error);
      throw error;
    }
  },

  updateProvider: async (provider: Provider) => {
    try {
      await get().gateway.updateProvider(provider);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to update provider:', error);
      throw error;
    }
  },

  deleteProvider: async (providerId: string) => {
    try {
      await get().gateway.deleteProvider(providerId);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to delete provider:', error);
      throw error;
    }
  },

  addModel: async (providerId: string, model: Model) => {
    try {
      await get().gateway.addModel(providerId, model);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to add model:', error);
      throw error;
    }
  },

  updateModel: async (providerId: string, model: Model) => {
    try {
      await get().gateway.updateModel(providerId, model);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to update model:', error);
      throw error;
    }
  },

  deleteModel: async (providerId: string, modelId: string) => {
    try {
      await get().gateway.deleteModel(providerId, modelId);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to delete model:', error);
      throw error;
    }
  },

  setSelectedModel: async (providerId: string, modelId: string) => {
    try {
      await get().gateway.setSelectedModel(providerId, modelId);
      await get().loadSettings(); // Reload
      
      // Reload API client in backend
      try {
        await invoke('reload_api_client');
        console.log('[SETTINGS] API client reloaded successfully');
      } catch (error) {
        console.error('[SETTINGS] Failed to reload API client:', error);
        // Don't throw - settings were saved successfully
      }
    } catch (error) {
      console.error('Failed to set selected model:', error);
      throw error;
    }
  },

  getSelectedModelInfo: async () => {
    try {
      return await get().gateway.getSelectedModelInfo();
    } catch (error) {
      console.error('Failed to get selected model info:', error);
      throw error;
    }
  },

  updateCompactConfig: async (config: { threshold_ratio: number; preserve_recent_messages: number }) => {
    try {
      const currentSettings = get().settings;
      if (!currentSettings) throw new Error('Settings not loaded');
      
      const updatedSettings = {
        ...currentSettings,
        compact_config: config,
      };
      
      await get().saveSettings(updatedSettings);
      await get().loadSettings(); // Reload
    } catch (error) {
      console.error('Failed to update compact config:', error);
      throw error;
    }
  },
}));
