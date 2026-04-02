// ChatSessionActor - Actor Pattern với MPSC
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

use runtime::{
    ApiClient, ConversationRuntime, PermissionPrompter, RuntimeError, RuntimeFeatureConfig,
    Session, ToolExecutor, TurnSummary,
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
    ListSessions {
        response_tx: oneshot::Sender<Result<Vec<crate::core::domain::session_metadata::SessionMetadata>, String>>,
    },
    DeleteSession {
        session_id: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    RenameSession {
        session_id: String,
        title: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    NewSession {
        response_tx: oneshot::Sender<Result<String, String>>,
    },
    GetCurrentSessionId {
        response_tx: oneshot::Sender<Option<String>>,
    },
}

/// ChatSessionActor - Chạy trên tokio::task độc lập
pub struct ChatSessionActor<C: ApiClient, T: ToolExecutor, P: PermissionPrompter> {
    runtime: ConversationRuntime<C, T>,
    inbox: mpsc::Receiver<ActorCommand>,
    event_publisher: Arc<dyn IEventPublisher>,
    prompter: P,
    session_repository: Arc<dyn crate::core::use_cases::ports::ISessionRepository>,
    current_session_id: Option<String>,
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
            current_session_id: None,
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
                ActorCommand::ListSessions { response_tx } => {
                    let result = self.handle_list_sessions();
                    let _ = response_tx.send(result);
                }
                ActorCommand::DeleteSession {
                    session_id,
                    response_tx,
                } => {
                    let result = self.handle_delete_session(session_id);
                    let _ = response_tx.send(result);
                }
                ActorCommand::RenameSession {
                    session_id,
                    title,
                    response_tx,
                } => {
                    let result = self.handle_rename_session(session_id, title);
                    let _ = response_tx.send(result);
                }
                ActorCommand::NewSession { response_tx } => {
                    let result = self.handle_new_session();
                    let _ = response_tx.send(result);
                }
                ActorCommand::GetCurrentSessionId { response_tx } => {
                    let _ = response_tx.send(self.current_session_id.clone());
                }
            }
        }
    }

    async fn handle_prompt(&mut self, text: String) -> Result<TurnSummary, RuntimeError> {
        let event_publisher = self.event_publisher.clone();
        
        // Use extension's run_turn_with_callback for real-time tool event emission
        let summary = tokio::task::block_in_place(|| {
            self.runtime.run_turn_with_callback(
                text,
                Some(&mut self.prompter),
                |tool_result_message| {
                    // Emit tool result NGAY KHI tool execute xong (real-time)
                    for block in &tool_result_message.blocks {
                        if let runtime::ContentBlock::ToolResult {
                            tool_use_id,
                            tool_name: _,
                            output,
                            is_error,
                        } = block
                        {
                            event_publisher.publish_stream_event(
                                crate::core::domain::types::StreamEvent::ToolResult {
                                    tool_use_id: tool_use_id.clone(),
                                    output: output.clone(),
                                    is_error: *is_error,
                                },
                            );
                        }
                    }
                },
            )
        })?;

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
        self.session_repository.save(&session_id, session)?;
        self.current_session_id = Some(session_id);
        Ok(())
    }

    fn handle_list_sessions(
        &self,
    ) -> Result<Vec<crate::core::domain::session_metadata::SessionMetadata>, String> {
        self.session_repository.list_with_metadata()
    }

    fn handle_delete_session(&mut self, session_id: String) -> Result<(), String> {
        self.session_repository.delete(&session_id)?;
        // Clear current session if deleted
        if self.current_session_id.as_ref() == Some(&session_id) {
            self.current_session_id = None;
        }
        Ok(())
    }

    fn handle_rename_session(&self, session_id: String, title: String) -> Result<(), String> {
        self.session_repository.rename(&session_id, &title)
    }

    fn handle_new_session(&mut self) -> Result<String, String> {
        // Generate new session ID
        let session_id = uuid::Uuid::new_v4().to_string();
        
        // Create new session metadata
        let metadata =
            crate::core::domain::session_metadata::SessionMetadata::new(session_id.clone(), None);
        self.session_repository.save_metadata(&metadata)?;

        // Set as current
        self.current_session_id = Some(session_id.clone());

        Ok(session_id)
    }
}
