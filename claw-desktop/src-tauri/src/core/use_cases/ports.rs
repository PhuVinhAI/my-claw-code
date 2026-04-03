// Ports (Interfaces) - Dependency Inversion
use crate::core::domain::types::{PermissionRequestEvent, StreamEvent};
use crate::core::domain::session_metadata::SessionMetadata;

/// Port: Event Publisher (Outbound)
/// Adapter sẽ implement trait này để emit events về Frontend
pub trait IEventPublisher: Send + Sync {
    fn publish_stream_event(&self, event: StreamEvent);
    fn publish_permission_request(&self, event: PermissionRequestEvent);
}

/// Port: Session Repository (Outbound)
/// Adapter sẽ implement trait này để persist sessions
pub trait ISessionRepository: Send + Sync {
    fn save(&self, session_id: &str, session: &runtime::Session) -> Result<(), String>;
    fn load(&self, session_id: &str) -> Result<runtime::Session, String>;
    fn list(&self) -> Result<Vec<String>, String>;
    fn list_with_metadata(&self) -> Result<Vec<SessionMetadata>, String>;
    fn delete(&self, session_id: &str) -> Result<(), String>;
    fn rename(&self, session_id: &str, new_title: &str) -> Result<(), String>;
    fn save_metadata(&self, metadata: &SessionMetadata) -> Result<(), String>;
    fn load_metadata(&self, session_id: &str) -> Result<SessionMetadata, String>;
    fn set_working_dir(&self, workdir: String) -> Result<(), String>;
}
