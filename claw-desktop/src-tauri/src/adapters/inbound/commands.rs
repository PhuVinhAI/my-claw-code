// Tauri Commands - Inbound Adapters
use std::sync::atomic::Ordering;
use tauri::State;
use tokio::sync::oneshot;

use crate::core::use_cases::chat_actor::ActorCommand;
use crate::setup::app_state::AppState;

/// Send prompt command - Non-blocking (fire and forget)
#[tauri::command]
pub async fn send_prompt(text: String, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!(text_len = text.len(), "send_prompt command called");
    tracing::debug!(text_preview = %text.chars().take(100).collect::<String>(), "Prompt text preview");
    
    // DON'T reset cancel_flag here - Actor will reset it when starting new prompt
    // This prevents race condition where cancel_flag is reset before Actor checks it
    
    // Spawn task để không block UI
    let actor_tx = state.actor_tx.clone();
    tokio::spawn(async move {
        let (tx, rx) = oneshot::channel();
        
        tracing::debug!("Sending ActorCommand::Prompt to actor");
        if let Err(e) = actor_tx.send(ActorCommand::Prompt { text, response_tx: tx }).await {
            tracing::error!(error = %e, "Failed to send prompt to actor");
            return;
        }
        
        tracing::debug!("Waiting for actor response");
        // Await response trong background task (không block UI)
        match rx.await {
            Ok(Ok(_summary)) => tracing::info!("Actor completed successfully"),
            Ok(Err(e)) => tracing::error!(error = %e, "Actor returned error"),
            Err(e) => tracing::error!(error = %e, "Failed to receive response"),
        }
    });

    // Return ngay lập tức (không đợi Actor xử lý)
    tracing::debug!("send_prompt returning immediately");
    Ok(())
}

/// Answer permission command
#[tauri::command]
pub async fn answer_permission(
    request_id: String,
    allow: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    tracing::info!(request_id = %request_id, allow = allow, "answer_permission command called");
    // Answer qua PermissionState
    state.permission_state.answer(request_id, allow)
}

