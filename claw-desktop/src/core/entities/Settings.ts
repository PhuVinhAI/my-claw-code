// Settings Domain Types

export interface Model {
  id: string;
  name: string;
  max_context?: number;
}

export interface Provider {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
  models: Model[];
}

export interface SelectedModel {
  provider_id: string;
  model_id: string;
}

export interface CompactConfig {
  threshold_ratio: number;
  preserve_recent_messages: number;
}

export interface Settings {
  providers: Provider[];
  selected_model: SelectedModel | null;
  compact_config?: CompactConfig;
}
