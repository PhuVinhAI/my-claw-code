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
    fn save_with_work_context(&self, session_id: &str, session: &runtime::Session, work_mode: String, workspace_path: Option<String>) -> Result<(), String>;
    fn load(&self, session_id: &str, work_mode: &str, workspace_path: Option<&str>) -> Result<runtime::Session, String>;
    fn list(&self) -> Result<Vec<String>, String>;
    fn list_with_metadata(&self) -> Result<Vec<SessionMetadata>, String>;
    fn delete(&self, session_id: &str, work_mode: &str, workspace_path: Option<&str>) -> Result<(), String>;
    fn rename(&self, session_id: &str, new_title: &str, work_mode: &str, workspace_path: Option<&str>) -> Result<(), String>;
    fn save_metadata(&self, metadata: &SessionMetadata) -> Result<(), String>;
    fn load_metadata(&self, session_id: &str) -> Result<SessionMetadata, String>;
    fn set_working_dir(&self, workdir: String) -> Result<(), String>;
    fn set_work_mode(&self, work_mode: String) -> Result<(), String>;
    fn get_work_mode(&self) -> Result<String, String>;
    fn get_workspace_path(&self) -> Result<Option<String>, String>;
    fn set_user_language(&self, language: String) -> Result<(), String>;
    fn get_user_language(&self) -> Result<String, String>;
}
