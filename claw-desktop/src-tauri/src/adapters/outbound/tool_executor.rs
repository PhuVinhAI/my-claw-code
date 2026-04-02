// Tool Executor Adapter for Tauri
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use runtime::{ToolExecutor, ToolError};
use tools::GlobalToolRegistry;
use crossbeam_channel::{Receiver, Sender, bounded};

use crate::core::use_cases::ports::IEventPublisher;

pub struct TauriToolExecutor {
    registry: GlobalToolRegistry,
    _event_publisher: Arc<dyn IEventPublisher>,
    cancel_flag: Arc<AtomicBool>,
    cancel_tx: Sender<()>,
    cancel_rx: Receiver<()>,
}

impl TauriToolExecutor {
    pub fn new(event_publisher: Arc<dyn IEventPublisher>, cancel_flag: Arc<AtomicBool>) -> Self {
        let (cancel_tx, cancel_rx) = bounded(1);
        Self {
            registry: GlobalToolRegistry::builtin(),
            _event_publisher: event_publisher,
            cancel_flag,
            cancel_tx,
            cancel_rx,
        }
    }

    pub fn get_tool_definitions(&self) -> Vec<api::ToolDefinition> {
        self.registry.definitions(None)
    }
    
    pub fn get_cancel_sender(&self) -> Sender<()> {
        self.cancel_tx.clone()
    }
}

impl ToolExecutor for TauriToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        // Check cancel BEFORE executing tool
        if self.cancel_flag.load(Ordering::Relaxed) {
            eprintln!("[TOOL EXECUTOR] Tool execution cancelled before start");
            return Err(ToolError::new("Tool execution cancelled by user".to_string()));
        }

        eprintln!("[TOOL EXECUTOR] Executing tool: {}", tool_name);
        eprintln!("[TOOL EXECUTOR] Input: {}", input);
        
        // Parse input JSON
        let input_value: serde_json::Value = serde_json::from_str(input)
            .map_err(|e| {
                eprintln!("[TOOL EXECUTOR] Failed to parse input JSON: {}", e);
                ToolError::new(format!("Invalid tool input JSON: {}", e))
            })?;

        eprintln!("[TOOL EXECUTOR] Parsed input: {:?}", input_value);

        // Execute tool in separate thread with channel-based cancellation
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
