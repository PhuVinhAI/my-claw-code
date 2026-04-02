// AppState - Tauri State Management
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::mpsc;
use crossbeam_channel::Sender;

use crate::adapters::outbound::tauri_prompter::PermissionState;
use crate::core::use_cases::chat_actor::ActorCommand;

/// Application State - Shared across Tauri commands
pub struct AppState {
    pub actor_tx: mpsc::Sender<ActorCommand>,
    pub permission_state: PermissionState,
    pub cancel_flag: Arc<AtomicBool>,
    pub cancel_tx: Sender<()>,
}

impl AppState {
    pub fn new(
        actor_tx: mpsc::Sender<ActorCommand>,
        permission_state: PermissionState,
        cancel_flag: Arc<AtomicBool>,
        cancel_tx: Sender<()>,
    ) -> Self {
        Self {
            actor_tx,
            permission_state,
            cancel_flag,
            cancel_tx,
        }
    }
}
