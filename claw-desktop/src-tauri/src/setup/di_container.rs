// Dependency Injection Container
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

use api::ProviderClient;
use runtime::{ConversationRuntime, PermissionMode, PermissionPolicy, Session};
use tools::GlobalToolRegistry;

use crate::adapters::outbound::file_repository::FileSessionRepository;
use crate::adapters::outbound::tauri_prompter::{PermissionState, TauriPermissionAdapter};
use crate::adapters::outbound::tauri_publisher::TauriEventPublisher;
use crate::core::use_cases::chat_actor::{ActorCommand, ChatSessionActor};
use crate::core::use_cases::ports::{IEventPublisher, ISessionRepository};
use crate::setup::app_state::AppState;

/// Load environment variables from .env file
fn load_env_vars() {
    // Try to load from workspace root .env
    if let Err(e) = dotenvy::from_path("../.env") {
        eprintln!("Warning: Could not load .env from workspace root: {}", e);
        // Try current directory
        if let Err(e) = dotenvy::dotenv() {
            eprintln!("Warning: Could not load .env from current directory: {}", e);
        }
    }
}

/// Get model from environment or use default
fn get_model_from_env() -> String {
    std::env::var("CLAW_MODEL").unwrap_or_else(|_| "stepfun-ai/step-3.5-flash".to_string())
}

/// Simple ApiClient wrapper
pub struct SimpleApiClient {
    client: ProviderClient,
    event_publisher: Arc<dyn IEventPublisher>,
    tool_definitions: Vec<api::ToolDefinition>,
}

impl SimpleApiClient {
    pub fn new(
        model: &str,
        event_publisher: Arc<dyn IEventPublisher>,
        tool_definitions: Vec<api::ToolDefinition>,
    ) -> Result<Self, String> {
        let client = ProviderClient::from_model(model)
            .map_err(|e| format!("Failed to create API client: {}. Make sure OPENAI_API_KEY and OPENAI_BASE_URL are set in .env", e))?;
        Ok(Self {
            client,
            event_publisher,
            tool_definitions,
        })
    }
}

