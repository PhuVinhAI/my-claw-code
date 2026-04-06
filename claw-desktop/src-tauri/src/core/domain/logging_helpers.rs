// Logging Helpers - Format complex types for logging
use runtime::{ContentBlock, ConversationMessage as Message, MessageRole};
use serde_json::json;

/// Format message for logging (truncate long content)
pub fn format_message_for_log(msg: &Message) -> String {
    let role = match msg.role {
        MessageRole::User => "User",
        MessageRole::Assistant => "Assistant",
        MessageRole::Tool => "Tool",
        MessageRole::System => "System",
    };
    
    let blocks_summary: Vec<String> = msg.blocks.iter().map(|block| {
        match block {
            ContentBlock::Text { text } => {
                let preview = text.chars().take(100).collect::<String>();
                format!("Text({}...)", preview)
            }
            ContentBlock::ToolUse { id, name, input } => {
                let input_preview = input.chars().take(50).collect::<String>();
                format!("ToolUse(id={}, name={}, input={}...)", id, name, input_preview)
            }
            ContentBlock::ToolResult { tool_use_id, output, is_error, .. } => {
                let output_preview = output.chars().take(100).collect::<String>();
                let is_cancelled = output.contains("cancelled by user") || output.contains("Tool execution cancelled");
                format!(
                    "ToolResult(id={}, error={}, cancelled={}, output={}...)",
                    tool_use_id, is_error, is_cancelled, output_preview
                )
            }
        }
    }).collect();
    
    format!("{} [{}]", role, blocks_summary.join(", "))
}

/// Log all messages in session
pub fn log_session_messages(messages: &[Message]) {
    tracing::debug!(message_count = messages.len(), "Session messages:");
    for (idx, msg) in messages.iter().enumerate() {
        tracing::debug!(
            index = idx,
            message = %format_message_for_log(msg),
            "Message"
        );
    }
}

/// Format message as JSON for AI-readable logs
/// This creates a structured log that AI can easily parse and understand
pub fn format_message_as_json(msg: &Message) -> serde_json::Value {
    let role = match msg.role {
        MessageRole::User => "user",
        MessageRole::Assistant => "assistant",
        MessageRole::Tool => "tool",
        MessageRole::System => "system",
    };
    
    let blocks: Vec<serde_json::Value> = msg.blocks.iter().map(|block| {
        match block {
            ContentBlock::Text { text } => {
                json!({
                    "type": "text",
                    "text": text.chars().take(500).collect::<String>(),
                    "truncated": text.len() > 500
                })
            }
            ContentBlock::ToolUse { id, name, input } => {
                json!({
                    "type": "tool_use",
                    "id": id,
                    "name": name,
                    "input": input.chars().take(200).collect::<String>(),
                    "truncated": input.len() > 200
                })
            }
            ContentBlock::ToolResult { tool_use_id, output, is_error, .. } => {
                let is_cancelled = output.contains("cancelled by user") || output.contains("Tool execution cancelled");
                let is_timed_out = output.contains("TIMEOUT") || output.contains("timed out");
                json!({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "output": output.chars().take(500).collect::<String>(),
                    "truncated": output.len() > 500,
                    "is_error": is_error,
                    "is_cancelled": is_cancelled,
                    "is_timed_out": is_timed_out
                })
            }
        }
    }).collect();
    
    json!({
        "role": role,
        "blocks": blocks,
        "usage": msg.usage.as_ref().map(|u| json!({
            "input_tokens": u.input_tokens,
            "output_tokens": u.output_tokens,
            "cache_creation": u.cache_creation_input_tokens,
            "cache_read": u.cache_read_input_tokens
        }))
    })
}

/// Log conversation turn in AI-readable format
/// This creates a complete snapshot of the conversation state
pub fn log_turn_for_ai(
    turn_id: &str,
    user_input: &str,
    messages: &[Message],
    iteration: usize,
) {
    let messages_json: Vec<serde_json::Value> = messages.iter()
        .map(format_message_as_json)
        .collect();
    
    let turn_data = json!({
        "turn_id": turn_id,
        "iteration": iteration,
        "user_input": user_input.chars().take(200).collect::<String>(),
        "user_input_truncated": user_input.len() > 200,
        "message_count": messages.len(),
        "messages": messages_json
    });
    
    tracing::info!(
        turn_data = %turn_data.to_string(),
        "🤖 AI_READABLE_TURN"
    );
}

/// Log tool execution in AI-readable format
pub fn log_tool_execution_for_ai(
    tool_use_id: &str,
    tool_name: &str,
    input: &str,
    output: Option<&str>,
    is_error: bool,
    duration_ms: Option<u64>,
) {
    let tool_data = json!({
        "tool_use_id": tool_use_id,
        "tool_name": tool_name,
        "input": input.chars().take(200).collect::<String>(),
        "input_truncated": input.len() > 200,
        "output": output.map(|o| o.chars().take(500).collect::<String>()),
        "output_truncated": output.map(|o| o.len() > 500).unwrap_or(false),
        "is_error": is_error,
        "duration_ms": duration_ms
    });
    
    tracing::info!(
        tool_data = %tool_data.to_string(),
        "🔧 AI_READABLE_TOOL"
    );
}

/// Log API request/response in AI-readable format
pub fn log_api_call_for_ai(
    model: &str,
    message_count: usize,
    system_prompt_len: usize,
    tool_count: usize,
    response_type: &str, // "text", "tool_use", "error"
) {
    let api_data = json!({
        "model": model,
        "message_count": message_count,
        "system_prompt_len": system_prompt_len,
        "tool_count": tool_count,
        "response_type": response_type
    });
    
    tracing::info!(
        api_data = %api_data.to_string(),
        "🌐 AI_READABLE_API"
    );
}

