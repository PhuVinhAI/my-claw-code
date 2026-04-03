// SessionMetadata - Domain entity
export interface SessionMetadata {
  id: string;
  title: string;
  created_at: number; // Unix timestamp
  updated_at: number;
  message_count: number;
  preview: string;
  work_mode?: string; // "normal" or "workspace"
  workspace_path?: string;
}
