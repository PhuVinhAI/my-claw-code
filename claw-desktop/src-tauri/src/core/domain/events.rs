// Domain events
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum DomainEvent {
    ConversationStarted { session_id: String },
    ConversationEnded { session_id: String },
    ToolExecutionStarted { tool_name: String },
    ToolExecutionCompleted { tool_name: String, success: bool },
}
