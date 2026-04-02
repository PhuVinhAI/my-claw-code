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
        }
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
                let title = if cleaned.len() > 50 {
                    format!("{}...", &cleaned[..50])
                } else {
                    cleaned.clone()
                };
                let preview = if cleaned.len() > 100 {
                    format!("{}...", &cleaned[..100])
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
