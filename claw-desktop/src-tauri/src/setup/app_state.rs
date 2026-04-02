// AppState - Tauri State Management
use tokio::sync::mpsc;

use crate::core::use_cases::chat_actor::ActorCommand;

/// Application State - Shared across Tauri commands
pub struct AppState {
    pub actor_tx: mpsc::Sender<ActorCommand>,
}

impl AppState {
    pub fn new(actor_tx: mpsc::Sender<ActorCommand>) -> Self {
        Self { actor_tx }
    }
}
