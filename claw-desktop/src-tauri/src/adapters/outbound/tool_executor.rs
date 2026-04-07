// Tool Executor Adapter for Tauri
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use runtime::{ToolExecutor, ToolError};
use tools::GlobalToolRegistry;
use crossbeam_channel::{Receiver, Sender, bounded};

use crate::core::use_cases::ports::IEventPublisher;
use crate::core::domain::types::WorkMode;
use super::pty_executor::PtyExecutor;

pub struct TauriToolExecutor {
    registry: GlobalToolRegistry,
    cancel_flag: Arc<AtomicBool>,
    cancel_tx: Sender<()>,
    cancel_rx: Receiver<()>,
    pty_executor: Arc<PtyExecutor>, // Make Arc to share with commands
    work_mode: Arc<Mutex<WorkMode>>,
    selected_tools: Arc<Mutex<Vec<String>>>, // Normal mode: user-selected tools
    event_publisher: Arc<dyn IEventPublisher>, // For emitting tool cancellation events
    current_turn_id: Arc<std::sync::Mutex<String>>, // Track current turn ID
}

impl TauriToolExecutor {
    pub fn new(
        event_publisher: Arc<dyn IEventPublisher>,
        cancel_flag: Arc<AtomicBool>,
        stdin_rx: crossbeam_channel::Receiver<(String, String)>,
        work_mode: Arc<Mutex<WorkMode>>,
        workspace_path: std::path::PathBuf,
    ) -> Self {
        let (cancel_tx, cancel_rx) = bounded(1);
        let pty_executor = Arc::new(PtyExecutor::new(
            event_publisher.clone(),
            cancel_flag.clone(),
            stdin_rx.clone(),
            workspace_path.clone(),
        ));
        Self {
            registry: GlobalToolRegistry::builtin(),
            cancel_flag,
            cancel_tx,
            cancel_rx,
            pty_executor,
            work_mode,
            selected_tools: Arc::new(Mutex::new(Vec::new())), // Mặc định: không có tools
            event_publisher,
            current_turn_id: Arc::new(std::sync::Mutex::new(String::new())),
        }
    }
    
    /// Set current turn ID for event emission
    pub fn set_turn_id(&self, turn_id: String) {
        let mut current = self.current_turn_id.lock().unwrap();
        *current = turn_id.clone();
        // Also set in pty_executor
        self.pty_executor.set_turn_id(turn_id);
    }
    
    /// Get current turn ID
    fn get_turn_id(&self) -> String {
        let current = self.current_turn_id.lock().unwrap();
        current.clone()
    }
    
    /// Get PTY executor for cancelling specific tools
    pub fn get_pty_executor(&self) -> Arc<PtyExecutor> {
        self.pty_executor.clone()
    }
    
    /// Set selected tools for Normal mode (called when user toggles tools in UI)
    pub fn set_selected_tools(&self, tools: Vec<String>) {
        let mut selected = self.selected_tools.lock().unwrap();
        *selected = tools;
    }
    
    /// Get current selected tools (for detecting changes)
    pub fn get_selected_tools(&self) -> Vec<String> {
        let selected = self.selected_tools.lock().unwrap();
        selected.clone()
    }
    
    /// Update work mode (called when user switches mode)
    pub fn set_work_mode(&self, mode: WorkMode) {
        let mut current_mode = self.work_mode.lock().unwrap();
        *current_mode = mode;
    }

    pub fn get_tool_definitions(&self) -> Vec<api::ToolDefinition> {
        let mode = self.work_mode.lock().unwrap();
        
        // Get common exclusions (workspace-specific + OS-specific)
        // Apply to BOTH modes for consistency
        let excluded = tools::GlobalToolRegistry::default_workspace_exclusions();
        
        match *mode {
            WorkMode::Workspace => {
                // Workspace mode: All tools EXCEPT excluded ones
                self.registry.definitions_with_exclusions(None, Some(&excluded))
            }
            WorkMode::Normal => {
                // Normal mode: User-selected tools, also excluding common exclusions
                let selected = self.selected_tools.lock().unwrap();
                
                if selected.is_empty() {
                    // Không có tools nào được chọn → return empty
                    Vec::new()
                } else {
                    // Return definitions cho selected tools, excluding common exclusions
                    let allowed_tools: std::collections::BTreeSet<String> = 
                        selected.iter().cloned().collect();
                    self.registry.definitions_with_exclusions(Some(&allowed_tools), Some(&excluded))
                }
            }
        }
    }
    
