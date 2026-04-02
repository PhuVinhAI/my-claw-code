// ChatSessionActor - Actor Pattern với MPSC
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

use runtime::{
    ApiClient, ConversationRuntime, PermissionMode, PermissionPolicy, PermissionPrompter,
    RuntimeError, Session, ToolExecutor, TurnSummary,
};

use crate::core::use_cases::ports::IEventPublisher;

/// Actor Command - Messages gửi đến Actor
#[derive(Debug)]
pub enum ActorCommand {
    Prompt {
        text: String,
        response_tx: oneshot::Sender<Result<TurnSummary, RuntimeError>>,
    },
    Cancel,
    GrantPermission {
        request_id: String,
        allow: bool,
    },
    LoadSession {
        session_id: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    SaveSession {
        session_id: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    GetSession {
        response_tx: oneshot::Sender<Session>,
    },
}

/// ChatSessionActor - Chạy trên tokio::task độc lập
pub struct ChatSessionActor<C: ApiClient, T: ToolExecutor, P: PermissionPrompter> {
    runtime: ConversationRuntime<C, T>,
    inbox: mpsc::Receiver<ActorCommand>,
    event_publisher: Arc<dyn IEventPublisher>,
    prompter: P,
}

impl<C: ApiClient, T: ToolExecutor, P: PermissionPrompter> ChatSessionActor<C, T, P> {
    pub fn new(
        runtime: ConversationRuntime<C, T>,
        inbox: mpsc::Receiver<ActorCommand>,
        event_publisher: Arc<dyn IEventPublisher>,
        prompter: P,
    ) -> Self {
        Self {
            runtime,
            inbox,
            event_publisher,
            prompter,
        }
    }

    /// Main loop - Nhận messages từ inbox và xử lý
    pub async fn run(mut self) {
        while let Some(command) = self.inbox.recv().await {
            match command {
                ActorCommand::Prompt { text, response_tx } => {
                    let result = self.handle_prompt(text).await;
                    let _ = response_tx.send(result);
                }
                ActorCommand::Cancel => {
                    self.handle_cancel();
                }
                ActorCommand::GrantPermission { request_id, allow } => {
                    self.handle_permission(request_id, allow);
                }
                ActorCommand::LoadSession {
                    session_id,
                    response_tx,
                } => {
                    let result = self.handle_load_session(session_id);
                    let _ = response_tx.send(result);
                }
                ActorCommand::SaveSession {
                    session_id,
                    response_tx,
                } => {
                    let result = self.handle_save_session(session_id);
                    let _ = response_tx.send(result);
                }
                ActorCommand::GetSession { response_tx } => {
                    let _ = response_tx.send(self.runtime.session().clone());
                }
            }
        }
    }

    async fn handle_prompt(&mut self, text: String) -> Result<TurnSummary, RuntimeError> {
        // TODO: Implement streaming với event publisher
        // Hiện tại chỉ gọi runtime.run_turn
        self.runtime.run_turn(text, Some(&mut self.prompter))
    }

    fn handle_cancel(&mut self) {
        // TODO: Implement cancellation
        eprintln!("Cancel not yet implemented");
    }

    fn handle_permission(&mut self, _request_id: String, _allow: bool) {
        // TODO: Implement permission handling
        // Cần notify prompter về decision
        eprintln!("Permission handling not yet implemented");
    }

    fn handle_load_session(&mut self, _session_id: String) -> Result<(), String> {
        // TODO: Load session từ repository
        Err("Load session not yet implemented".to_string())
    }

    fn handle_save_session(&mut self, _session_id: String) -> Result<(), String> {
        // TODO: Save session to repository
        Err("Save session not yet implemented".to_string())
    }
}
