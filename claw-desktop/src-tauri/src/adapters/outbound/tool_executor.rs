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
    pty_executor: PtyExecutor,
    work_mode: Arc<Mutex<WorkMode>>,
    selected_tools: Arc<Mutex<Vec<String>>>, // Normal mode: user-selected tools
}

impl TauriToolExecutor {
    pub fn new(
        event_publisher: Arc<dyn IEventPublisher>,
        cancel_flag: Arc<AtomicBool>,
        stdin_rx: crossbeam_channel::Receiver<(String, String)>,
        work_mode: Arc<Mutex<WorkMode>>,
    ) -> Self {
        let (cancel_tx, cancel_rx) = bounded(1);
        let pty_executor = PtyExecutor::new(
            event_publisher.clone(),
            cancel_flag.clone(),
            stdin_rx.clone(),
        );
        Self {
            registry: GlobalToolRegistry::builtin(),
            cancel_flag,
            cancel_tx,
            cancel_rx,
            pty_executor,
            work_mode,
            selected_tools: Arc::new(Mutex::new(Vec::new())), // Mặc định: không có tools
        }
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
        // Check cancel BEFORE executing tool
        if self.cancel_flag.load(Ordering::Relaxed) {
            eprintln!("[TOOL EXECUTOR] Tool execution cancelled before start");
            return Err(ToolError::new("Tool execution cancelled by user".to_string()));
        }

        eprintln!("[TOOL EXECUTOR] Executing tool: {} (id: {})", tool_name, tool_use_id);
        eprintln!("[TOOL EXECUTOR] Input: {}", input);
        
        // Parse input JSON
        let input_value: serde_json::Value = serde_json::from_str(input)
            .map_err(|e| {
                eprintln!("[TOOL EXECUTOR] Failed to parse input JSON: {}", e);
                ToolError::new(format!("Invalid tool input JSON: {}", e))
            })?;

        eprintln!("[TOOL EXECUTOR] Parsed input: {:?}", input_value);

        // Special handling for bash/PowerShell tools with PTY
        if tool_name == "bash" || tool_name == "PowerShell" {
            return self.execute_bash_with_pty(tool_name, &input_value, tool_use_id);
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
                // Tool finished, return result
                match result {
                    Ok(tool_result) => {
                        tool_result.map_err(|e| {
                            eprintln!("[TOOL EXECUTOR] Tool execution failed: {}", e);
                            ToolError::new(e)
                        })
                    }
                    Err(_) => {
                        eprintln!("[TOOL EXECUTOR] Tool execution thread disconnected");
                        Err(ToolError::new("Tool execution failed unexpectedly".to_string()))
                    }
                }
            }
            recv(self.cancel_rx) -> _ => {
                // Cancel event received
                eprintln!("[TOOL EXECUTOR] Tool execution cancelled via event");
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

        // Execute in PTY (blocking call, but runs in separate thread via execute_with_context)
        let output = self.pty_executor.execute_in_pty(&bash_input.command, tool_use_id)
            .map_err(|e| ToolError::new(e))?;

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