    pub fn get_cancel_sender(&self) -> Sender<()> {
        self.cancel_tx.clone()
    }
}

impl ToolExecutor for TauriToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        // Fallback to execute_with_context with empty tool_use_id
        self.execute_with_context(tool_name, input, "")
    }
    
    fn execute_with_context(&mut self, tool_name: &str, input: &str, tool_use_id: &str) -> Result<String, ToolError> {
        use crate::core::domain::logging_helpers::log_tool_execution_for_ai;
        use std::time::Instant;
        
        let start_time = Instant::now();
        
        tracing::info!(
            tool_name = %tool_name,
            tool_use_id = %tool_use_id,
            input_len = input.len(),
            "🔧 TOOL_EXEC_START"
        );
        
        // VALIDATE: Check if tool is allowed based on work mode and selected tools
        let mode = self.work_mode.lock().unwrap();
        let is_allowed = match *mode {
            WorkMode::Workspace => {
                // Workspace mode: All tools except excluded ones
                let excluded = tools::GlobalToolRegistry::default_workspace_exclusions();
                !excluded.contains(tool_name)
            }
            WorkMode::Normal => {
                // Normal mode: Only selected tools
                let selected = self.selected_tools.lock().unwrap();
                selected.contains(&tool_name.to_string())
            }
        };
        drop(mode); // Release lock
        
        if !is_allowed {
            let error_msg = format!(
                "Tool '{}' is not available in current mode. Please enable it in settings.",
                tool_name
            );
            tracing::warn!(
                tool_name = %tool_name,
                "Tool execution blocked - not in allowed list"
            );
            return Err(ToolError::new(error_msg));
        }
        
        // Parse input JSON
        let input_value: serde_json::Value = serde_json::from_str(input)
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to parse tool input JSON");
                ToolError::new(format!("Invalid tool input JSON: {}", e))
            })?;

        // Special handling for bash/PowerShell tools with PTY
        if tool_name == "bash" || tool_name == "PowerShell" {
            tracing::debug!("Using PTY executor for bash/PowerShell");
            let result = self.execute_bash_with_pty(tool_name, &input_value, tool_use_id);
            
            let duration_ms = start_time.elapsed().as_millis() as u64;
            
            // Log for AI
            log_tool_execution_for_ai(
                tool_use_id,
                tool_name,
                input,
                result.as_ref().ok().map(|s| s.as_str()),
                result.is_err(),
                Some(duration_ms)
            );
            
            if result.is_ok() {
                tracing::info!(
                    tool_name = %tool_name,
                    tool_use_id = %tool_use_id,
                    duration_ms = duration_ms,
                    "✅ TOOL_EXEC_SUCCESS"
                );
            } else {
                tracing::error!(
                    tool_name = %tool_name,
                    tool_use_id = %tool_use_id,
                    duration_ms = duration_ms,
                    "❌ TOOL_EXEC_FAILED"
                );
            }
            
            return result;
        }

        // Execute other tools in separate thread with channel-based cancellation
        let tool_name_owned = tool_name.to_string();
        let input_value_clone = input_value.clone();
        
        // Create channel for result
        let (result_tx, result_rx) = bounded(1);
        
        // Spawn thread
        std::thread::spawn(move || {
            let registry = GlobalToolRegistry::builtin();
            let result = registry.execute(&tool_name_owned, &input_value_clone);
            // Send result back (ignore error if receiver dropped due to cancellation)
            let _ = result_tx.send(result);
        });

        // Wait for EITHER result OR cancel event (true event-driven)
        crossbeam_channel::select! {
            recv(result_rx) -> result => {
                let duration_ms = start_time.elapsed().as_millis() as u64;
                
                // Tool finished, return result
                match result {
                    Ok(tool_result) => {
                        tool_result.map_err(|e| {
                            tracing::error!(tool_name = %tool_name, error = %e, "Tool execution failed");
                            
                            // Log for AI
                            log_tool_execution_for_ai(
                                tool_use_id,
                                tool_name,
                                input,
                                None,
                                true,
                                Some(duration_ms)
                            );
                            
                            ToolError::new(e)
                        }).map(|output| {
                            tracing::info!(
                                tool_name = %tool_name,
                                output_len = output.len(),
                                duration_ms = duration_ms,
                                "✅ TOOL_EXEC_SUCCESS"
                            );
                            
                            // Log for AI
                            log_tool_execution_for_ai(
                                tool_use_id,
                                tool_name,
                                input,
                                Some(&output),
                                false,
                                Some(duration_ms)
                            );
                            
                            output
                        })
                    }
                    Err(_) => {
                        tracing::error!(tool_name = %tool_name, "Tool execution thread disconnected");
                        Err(ToolError::new("Tool execution failed unexpectedly".to_string()))
                    }
                }
            }
            recv(self.cancel_rx) -> _ => {
                let duration_ms = start_time.elapsed().as_millis() as u64;
                tracing::warn!(
                    tool_name = %tool_name,
                    duration_ms = duration_ms,
                    "🛑 TOOL_EXEC_CANCELLED"
                );
                
                // Log for AI
                log_tool_execution_for_ai(
                    tool_use_id,
                    tool_name,
                    input,
                    None,
                    true,
                    Some(duration_ms)
                );
                
                // CRITICAL: Emit ToolResult event with is_cancelled=true
                // This ensures UI knows tool was cancelled and can update state
                if !tool_use_id.is_empty() {
                    let turn_id = self.get_turn_id();
                    self.event_publisher.publish_stream_event(
                        crate::core::domain::types::StreamEvent::ToolResult {
                            tool_use_id: tool_use_id.to_string(),
                            output: "Tool execution cancelled by user".to_string(),
                            is_error: false,
                            is_cancelled: true,
                            is_timed_out: false,
                            turn_id,
                        }
                    );
                }
                
                Err(ToolError::new("Tool execution cancelled by user".to_string()))
            }
        }
    }
}

