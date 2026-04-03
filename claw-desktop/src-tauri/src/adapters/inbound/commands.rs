// Tauri Commands - Inbound Adapters
use std::sync::atomic::Ordering;
use tauri::State;
use tokio::sync::oneshot;

use crate::core::use_cases::chat_actor::ActorCommand;
use crate::setup::app_state::AppState;

/// Send prompt command - Non-blocking
#[tauri::command]
pub async fn send_prompt(text: String, state: State<'_, AppState>) -> Result<(), String> {
    // Reset cờ hủy trước khi chạy prompt mới
    state.cancel_flag.store(false, Ordering::Relaxed);
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::Prompt { text, response_tx: tx })
        .await
        .map_err(|e| format!("Failed to send prompt: {}", e))?;

    // Chờ Actor nhận message (không chờ xử lý xong)
    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))?
        .map_err(|e| format!("Runtime error: {}", e))?;

    Ok(())
}

/// Answer permission command
#[tauri::command]
pub async fn answer_permission(
    request_id: String,
    allow: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Answer qua PermissionState
    state.permission_state.answer(request_id, allow)
}

/// Load session command
#[tauri::command]
pub async fn load_session(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::LoadSession {
            session_id,
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
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::SaveSession {
            session_id,
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

    rx.await
        .map_err(|e| format!("Failed to receive response: {}", e))
}

/// Dừng quá trình tạo phản hồi của AI
#[tauri::command]
pub fn cancel_prompt(state: State<'_, AppState>) {
    state.cancel_flag.store(true, Ordering::Relaxed);
    // Send cancel event to tool executor
    let _ = state.cancel_tx.send(());
}

/// Lấy thông tin model hiện tại đang sử dụng
#[tauri::command]
pub fn get_model() -> String {
    std::env::var("CLAW_MODEL").unwrap_or_else(|_| "nvidia/nemotron-3-super-120b-a12b".to_string())
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
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::DeleteSession {
            session_id,
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
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::RenameSession {
            session_id,
            title,
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
    let (tx, rx) = oneshot::channel();

    state
        .actor_tx
        .send(ActorCommand::ReloadSystemPrompt { response_tx: tx })
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
