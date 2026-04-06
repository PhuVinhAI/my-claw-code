// Domain types - Wrappers từ runtime crate
use serde::{Deserialize, Serialize};

// Re-export types từ runtime crate
pub use runtime::{
    ContentBlock, ConversationMessage, MessageRole, PermissionMode, PermissionRequest,
    TokenUsage, TurnSummary,
};

/// Serializable wrapper for Session (runtime::Session doesn't have Serialize)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDto {
    pub version: u32,
    pub session_id: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub messages: Vec<ConversationMessage>,
}

impl From<&runtime::Session> for SessionDto {
    fn from(session: &runtime::Session) -> Self {
        Self {
            version: session.version,
            session_id: session.session_id.clone(),
            created_at_ms: session.created_at_ms,
            updated_at_ms: session.updated_at_ms,
            messages: session.messages.clone(),
        }
    }
}

/// Stream event được emit về Frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    TextDelta { delta: String },
    ToolUse { id: String, name: String, input: String },
    ToolResult { tool_use_id: String, output: String, is_error: bool, is_cancelled: bool, is_timed_out: bool },
    ToolOutputChunk { tool_use_id: String, chunk: String }, // Real-time output streaming
    Usage { usage: TokenUsage },
    MessageStop,
    Error { message: String },
    SystemMessage { message: String }, // System notification (e.g., tool changes)
    CompactStarted { estimated_tokens: usize, max_tokens: usize }, // Auto-compact bắt đầu
    CompactCompleted { removed_count: usize, summary: String, new_estimated_tokens: usize, max_tokens: usize }, // Auto-compact hoàn thành
}

/// Permission request event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequestEvent {
    pub request_id: String,
    pub tool_name: String,
    pub input: String,
    pub current_mode: String,
    pub required_mode: String,
}

/// Work mode - Chế độ làm việc
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WorkMode {
    Normal,    // Chế độ thông thường - read-only tools
    Workspace, // Chế độ làm việc - full tool access
}

// Re-export settings types from domain module
pub use super::settings::{Model, Provider, SelectedModel, Settings, SettingsManager};