impl TauriToolExecutor {
    fn execute_bash_with_pty(&self, _tool_name: &str, input: &serde_json::Value, tool_use_id: &str) -> Result<String, ToolError> {
        // Parse bash input
        let bash_input: runtime::BashCommandInput = serde_json::from_value(input.clone())
            .map_err(|e| ToolError::new(format!("Invalid bash input: {}", e)))?;

        // Get timeout from input (in milliseconds, convert to seconds)
        let timeout_secs = bash_input.timeout.map(|ms| (ms / 1000) as u64);

        // Execute in PTY (blocking call, but runs in separate thread via execute_with_context)
        // PTY will use current process CWD (set by set_work_mode command)
        let output = self.pty_executor.execute_in_pty(&bash_input.command, tool_use_id, timeout_secs)
            .map_err(|e| {
                // Check if timeout
                if e == "TIMEOUT" {
                    ToolError::new("TIMEOUT".to_string())
                } else {
                    ToolError::new(e)
                }
            })?;

        // Return as BashCommandOutput JSON
        let bash_output = runtime::BashCommandOutput {
            stdout: output,
            stderr: String::new(),
            raw_output_path: None,
            interrupted: false,
            is_image: None,
            background_task_id: None,
            backgrounded_by_user: None,
            assistant_auto_backgrounded: None,
            dangerously_disable_sandbox: bash_input.dangerously_disable_sandbox,
            return_code_interpretation: None,
            no_output_expected: Some(false),
            structured_content: None,
            persisted_output_path: None,
            persisted_output_size: None,
            sandbox_status: None,
        };

        serde_json::to_string(&bash_output)
            .map_err(|e| ToolError::new(format!("Failed to serialize output: {}", e)))
    }
}

