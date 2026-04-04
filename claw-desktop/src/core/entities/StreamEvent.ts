// Stream Event Types
import { TokenUsage } from './Message';

export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: string }
  | { type: 'tool_result'; tool_use_id: string; output: string; is_error: boolean; is_cancelled: boolean; is_timed_out?: boolean }
  | { type: 'tool_output_chunk'; tool_use_id: string; chunk: string } // Real-time output streaming
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'message_stop' }
  | { type: 'error'; message: string }
  | { type: 'system_message'; message: string } // System notification
  | { type: 'compact_started'; estimated_tokens: number; max_tokens: number } // Auto-compact bắt đầu
  | { type: 'compact_completed'; removed_count: number; summary: string; new_estimated_tokens: number; max_tokens: number }; // Auto-compact hoàn thành
