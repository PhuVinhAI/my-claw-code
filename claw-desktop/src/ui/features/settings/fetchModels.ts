// Shared utility for fetching models from OpenAI-compatible endpoints
// Supports Kilo, OpenRouter, and other OpenAI-compatible providers
// Uses Tauri command to bypass CORS
// Implements 1-day cache for faster loading

import { invoke } from '@tauri-apps/api/core';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds

interface CacheEntry {
  data: ModelInfo[];
  timestamp: number;
}

function getCacheKey(providerId: string, baseUrl: string): string {
  return `models_cache_${providerId}_${baseUrl}`;
}

function getFromCache(cacheKey: string): ModelInfo[] | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (less than 1 day old)
    if (now - entry.timestamp < CACHE_DURATION) {
      console.log(`[CACHE] Using cached models for ${cacheKey}`);
      return entry.data;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.error('[CACHE] Failed to read cache:', error);
    return null;
  }
}

function saveToCache(cacheKey: string, data: ModelInfo[]): void {
  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    console.log(`[CACHE] Saved ${data.length} models to cache for ${cacheKey}`);
  } catch (error) {
    console.error('[CACHE] Failed to save cache:', error);
  }
}

export interface ModelInfo {
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
  isVirtual?: boolean; // For kilo-auto/* virtual routing models
}

interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
  }>;
}

interface KiloModel {
  id: string;
  name?: string;
  provider?: string;
  context_length?: number;
  pricing?: {
    input?: number;
    output?: number;
  };
  free?: boolean;
}

interface KiloModelsResponse {
  data: KiloModel[];
}

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  top_provider?: {
    is_moderated?: boolean;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * Fetch models from Kilo Gateway
 * Kilo provides provider field and free tier is detected from model name prefix (:free or /free)
 * NOTE: Kilo does NOT provide pricing in API response
 */
export async function fetchKiloModels(
  baseUrl: string,
  apiKey?: string
): Promise<ModelInfo[]> {
  // Check cache first
  const cacheKey = getCacheKey('kilo', baseUrl);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use Tauri command to bypass CORS
    const body = await invoke<string>('fetch_provider_models', {
      baseUrl,
      apiKey: apiKey || null,
      endpointPath: '/models',
    });
    
    const data: KiloModelsResponse = JSON.parse(body);
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from Kilo API');
    }
    
    // Map Kilo models - detect free from :free suffix or kilo-auto/free virtual model
    const models = data.data.map((model) => {
      const modelName = model.name || model.id;
      
      // Detect free tier:
      // 1. :free suffix in model ID (e.g., "minimax/minimax-m2.1:free")
      // 2. kilo-auto/free virtual model (routes to best free model)
      const isFree = 
        model.id.includes(':free') || 
        modelName.includes(':free') ||
        model.id === 'kilo-auto/free';
      
      // Detect virtual auto-routing models
      const isVirtual = model.id.startsWith('kilo-auto/');
      
      // Extract provider from model ID (e.g., "anthropic/claude-opus" -> "anthropic")
      // Fallback to API-provided provider field if available
      const provider = model.provider || (model.id.includes('/') 
        ? model.id.split('/')[0] 
        : undefined);
      
      return {
        id: model.id,
        name: modelName,
        provider,
        context_length: model.context_length || inferContextWindow(model.id),
        // Kilo does NOT provide pricing
        isFree,
        isVirtual,
      };
    });
    
    console.log('[KILO] Parsed models:', {
      total: models.length,
      freeCount: models.filter(m => m.isFree).length,
      providersCount: new Set(models.map(m => m.provider).filter(Boolean)).size,
      sampleFree: models.filter(m => m.isFree).slice(0, 3).map(m => ({ id: m.id, provider: m.provider })),
      samplePaid: models.filter(m => !m.isFree).slice(0, 3).map(m => ({ id: m.id, provider: m.provider })),
    });
    
    // Save to cache
    saveToCache(cacheKey, models);
    
    return models;
  } catch (error) {
    console.error('[KILO] Failed to fetch models:', error);
    throw error;
  }
}

/**
 * Fetch models from OpenAI-compatible /v1/models endpoint using Tauri command
 * Works with generic OpenAI-compatible providers
 */
