// Dependency Injection Container
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

use runtime::{PermissionMode, PermissionPolicy, Session, RuntimeFeatureConfig};

use crate::adapters::outbound::api_client::TauriApiClient;
use crate::adapters::outbound::tool_executor::TauriToolExecutor;
use crate::adapters::outbound::file_repository::FileSessionRepository;
use crate::adapters::outbound::tauri_prompter::{PermissionState, TauriPermissionAdapter};
use crate::adapters::outbound::tauri_publisher::TauriEventPublisher;
use crate::core::use_cases::chat_actor::{ActorCommand, ChatSessionActor};
use crate::core::use_cases::ports::{IEventPublisher, ISessionRepository};
use crate::setup::app_state::AppState;

// Use extension from workspace
use extensions::realtime_tool_events::RealtimeConversationRuntime;

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
    let tool_executor = TauriToolExecutor::new(event_publisher.clone());

    // 5. Get tool definitions
    let tool_definitions = tool_executor.get_tool_definitions();

    // 6. Create API Client
    let api_client = TauriApiClient::new(
        &model,
        event_publisher.clone(),
        tool_definitions,
    )
    .map_err(|e| format!("Failed to create API client: {}", e))?;

    // 7. Create Permission Policy
    let permission_policy = PermissionPolicy::new(PermissionMode::Prompt);

    // 8. Create RealtimeConversationRuntime (extension) instead of core ConversationRuntime
    let session = Session::new();
    
    // Load system prompt from runtime (same as CLI)
    let cwd = std::env::current_dir().map_err(|e| format!("Failed to get cwd: {}", e))?;
    let system_prompt = runtime::load_system_prompt(
        cwd,
        chrono::Local::now().format("%Y-%m-%d").to_string(),
        std::env::consts::OS,
        "claw-desktop",
    )
    .map_err(|e| format!("Failed to load system prompt: {}", e))?;
    
    // Use extension for real-time tool event emission
    let runtime = RealtimeConversationRuntime::new(
        session,
        api_client,
        tool_executor,
        permission_policy,
        system_prompt,
        RuntimeFeatureConfig::default(),
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
