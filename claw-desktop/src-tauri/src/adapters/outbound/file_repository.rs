// FileSessionRepository - Implement ISessionRepository
use std::fs;
use std::path::PathBuf;

use runtime::Session;

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
}

impl ISessionRepository for FileSessionRepository {
    fn save(&self, session_id: &str, session: &Session) -> Result<(), String> {
        let path = self.base_path.join(format!("{}.json", session_id));
        session
            .save_to_path(&path)
            .map_err(|e| format!("Failed to save session: {}", e))
    }

    fn load(&self, session_id: &str) -> Result<Session, String> {
        let path = self.base_path.join(format!("{}.json", session_id));
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
                    session_ids.push(stem.to_string());
                }
            }
        }

        Ok(session_ids)
    }
}
