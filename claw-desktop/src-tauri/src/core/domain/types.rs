// Domain types - Wrappers từ runtime crate
use serde::{Deserialize, Serialize};

// Re-export types từ runtime crate
pub use runtime::{
    ContentBlock, ConversationMessage, MessageRole, PermissionMode, PermissionRequest,
    Session, TokenUsage, TurnSummary,
};

/// Stream event được emit về Frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    TextDelta { delta: String },
    ToolUse { id: String, name: String, input: String },
    ToolResult { tool_use_id: String, output: String, is_error: bool },
    Usage { usage: TokenUsage },
    MessageStop,
    Error { message: String },
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
