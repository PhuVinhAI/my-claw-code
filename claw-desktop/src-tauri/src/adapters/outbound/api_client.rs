// API Client Adapter for Tauri
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use api::{
    convert_runtime_messages, max_tokens_for_model, InputContentBlock, InputMessage,
    MessageRequest, ProviderClient, StreamEvent as ApiStreamEvent, ToolChoice,
};
use runtime::{ApiClient, ApiRequest, AssistantEvent, RuntimeError};

use crate::core::use_cases::ports::IEventPublisher;

pub struct TauriApiClient {
    client: ProviderClient,
    event_publisher: Arc<dyn IEventPublisher>,
    tool_definitions: Vec<api::ToolDefinition>,
    model: String,
    cancel_flag: Arc<AtomicBool>,
}

impl TauriApiClient {
    pub fn new(
        model: &str,
        event_publisher: Arc<dyn IEventPublisher>,
        tool_definitions: Vec<api::ToolDefinition>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<Self, String> {
        let client = ProviderClient::from_model(model)
            .map_err(|e| format!("Failed to create API client: {}. Make sure API key is configured in settings.", e))?;
        Ok(Self {
            client,
            event_publisher,
            tool_definitions,
            model: model.to_string(),
            cancel_flag,
        })
    }
    
    /// Update tool definitions (called when work mode changes)
    pub fn set_tool_definitions(&mut self, tool_definitions: Vec<api::ToolDefinition>) {
        self.tool_definitions = tool_definitions;
    }
    
    /// Get current tool definitions
    pub fn get_tool_definitions(&self) -> Vec<api::ToolDefinition> {
        self.tool_definitions.clone()
    }
}

impl ApiClient for TauriApiClient {
    fn stream(
        &mut self,
        request: ApiRequest,
    ) -> Result<Vec<AssistantEvent>, RuntimeError> {
        // Convert runtime messages to API messages using shared helper
        let api_messages = convert_runtime_messages(&request.messages);

        let api_request = MessageRequest {
            model: self.model.clone(),
            messages: api_messages,
            max_tokens: max_tokens_for_model(&self.model),
            system: if request.system_prompt.is_empty() {
                None
            } else {
                Some(request.system_prompt.join("\n\n"))
            },
            tools: if self.tool_definitions.is_empty() {
                None
            } else {
                Some(self.tool_definitions.clone())
            },
            // Only set tool_choice if tools are available
            tool_choice: if self.tool_definitions.is_empty() {
                None
            } else {
                Some(ToolChoice::Auto)
            },
            stream: true,
        };

        // Use block_in_place to allow blocking in async context
        let client = self.client.clone();
        let event_publisher = self.event_publisher.clone();

        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let mut stream = client.stream_message(&api_request).await
                    .map_err(|e| RuntimeError::new(format!("API error: {}", e)))?;

                let mut assistant_events = Vec::new();
                // Track pending tool uses: index -> (id, name, input_accumulator)
                let mut pending_tools: std::collections::HashMap<u32, (String, String, String)> =
                    std::collections::HashMap::new();

                loop {
                    // Check nếu user bấm nút dừng (Cancel)
                    if self.cancel_flag.load(Ordering::Relaxed) {
                        event_publisher.publish_stream_event(
                            crate::core::domain::types::StreamEvent::MessageStop,
                        );
                        assistant_events.push(AssistantEvent::MessageStop);
                        break;
                    }

                    // Sử dụng timeout cực thấp để không bị block vòng lặp quá lâu,
                    // cho phép kiểm tra cancel_flag liên tục.
                    let event_opt = match tokio::time::timeout(std::time::Duration::from_millis(100), stream.next_event()).await {
                        Ok(res) => res.map_err(|e| RuntimeError::new(format!("Stream error: {}", e)))?,
                        Err(_) => continue, // Timeout -> lặp lại để check cờ cancel
                    };

                    match event_opt {
                        None => break,
                        Some(api_event) => {
                            match &api_event {
                                ApiStreamEvent::ContentBlockDelta(delta) => {
                                    match &delta.delta {
                                        api::ContentBlockDelta::TextDelta { text } => {
                                            event_publisher.publish_stream_event(
                                                crate::core::domain::types::StreamEvent::TextDelta {
                                                    delta: text.clone(),
                                                },
                                            );
                                            assistant_events
                                                .push(AssistantEvent::TextDelta(text.clone()));
                                        }
                                        api::ContentBlockDelta::InputJsonDelta { partial_json } => {
                                            // Accumulate tool input
                                            if let Some((_, _, input)) = pending_tools.get_mut(&delta.index) {
                                                input.push_str(partial_json);
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                                ApiStreamEvent::ContentBlockStart(start) => {
                                    if let api::OutputContentBlock::ToolUse { id, name, .. } =
                                        &start.content_block
                                    {
                                        // Start tracking this tool use
                                        pending_tools.insert(
                                            start.index,
                                            (id.clone(), name.clone(), String::new())
                                        );
                                    }
                                }
                                ApiStreamEvent::ContentBlockStop(stop) => {
                                    // Emit tool use with complete input
                                    if let Some((id, name, input)) = pending_tools.remove(&stop.index) {
                                        event_publisher.publish_stream_event(
                                            crate::core::domain::types::StreamEvent::ToolUse {
                                                id: id.clone(),
                                                name: name.clone(),
                                                input: input.clone(),
                                            },
                                        );
                                        assistant_events.push(AssistantEvent::ToolUse {
                                            id,
                                            name,
                                            input,
                                        });
                                    }
                                }
                                ApiStreamEvent::MessageDelta(delta) => {
                                    let token_usage = runtime::TokenUsage {
                                        input_tokens: delta.usage.input_tokens,
                                        output_tokens: delta.usage.output_tokens,
                                        cache_creation_input_tokens: delta
                                            .usage
                                            .cache_creation_input_tokens,
                                        cache_read_input_tokens: delta.usage.cache_read_input_tokens,
                                    };
                                    assistant_events.push(AssistantEvent::Usage(token_usage));
                                }
                                ApiStreamEvent::MessageStop(_) => {
                                    event_publisher.publish_stream_event(
                                        crate::core::domain::types::StreamEvent::MessageStop,
                                    );
                                    assistant_events.push(AssistantEvent::MessageStop);
                                }
                                _ => {}
                            }
                        }
                    }
                }

                Ok(assistant_events)
            })
        })
    }
}

