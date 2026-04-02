// TauriPermissionAdapter - Implement PermissionPrompter với Suspend/Resume
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tokio::sync::oneshot;
use uuid::Uuid;

use runtime::{PermissionMode, PermissionPromptDecision, PermissionPrompter, PermissionRequest};

use crate::core::domain::types::PermissionRequestEvent;
use crate::core::use_cases::ports::IEventPublisher;

pub struct TauriPermissionAdapter {
    pending_requests: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    event_publisher: Arc<dyn IEventPublisher>,
}

impl TauriPermissionAdapter {
    pub fn new(event_publisher: Arc<dyn IEventPublisher>) -> Self {
        Self {
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            event_publisher,
        }
    }

    pub fn answer(&self, request_id: String, allow: bool) -> Result<(), String> {
        let mut pending = self.pending_requests.lock().unwrap();
        if let Some(tx) = pending.remove(&request_id) {
            tx.send(allow)
                .map_err(|_| "Failed to send permission decision".to_string())?;
            Ok(())
        } else {
            Err(format!("Permission request {} not found", request_id))
        }
    }
}

impl PermissionPrompter for TauriPermissionAdapter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();

        // Lưu sender để Tauri Command có thể trả lời sau
        self.pending_requests
            .lock()
            .unwrap()
            .insert(request_id.clone(), tx);

        // Bắn event ra Frontend
        self.event_publisher.publish_permission_request(PermissionRequestEvent {
            request_id: request_id.clone(),
            tool_name: request.tool_name.clone(),
            input: request.input.clone(),
            current_mode: request.current_mode.as_str().to_string(),
            required_mode: request.required_mode.as_str().to_string(),
        });

        // ĐÌNH CHỈ luồng hiện tại, chờ UI trả lời
        match rx.blocking_recv() {
            Ok(true) => PermissionPromptDecision::Allow,
            Ok(false) => PermissionPromptDecision::Deny {
                reason: "User denied".to_string(),
            },
            Err(_) => PermissionPromptDecision::Deny {
                reason: "Permission request timeout or cancelled".to_string(),
            },
        }
    }
}
