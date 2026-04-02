// FileSessionRepository - Implement ISessionRepository
use std::fs;
use std::path::PathBuf;

use runtime::{MessageRole, Session};

use crate::core::domain::session_metadata::SessionMetadata;
use crate::core::use_cases::ports::ISessionRepository;

pub struct FileSessionRepository {
    base_path: PathBuf,
}

impl FileSessionRepository {
    pub fn new(base_path: PathBuf) -> Result<Self, String> {
        // Tạo thư mục nếu chưa tồn tại
        fs::create_dir_all(&base_path)
            .map_err(|e| format!("Failed to create sessions directory: {}", e))?;
        Ok(Self { base_path })
    }

    fn session_path(&self, session_id: &str) -> PathBuf {
        self.base_path.join(format!("{}.json", session_id))
    }

    fn metadata_path(&self, session_id: &str) -> PathBuf {
        self.base_path.join(format!("{}.meta.json", session_id))
    }

    fn extract_first_user_message(session: &Session) -> Option<String> {
        session
            .messages
            .iter()
            .find(|msg| msg.role == MessageRole::User)
            .and_then(|msg| {
                msg.blocks.iter().find_map(|block| {
                    if let runtime::ContentBlock::Text { text } = block {
                        Some(text.clone())
                    } else {
                        None
                    }
                })
            })
    }
}

impl ISessionRepository for FileSessionRepository {
    fn save(&self, session_id: &str, session: &Session) -> Result<(), String> {
        let path = self.session_path(session_id);
        session
            .save_to_path(&path)
            .map_err(|e| format!("Failed to save session: {}", e))?;

        // Auto-update metadata
        let first_user_msg = Self::extract_first_user_message(session);
        let mut metadata = self
            .load_metadata(session_id)
            .unwrap_or_else(|_| SessionMetadata::new(session_id.to_string(), first_user_msg.as_deref()));

        metadata.update(session.messages.len(), first_user_msg.as_deref());
        self.save_metadata(&metadata)?;

        Ok(())
    }

    fn load(&self, session_id: &str) -> Result<Session, String> {
        let path = self.session_path(session_id);
        Session::load_from_path(&path).map_err(|e| format!("Failed to load session: {}", e))
    }

    fn list(&self) -> Result<Vec<String>, String> {
        let entries = fs::read_dir(&self.base_path)
            .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

        let mut session_ids = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if !stem.ends_with(".meta") {
                        session_ids.push(stem.to_string());
                    }
                }
            }
        }

        Ok(session_ids)
    }

    fn list_with_metadata(&self) -> Result<Vec<SessionMetadata>, String> {
        let session_ids = self.list()?;
        let mut metadata_list = Vec::new();

        for id in session_ids {
            match self.load_metadata(&id) {
                Ok(meta) => metadata_list.push(meta),
                Err(_) => {
                    // Create metadata if missing
                    let session = self.load(&id).ok();
                    let first_msg = session.as_ref().and_then(Self::extract_first_user_message);
                    let meta = SessionMetadata::new(id.clone(), first_msg.as_deref());
                    let _ = self.save_metadata(&meta);
                    metadata_list.push(meta);
                }
            }
        }

        // Sort by updated_at descending
        metadata_list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(metadata_list)
    }

    fn delete(&self, session_id: &str) -> Result<(), String> {
        let session_path = self.session_path(session_id);
        let metadata_path = self.metadata_path(session_id);

        if session_path.exists() {
            fs::remove_file(&session_path)
                .map_err(|e| format!("Failed to delete session file: {}", e))?;
        }

        if metadata_path.exists() {
            fs::remove_file(&metadata_path)
                .map_err(|e| format!("Failed to delete metadata file: {}", e))?;
        }

        Ok(())
    }

    fn rename(&self, session_id: &str, new_title: &str) -> Result<(), String> {
        let mut metadata = self.load_metadata(session_id)?;
        metadata.title = new_title.to_string();
        self.save_metadata(&metadata)
    }

    fn save_metadata(&self, metadata: &SessionMetadata) -> Result<(), String> {
        let path = self.metadata_path(&metadata.id);
        let json = serde_json::to_string_pretty(metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        fs::write(&path, json).map_err(|e| format!("Failed to write metadata: {}", e))
    }

    fn load_metadata(&self, session_id: &str) -> Result<SessionMetadata, String> {
        let path = self.metadata_path(session_id);
        let contents =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read metadata: {}", e))?;
        serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to deserialize metadata: {}", e))
    }
}