/// Load session command
#[tauri::command]
pub async fn load_session(
    session_id: String,
    work_mode: String,
    workspace_path: Option<String>,
    state: State<'_, AppState>
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::LoadSession {
            session_id,
            work_mode,
            workspace_path,
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to send load session: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Save session command
#[tauri::command]
pub async fn save_session(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    // Get current work mode and workspace path
    let work_mode = {
        let mode = state.work_mode.lock().unwrap();
        format!("{:?}", *mode).to_lowercase()
    };
    let workspace_path = {
        let path = state.workspace_path.lock().unwrap();
        path.clone()
    };
    
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::SaveSession {
            session_id,
            work_mode,
            workspace_path,
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to send save session: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Get current session command
#[tauri::command]
pub async fn get_session(state: State<'_, AppState>) -> Result<runtime::Session, String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::GetSession { response_tx: tx })
        .await
        .map_err(|e| format!("Failed to send get session: {}", e))?;

    let session = rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?;
    
    // Debug: log first assistant message's model_name
    if let Some(msg) = session.messages.iter().find(|m| m.role == runtime::MessageRole::Assistant) {
        eprintln!("[GET_SESSION] First assistant message model_name: {:?}", msg.model_name);
    }
    
    Ok(session)
}

/// Dừng quá trình tạo phản hồi của AI
#[tauri::command]
pub fn cancel_prompt(state: State<'_, AppState>) -> Result<(), String> {
    eprintln!("[COMMAND] cancel_prompt called - cancelling all operations");
    
    // Set global cancel flag
    state.cancel_flag.store(true, Ordering::Relaxed);
    
    // Send cancel event to tool executor
    let _ = state.cancel_tx.send(());
    
    // Cancel ALL running PTY processes
    let running_tools = state.pty_executor.get_running_tools();
    eprintln!("[COMMAND] Cancelling {} running tools", running_tools.len());
    
    for tool_id in running_tools {
        if let Err(e) = state.pty_executor.cancel_tool(&tool_id) {
            eprintln!("[COMMAND] Failed to cancel tool {}: {}", tool_id, e);
        }
    }
    
    // Send Cancel command to Actor (non-blocking)
    let actor_tx = state.actor_tx.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = actor_tx.send(ActorCommand::Cancel).await {
            eprintln!("[COMMAND] Failed to send Cancel to actor: {}", e);
        } else {
            eprintln!("[COMMAND] Cancel command sent to actor");
        }
    });
    
    eprintln!("[COMMAND] All cancel signals sent");
    Ok(())
}

/// List all sessions with metadata
#[tauri::command]
pub async fn list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<crate::core::domain::session_metadata::SessionMetadata>, String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::ListSessions { response_tx: tx })
        .await
        .map_err(|e| format!("Failed to send list sessions: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Delete a session
#[tauri::command]
pub async fn delete_session(
    session_id: String,
    work_mode: String,
    workspace_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::DeleteSession {
            session_id,
            work_mode,
            workspace_path,
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to send delete session: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Rename a session
#[tauri::command]
pub async fn rename_session(
    session_id: String,
    title: String,
    work_mode: String,
    workspace_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::RenameSession {
            session_id,
            title,
            work_mode,
            workspace_path,
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to send rename session: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Create a new session
#[tauri::command]
pub async fn new_session(state: State<'_, AppState>) -> Result<String, String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::NewSession { response_tx: tx })
        .await
        .map_err(|e| format!("Failed to send new session: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Get current session ID
#[tauri::command]
pub async fn get_current_session_id(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::GetCurrentSessionId { response_tx: tx })
        .await
        .map_err(|e| format!("Failed to send get current session id: {}", e))?;

    Ok(rx
        .await
        .map_err(|e| format!("Failed to receive response: {}", e))?)
}

/// Set working directory (workspace) - Changes process CWD globally
#[tauri::command]
pub async fn set_working_directory(path: String, state: State<'_, AppState>) -> Result<(), String> {
    use std::path::Path;
    
    let workspace_path = Path::new(&path);
    
    // Validate path exists
    if !workspace_path.exists() {
        return Err(format!("Thư mục không tồn tại: {}", path));
    }
    
    if !workspace_path.is_dir() {
        return Err(format!("Đường dẫn không phải là thư mục: {}", path));
    }
    
    // Set current directory globally for the entire process
    std::env::set_current_dir(workspace_path)
        .map_err(|e| format!("Không thể chuyển thư mục: {}", e))?;
    
    eprintln!("[WORKSPACE] Changed working directory to: {}", path);
    
    // Notify actor about working directory change
    let (tx, rx) = oneshot::channel();
    state
        .actor_tx
        .send(ActorCommand::ChangeWorkingDir {
            workdir: path.clone(),
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to notify actor: {}", e))?;
    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))??;
    
    // Reload system prompt with new workspace context
    reload_system_prompt(state).await?;
    
    Ok(())
}

/// Get current working directory
#[tauri::command]
pub fn get_working_directory() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Không thể lấy thư mục hiện tại: {}", e))
}

/// Open folder picker dialog and set as working directory
#[tauri::command]
pub async fn select_and_set_workspace(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // Open folder picker using Tauri v2 dialog API
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();
    
    if let Some(file_path) = folder {
        // Convert FilePath to PathBuf then to String
        let path = file_path.as_path()
            .ok_or_else(|| "Invalid file path".to_string())?;
        let path_str = path.to_string_lossy().to_string();
        
        // Set as working directory (this will also reload system prompt)
        set_working_directory(path_str.clone(), state).await?;
        
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

/// Reload system prompt (call after workspace change)
#[tauri::command]
pub async fn reload_system_prompt(state: State<'_, AppState>) -> Result<(), String> {
    // Get current work mode and workspace path
    let work_mode = {
        let mode = state.work_mode.lock().unwrap();
        format!("{:?}", *mode).to_lowercase()
    };
    let workspace_path = {
        let path = state.workspace_path.lock().unwrap();
        path.clone()
    };
    
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::ReloadSystemPrompt { 
            work_mode,
            workspace_path,
            response_tx: tx 
        })
        .await
        .map_err(|e| format!("Failed to send reload system prompt: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Send input to interactive tool (stdin)
#[tauri::command]
pub async fn send_tool_input(
    tool_use_id: String,
    input: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Send input to tool executor's stdin channel
    state
        .tool_stdin_tx
        .send((tool_use_id, input))
        .map_err(|e| format!("Failed to send tool input: {}", e))?;
    Ok(())
}

/// Cancel a specific tool execution (for bash/PowerShell)
#[tauri::command]
pub fn cancel_tool_execution(
    tool_use_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.pty_executor.cancel_tool(&tool_use_id)
}

/// Detach a tool execution - let it run but return current output to AI
#[tauri::command]
pub fn detach_tool_execution(
    tool_use_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.pty_executor.detach_tool(&tool_use_id)
}

/// Get current work mode
#[tauri::command]
pub fn get_work_mode(state: State<'_, AppState>) -> Result<crate::core::domain::types::WorkMode, String> {
    let mode = state.work_mode.lock().unwrap();
    Ok(*mode)
}

/// Set work mode and optionally workspace path
#[tauri::command]
pub async fn set_work_mode(
    mode: crate::core::domain::types::WorkMode,
    workspace_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use crate::core::domain::types::WorkMode;
    
    let work_mode_str = match mode {
        WorkMode::Normal => "normal",
        WorkMode::Workspace => "workspace",
    }.to_string();
    
    // Validate workspace path if switching to Workspace mode
    if mode == WorkMode::Workspace {
        if let Some(ref path) = workspace_path {
            use std::path::Path;
            let ws_path = Path::new(path);
            if !ws_path.exists() || !ws_path.is_dir() {
                return Err("Đường dẫn workspace không hợp lệ".to_string());
            }
            
            // Set working directory
            set_working_directory(path.clone(), state.clone()).await?;
        } else {
            return Err("Chế độ Làm việc yêu cầu workspace path".to_string());
        }
    } else {
        // Normal mode: Clear workspace path
        let mut current_path = state.workspace_path.lock().unwrap();
        *current_path = None;
    }
    
    // Update mode in AppState
    {
        let mut current_mode = state.work_mode.lock().unwrap();
        *current_mode = mode;
    }
    
    // Update workspace path (only for Workspace mode)
    if mode == WorkMode::Workspace {
        let mut current_path = state.workspace_path.lock().unwrap();
        *current_path = workspace_path.clone();
    }
    
    eprintln!("[WORK_MODE] Changed to: {:?}", mode);
    
    // Notify repository about work mode change
    let (tx, rx) = oneshot::channel();
    state
        .actor_tx
        .send(ActorCommand::SetWorkMode {
            work_mode: work_mode_str.clone(),
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to notify actor: {}", e))?;
    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))??;
    
    // Reload tool definitions to reflect new mode
    reload_tool_definitions(state.clone()).await?;
    
    // Reload system prompt with new work mode context
    reload_system_prompt(state).await?;
    
    Ok(())
}

/// Get current workspace path
#[tauri::command]
pub fn get_workspace_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let path = state.workspace_path.lock().unwrap();
    Ok(path.clone())
}

/// Reload tool definitions (called after work mode change)
#[tauri::command]
pub async fn reload_tool_definitions(state: State<'_, AppState>) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::ReloadToolDefinitions { response_tx: tx })
        .await
        .map_err(|e| format!("Failed to send reload tool definitions: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Set selected tools for Normal mode (user toggles tools in UI)
#[tauri::command]
pub async fn set_selected_tools(
    tools: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::SetSelectedTools {
            tools,
            response_tx: tx,
        })
        .await
        .map_err(|e| format!("Failed to send set selected tools: {}", e))?;

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
}


// ============================================================================
// SETTINGS COMMANDS
// ============================================================================

use crate::core::domain::settings::{Model, Provider, SelectedModel, Settings};

/// Check if onboarding is complete (settings configured)
#[tauri::command]
pub fn check_onboarding_complete(state: State<'_, AppState>) -> Result<bool, String> {
    let settings = state.settings_manager.load()?;
    Ok(settings.is_configured())
}

/// Get all settings
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    eprintln!("[COMMAND] get_settings called");
    let settings = state.settings_manager.load()?;
    eprintln!("[COMMAND] Returning settings with {} providers", settings.providers.len());
    Ok(settings)
}

/// Save settings
#[tauri::command]
pub fn save_settings(settings: Settings, state: State<'_, AppState>) -> Result<(), String> {
    state.settings_manager.save(&settings)
}

/// Add provider
#[tauri::command]
pub fn add_provider(provider: Provider, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.add_provider(provider)?;
    state.settings_manager.save(&settings)
}

/// Update provider
#[tauri::command]
pub fn update_provider(provider: Provider, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.update_provider(provider)?;
    state.settings_manager.save(&settings)
}

/// Delete provider
#[tauri::command]
pub fn delete_provider(provider_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.delete_provider(&provider_id)?;
    state.settings_manager.save(&settings)
}

/// Add model to provider
#[tauri::command]
pub fn add_model(provider_id: String, model: Model, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.add_model(&provider_id, model)?;
    state.settings_manager.save(&settings)
}

/// Update model
#[tauri::command]
pub fn update_model(provider_id: String, model: Model, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.update_model(&provider_id, model)?;
    state.settings_manager.save(&settings)
}

/// Delete model
#[tauri::command]
pub fn delete_model(provider_id: String, model_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.delete_model(&provider_id, &model_id)?;
    state.settings_manager.save(&settings)
}

/// Set selected model
#[tauri::command]
pub fn set_selected_model(provider_id: String, model_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings_manager.load()?;
    settings.set_selected_model(provider_id, model_id)?;
    state.settings_manager.save(&settings)
}

/// Get selected model info (provider + model)
#[tauri::command]
pub fn get_selected_model_info(state: State<'_, AppState>) -> Result<Option<(Provider, Model)>, String> {
    let settings = state.settings_manager.load()?;
    
    if let Some(ref selected) = settings.selected_model {
        let provider = settings.get_provider(&selected.provider_id)
            .ok_or_else(|| format!("Provider '{}' not found", selected.provider_id))?;
        
        let model = provider.models.iter()
            .find(|m| m.id == selected.model_id)
            .ok_or_else(|| format!("Model '{}' not found", selected.model_id))?;
        
        Ok(Some((provider.clone(), model.clone())))
    } else {
        Ok(None)
    }
}


/// Reload API client with new model configuration from settings
#[tauri::command]
pub async fn reload_api_client(state: State<'_, AppState>) -> Result<(), String> {
    eprintln!("[COMMAND] reload_api_client called");
    
    // Load settings
    let settings = state.settings_manager.load()?;
    
    // Get selected model
    let (model, api_key, base_url) = if let Some(ref selected) = settings.selected_model {
        let provider = settings.get_provider(&selected.provider_id)
            .ok_or_else(|| format!("Provider '{}' not found", selected.provider_id))?;
        
        let model_obj = provider.models.iter()
            .find(|m| m.id == selected.model_id)
            .ok_or_else(|| format!("Model '{}' not found in provider '{}'", selected.model_id, selected.provider_id))?;
        
        eprintln!("[COMMAND] Reloading with model: {} ({})", model_obj.name, model_obj.id);
        (model_obj.id.clone(), provider.api_key.clone(), provider.base_url.clone())
    } else {
        return Err("No model selected in settings".to_string());
    };
    
    // Update environment variables
    std::env::set_var("OPENAI_API_KEY", &api_key);
    std::env::set_var("OPENAI_BASE_URL", &base_url);
    
    // Send command to actor to reload API client
    let (tx, rx) = oneshot::channel();
    state.actor_tx.send(ActorCommand::ReloadApiClient {
        model,
        base_url,
        api_key,
        response_tx: tx,
    }).await.map_err(|e| format!("Failed to send reload command: {}", e))?;
    
    rx.await.map_err(|e| format!("Failed to receive response: {}", e))?
}

/// Open external terminal at current working directory with optional command
#[tauri::command]
pub fn open_external_terminal(command: Option<String>) -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    eprintln!("[COMMAND] Opening external terminal at: {}", cwd.display());
    if let Some(ref cmd) = command {
        eprintln!("[COMMAND] With command: {}", cmd);
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows: Use 'start' command to open new terminal window
        let cwd_str = cwd.to_string_lossy().to_string();
        
        if let Some(cmd) = command {
            // Open terminal and run command
            // Try Windows Terminal first
            let wt_result = std::process::Command::new("cmd")
                .arg("/C")
                .arg("start")
                .arg("wt")
                .arg("-d")
                .arg(&cwd_str)
                .arg("cmd")
                .arg("/K")
                .arg(&cmd)
                .spawn();
            
            if wt_result.is_ok() {
                eprintln!("[COMMAND] Opened Windows Terminal with command");
            } else {
                // Fallback to PowerShell
                eprintln!("[COMMAND] Windows Terminal not found, trying PowerShell...");
                let ps_result = std::process::Command::new("cmd")
                    .arg("/C")
                    .arg("start")
                    .arg("powershell")
                    .arg("-NoExit")
                    .arg("-Command")
                    .arg(format!("Set-Location '{}'; {}", cwd_str, cmd))
                    .spawn();
                
                if ps_result.is_ok() {
                    eprintln!("[COMMAND] Opened PowerShell with command");
                } else {
                    // Final fallback to CMD
                    eprintln!("[COMMAND] PowerShell failed, trying CMD...");
                    std::process::Command::new("cmd")
                        .arg("/C")
                        .arg("start")
                        .arg("cmd")
                        .arg("/K")
                        .arg(format!("cd /d \"{}\" && {}", cwd_str, cmd))
                        .spawn()
                        .map_err(|e| format!("Failed to open CMD: {}", e))?;
                    eprintln!("[COMMAND] Opened CMD with command");
                }
            }
        } else {
            // Open terminal without command (original behavior)
            let wt_result = std::process::Command::new("cmd")
                .arg("/C")
                .arg("start")
                .arg("wt")
                .arg("-d")
                .arg(&cwd_str)
                .spawn();
            
            if wt_result.is_ok() {
                eprintln!("[COMMAND] Opened Windows Terminal");
            } else {
                eprintln!("[COMMAND] Windows Terminal not found, trying PowerShell...");
                let ps_result = std::process::Command::new("cmd")
                    .arg("/C")
                    .arg("start")
                    .arg("powershell")
                    .arg("-NoExit")
                    .arg("-Command")
                    .arg(format!("Set-Location '{}'", cwd_str))
                    .spawn();
                
                if ps_result.is_ok() {
                    eprintln!("[COMMAND] Opened PowerShell");
                } else {
                    eprintln!("[COMMAND] PowerShell failed, trying CMD...");
                    std::process::Command::new("cmd")
                        .arg("/C")
                        .arg("start")
                        .arg("cmd")
                        .arg("/K")
                        .arg(format!("cd /d \"{}\"", cwd_str))
                        .spawn()
                        .map_err(|e| format!("Failed to open CMD: {}", e))?;
                    eprintln!("[COMMAND] Opened CMD");
                }
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS: Open Terminal.app
        if let Some(cmd) = command {
            // Open terminal and run command
            std::process::Command::new("osascript")
                .arg("-e")
                .arg(format!(
                    "tell application \"Terminal\" to do script \"cd '{}' && {}\"",
                    cwd.display(),
                    cmd
                ))
                .spawn()
                .map_err(|e| format!("Failed to open Terminal: {}", e))?;
        } else {
            std::process::Command::new("open")
                .arg("-a")
                .arg("Terminal")
                .arg(cwd)
                .spawn()
                .map_err(|e| format!("Failed to open Terminal: {}", e))?;
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux: Try common terminals
        let terminals = ["gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
        let mut success = false;
        
        for terminal in &terminals {
            let result = if let Some(ref cmd) = command {
                std::process::Command::new(terminal)
                    .arg("--working-directory")
                    .arg(&cwd)
                    .arg("-e")
                    .arg("bash")
                    .arg("-c")
                    .arg(format!("{}; exec bash", cmd))
                    .spawn()
            } else {
                std::process::Command::new(terminal)
                    .arg("--working-directory")
                    .arg(&cwd)
                    .spawn()
            };
            
            if result.is_ok() {
                success = true;
                break;
            }
        }
        
        if !success {
            return Err("No supported terminal found".to_string());
        }
    }
    
    eprintln!("[COMMAND] External terminal opened successfully");
    Ok(())
}

/// Fetch available models from Kilo Gateway API
#[tauri::command]
pub async fn fetch_kilo_models() -> Result<String, String> {
    eprintln!("[COMMAND] fetch_kilo_models called");
    
    // Use reqwest to fetch models (bypass CORS)
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.kilo.ai/api/gateway/models")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    eprintln!("[COMMAND] Fetched {} bytes from Kilo API", body.len());
    Ok(body)
}
