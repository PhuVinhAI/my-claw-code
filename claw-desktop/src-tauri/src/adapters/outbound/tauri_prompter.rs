// TauriPermissionAdapter - Implement PermissionPrompter với Suspend/Resume
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;
use uuid::Uuid;

use runtime::{PermissionPromptDecision, PermissionPrompter, PermissionRequest};

use crate::core::domain::types::PermissionRequestEvent;
use crate::core::use_cases::ports::IEventPublisher;

/// Shared state cho pending permission requests
#[derive(Clone)]
pub struct PermissionState {
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl PermissionState {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn answer(&self, request_id: String, allow: bool) -> Result<(), String> {
        let mut pending = self.pending.lock().unwrap();
        if let Some(tx) = pending.remove(&request_id) {
            tx.send(allow)
                .map_err(|_| "Failed to send permission decision".to_string())?;
            Ok(())
        } else {
            Err(format!("Permission request {} not found", request_id))
        }
    }

    fn insert(&self, request_id: String, tx: oneshot::Sender<bool>) {
        self.pending.lock().unwrap().insert(request_id, tx);
    }
}

pub struct TauriPermissionAdapter {
    state: PermissionState,
    event_publisher: Arc<dyn IEventPublisher>,
}

impl TauriPermissionAdapter {
    pub fn new(state: PermissionState, event_publisher: Arc<dyn IEventPublisher>) -> Self {
        Self {
            state,
            event_publisher,
        }
    }
}

impl PermissionPrompter for TauriPermissionAdapter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();

        // Lưu sender
        self.state.insert(request_id.clone(), tx);

        // Bắn event ra Frontend
        self.event_publisher
            .publish_permission_request(PermissionRequestEvent {
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
