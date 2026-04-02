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
