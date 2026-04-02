// Tauri Commands - Inbound Adapters
use tauri::State;
use tokio::sync::oneshot;

use crate::core::use_cases::chat_actor::ActorCommand;
use crate::setup::app_state::AppState;

/// Send prompt command - Non-blocking
#[tauri::command]
pub async fn send_prompt(text: String, state: State<'_, AppState>) -> Result<(), String> {
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
