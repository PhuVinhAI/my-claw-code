// AppState - Tauri State Management
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use crossbeam_channel::Sender;

use crate::adapters::outbound::tauri_prompter::PermissionState;
use crate::core::use_cases::chat_actor::ActorCommand;
use crate::core::domain::types::WorkMode;
use crate::core::domain::settings::SettingsManager;
use crate::adapters::outbound::pty_executor::PtyExecutor;
use crate::adapters::outbound::prompt_registry::PromptRegistry;

/// Application State - Shared across Tauri commands
pub struct AppState {
    pub actor_tx: mpsc::Sender<ActorCommand>,
    pub permission_state: PermissionState,
    pub cancel_flag: Arc<AtomicBool>,
    pub cancel_tx: Sender<()>,
    pub tool_stdin_tx: crossbeam_channel::Sender<(String, String)>, // (tool_use_id, input)
    pub work_mode: Arc<Mutex<WorkMode>>,
    pub workspace_path: Arc<Mutex<Option<String>>>,
    pub settings_manager: Arc<SettingsManager>,
    pub pty_executor: Arc<PtyExecutor>, // For cancelling specific PTY tools
    pub prompt_registry: Arc<PromptRegistry>, // For PromptUser tool
}

impl AppState {
    pub fn new(
        actor_tx: mpsc::Sender<ActorCommand>,
        permission_state: PermissionState,
        cancel_flag: Arc<AtomicBool>,
        cancel_tx: Sender<()>,
        tool_stdin_tx: crossbeam_channel::Sender<(String, String)>,
        settings_manager: Arc<SettingsManager>,
        pty_executor: Arc<PtyExecutor>,
        prompt_registry: Arc<PromptRegistry>,
    ) -> Self {
        Self {
            actor_tx,
            permission_state,
            cancel_flag,
            cancel_tx,
            tool_stdin_tx,
            work_mode: Arc::new(Mutex::new(WorkMode::Normal)),
            workspace_path: Arc::new(Mutex::new(None)),
            settings_manager,
            pty_executor,
            prompt_registry,
        }
    }
}