impl runtime::ApiClient for SimpleApiClient {
    fn stream(
        &mut self,
        request: runtime::ApiRequest,
    ) -> Result<Vec<runtime::AssistantEvent>, runtime::RuntimeError> {
        use api::{InputContentBlock, InputMessage, MessageRequest, StreamEvent as ApiStreamEvent};

        // Convert runtime::ApiRequest → api::MessageRequest
        let mut api_messages = Vec::new();

        // Add conversation messages
        for msg in &request.messages {
            let role = match msg.role {
                runtime::MessageRole::User => "user",
                runtime::MessageRole::Assistant => "assistant",
                _ => continue, // Skip system and tool messages for now
            };

            let content = msg
                .blocks
                .iter()
                .filter_map(|block| match block {
                    runtime::ContentBlock::Text { text } => {
                        Some(InputContentBlock::Text { text: text.clone() })
                    }
                    runtime::ContentBlock::ToolUse { id, name, input } => {
                        // Parse input string to JSON Value
                        let input_value: serde_json::Value = serde_json::from_str(input).ok()?;
                        Some(InputContentBlock::ToolUse {
                            id: id.clone(),
                            name: name.clone(),
                            input: input_value,
                        })
                    }
                    runtime::ContentBlock::ToolResult {
                        tool_use_id,
                        tool_name: _,
                        output,
                        is_error,
                    } => Some(InputContentBlock::ToolResult {
                        tool_use_id: tool_use_id.clone(),
                        content: vec![api::ToolResultContentBlock::Text {
                            text: output.clone(),
                        }],
                        is_error: *is_error,
                    }),
                })
                .collect();

            api_messages.push(InputMessage {
                role: role.to_string(),
                content,
            });
        }

        let api_request = MessageRequest {
            model: "stepfun-ai/step-3.5-flash".to_string(), // Will be overridden by env
            messages: api_messages,
            max_tokens: 4096,
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
            tool_choice: None,
            stream: true,
        };

        // Use block_in_place to allow blocking in async context
        let client = self.client.clone();
        let event_publisher = self.event_publisher.clone();
        
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let mut stream = client.stream_message(&api_request).await
                    .map_err(|e| runtime::RuntimeError::new(format!("API error: {}", e)))?;

                let mut assistant_events = Vec::new();

                loop {
                    let event = stream.next_event().await
                        .map_err(|e| runtime::RuntimeError::new(format!("Stream error: {}", e)))?;

                    match event {
                        None => break,
                        Some(api_event) => {
                            match &api_event {
                                ApiStreamEvent::ContentBlockDelta(delta) => {
                                    if let api::ContentBlockDelta::TextDelta { text } = &delta.delta {
                                        event_publisher.publish_stream_event(
                                            crate::core::domain::types::StreamEvent::TextDelta {
                                                delta: text.clone(),
                                            },
                                        );
                                        assistant_events
                                            .push(runtime::AssistantEvent::TextDelta(text.clone()));
                                    }
                                }
                                ApiStreamEvent::ContentBlockStart(start) => {
                                    if let api::OutputContentBlock::ToolUse { id, name, input } =
                                        &start.content_block
                                    {
                                        let input_str = input.to_string();
                                        event_publisher.publish_stream_event(
                                            crate::core::domain::types::StreamEvent::ToolUse {
                                                id: id.clone(),
                                                name: name.clone(),
                                                input: input_str.clone(),
                                            },
                                        );
                                        assistant_events.push(runtime::AssistantEvent::ToolUse {
                                            id: id.clone(),
                                            name: name.clone(),
                                            input: input_str,
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
                                    assistant_events.push(runtime::AssistantEvent::Usage(token_usage));
                                }
                                ApiStreamEvent::MessageStop(_) => {
                                    event_publisher.publish_stream_event(
                                        crate::core::domain::types::StreamEvent::MessageStop,
                                    );
                                    assistant_events.push(runtime::AssistantEvent::MessageStop);
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

/// Simple ToolExecutor wrapper
pub struct SimpleToolExecutor {
    registry: GlobalToolRegistry,
}

impl SimpleToolExecutor {
    pub fn new() -> Self {
        Self {
            registry: GlobalToolRegistry::builtin(),
        }
    }

    pub fn get_tool_definitions(&self) -> Vec<api::ToolDefinition> {
        self.registry.definitions(None)
    }
}

impl runtime::ToolExecutor for SimpleToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, runtime::ToolError> {
        // Parse input JSON
        let input_value: serde_json::Value = serde_json::from_str(input)
            .map_err(|e| runtime::ToolError::new(format!("Invalid tool input JSON: {}", e)))?;

        // Execute tool via registry
        self.registry
            .execute(tool_name, &input_value)
            .map_err(|e| runtime::ToolError::new(e))
    }
}

/// Initialize DI Container và spawn Actor
pub fn initialize_app(app_handle: AppHandle) -> Result<AppState, String> {
    // Load environment variables
    load_env_vars();

    // Get model from env
    let model = get_model_from_env();
    eprintln!("Using model: {}", model);

    // Use Tauri's async runtime to initialize
    tauri::async_runtime::block_on(async {
        initialize_app_async(app_handle, model).await
    })
}

async fn initialize_app_async(app_handle: AppHandle, model: String) -> Result<AppState, String> {
    // 1. Create Event Publisher
    let event_publisher: Arc<dyn IEventPublisher> =
        Arc::new(TauriEventPublisher::new(app_handle.clone()));

    // 2. Create Permission State (shared)
    let permission_state = PermissionState::new();

    // 3. Create Permission Prompter
    let prompter = TauriPermissionAdapter::new(permission_state.clone(), event_publisher.clone());

    // 3. Create Session Repository
    let sessions_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("sessions");
    let repository: Arc<dyn ISessionRepository> =
        Arc::new(FileSessionRepository::new(sessions_dir)?);

    // 4. Create Tool Executor
    let tool_executor = SimpleToolExecutor::new();

    // 5. Get tool definitions
    let tool_definitions = tool_executor.get_tool_definitions();

    // 6. Create API Client
    let api_client = SimpleApiClient::new(
        &model,
        event_publisher.clone(),
        tool_definitions,
    )
    .map_err(|e| format!("Failed to create API client: {}", e))?;

    // 7. Create Permission Policy
    let permission_policy = PermissionPolicy::new(PermissionMode::Prompt);

    // 7. Create ConversationRuntime
    let session = Session::new();
    let system_prompt = vec!["You are a helpful AI assistant.".to_string()];
    let runtime = ConversationRuntime::new(
        session,
        api_client,
        tool_executor,
        permission_policy,
        system_prompt,
    );

    // 10. Create MPSC channel
    let (tx, rx) = mpsc::channel::<ActorCommand>(100);

    // 11. Create Actor
    let actor = ChatSessionActor::new(runtime, rx, event_publisher, prompter, repository);

    // 12. Spawn Actor task
    tokio::spawn(async move {
        actor.run().await;
    });

    // 13. Return AppState
    Ok(AppState::new(tx, permission_state))
}
