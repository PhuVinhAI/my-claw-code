// Tool Executor Adapter for Tauri
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use runtime::{ToolExecutor, ToolError};
use tools::GlobalToolRegistry;
use crossbeam_channel::{Receiver, Sender, bounded};

use crate::core::use_cases::ports::IEventPublisher;

pub struct TauriToolExecutor {
    registry: GlobalToolRegistry,
    event_publisher: Arc<dyn IEventPublisher>,
    cancel_flag: Arc<AtomicBool>,
    cancel_tx: Sender<()>,
    cancel_rx: Receiver<()>,
}

impl TauriToolExecutor {
    pub fn new(event_publisher: Arc<dyn IEventPublisher>, cancel_flag: Arc<AtomicBool>) -> Self {
        let (cancel_tx, cancel_rx) = bounded(1);
        Self {
            registry: GlobalToolRegistry::builtin(),
            event_publisher,
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

        // Special handling for bash/PowerShell tools with streaming
        if tool_name == "bash" || tool_name == "PowerShell" {
            return self.execute_bash_streaming(tool_name, &input_value, tool_use_id);
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
    fn execute_bash_streaming(&self, _tool_name: &str, input: &serde_json::Value, tool_use_id: &str) -> Result<String, ToolError> {
        // Parse bash input
        let bash_input: runtime::BashCommandInput = serde_json::from_value(input.clone())
            .map_err(|e| ToolError::new(format!("Invalid bash input: {}", e)))?;

        let event_publisher = self.event_publisher.clone();
        let tool_use_id_owned = tool_use_id.to_string();
        
        // Execute with streaming callback
        let result = runtime::execute_bash_with_callback(bash_input, move |chunk| {
            // Emit chunk event with tool_use_id
            event_publisher.publish_stream_event(
                crate::core::domain::types::StreamEvent::ToolOutputChunk {
                    tool_use_id: tool_use_id_owned.clone(),
                    chunk: chunk.to_string(),
                }
            );
        });

        match result {
            Ok(output) => {
                let output_json = serde_json::to_string(&output)
                    .map_err(|e| ToolError::new(format!("Failed to serialize output: {}", e)))?;
                Ok(output_json)
            }
            Err(e) => Err(ToolError::new(format!("Bash execution failed: {}", e))),
        }
    }
}