export async function fetchOpenAICompatModels(
  baseUrl: string,
  apiKey?: string,
  endpointPath?: string
): Promise<ModelInfo[]> {
  // Check cache first
  const cacheKey = getCacheKey('openai-compat', baseUrl);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use Tauri command to bypass CORS
    const body = await invoke<string>('fetch_provider_models', {
      baseUrl,
      apiKey: apiKey || null,
      endpointPath: endpointPath || null,
    });
    
    const data: OpenAIModelsResponse = JSON.parse(body);
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from /v1/models');
    }
    
    // Basic mapping - just ID and name
    const models = data.data.map((model) => ({
      id: model.id,
      name: model.id,
      context_length: inferContextWindow(model.id),
    }));
    
    // Save to cache
    saveToCache(cacheKey, models);
    
    return models;
  } catch (error) {
    console.error('[FETCH_MODELS] Failed to fetch models:', error);
    throw error;
  }
}

/**
 * Fetch models from OpenRouter with enhanced metadata using Tauri command
 * OpenRouter provides richer model information including pricing, context, etc.
 */
export async function fetchOpenRouterModels(
  baseUrl: string,
  apiKey?: string
): Promise<ModelInfo[]> {
  // Check cache first
  const cacheKey = getCacheKey('openrouter', baseUrl);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use Tauri command to bypass CORS
    const body = await invoke<string>('fetch_provider_models', {
      baseUrl,
      apiKey: apiKey || null,
      endpointPath: '/v1/models', // OpenRouter uses standard path
    });
    
    const data: OpenRouterModelsResponse = JSON.parse(body);
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from /v1/models');
    }
    
    // Map OpenRouter models with enhanced metadata
    const models = data.data.map((model) => {
      const isFree = 
        model.pricing?.prompt === '0' && 
        model.pricing?.completion === '0';
      
      // Extract provider from model ID (e.g., "openai/gpt-4" -> "openai")
      const provider = model.id.includes('/') 
        ? model.id.split('/')[0] 
        : undefined;
      
      return {
        id: model.id,
        name: model.name || model.id,
        provider,
        description: model.description,
        context_length: model.context_length,
        pricing: model.pricing ? {
          input: parseFloat(model.pricing.prompt || '0'),
          output: parseFloat(model.pricing.completion || '0'),
        } : undefined,
        isFree,
      };
    });
    
    // Save to cache
    saveToCache(cacheKey, models);
    
    return models;
  } catch (error) {
    console.error('[OPENROUTER] Failed to fetch models:', error);
    throw error;
  }
}

/**
 * Infer context window from model name
 * Used as fallback when provider doesn't return context_length
 */
function inferContextWindow(modelId: string): number {
  const lower = modelId.toLowerCase();
  
  // Gemini models
  if (lower.includes('gemini')) {
    if (lower.includes('1.5') || lower.includes('2.0')) {
      return 1_000_000; // Gemini 1.5/2.0 have 1M context
    }
    return 32_000; // Older Gemini models
  }
  
  // Claude models
  if (lower.includes('claude')) {
    if (lower.includes('opus') || lower.includes('sonnet') || lower.includes('haiku')) {
      return 200_000; // Claude 3+ models
    }
    return 100_000; // Older Claude models
  }
  
  // GPT models
  if (lower.includes('gpt-4')) {
    if (lower.includes('turbo') || lower.includes('32k')) {
      return 32_000;
    }
    if (lower.includes('128k')) {
      return 128_000;
    }
    return 8_000;
  }
  
  if (lower.includes('gpt-3.5')) {
    if (lower.includes('16k')) {
      return 16_000;
    }
    return 4_000;
  }
  
  // Default fallback
  return 200_000;
}

/**
 * Generic fetch function that auto-detects provider type
 */
export async function fetchModels(
  baseUrl: string,
  providerId: string,
  apiKey?: string
): Promise<ModelInfo[]> {
  // Kilo uses custom /models endpoint with enhanced metadata
  if (providerId === 'kilo' || baseUrl.includes('kilo.ai')) {
    return fetchKiloModels(baseUrl, apiKey);
  }
  
  // OpenRouter gets enhanced metadata
  if (providerId === 'openrouter' || baseUrl.includes('openrouter.ai')) {
    return fetchOpenRouterModels(baseUrl, apiKey);
  }
  
  // All other providers use standard /v1/models
  return fetchOpenAICompatModels(baseUrl, apiKey);
}
