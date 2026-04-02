// TauriEventPublisher - Implement IEventPublisher
use tauri::{AppHandle, Emitter};

use crate::core::domain::types::{PermissionRequestEvent, StreamEvent};
use crate::core::use_cases::ports::IEventPublisher;

pub struct TauriEventPublisher {
    app_handle: AppHandle,
}

impl TauriEventPublisher {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }
}

impl IEventPublisher for TauriEventPublisher {
    fn publish_stream_event(&self, event: StreamEvent) {
        if let Err(e) = self.app_handle.emit("stream_event", event) {
            eprintln!("Failed to emit stream_event: {}", e);
        }
    }

    fn publish_permission_request(&self, event: PermissionRequestEvent) {
        if let Err(e) = self.app_handle.emit("permission_requested", event) {
            eprintln!("Failed to emit permission_requested: {}", e);
        }
    }
}
