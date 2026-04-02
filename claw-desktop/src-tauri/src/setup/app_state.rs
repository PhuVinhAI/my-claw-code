// AppState - Tauri State Management
use tokio::sync::mpsc;

use crate::adapters::outbound::tauri_prompter::PermissionState;
use crate::core::use_cases::chat_actor::ActorCommand;

/// Application State - Shared across Tauri commands
pub struct AppState {
    pub actor_tx: mpsc::Sender<ActorCommand>,
    pub permission_state: PermissionState,
}

impl AppState {
    pub fn new(actor_tx: mpsc::Sender<ActorCommand>, permission_state: PermissionState) -> Self {
        Self {
            actor_tx,
            permission_state,
        }
    }
}
