// Helper functions for converting runtime types to API types
// Shared between CLI and Desktop to avoid duplication

use crate::types::{InputContentBlock, InputMessage, ToolResultContentBlock};

/// Convert runtime ConversationMessages to API InputMessages
/// 
/// This function is used by both CLI and Desktop to convert runtime's
/// internal message format to the API's expected format.
pub fn convert_runtime_messages(
    messages: &[runtime::ConversationMessage],
) -> Vec<InputMessage> {
    messages
        .iter()
        .filter_map(|message| {
            let role = match message.role {
                runtime::MessageRole::System
                | runtime::MessageRole::User
                | runtime::MessageRole::Tool => "user",
                runtime::MessageRole::Assistant => "assistant",
            };
            let content = message
                .blocks
                .iter()
                .map(|block| match block {
                    runtime::ContentBlock::Text { text } => {
                        InputContentBlock::Text { text: text.clone() }
                    }
                    runtime::ContentBlock::ToolUse { id, name, input } => {
                        InputContentBlock::ToolUse {
                            id: id.clone(),
                            name: name.clone(),
                            input: serde_json::from_str(input).unwrap_or_else(|_| {
                                serde_json::json!({ "raw": input })
                            }),
                        }
                    }
                    runtime::ContentBlock::ToolResult {
                        tool_use_id,
                        output,
                        is_error,
                        ..
                    } => InputContentBlock::ToolResult {
                        tool_use_id: tool_use_id.clone(),
                        content: vec![ToolResultContentBlock::Text {
                            text: output.clone(),
                        }],
                        is_error: *is_error,
                    },
                })
                .collect::<Vec<_>>();
            (!content.is_empty()).then(|| InputMessage {
                role: role.to_string(),
                content,
            })
        })
        .collect()
}
