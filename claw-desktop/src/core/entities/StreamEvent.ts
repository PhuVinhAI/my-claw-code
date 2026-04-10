// Stream Event Types
import { TokenUsage } from './Message';

export type StreamEvent =
  | { type: 'text_delta'; delta: string; turn_id: string }
  | { type: 'thinking_block'; thinking: string; is_complete: boolean; turn_id: string } // AI thinking from API
  | { type: 'tool_use'; id: string; name: string; input: string; turn_id: string }
  | { type: 'tool_result'; tool_use_id: string; output: string; is_error: boolean; is_cancelled: boolean; is_timed_out?: boolean; turn_id: string }
  | { type: 'tool_output_chunk'; tool_use_id: string; chunk: string; turn_id: string } // Real-time output streaming
  | { type: 'usage'; usage: TokenUsage; turn_id: string }
  | { type: 'message_stop'; turn_id: string }
  | { type: 'error'; message: string; turn_id: string }
  | { type: 'system_message'; message: string } // System notification (no turn_id - global)
  | { type: 'compact_started'; estimated_tokens: number; max_tokens: number; turn_id: string } // Auto-compact bắt đầu
  | { type: 'compact_completed'; removed_count: number; summary: string; new_estimated_tokens: number; max_tokens: number; turn_id: string }; // Auto-compact hoàn thành
