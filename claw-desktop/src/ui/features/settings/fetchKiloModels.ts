// Helper function to fetch Kilo Gateway models
import { invoke } from '@tauri-apps/api/core';
import { KiloModel } from './KiloModelsBrowser';

export async function fetchKiloModels(): Promise<KiloModel[]> {
  try {
    const response = await invoke<string>('fetch_kilo_models');
    console.log('[Kilo] Raw response length:', response.length);
    
    const data = JSON.parse(response);
    console.log('[Kilo] Parsed data keys:', Object.keys(data));
    
    // API returns {"data": [...]} structure
    let fetchedModels = data.data || data.models || [];
    
    // If still empty, try the root array
    if (!Array.isArray(fetchedModels) || fetchedModels.length === 0) {
      if (Array.isArray(data)) {
        fetchedModels = data;
      }
    }
    
    console.log('[Kilo] Extracted models count:', fetchedModels.length);
    
    if (fetchedModels.length > 0) {
      console.log('[Kilo] First 3 models:', fetchedModels.slice(0, 3));
    } else {
      console.error('[Kilo] No models found in response!');
    }
    
    return fetchedModels;
  } catch (error) {
    console.error('Failed to fetch Kilo models:', error);
    throw error;
  }
}
