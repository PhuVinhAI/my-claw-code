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
    session_repository: Arc<dyn crate::core::use_cases::ports::ISessionRepository>,
}

impl<C: ApiClient, T: ToolExecutor, P: PermissionPrompter> ChatSessionActor<C, T, P> {
    pub fn new(
        runtime: ConversationRuntime<C, T>,
        inbox: mpsc::Receiver<ActorCommand>,
        event_publisher: Arc<dyn IEventPublisher>,
        prompter: P,
        session_repository: Arc<dyn crate::core::use_cases::ports::ISessionRepository>,
    ) -> Self {
        Self {
            runtime,
            inbox,
            event_publisher,
            prompter,
            session_repository,
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
        // Run turn in block_in_place to avoid runtime conflicts with bash tool
        let summary = tokio::task::block_in_place(|| {
            self.runtime.run_turn(text, Some(&mut self.prompter))
        })?;

        // Emit tool results về Frontend
        for tool_result in &summary.tool_results {
            for block in &tool_result.blocks {
                if let runtime::ContentBlock::ToolResult {
                    tool_use_id,
                    tool_name: _,
                    output,
                    is_error,
                } = block
                {
                    self.event_publisher.publish_stream_event(
                        crate::core::domain::types::StreamEvent::ToolResult {
                            tool_use_id: tool_use_id.clone(),
                            output: output.clone(),
                            is_error: *is_error,
                        },
                    );
                }
            }
        }

        // Emit usage
        self.event_publisher.publish_stream_event(
            crate::core::domain::types::StreamEvent::Usage {
                usage: summary.usage,
            },
        );

        Ok(summary)
    }

    fn handle_cancel(&mut self) {
        // TODO: Implement cancellation
        eprintln!("Cancel not yet implemented");
    }

    fn handle_load_session(&mut self, _session_id: String) -> Result<(), String> {
        // TODO: Load session - cần refactor ConversationRuntime để support replace_session
        // Hiện tại ConversationRuntime không có method để replace session
        Err("Load session not yet implemented - need ConversationRuntime refactor".to_string())
    }

    fn handle_save_session(&mut self, session_id: String) -> Result<(), String> {
        let session = self.runtime.session();
        self.session_repository.save(&session_id, session)
    }
}
