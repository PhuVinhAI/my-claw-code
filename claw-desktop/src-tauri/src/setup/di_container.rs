// Dependency Injection Container
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

use runtime::{ConversationRuntime, PermissionMode, PermissionPolicy, RuntimeFeatureConfig, Session};

use crate::adapters::outbound::api_client::TauriApiClient;
use crate::adapters::outbound::tool_executor::TauriToolExecutor;
use crate::adapters::outbound::file_repository::FileSessionRepository;
use crate::adapters::outbound::tauri_prompter::{PermissionState, TauriPermissionAdapter};
use crate::adapters::outbound::tauri_publisher::TauriEventPublisher;
use crate::core::use_cases::chat_actor::{ActorCommand, ChatSessionActor};
use crate::core::use_cases::ports::{IEventPublisher, ISessionRepository};
use crate::setup::app_state::AppState;
use crate::core::domain::settings::SettingsManager;

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

/// Get model configuration from environment (fallback)
fn get_model_from_env() -> (String, String, String) {
    let model = std::env::var("CLAW_MODEL").unwrap_or_else(|_| "gpt-4".to_string());
    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());
    (model, api_key, base_url)
}

/// Initialize DI Container và spawn Actor
pub fn initialize_app(app_handle: AppHandle) -> Result<AppState, String> {
    // Load environment variables (for backward compatibility)
    load_env_vars();

    // Use Tauri's async runtime to initialize
    tauri::async_runtime::block_on(async {
        initialize_app_async(app_handle).await
    })
}

