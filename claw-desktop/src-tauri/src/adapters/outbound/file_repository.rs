// FileSessionRepository - Implement ISessionRepository
use std::fs;
use std::path::PathBuf;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::RwLock;

use runtime::{MessageRole, Session};

use crate::core::domain::session_metadata::SessionMetadata;
use crate::core::use_cases::ports::ISessionRepository;

pub struct FileSessionRepository {
    base_path: PathBuf,
    current_working_dir: RwLock<String>, // Interior mutability for thread-safe updates
    current_work_mode: RwLock<String>, // "normal" or "workspace"
    current_user_language: RwLock<String>, // User language preference (e.g., "en", "vi")
}

impl FileSessionRepository {
    pub fn new(base_path: PathBuf) -> Result<Self, String> {
        // Tạo thư mục nếu chưa tồn tại
        fs::create_dir_all(&base_path)
            .map_err(|e| format!("Failed to create sessions directory: {}", e))?;
        
        // Tạo folder "normal" mặc định
        let normal_folder = base_path.join("normal");
        fs::create_dir_all(&normal_folder)
            .map_err(|e| format!("Failed to create normal sessions folder: {}", e))?;
        
        Ok(Self { 
            base_path,
            current_working_dir: RwLock::new(String::new()), // Empty - chỉ set khi user chọn workspace
            current_work_mode: RwLock::new("normal".to_string()),
            current_user_language: RwLock::new("en".to_string()), // Default to English
        })
    }

    /// Get hash of working directory for folder name
    fn workdir_hash(workdir: &str) -> String {
        let mut hasher = DefaultHasher::new();
        workdir.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Get sessions folder for current working directory (deprecated - dùng sessions_folder_for_mode)
    fn sessions_folder(&self) -> PathBuf {
        let workdir = self.current_working_dir.read().unwrap();
        if workdir.is_empty() {
            // Fallback to normal folder if no workspace set
            self.base_path.join("normal")
        } else {
            let hash = Self::workdir_hash(&workdir);
            self.base_path.join(hash)
        }
    }
    
    /// Get sessions folder based on work mode
    fn sessions_folder_for_mode(&self, work_mode: &str, workspace_path: Option<&str>) -> PathBuf {
        match work_mode {
            "workspace" => {
                // Workspace mode: sessions per workspace
                if let Some(path) = workspace_path {
                    let hash = Self::workdir_hash(path);
                    self.base_path.join(hash)
                } else {
                    // Fallback to current workdir
                    self.sessions_folder()
                }
            }
            _ => {
                // Normal mode: shared folder at home (không theo CWD)
                self.base_path.join("normal")
            }
        }
    }
    
    /// Get current active folder (used by list/load/delete operations)
    fn current_active_folder(&self) -> PathBuf {
        let work_mode = self.current_work_mode.read().unwrap();
        let workspace_path = if *work_mode == "workspace" {
            let workdir = self.current_working_dir.read().unwrap();
            if workdir.is_empty() {
                None // Workspace mode nhưng chưa set path
            } else {
                Some(workdir.clone())
            }
        } else {
            None
        };
        
        self.sessions_folder_for_mode(&work_mode, workspace_path.as_deref())
    }

    /// Update working directory (called when user changes workspace)
    pub fn set_working_dir(&self, workdir: String) -> Result<(), String> {
        let mut current = self.current_working_dir.write().unwrap();
        *current = workdir.clone();
        
        // Create folder for this working directory
        let hash = Self::workdir_hash(&workdir);
        let folder = self.base_path.join(&hash);
        fs::create_dir_all(&folder)
            .map_err(|e| format!("Failed to create sessions folder for workdir: {}", e))?;
        
        eprintln!("[REPO] Working directory updated to: {} (hash: {})", workdir, hash);
        Ok(())
    }
    
    /// Update work mode (called when user switches mode)
    pub fn set_work_mode(&self, work_mode: String) -> Result<(), String> {
        let mut current = self.current_work_mode.write().unwrap();
        *current = work_mode.clone();
        
        // Clear working dir khi đổi về Normal mode
        if work_mode == "normal" {
            let mut workdir = self.current_working_dir.write().unwrap();
            *workdir = String::new();
            eprintln!("[REPO] Cleared working directory (Normal mode)");
        }
        
        eprintln!("[REPO] Work mode updated to: {}", work_mode);
        Ok(())
    }
    
    /// Update user language preference
    pub fn set_user_language(&self, language: String) -> Result<(), String> {
        let mut current = self.current_user_language.write().unwrap();
        *current = language.clone();
        eprintln!("[REPO] User language updated to: {}", language);
        Ok(())
    }

    fn session_path(&self, session_id: &str) -> PathBuf {
        self.current_active_folder().join(format!("{}.json", session_id))
    }

    fn metadata_path(&self, session_id: &str) -> PathBuf {
        self.current_active_folder().join(format!("{}.meta.json", session_id))
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
        self.save_with_work_context(session_id, session, "normal".to_string(), None)
    }
    
    fn save_with_work_context(&self, session_id: &str, session: &Session, work_mode: String, workspace_path: Option<String>) -> Result<(), String> {
        // Get folder based on work mode
        let folder = self.sessions_folder_for_mode(&work_mode, workspace_path.as_deref());
        
        // Create folder if not exists
        fs::create_dir_all(&folder)
            .map_err(|e| format!("Failed to create sessions folder: {}", e))?;
        
        let path = folder.join(format!("{}.json", session_id));
        session
            .save_to_path(&path)
            .map_err(|e| format!("Failed to save session: {}", e))?;

        // Auto-update metadata with work context
        let first_user_msg = Self::extract_first_user_message(session);
        let mut metadata = self
            .load_metadata(session_id)
            .unwrap_or_else(|_| SessionMetadata::new(session_id.to_string(), first_user_msg.as_deref()));

        metadata.update(session.messages.len(), first_user_msg.as_deref());
        metadata.work_mode = Some(work_mode);
        metadata.workspace_path = workspace_path;
        
        // Save metadata to same folder
        let metadata_path = folder.join(format!("{}.meta.json", session_id));
        let json = serde_json::to_string_pretty(&metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        fs::write(&metadata_path, json)
            .map_err(|e| format!("Failed to write metadata: {}", e))?;

        Ok(())
    }

    fn load(&self, session_id: &str, work_mode: &str, workspace_path: Option<&str>) -> Result<Session, String> {
        // Direct access với work context
        let folder = self.sessions_folder_for_mode(work_mode, workspace_path);
        let path = folder.join(format!("{}.json", session_id));
        Session::load_from_path(&path).map_err(|e| format!("Failed to load session: {}", e))
    }

    fn list(&self) -> Result<Vec<String>, String> {
        let folder = self.current_active_folder();
        
        // Create folder if not exists
        if !folder.exists() {
            fs::create_dir_all(&folder)
                .map_err(|e| format!("Failed to create sessions folder: {}", e))?;
            return Ok(Vec::new());
        }
        
        let entries = fs::read_dir(&folder)
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
        let mut metadata_list = Vec::new();
        
        // Scan TẤT CẢ folders (normal + all workspace hashes)
        // để hiển thị tất cả sessions từ Home + tất cả Workspaces
        
        // Helper function để scan một folder
        let mut scan_folder = |folder_path: &PathBuf| -> Result<(), String> {
            if !folder_path.exists() {
                return Ok(());
            }
            
            let session_entries = fs::read_dir(folder_path)
                .map_err(|e| format!("Failed to read sessions folder: {}", e))?;
            
            for session_entry in session_entries {
                let session_entry = session_entry.map_err(|e| format!("Failed to read session entry: {}", e))?;
                let path = session_entry.path();
                
                // Only process .meta.json files
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                        if filename.ends_with(".meta.json") {
                            // Load metadata
                            let metadata_content = fs::read_to_string(&path)
                                .map_err(|e| format!("Failed to read metadata: {}", e))?;
                            match serde_json::from_str::<SessionMetadata>(&metadata_content) {
                                Ok(meta) => metadata_list.push(meta),
                                Err(e) => {
                                    let session_id = filename.trim_end_matches(".meta.json");
                                    eprintln!("Failed to parse metadata for {}: {}", session_id, e);
                                }
                            }
                        }
                    }
                }
            }
            Ok(())
        };
        
        // 1. Scan "normal" folder (Home sessions)
        let normal_folder = self.base_path.join("normal");
        scan_folder(&normal_folder)?;
        
        // 2. Scan all workspace folders (hash folders)
        let base_entries = fs::read_dir(&self.base_path)
            .map_err(|e| format!("Failed to read base sessions directory: {}", e))?;
        
        for base_entry in base_entries {
            let base_entry = base_entry.map_err(|e| format!("Failed to read base entry: {}", e))?;
            let folder_path = base_entry.path();
            
            // Skip if not a directory
            if !folder_path.is_dir() {
                continue;
            }
            
            // Skip "normal" folder (already scanned)
            if let Some(folder_name) = folder_path.file_name().and_then(|s| s.to_str()) {
                if folder_name == "normal" {
                    continue;
                }
                
                // This is a workspace hash folder - scan it
                scan_folder(&folder_path)?;
            }
        }

        // Sort by updated_at descending
        metadata_list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(metadata_list)
    }

