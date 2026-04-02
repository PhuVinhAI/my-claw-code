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
    ReloadSystemPrompt {
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    ChangeWorkingDir {
        workdir: String,
        response_tx: oneshot::Sender<Result<(), String>>,
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
                ActorCommand::ReloadSystemPrompt { response_tx } => {
                    let result = self.handle_reload_system_prompt();
                    let _ = response_tx.send(result);
                }
                ActorCommand::ChangeWorkingDir { workdir, response_tx } => {
                    let result = self.handle_change_working_dir(workdir);
                    let _ = response_tx.send(result);
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

    fn handle_load_session(&mut self, session_id: String) -> Result<(), String> {
        // Load session from repository
        let session = self.session_repository.load(&session_id)?;
        
        // Replace runtime session
        self.runtime.replace_session(session);
        
        // Update current session ID
        self.current_session_id = Some(session_id);
        
        Ok(())
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
        
        // Create empty session and replace in runtime
        let new_session = runtime::Session::new();
        self.runtime.replace_session(new_session);
        
        // Create new session metadata
        let metadata =
            crate::core::domain::session_metadata::SessionMetadata::new(session_id.clone(), None);
        self.session_repository.save_metadata(&metadata)?;

        // Set as current
        self.current_session_id = Some(session_id.clone());

        Ok(session_id)
    }

    fn handle_reload_system_prompt(&mut self) -> Result<(), String> {
        // Get current working directory
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        
        // Reload system prompt with new cwd
        let date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let os_name = std::env::consts::OS.to_string();
        let os_version = "".to_string(); // Can be empty
        
        let system_prompt = runtime::load_system_prompt(cwd, date, os_name, os_version)
            .map_err(|e| format!("Failed to load system prompt: {}", e))?;
        
        // Update runtime's system prompt
        self.runtime.update_system_prompt(system_prompt);
        
        eprintln!("[ACTOR] System prompt reloaded for new workspace");
        Ok(())
    }

    fn handle_change_working_dir(&mut self, workdir: String) -> Result<(), String> {
        // Update repository's working directory
        // Note: This requires session_repository to be mutable
        // We need to add a method to ISessionRepository trait
        eprintln!("[ACTOR] Working directory changed to: {}", workdir);
        
        // Clear current session when changing workspace
        self.current_session_id = None;
        let new_session = runtime::Session::new();
        self.runtime.replace_session(new_session);
        
        Ok(())
    }
}
