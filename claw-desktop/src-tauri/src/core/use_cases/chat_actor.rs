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
        work_mode: String,
        workspace_path: Option<String>,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    SaveSession {
        session_id: String,
        work_mode: String,
        workspace_path: Option<String>,
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
        work_mode: String,
        workspace_path: Option<String>,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    RenameSession {
        session_id: String,
        title: String,
        work_mode: String,
        workspace_path: Option<String>,
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
    ReloadToolDefinitions {
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    SetWorkMode {
        work_mode: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
}

/// ChatSessionActor - Chạy trên tokio::task độc lập
/// Desktop-specific: Dùng concrete types thay vì generics để dễ access methods
pub struct ChatSessionActor {
    runtime: ConversationRuntime<
        crate::adapters::outbound::api_client::TauriApiClient,
        crate::adapters::outbound::tool_executor::TauriToolExecutor,
    >,
    inbox: mpsc::Receiver<ActorCommand>,
    event_publisher: Arc<dyn IEventPublisher>,
    prompter: crate::adapters::outbound::tauri_prompter::TauriPermissionAdapter,
    session_repository: Arc<dyn crate::core::use_cases::ports::ISessionRepository>,
    current_session_id: Option<String>,
}

impl ChatSessionActor {
    pub fn new(
        runtime: ConversationRuntime<
            crate::adapters::outbound::api_client::TauriApiClient,
            crate::adapters::outbound::tool_executor::TauriToolExecutor,
        >,
        inbox: mpsc::Receiver<ActorCommand>,
        event_publisher: Arc<dyn IEventPublisher>,
        prompter: crate::adapters::outbound::tauri_prompter::TauriPermissionAdapter,
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
                    work_mode,
                    workspace_path,
                    response_tx,
                } => {
                    let result = self.handle_load_session(session_id, work_mode, workspace_path);
                    let _ = response_tx.send(result);
                }
                ActorCommand::SaveSession {
                    session_id,
                    work_mode,
                    workspace_path,
                    response_tx,
                } => {
                    let result = self.handle_save_session(session_id, work_mode, workspace_path);
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
                    work_mode,
                    workspace_path,
                    response_tx,
                } => {
                    let result = self.handle_delete_session(session_id, work_mode, workspace_path);
                    let _ = response_tx.send(result);
                }
                ActorCommand::RenameSession {
                    session_id,
                    title,
                    work_mode,
                    workspace_path,
                    response_tx,
                } => {
                    let result = self.handle_rename_session(session_id, title, work_mode, workspace_path);
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
                ActorCommand::ReloadToolDefinitions { response_tx } => {
                    let result = self.handle_reload_tool_definitions();
                    let _ = response_tx.send(result);
                }
                ActorCommand::SetWorkMode { work_mode, response_tx } => {
                    let result = self.handle_set_work_mode(work_mode);
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

    fn handle_load_session(&mut self, session_id: String, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        // Load session from repository with work context
        let session = self.session_repository.load(&session_id, &work_mode, workspace_path.as_deref())?;
        
        // Replace runtime session
        self.runtime.replace_session(session);
        
        // Update current session ID
        self.current_session_id = Some(session_id);
        
        Ok(())
    }

    fn handle_save_session(&mut self, session_id: String, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        let session = self.runtime.session();
        self.session_repository.save_with_work_context(&session_id, session, work_mode, workspace_path)?;
        self.current_session_id = Some(session_id);
        Ok(())
    }

    fn handle_list_sessions(
        &self,
    ) -> Result<Vec<crate::core::domain::session_metadata::SessionMetadata>, String> {
        self.session_repository.list_with_metadata()
    }

    fn handle_delete_session(&mut self, session_id: String, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        self.session_repository.delete(&session_id, &work_mode, workspace_path.as_deref())?;
        // Clear current session if deleted
        if self.current_session_id.as_ref() == Some(&session_id) {
            self.current_session_id = None;
        }
        Ok(())
    }

    fn handle_rename_session(&self, session_id: String, title: String, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        self.session_repository.rename(&session_id, &title, &work_mode, workspace_path.as_deref())
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
        self.session_repository.set_working_dir(workdir.clone())?;
        
        eprintln!("[ACTOR] Working directory changed to: {}", workdir);
        
        // Clear current session when changing workspace
        self.current_session_id = None;
        let new_session = runtime::Session::new();
        self.runtime.replace_session(new_session);
        
        Ok(())
    }
    
    fn handle_reload_tool_definitions(&mut self) -> Result<(), String> {
        eprintln!("[ACTOR] Reloading tool definitions based on work mode");
        
        // Get updated tool definitions from tool executor
        let tool_executor = self.runtime.tool_executor_mut();
        let new_definitions = tool_executor.get_tool_definitions();
        
        eprintln!("[ACTOR] Loaded {} tool definitions", new_definitions.len());
        
        // Update API client with new definitions
        let api_client = self.runtime.api_client_mut();
        api_client.set_tool_definitions(new_definitions);
        
        Ok(())
    }
    
    fn handle_set_work_mode(&mut self, work_mode: String) -> Result<(), String> {
        // Update repository's work mode
        self.session_repository.set_work_mode(work_mode)?;
        Ok(())
    }
}