async fn initialize_app_async(app_handle: AppHandle) -> Result<AppState, String> {
    // 1. Create Event Publisher
    let event_publisher: Arc<dyn IEventPublisher> =
        Arc::new(TauriEventPublisher::new(app_handle.clone()));

    // 2. Create Permission State (shared)
    let permission_state = PermissionState::new();

    // 3. Create Permission Prompter
    let prompter = TauriPermissionAdapter::new(permission_state.clone(), event_publisher.clone());

    // 3. Create Settings Manager FIRST (để load user_language)
    let settings_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("settings.json");
    let settings_manager = Arc::new(SettingsManager::new(settings_path));
    
    // Try to load settings
    let settings = settings_manager.load().unwrap_or_else(|_| {
        eprintln!("Warning: Could not load settings, using empty settings");
        use crate::core::domain::settings::Settings;
        Settings::new()
    });
    
    // 3.5. Create Session Repository (with user_language from settings)
    let sessions_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("sessions");
    let repository: Arc<dyn ISessionRepository> =
        Arc::new(FileSessionRepository::new(sessions_dir, settings.user_language.clone())?);
    
    // Get model configuration from settings or fallback to env
    let (model, api_key, base_url, provider_id) = if let Some(ref selected) = settings.selected_model {
        if let Some(provider) = settings.get_provider(&selected.provider_id) {
            if let Some(model_obj) = provider.models.iter().find(|m| m.id == selected.model_id) {
                eprintln!("✓ Using model from settings: {} ({})", model_obj.name, model_obj.id);
                (
                    model_obj.id.clone(),
                    provider.api_key.clone(),
                    provider.base_url.clone(),
                    Some(selected.provider_id.clone())
                )
            } else {
                eprintln!("Warning: Model not found in settings, falling back to env");
                let (m, k, u) = get_model_from_env();
                (m, k, u, None)
            }
        } else {
            eprintln!("Warning: Provider not found in settings, falling back to env");
            let (m, k, u) = get_model_from_env();
            (m, k, u, None)
        }
    } else {
        eprintln!("Warning: No model selected in settings, falling back to env");
        let (m, k, u) = get_model_from_env();
        (m, k, u, None)
    };

    // Set environment variables for API client (only if we have an API key)
    let has_api_key = !api_key.is_empty();
    if has_api_key {
        // Set for OpenAI-compatible providers
        std::env::set_var("OPENAI_API_KEY", &api_key);
        std::env::set_var("OPENAI_BASE_URL", &base_url);
        // Set for Anthropic-compatible providers (Antigravity, etc.)
        std::env::set_var("ANTHROPIC_API_KEY", &api_key);
        std::env::set_var("ANTHROPIC_BASE_URL", &base_url);
        eprintln!("✓ API client configured with model: {}", model);
    } else {
        eprintln!("⚠ No API key configured. App will start in onboarding mode.");
        // Set dummy values to prevent panics during initialization
        std::env::set_var("OPENAI_API_KEY", "sk-dummy-key-for-onboarding-mode");
        std::env::set_var("OPENAI_BASE_URL", "https://api.openai.com/v1");
        std::env::set_var("ANTHROPIC_API_KEY", "sk-dummy-key-for-onboarding-mode");
        std::env::set_var("ANTHROPIC_BASE_URL", "https://api.anthropic.com");
    }
    
    // 4. Create cancel flag (shared)
    let cancel_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));

    // 5. Create stdin channel for interactive tools
    let (tool_stdin_tx, tool_stdin_rx) = crossbeam_channel::unbounded::<(String, String)>();

    // 6. Create work mode state (shared)
    let work_mode = Arc::new(std::sync::Mutex::new(crate::core::domain::types::WorkMode::Normal));

    // 6.5. Get workspace path from settings
    let workspace_path = std::path::PathBuf::from(&settings.workspace_path);
    eprintln!("✓ Workspace path: {}", workspace_path.display());

    // 6.6. Create PromptRegistry for PromptUser tool
    let prompt_registry = Arc::new(crate::adapters::outbound::prompt_registry::PromptRegistry::new());

    // 7. Create Tool Executor
    let tool_executor = TauriToolExecutor::new(
        event_publisher.clone(),
        cancel_flag.clone(),
        tool_stdin_rx,
        work_mode.clone(),
        workspace_path,
        prompt_registry.clone(),
    );

    // 7.5. Get PTY executor reference for cancellation (before moving tool_executor)
    let pty_executor_for_cancel = tool_executor.get_pty_executor();

    // 8. Get tool definitions and cancel sender
    let tool_definitions = tool_executor.get_tool_definitions();
    let cancel_tx = tool_executor.get_cancel_sender();

    // 9. Create API Client with explicit base_url and api_key from settings
    let api_client = if has_api_key {
        TauriApiClient::new_with_base_url(
            &model,
            &base_url,
            &api_key,
            provider_id.as_deref(),
            event_publisher.clone(),
            tool_definitions,
            cancel_flag.clone(),
        )
    } else {
        // Onboarding mode - use dummy values
        TauriApiClient::new_with_base_url(
            &model,
            "https://api.openai.com/v1",
            "sk-dummy",
            None,
            event_publisher.clone(),
            tool_definitions,
            cancel_flag.clone(),
        )
    }
    .map_err(|e| {
        if has_api_key {
            format!("Failed to create API client with configured credentials: {}", e)
        } else {
            format!("Failed to initialize app in onboarding mode: {}", e)
        }
    })?;

    // 10. Create Permission Policy
    let permission_policy = PermissionPolicy::new(PermissionMode::Prompt);

    // 11. Create ConversationRuntime with features
    let session = Session::new();

    // Load system prompt from runtime (same as CLI)
    // At init time, always use home dir (Normal mode default) - NO workspace context
    let cwd = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"));
    let system_prompt = runtime::load_system_prompt(
        cwd,
        chrono::Local::now().format("%Y-%m-%d").to_string(),
        std::env::consts::OS,
        "claw-desktop",
        false, // Normal mode: no git/directory tree
        None,  // No language preference at init (will be set later)
    )
    .map_err(|e| format!("Failed to load system prompt: {}", e))?;

    // 12. Use core ConversationRuntime with features
    let runtime = ConversationRuntime::new_with_features(
        session,
        api_client,
        tool_executor,
        permission_policy,
        system_prompt,
        &RuntimeFeatureConfig::default(),
    );

    // 13. Create MPSC channel
    let (tx, rx) = mpsc::channel::<ActorCommand>(100);

    // 14. Create Actor
    let actor = ChatSessionActor::new(
        runtime, 
        rx, 
        event_publisher, 
        prompter, 
        repository,
        settings_manager.clone(), // Pass settings_manager to actor
        cancel_flag.clone(), // Pass shared cancel_flag to actor
    );

    // 15. Spawn Actor task in background thread (actor is !Send due to HookProgressReporter)
    // Use std::thread with tokio::spawn instead of block_on to support block_in_place
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        // Use spawn instead of block_on to allow block_in_place in handle_prompt
        let handle = rt.spawn(async move {
            actor.run().await;
        });
        // Block on the spawned task
        rt.block_on(handle).expect("Actor task panicked");
    });

    // 16. Return AppState
    Ok(AppState::new(tx, permission_state, cancel_flag, cancel_tx, tool_stdin_tx, settings_manager, pty_executor_for_cancel, prompt_registry))
}
