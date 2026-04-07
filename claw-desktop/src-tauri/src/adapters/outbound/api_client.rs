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
    current_turn_id: Arc<std::sync::Mutex<String>>, // Track current turn ID for event emission
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
            current_turn_id: Arc::new(std::sync::Mutex::new(String::new())),
        })
    }
    
    /// Create API client with explicit base URL and API key (from Desktop settings)
    pub fn new_with_base_url(
        model: &str,
        base_url: &str,
        api_key: &str,
        provider_id: Option<&str>,
        event_publisher: Arc<dyn IEventPublisher>,
        tool_definitions: Vec<api::ToolDefinition>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<Self, String> {
        let client = ProviderClient::from_model_and_base_url(
            model,
            base_url.to_string(),
            api_key.to_string(),
            provider_id,
        )
            .map_err(|e| format!("Failed to create API client: {}", e))?;
        Ok(Self {
            client,
            event_publisher,
            tool_definitions,
            model: model.to_string(),
            cancel_flag,
            current_turn_id: Arc::new(std::sync::Mutex::new(String::new())),
        })
    }
    
    /// Set current turn ID for event emission
    pub fn set_turn_id(&self, turn_id: String) {
        let mut current = self.current_turn_id.lock().unwrap();
        *current = turn_id;
    }
    
    /// Get current turn ID
    fn get_turn_id(&self) -> String {
        let current = self.current_turn_id.lock().unwrap();
        current.clone()
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
        use crate::core::domain::logging_helpers::log_api_call_for_ai;
        
        let message_count = request.messages.len();
        let system_prompt_len = request.system_prompt.iter().map(|s| s.len()).sum::<usize>();
        let tool_count = self.tool_definitions.len();
        
        tracing::info!(
            model = %self.model,
            message_count = message_count,
            system_prompt_len = system_prompt_len,
            tool_count = tool_count,
            "🌐 API_REQUEST_START"
        );
        
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
        
        // Log API call for AI
        log_api_call_for_ai(
            &self.model,
            message_count,
            system_prompt_len,
            tool_count,
            "streaming"
        );

        // Use block_in_place to allow blocking in async context
        let client = self.client.clone();
        let event_publisher = self.event_publisher.clone();
        let turn_id = self.get_turn_id(); // Get current turn_id

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
                            crate::core::domain::types::StreamEvent::MessageStop {
                                turn_id: turn_id.clone(),
                            },
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
                        None => {
                            tracing::debug!("Stream ended");
                            break;
                        }
                        Some(api_event) => {
                            tracing::trace!(event_type = ?api_event, "Received stream event");
                            match &api_event {
                                ApiStreamEvent::ContentBlockDelta(delta) => {
                                    match &delta.delta {
                                        api::ContentBlockDelta::TextDelta { text } => {
                                            event_publisher.publish_stream_event(
                                                crate::core::domain::types::StreamEvent::TextDelta {
                                                    delta: text.clone(),
                                                    turn_id: turn_id.clone(),
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
                                        tracing::info!(
                                            tool_id = %id,
                                            tool_name = %name,
                                            index = start.index,
                                            "Tool use started"
                                        );
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
                                        tracing::info!(
                                            tool_id = %id,
                                            tool_name = %name,
                                            input_len = input.len(),
                                            "Tool use completed"
                                        );
                                        event_publisher.publish_stream_event(
                                            crate::core::domain::types::StreamEvent::ToolUse {
                                                id: id.clone(),
                                                name: name.clone(),
                                                input: input.clone(),
                                                turn_id: turn_id.clone(),
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
                                    // If usage is 0 (Gemini doesn't provide usage in streaming),
                                    // skip emitting Usage event - will use estimated tokens instead
                                    if delta.usage.input_tokens > 0 || delta.usage.output_tokens > 0 {
                                        tracing::debug!(
                                            input_tokens = delta.usage.input_tokens,
                                            output_tokens = delta.usage.output_tokens,
                                            cache_creation = delta.usage.cache_creation_input_tokens,
                                            cache_read = delta.usage.cache_read_input_tokens,
                                            "Token usage received"
                                        );
                                        let token_usage = runtime::TokenUsage {
                                            input_tokens: delta.usage.input_tokens,
                                            output_tokens: delta.usage.output_tokens,
                                            cache_creation_input_tokens: delta
                                                .usage
                                                .cache_creation_input_tokens,
                                            cache_read_input_tokens: delta.usage.cache_read_input_tokens,
                                        };
                                        
                                        event_publisher.publish_stream_event(
                                            crate::core::domain::types::StreamEvent::Usage {
                                                usage: token_usage.clone(),
                                                turn_id: turn_id.clone(),
                                            },
                                        );
                                        
                                        assistant_events.push(AssistantEvent::Usage(token_usage));
                                    }
                                }
                                ApiStreamEvent::MessageStop(_) => {
                                    event_publisher.publish_stream_event(
                                        crate::core::domain::types::StreamEvent::MessageStop {
                                            turn_id: turn_id.clone(),
                                        },
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
    
    fn model_name(&self) -> Option<String> {
        tracing::debug!(model = %self.model, "model_name() called");
        Some(self.model.clone())
    }
}