    fn delete(&self, session_id: &str, work_mode: &str, workspace_path: Option<&str>) -> Result<(), String> {
        // Direct access với work context
        let folder = self.sessions_folder_for_mode(work_mode, workspace_path);
        let session_path = folder.join(format!("{}.json", session_id));
        let metadata_path = folder.join(format!("{}.meta.json", session_id));

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

    fn rename(&self, session_id: &str, new_title: &str, work_mode: &str, workspace_path: Option<&str>) -> Result<(), String> {
        // Direct access với work context
        let folder = self.sessions_folder_for_mode(work_mode, workspace_path);
        let metadata_path = folder.join(format!("{}.meta.json", session_id));
        
        let contents = fs::read_to_string(&metadata_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let mut metadata: SessionMetadata = serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to deserialize metadata: {}", e))?;
        
        metadata.title = new_title.to_string();
        
        let json = serde_json::to_string_pretty(&metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        fs::write(&metadata_path, json)
            .map_err(|e| format!("Failed to write metadata: {}", e))?;
        
        Ok(())
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

    fn set_working_dir(&self, workdir: String) -> Result<(), String> {
        self.set_working_dir(workdir)
    }
    
    fn set_work_mode(&self, work_mode: String) -> Result<(), String> {
        self.set_work_mode(work_mode)
    }
    
    fn get_work_mode(&self) -> Result<String, String> {
        let mode = self.current_work_mode.read().unwrap();
        Ok(mode.clone())
    }
    
    fn get_workspace_path(&self) -> Result<Option<String>, String> {
        let workdir = self.current_working_dir.read().unwrap();
        if workdir.is_empty() {
            Ok(None)
        } else {
            Ok(Some(workdir.clone()))
        }
    }
    
    fn set_user_language(&self, language: String) -> Result<(), String> {
        self.set_user_language(language)
    }
    
    fn get_user_language(&self) -> Result<String, String> {
        let lang = self.current_user_language.read().unwrap();
        Ok(lang.clone())
    }
}
