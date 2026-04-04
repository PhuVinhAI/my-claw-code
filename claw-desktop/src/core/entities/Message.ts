// Message Entity
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'compact';
  text?: string;
  id?: string;
  name?: string;
  input?: string;
  tool_use_id?: string;
  tool_name?: string;
  output?: string;
  is_error?: boolean;
  is_cancelled?: boolean; // True when tool was cancelled by user
  is_timed_out?: boolean; // True when tool timed out
  isStreaming?: boolean; // True when receiving chunks, false when complete
  thinking?: string; // For thinking blocks (parsed from text)
  // Compact block fields
  status?: 'started' | 'completed';
  estimatedTokens?: number;
  maxTokens?: number;
  removedCount?: number;
  summary?: string;
  newEstimatedTokens?: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface Message {
  role: MessageRole;
  blocks: ContentBlock[];
  usage?: TokenUsage;
  modelName?: string; // Model used to generate this message (e.g., "Claude Sonnet 4.5")
}

export interface Session {
  version: number;
  messages: Message[];
}
