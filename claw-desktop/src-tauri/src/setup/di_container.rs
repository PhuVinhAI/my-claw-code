// Dependency Injection Container
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

use api::ProviderClient;
use runtime::{ConversationRuntime, PermissionMode, PermissionPolicy, Session};
use tools::GlobalToolRegistry;

use crate::adapters::outbound::file_repository::FileSessionRepository;
use crate::adapters::outbound::tauri_prompter::TauriPermissionAdapter;
use crate::adapters::outbound::tauri_publisher::TauriEventPublisher;
use crate::core::use_cases::chat_actor::{ActorCommand, ChatSessionActor};
use crate::core::use_cases::ports::{IEventPublisher, ISessionRepository};
use crate::setup::app_state::AppState;

/// Simple ApiClient wrapper
pub struct SimpleApiClient {
    client: ProviderClient,
}

impl SimpleApiClient {
    pub fn new(model: &str) -> Result<Self, String> {
        let client = ProviderClient::from_model(model)
            .map_err(|e| format!("Failed to create API client: {}", e))?;
        Ok(Self { client })
    }
}

impl runtime::ApiClient for SimpleApiClient {
    fn stream(
        &mut self,
        _request: runtime::ApiRequest,
    ) -> Result<Vec<runtime::AssistantEvent>, runtime::RuntimeError> {
        // TODO: Implement async streaming
        // Hiện tại chỉ return empty để compile
        Err(runtime::RuntimeError::new(
            "Streaming not yet implemented",
        ))
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
}

impl runtime::ToolExecutor for SimpleToolExecutor {
    fn execute(&mut self, _tool_name: &str, _input: &str) -> Result<String, runtime::ToolError> {
        // TODO: Implement tool execution
        Err(runtime::ToolError::new("Tool execution not yet implemented"))
    }
}

/// Initialize DI Container và spawn Actor
pub fn initialize_app(app_handle: AppHandle) -> Result<AppState, String> {
    // 1. Create Event Publisher
    let event_publisher: Arc<dyn IEventPublisher> =
        Arc::new(TauriEventPublisher::new(app_handle.clone()));

    // 2. Create Permission Prompter
    let prompter = TauriPermissionAdapter::new(event_publisher.clone());

    // 3. Create Session Repository
    let sessions_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("sessions");
    let _repository: Arc<dyn ISessionRepository> =
        Arc::new(FileSessionRepository::new(sessions_dir)?);

    // 4. Create API Client
    let api_client = SimpleApiClient::new("claude-sonnet-4.5")
        .map_err(|e| format!("Failed to create API client: {}", e))?;

    // 5. Create Tool Executor
    let tool_executor = SimpleToolExecutor::new();

    // 6. Create Permission Policy
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

    // 8. Create MPSC channel
    let (tx, rx) = mpsc::channel::<ActorCommand>(100);

    // 9. Create Actor
    let actor = ChatSessionActor::new(runtime, rx, event_publisher, prompter);

    // 10. Spawn Actor task
    tokio::spawn(async move {
        actor.run().await;
    });

    // 11. Return AppState
    Ok(AppState::new(tx))
}
