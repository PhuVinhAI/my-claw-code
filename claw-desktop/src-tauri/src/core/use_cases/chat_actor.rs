// ChatSessionActor - Actor Pattern với MPSC
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

use runtime::{
    ApiClient, ConversationRuntime, PermissionPrompter, RuntimeError, RuntimeFeatureConfig,
    Session, ToolExecutor, TurnSummary,
};

use crate::core::use_cases::ports::IEventPublisher;
use crate::core::domain::types::StreamEvent;

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
        work_mode: String,
        workspace_path: Option<String>,
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
    SetSelectedTools {
        tools: Vec<String>,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    ReloadApiClient {
        model: String,
        base_url: String,
        api_key: String,
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
    settings_manager: Arc<crate::core::domain::settings::SettingsManager>,
    cancel_flag: Arc<std::sync::atomic::AtomicBool>, // Shared cancel flag
    cumulative_usage: Option<runtime::TokenUsage>, // Track cumulative usage for Antigravity
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
        settings_manager: Arc<crate::core::domain::settings::SettingsManager>,
        cancel_flag: Arc<std::sync::atomic::AtomicBool>,
    ) -> Self {
        Self {
            runtime,
            inbox,
            event_publisher,
            prompter,
            session_repository,
            current_session_id: None,
            settings_manager,
            cancel_flag,
            cumulative_usage: None,
        }
    }

    /// Check if current provider is Antigravity (needs token accumulation)
    fn is_antigravity_provider(&self) -> bool {
        match self.settings_manager.load() {
            Ok(settings) => {
                if let Some(selected) = &settings.selected_model {
                    selected.provider_id == "antigravity"
                } else {
                    false
                }
            }
            Err(_) => false,
        }
    }

    /// Main loop - Nhận messages từ inbox và xử lý
    pub async fn run(mut self) {
        tracing::info!("ChatSessionActor started, waiting for commands");
        while let Some(command) = self.inbox.recv().await {
            let command_type = format!("{:?}", std::mem::discriminant(&command));
            tracing::debug!(command_type = %command_type, "Received actor command");
            
            match command {
                ActorCommand::Prompt { text, response_tx } => {
                    tracing::info!(text_len = text.len(), "Processing Prompt command");
                    let result = self.handle_prompt(text).await;
                    match &result {
                        Ok(summary) => {
                            tracing::info!(
                                iterations = summary.iterations,
                                "Prompt completed successfully"
                            );
                        }
                        Err(e) => {
                            tracing::error!(error = %e, "Prompt failed");
                            // Emit error event to frontend
                            let error_msg = format!("{}", e);
                            self.event_publisher.publish_stream_event(StreamEvent::Error { message: error_msg });
                        }
                    }
                    let _ = response_tx.send(result);
                }
                ActorCommand::Cancel => {
                    tracing::info!("Processing Cancel command");
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
                ActorCommand::ReloadSystemPrompt { work_mode, workspace_path, response_tx } => {
                    let result = self.handle_reload_system_prompt(work_mode, workspace_path);
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
                ActorCommand::SetSelectedTools { tools, response_tx } => {
                    let result = self.handle_set_selected_tools(tools);
                    let _ = response_tx.send(result);
                }
                ActorCommand::ReloadApiClient { model, base_url, api_key, response_tx } => {
                    tracing::info!(model = %model, "Processing ReloadApiClient command");
                    let result = self.handle_reload_api_client(model, base_url, api_key);
                    let _ = response_tx.send(result);
                }
            }
        }
    }

    async fn handle_prompt(&mut self, text: String) -> Result<TurnSummary, RuntimeError> {
        use crate::core::domain::logging_helpers::{log_turn_for_ai, log_tool_execution_for_ai, log_api_call_for_ai};
        
        let turn_id = uuid::Uuid::new_v4().to_string();
        
        tracing::info!(
            turn_id = %turn_id,
            text_len = text.len(),
            "🎯 TURN_START"
        );
        
        // Reset cancel flag at the START of new prompt (prevent race condition)
        self.cancel_flag.store(false, std::sync::atomic::Ordering::Relaxed);
        
        // Check if Antigravity provider (needs token accumulation)
        let is_antigravity = self.is_antigravity_provider();
        
        // Shared cumulative usage for Antigravity (use existing or start new)
        let cumulative_usage_shared = Arc::new(std::sync::Mutex::new(self.cumulative_usage));
        
        let event_publisher = self.event_publisher.clone();
        
        // Load settings để lấy threshold config
        let (threshold_ratio, max_tokens_opt) = match self.settings_manager.load() {
            Ok(settings) => {
                let max_tokens_opt = if let Some(selected) = &settings.selected_model {
                    if let Some(provider) = settings.get_provider(&selected.provider_id) {
                        if let Some(model) = provider.models.iter().find(|m| m.id == selected.model_id) {
                            model.max_context.map(|mc| mc as usize)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };
                (settings.compact_config.threshold_ratio, max_tokens_opt)
            }
            Err(e) => {
                eprintln!("[ACTOR] Failed to load settings for threshold check: {}", e);
                (0.80, None)
            }
        };
        
        // Only setup compression if model has max_tokens
        let threshold_opt = max_tokens_opt.map(|max_tokens| (max_tokens as f64 * threshold_ratio) as usize);
        let should_stop_for_compact = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let should_stop_clone = should_stop_for_compact.clone();
        
        // Track estimated tokens in shared state (updated after each API call)
        let estimated_tokens_shared = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let estimated_tokens_clone = estimated_tokens_shared.clone();
        
        // Clone for usage callback
        let cumulative_usage_clone = cumulative_usage_shared.clone();
        
        // Use extension's run_turn_with_callback for real-time tool event emission
        let turn_id_clone = turn_id.clone();
        let summary = tokio::task::block_in_place(|| {
            // Log turn start with full context
            log_turn_for_ai(
                &turn_id_clone,
                &text,
                &self.runtime.session().messages,
                0
            );
            
            self.runtime.run_turn_with_callback(
                text,
                Some(&mut self.prompter),
                |tool_result_message| {
                    // Emit tool result NGAY KHI tool execute xong (real-time)
                    for block in &tool_result_message.blocks {
                        if let runtime::ContentBlock::ToolResult {
                            tool_use_id,
                            tool_name,
                            output,
                            is_error,
                        } = block
                        {
                            // Detect cancelled/timed_out from output
                            let is_cancelled = output.contains("cancelled by user") || output.contains("Tool execution cancelled");
                            let is_timed_out = output.contains("TIMEOUT") || output.contains("timed out");
                            
                            // Log tool result for AI
                            log_tool_execution_for_ai(
                                tool_use_id,
                                tool_name,
                                "", // Input already logged when tool started
                                Some(output),
                                *is_error,
                                None
                            );
                            
                            event_publisher.publish_stream_event(
                                crate::core::domain::types::StreamEvent::ToolResult {
                                    tool_use_id: tool_use_id.clone(),
                                    output: output.clone(),
                                    is_error: *is_error,
                                    is_cancelled,
                                    is_timed_out,
                                },
                            );
                        }
                    }
                },
                |usage| {
                    // For Antigravity: accumulate tokens, for others: use directly
                    let usage_to_emit = if is_antigravity {
                        let mut cumulative = cumulative_usage_clone.lock().unwrap();
                        
                        if let Some(prev) = cumulative.as_ref() {
                            // Accumulate
                            let accumulated = runtime::TokenUsage {
                                input_tokens: prev.input_tokens + usage.input_tokens,
                                output_tokens: prev.output_tokens + usage.output_tokens,
                                cache_creation_input_tokens: prev.cache_creation_input_tokens + usage.cache_creation_input_tokens,
                                cache_read_input_tokens: prev.cache_read_input_tokens + usage.cache_read_input_tokens,
                            };
                            *cumulative = Some(accumulated);
                            accumulated
                        } else {
                            // First usage in turn
                            let first_usage = *usage;
                            *cumulative = Some(first_usage);
                            first_usage
                        }
                    } else {
                        // Other providers send cumulative usage directly
                        *usage
                    };
                    
                    // Emit accumulated/direct usage
                    event_publisher.publish_stream_event(
                        crate::core::domain::types::StreamEvent::Usage {
                            usage: usage_to_emit.clone(),
                        },
                    );
                    
                    // Update estimated tokens (rough estimate from usage)
                    let current_estimate = (usage_to_emit.input_tokens + usage_to_emit.output_tokens) as usize;
                    estimated_tokens_clone.store(current_estimate, std::sync::atomic::Ordering::Relaxed);
                },
                || {
                    // Check threshold NGAY SAU mỗi API call - return false để break loop
                    // Skip check if model doesn't have max_tokens
                    if let Some(threshold) = threshold_opt {
                        let estimated_tokens = estimated_tokens_shared.load(std::sync::atomic::Ordering::Relaxed);
                        
                        if estimated_tokens >= threshold {
                            should_stop_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                            
                            // KHÔNG emit MessageStop ở đây - sẽ emit sau khi compact xong
                            
                            return false; // Break loop
                        }
                    }
                    
                    true // Continue
                },
            )
        });

        // Check if cancelled during execution
        if self.cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
            tracing::warn!(turn_id = %turn_id, "🛑 TURN_CANCELLED");
            
            // Emit MessageStop to notify frontend
            event_publisher.publish_stream_event(
                crate::core::domain::types::StreamEvent::MessageStop,
            );
            
            // Return cancelled error
            return Err(RuntimeError::new("Operation cancelled by user"));
        }

        // If error occurred, remove last user message from session
        if summary.is_err() {
            eprintln!("[ACTOR] Error occurred, removing last user message from session");
            let session = self.runtime.session();
            let mut messages = session.messages.clone();
            
            // Find and remove last user message
            if let Some(last_idx) = messages.iter().rposition(|m| matches!(m.role, runtime::MessageRole::User)) {
                messages.remove(last_idx);
                eprintln!("[ACTOR] Removed user message at index {}", last_idx);
            }
            
            // Replace session with updated messages
            let mut new_session = session.clone();
            new_session.messages = messages;
            self.runtime.replace_session(new_session);
        }

        let summary = summary?;

        // Nếu đã stop vì vượt threshold → trigger compact NGAY
        if should_stop_for_compact.load(std::sync::atomic::Ordering::Relaxed) {
            eprintln!("[ACTOR] Performing compact after early termination");
            
            // Emit tool_result events cho các tool bị cancelled (nếu có)
            // Core runtime đã tạo tool_result messages, giờ cần emit events
            let session = self.runtime.session();
            
            // Tìm các tool_result messages cuối cùng (sau assistant message cuối)
            let mut last_assistant_idx = None;
            for (idx, msg) in session.messages.iter().enumerate().rev() {
                if matches!(msg.role, runtime::MessageRole::Assistant) {
                    last_assistant_idx = Some(idx);
                    break;
                }
            }
            
            if let Some(assistant_idx) = last_assistant_idx {
                // Emit tool_result events cho các tool_result sau assistant message
                for msg in &session.messages[assistant_idx + 1..] {
                    if matches!(msg.role, runtime::MessageRole::Tool) {
                        for block in &msg.blocks {
                            if let runtime::ContentBlock::ToolResult {
                                tool_use_id,
                                tool_name: _,
                                output,
                                is_error,
                            } = block
                            {
                                // Detect cancelled/timed_out from output
                                let is_cancelled = output.contains("cancelled by user") || output.contains("Tool execution cancelled");
                                let is_timed_out = output.contains("TIMEOUT") || output.contains("timed out");
                                
                                event_publisher.publish_stream_event(
                                    crate::core::domain::types::StreamEvent::ToolResult {
                                        tool_use_id: tool_use_id.clone(),
                                        output: output.clone(),
                                        is_error: *is_error,
                                        is_cancelled,
                                        is_timed_out,
                                    },
                                );
                            }
                        }
                    }
                }
            }
            
            // Emit MessageStop TRƯỚC KHI compact để UI chuyển về IDLE ngay
            event_publisher.publish_stream_event(
                crate::core::domain::types::StreamEvent::MessageStop,
            );
            
            // Perform compact
            self.perform_compact();
        } else {
            // Normal auto-compact check (fallback nếu chưa compact)
            self.check_and_auto_compact();
        }
        
        // Emit final estimated usage for models that don't provide usage (like Gemini)
        // This ensures UI always has token count to display
        // SKIP for Antigravity - it already emitted cumulative usage in callback
        if !is_antigravity {
            let estimated_tokens = self.runtime.estimated_tokens();
            if estimated_tokens > 0 {
                let estimated_usage = runtime::TokenUsage {
                    input_tokens: estimated_tokens as u32,
                    output_tokens: 0,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                };
                self.event_publisher.publish_stream_event(
                    crate::core::domain::types::StreamEvent::Usage {
                        usage: estimated_usage,
                    }
                );
            }
        }
        
        // Save cumulative usage for Antigravity (persists across turns in session)
        if is_antigravity {
            let final_cumulative = *cumulative_usage_shared.lock().unwrap();
            self.cumulative_usage = final_cumulative;
        }

        Ok(summary)
    }

    /// Check và auto-compact session nếu token vượt ngưỡng
    fn check_and_auto_compact(&mut self) {
        // Load settings để lấy config và model max_context
        let settings = match self.settings_manager.load() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[AUTO-COMPACT] Failed to load settings: {}", e);
                return;
            }
        };
        
        // Get max_tokens từ selected model - skip if model doesn't have max_context
        let max_tokens = if let Some(selected) = &settings.selected_model {
            if let Some(provider) = settings.get_provider(&selected.provider_id) {
                if let Some(model) = provider.models.iter().find(|m| m.id == selected.model_id) {
                    match model.max_context {
                        Some(mc) => mc as usize,
                        None => {
                            // Model không có max_context → skip compression
                            return;
                        }
                    }
                } else {
                    return; // Model not found
                }
            } else {
                return; // Provider not found
            }
        } else {
            return; // No selected model
        };
        
        let threshold_ratio = settings.compact_config.threshold_ratio;
        let threshold = (max_tokens as f64 * threshold_ratio) as usize;
        
        let estimated_tokens = self.runtime.estimated_tokens();
        
        if estimated_tokens >= threshold {
            self.perform_compact();
        }
    }
    
    /// Perform compaction (extracted for reuse)
    fn perform_compact(&mut self) {
        // Load settings để lấy config
        let settings = match self.settings_manager.load() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[COMPACT] Failed to load settings: {}", e);
                return;
            }
        };
        
        // Get max_tokens từ selected model - skip if model doesn't have max_context
        let max_tokens = if let Some(selected) = &settings.selected_model {
            if let Some(provider) = settings.get_provider(&selected.provider_id) {
                if let Some(model) = provider.models.iter().find(|m| m.id == selected.model_id) {
                    match model.max_context {
                        Some(mc) => mc as usize,
                        None => {
                            // Model không có max_context → skip compression
                            eprintln!("[COMPACT] Model doesn't have max_context, skipping compression");
                            return;
                        }
                    }
                } else {
                    eprintln!("[COMPACT] Model not found, skipping compression");
                    return;
                }
            } else {
                eprintln!("[COMPACT] Provider not found, skipping compression");
                return;
            }
        } else {
            eprintln!("[COMPACT] No selected model, skipping compression");
            return;
        };
        
        let estimated_tokens = self.runtime.estimated_tokens();
        
        // Emit CompactStarted event
        self.event_publisher.publish_stream_event(
            crate::core::domain::types::StreamEvent::CompactStarted {
                estimated_tokens,
                max_tokens,
            }
        );
        
        // Perform compaction using core logic với config từ settings
        let config = runtime::CompactionConfig {
            preserve_recent_messages: settings.compact_config.preserve_recent_messages,
            max_estimated_tokens: 10_000,
        };
        
        let result = self.runtime.compact(config);
        
        if result.removed_message_count > 0 {
            // Replace session with compacted version
            self.runtime.replace_session(result.compacted_session.clone());
            
            let new_estimated_tokens = self.runtime.estimated_tokens();
            
            // Emit CompactCompleted event
            self.event_publisher.publish_stream_event(
                crate::core::domain::types::StreamEvent::CompactCompleted {
                    removed_count: result.removed_message_count,
                    summary: result.formatted_summary,
                    new_estimated_tokens,
                    max_tokens,
                }
            );
            
            // Emit updated usage after compact
            // For Antigravity: recalculate cumulative from remaining messages
            // For others: use estimated tokens
            if self.is_antigravity_provider() {
                let session = self.runtime.session();
                let mut total_usage = runtime::TokenUsage::default();
                
                for msg in &session.messages {
                    if msg.role == runtime::MessageRole::Assistant {
                        if let Some(usage) = msg.usage {
                            total_usage.input_tokens += usage.input_tokens;
                            total_usage.output_tokens += usage.output_tokens;
                            total_usage.cache_creation_input_tokens += usage.cache_creation_input_tokens;
                            total_usage.cache_read_input_tokens += usage.cache_read_input_tokens;
                        }
                    }
                }
                
                // Update cumulative usage after compact
                self.cumulative_usage = Some(total_usage);
                
                self.event_publisher.publish_stream_event(
                    crate::core::domain::types::StreamEvent::Usage {
                        usage: crate::core::domain::types::TokenUsage {
                            input_tokens: total_usage.input_tokens,
                            output_tokens: total_usage.output_tokens,
                            cache_creation_input_tokens: total_usage.cache_creation_input_tokens,
                            cache_read_input_tokens: total_usage.cache_read_input_tokens,
                        },
                    }
                );
            } else {
                // For non-Antigravity: emit estimated usage
                let estimated_usage = runtime::TokenUsage {
                    input_tokens: new_estimated_tokens as u32,
                    output_tokens: 0,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                };
                self.event_publisher.publish_stream_event(
                    crate::core::domain::types::StreamEvent::Usage {
                        usage: estimated_usage,
                    }
                );
            }
        } else {
            eprintln!("[COMPACT] No compaction needed");
        }
    }

    fn handle_cancel(&mut self) {
        eprintln!("[ACTOR] Cancelling current operation");
        
        // Cancel flag đã được set bởi cancel_prompt command
        // Runtime sẽ check flag này và stop
        
        // Emit MessageStop để frontend biết đã cancel
        self.event_publisher.publish_stream_event(
            crate::core::domain::types::StreamEvent::MessageStop,
        );
        
        eprintln!("[ACTOR] Cancel command processed");
    }

    fn handle_load_session(&mut self, session_id: String, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        // Load session from repository with work context
        let session = self.session_repository.load(&session_id, &work_mode, workspace_path.as_deref())?;
        
        // Replace runtime session
        self.runtime.replace_session(session);
        
        // Update current session ID
        self.current_session_id = Some(session_id);
        
        let session = self.runtime.session();
        
        // For Antigravity: recalculate cumulative usage from all assistant messages in session
        if self.is_antigravity_provider() {
            let mut total_usage = runtime::TokenUsage::default();
            
            for (_idx, msg) in session.messages.iter().enumerate() {
                if msg.role == runtime::MessageRole::Assistant {
                    if let Some(usage) = msg.usage {
                        total_usage.input_tokens += usage.input_tokens;
                        total_usage.output_tokens += usage.output_tokens;
                        total_usage.cache_creation_input_tokens += usage.cache_creation_input_tokens;
                        total_usage.cache_read_input_tokens += usage.cache_read_input_tokens;
                    }
                }
            }
            
            // Only set if there's actual usage data
            if total_usage.input_tokens > 0 || total_usage.output_tokens > 0 {
                self.cumulative_usage = Some(total_usage);
                
                // Emit usage event to frontend so TokenCounter displays correct value
                self.event_publisher.publish_stream_event(
                    crate::core::domain::types::StreamEvent::Usage {
                        usage: crate::core::domain::types::TokenUsage {
                            input_tokens: total_usage.input_tokens,
                            output_tokens: total_usage.output_tokens,
                            cache_creation_input_tokens: total_usage.cache_creation_input_tokens,
                            cache_read_input_tokens: total_usage.cache_read_input_tokens,
                        },
                    },
                );
            } else {
                self.cumulative_usage = None;
            }
        } else {
            // Other providers: reset cumulative usage (they send cumulative in each response)
            self.cumulative_usage = None;
            
            // Find last assistant message and emit its usage to frontend
            for msg in session.messages.iter().rev() {
                if msg.role == runtime::MessageRole::Assistant {
                    if let Some(usage) = msg.usage {
                        self.event_publisher.publish_stream_event(
                            crate::core::domain::types::StreamEvent::Usage {
                                usage: crate::core::domain::types::TokenUsage {
                                    input_tokens: usage.input_tokens,
                                    output_tokens: usage.output_tokens,
                                    cache_creation_input_tokens: usage.cache_creation_input_tokens,
                                    cache_read_input_tokens: usage.cache_read_input_tokens,
                                },
                            },
                        );
                    } else {
                        eprintln!("[ACTOR] Last assistant message has no usage data");
                    }
                    break;
                }
            }
        }
        
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
        
        // KHÔNG save metadata ngay - chỉ save khi có tin nhắn đầu tiên
        // (tránh sessions rỗng xuất hiện trong list)

        // Set as current
        self.current_session_id = Some(session_id.clone());
        
        // Reset cumulative usage for new session
        self.cumulative_usage = None;

        Ok(session_id)
    }

    fn handle_reload_system_prompt(&mut self, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        // Determine CWD based on work mode
        let cwd = if work_mode == "workspace" {
            // Workspace mode: use workspace path or current dir
            if let Some(ref path) = workspace_path {
                std::path::PathBuf::from(path)
            } else {
                std::env::current_dir()
                    .map_err(|e| format!("Failed to get current directory: {}", e))?
            }
        } else {
            // Normal mode: use home directory (generic context)
            dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/"))
        };
        
        // Reload system prompt with work mode info
        let date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let os_name = std::env::consts::OS.to_string();
        let os_version = "".to_string();
        
        let system_prompt = runtime::load_system_prompt(
            cwd.clone(), 
            date, 
            os_name, 
            os_version,
        )
        .map_err(|e| format!("Failed to load system prompt: {}", e))?;
        
        // Update runtime's system prompt
        self.runtime.update_system_prompt(system_prompt);
        
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
        // Parse work mode string to enum
        let mode = match work_mode.as_str() {
            "workspace" => crate::core::domain::types::WorkMode::Workspace,
            _ => crate::core::domain::types::WorkMode::Normal,
        };
        
        // Update tool executor's work mode
        let tool_executor = self.runtime.tool_executor_mut();
        tool_executor.set_work_mode(mode);
        
        // Update repository's work mode
        self.session_repository.set_work_mode(work_mode)?;
        
        Ok(())
    }
    
    fn handle_set_selected_tools(&mut self, tools: Vec<String>) -> Result<(), String> {
        // Get previous tools to detect changes
        let tool_executor = self.runtime.tool_executor_mut();
        let previous_tools = tool_executor.get_selected_tools();
        
        // Detect changes
        let added_tools: Vec<String> = tools.iter()
            .filter(|t| !previous_tools.contains(t))
            .cloned()
            .collect();
        let removed_tools: Vec<String> = previous_tools.iter()
            .filter(|t| !tools.contains(t))
            .cloned()
            .collect();
        
        // Update tool executor's selected tools
        tool_executor.set_selected_tools(tools.clone());
        
        // Reload tool definitions to reflect new selection
        self.handle_reload_tool_definitions()?;
        
        // Reload system prompt to include tool instructions
        let work_mode = self.session_repository.get_work_mode()?;
        let workspace_path = self.session_repository.get_workspace_path()?;
        self.handle_reload_system_prompt(work_mode, workspace_path)?;
        
        // If there are changes AND session has messages, inject system notification
        if (!added_tools.is_empty() || !removed_tools.is_empty()) && !self.runtime.session().messages.is_empty() {
            // Map tool IDs to friendly names
            let tool_names = |tools: &[String]| -> String {
                tools.iter()
                    .map(|t| match t.as_str() {
                        "WebSearch" => "Tìm kiếm Web",
                        "WebFetch" => "Truy cập Web",
                        _ => t.as_str(),
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            };
            
            let mut notification_parts = Vec::new();
            
            if !added_tools.is_empty() {
                let tools_str = tool_names(&added_tools);
                notification_parts.push(format!("User đã BẬT tools: {}", tools_str));
            }
            
            if !removed_tools.is_empty() {
                let tools_str = tool_names(&removed_tools);
                notification_parts.push(format!("User đã TẮT tools: {}", tools_str));
            }
            
            let notification = format!(
                "<system-reminder>\n{}\n\nBạn có thể sử dụng các tools đã được bật để trả lời câu hỏi tiếp theo của user.\n</system-reminder>",
                notification_parts.join("\n")
            );
            
            // Inject system message into session
            let system_message = runtime::ConversationMessage {
                role: runtime::MessageRole::System,
                blocks: vec![runtime::ContentBlock::Text { text: notification.clone() }],
                usage: None,
            };
            
            // Add to session messages
            let session = self.runtime.session();
            let mut messages = session.messages.clone();
            messages.push(system_message.clone());
            
            // Replace session with updated messages
            let mut new_session = session.clone();
            new_session.messages = messages;
            self.runtime.replace_session(new_session);
            
            // Emit event to frontend (không render, chỉ log)
            self.event_publisher.publish_stream_event(
                crate::core::domain::types::StreamEvent::SystemMessage {
                    message: notification,
                }
            );
        }
        
        Ok(())
    }
    
    fn handle_reload_api_client(&mut self, model: String, base_url: String, api_key: String) -> Result<(), String> {
        eprintln!("[ACTOR] Reloading API client with model: {}", model);
        
        // Get current tool definitions from tool_executor
        let tool_definitions = self.runtime.tool_executor_mut().get_tool_definitions();
        let event_publisher = self.event_publisher.clone();
        let cancel_flag = self.cancel_flag.clone(); // Use shared cancel flag
        
        // Create new API client with explicit base_url and api_key
        let new_client = crate::adapters::outbound::api_client::TauriApiClient::new_with_base_url(
            &model,
            &base_url,
            &api_key,
            event_publisher,
            tool_definitions,
            cancel_flag,
        ).map_err(|e| format!("Failed to create new API client: {}", e))?;
        
        // Replace API client in runtime
        self.runtime.replace_api_client(new_client);
        
        eprintln!("[ACTOR] API client reloaded successfully");
        Ok(())
    }
}
