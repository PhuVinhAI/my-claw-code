// Tool Executor Adapter for Tauri
use std::sync::Arc;
use runtime::{ToolExecutor, ToolError};
use tools::GlobalToolRegistry;

use crate::core::use_cases::ports::IEventPublisher;

pub struct TauriToolExecutor {
    registry: GlobalToolRegistry,
    _event_publisher: Arc<dyn IEventPublisher>,
}

impl TauriToolExecutor {
    pub fn new(event_publisher: Arc<dyn IEventPublisher>) -> Self {
        Self {
            registry: GlobalToolRegistry::builtin(),
            _event_publisher: event_publisher,
        }
    }

    pub fn get_tool_definitions(&self) -> Vec<api::ToolDefinition> {
        self.registry.definitions(None)
    }
}

impl ToolExecutor for TauriToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        eprintln!("[TOOL EXECUTOR] Executing tool: {}", tool_name);
        eprintln!("[TOOL EXECUTOR] Input: {}", input);
        
        // Parse input JSON
        let input_value: serde_json::Value = serde_json::from_str(input)
            .map_err(|e| {
                eprintln!("[TOOL EXECUTOR] Failed to parse input JSON: {}", e);
                ToolError::new(format!("Invalid tool input JSON: {}", e))
            })?;

        eprintln!("[TOOL EXECUTOR] Parsed input: {:?}", input_value);

        // Execute tool via registry
        let result = self.registry
            .execute(tool_name, &input_value)
            .map_err(|e| {
                eprintln!("[TOOL EXECUTOR] Tool execution failed: {}", e);
                ToolError::new(e)
            })?;

        eprintln!("[TOOL EXECUTOR] Tool execution success, output length: {}", result.len());
        
        Ok(result)
    }
}
