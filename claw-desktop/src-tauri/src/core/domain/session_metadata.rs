// SessionMetadata - Domain type for session listing
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionMetadata {
    pub id: String,
    pub title: String,
    pub created_at: i64, // Unix timestamp
    pub updated_at: i64,
    pub message_count: usize,
    pub preview: String, // First 100 chars of first user message
    #[serde(default)]
    pub work_mode: Option<String>, // "normal" or "workspace"
    #[serde(default)]
    pub workspace_path: Option<String>, // Path if workspace mode
}

impl SessionMetadata {
    pub fn new(id: String, first_user_message: Option<&str>) -> Self {
        let now = chrono::Utc::now().timestamp();
        let (title, preview) = Self::generate_title_and_preview(first_user_message);

        Self {
            id,
            title,
            created_at: now,
            updated_at: now,
            message_count: 0,
            preview,
            work_mode: None,
            workspace_path: None,
        }
    }
    
    pub fn with_work_context(mut self, work_mode: String, workspace_path: Option<String>) -> Self {
        self.work_mode = Some(work_mode);
        self.workspace_path = workspace_path;
        self
    }

    pub fn update(&mut self, message_count: usize, first_user_message: Option<&str>) {
        self.updated_at = chrono::Utc::now().timestamp();
        self.message_count = message_count;

        // Update title/preview if they were auto-generated and we now have a message
        if self.title.starts_with("New Chat") && first_user_message.is_some() {
            let (title, preview) = Self::generate_title_and_preview(first_user_message);
            self.title = title;
            self.preview = preview;
        }
    }

    fn generate_title_and_preview(first_user_message: Option<&str>) -> (String, String) {
        match first_user_message {
            Some(msg) => {
                let cleaned = msg.trim().replace('\n', " ");
                
                // Safe UTF-8 truncation using char_indices
                let title = if cleaned.chars().count() > 50 {
                    let mut end_idx = 0;
                    for (idx, _) in cleaned.char_indices().take(50) {
                        end_idx = idx;
                    }
                    // Move to next char boundary
                    if let Some((next_idx, _)) = cleaned.char_indices().nth(50) {
                        end_idx = next_idx;
                    } else {
                        end_idx = cleaned.len();
                    }
                    format!("{}...", &cleaned[..end_idx])
                } else {
                    cleaned.clone()
                };
                
                let preview = if cleaned.chars().count() > 100 {
                    let mut end_idx = 0;
                    for (idx, _) in cleaned.char_indices().take(100) {
                        end_idx = idx;
                    }
                    // Move to next char boundary
                    if let Some((next_idx, _)) = cleaned.char_indices().nth(100) {
                        end_idx = next_idx;
                    } else {
                        end_idx = cleaned.len();
                    }
                    format!("{}...", &cleaned[..end_idx])
                } else {
                    cleaned
                };
                
                (title, preview)
            }
            None => {
                let timestamp = chrono::Local::now().format("%d/%m/%Y %H:%M");
                let title = format!("Hội thoại mới - {}", timestamp);
                (title.clone(), title)
            }
        }
    }
}
