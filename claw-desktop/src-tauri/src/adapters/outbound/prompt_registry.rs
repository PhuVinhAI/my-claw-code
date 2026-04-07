// Prompt Registry - Track pending user prompts and collect answers
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crossbeam_channel::{Sender, Receiver, bounded};

#[derive(Clone)]
pub struct PromptRegistry {
    pending: Arc<Mutex<HashMap<String, Sender<String>>>>, // tool_use_id -> answer sender
}

impl PromptRegistry {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Register a new pending prompt and return receiver for answer
    pub fn register_prompt(&self, tool_use_id: String) -> Receiver<String> {
        let (tx, rx) = bounded(1);
        let mut pending = self.pending.lock().unwrap();
        pending.insert(tool_use_id, tx);
        rx
    }
    
    /// Submit answer for a pending prompt
    pub fn submit_answer(&self, tool_use_id: &str, answer: String) -> Result<(), String> {
        let mut pending = self.pending.lock().unwrap();
        if let Some(tx) = pending.remove(tool_use_id) {
            tx.send(answer).map_err(|e| format!("Failed to send answer: {}", e))?;
            Ok(())
        } else {
            Err(format!("No pending prompt found for tool_use_id: {}", tool_use_id))
        }
    }
    
    /// Check if a prompt is pending
    pub fn is_pending(&self, tool_use_id: &str) -> bool {
        let pending = self.pending.lock().unwrap();
        pending.contains_key(tool_use_id)
    }
    
    /// Cancel a pending prompt (cleanup)
    pub fn cancel_prompt(&self, tool_use_id: &str) {
        let mut pending = self.pending.lock().unwrap();
        pending.remove(tool_use_id);
    }
}
