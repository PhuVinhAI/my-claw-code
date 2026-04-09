// Fetch models from Antigravity /v1/models endpoint
export interface AntigravityModel {
  id: string;
  name: string;
  max_context: number;
}

export async function fetchAntigravityModels(baseUrl: string): Promise<AntigravityModel[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // OpenAI-compatible /v1/models response format
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from /v1/models');
    }
    
    // Map models and infer context window from model name
    return data.data.map((model: any) => {
      const modelId = model.id;
      const modelName = model.id; // Use id as name if no display name
      
      // Infer context window based on model name
      let max_context = 200000; // Default for Claude
      
      if (modelId.toLowerCase().includes('gemini')) {
        max_context = 1000000; // Gemini models have 1M context
      } else if (modelId.toLowerCase().includes('claude')) {
        max_context = 200000; // Claude models have 200K context
      }
      
      return {
        id: modelId,
        name: modelName,
        max_context,
      };
    });
  } catch (error) {
    console.error('[ANTIGRAVITY] Failed to fetch models:', error);
    throw error;
  }
}
