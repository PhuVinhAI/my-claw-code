// Session-Based JSON Logging System
// Mỗi session = 1 thư mục riêng với JSON files rotation (1k lines limit)

use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const MAX_LINES_PER_FILE: usize = 1000;

/// Session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub session_id: String,
    pub start_time: DateTime<Local>,
    pub log_directory: PathBuf,
}

/// JSON log event structure
#[derive(Debug, Serialize)]
pub struct LogEvent {
    pub timestamp: DateTime<Local>,
    pub level: String,
    pub target: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<serde_json::Value>,
}

/// Session logger - Manages session directory and file rotation
pub struct SessionLogger {
    metadata: SessionMetadata,
    current_file_index: Arc<Mutex<usize>>,
    current_line_count: Arc<Mutex<usize>>,
    writer: Arc<Mutex<Option<BufWriter<File>>>>,
}

impl SessionLogger {
    /// Create new session logger
    /// Directory structure: logs/YYYY-MM-DD/session-{timestamp}-{short_id}/
    pub fn new() -> Result<Self, String> {
        let now = Local::now();
        let session_id = generate_session_id(&now);
        
        // Create session directory
        let log_dir = get_session_directory(&now, &session_id)?;
        
        let metadata = SessionMetadata {
            session_id: session_id.clone(),
            start_time: now,
            log_directory: log_dir.clone(),
        };
        
        // Write session metadata
        Self::write_session_metadata(&metadata)?;
        
        let logger = Self {
            metadata,
            current_file_index: Arc::new(Mutex::new(1)),
            current_line_count: Arc::new(Mutex::new(0)),
            writer: Arc::new(Mutex::new(None)),
        };
        
        // Initialize first file
        logger.rotate_file()?;
        
        Ok(logger)
    }
    
    /// Write log event
    pub fn write_event(&self, event: LogEvent) -> Result<(), String> {
        let mut line_count = self.current_line_count.lock()
            .map_err(|e| format!("Failed to lock line count: {}", e))?;
        
        // Check if need rotation
        if *line_count >= MAX_LINES_PER_FILE {
            drop(line_count); // Release lock before rotation
            self.rotate_file()?;
            line_count = self.current_line_count.lock()
                .map_err(|e| format!("Failed to lock line count after rotation: {}", e))?;
        }
        
        // Write event as JSON line
        let mut writer = self.writer.lock()
            .map_err(|e| format!("Failed to lock writer: {}", e))?;
        
        if let Some(w) = writer.as_mut() {
            let json_line = serde_json::to_string(&event)
                .map_err(|e| format!("Failed to serialize event: {}", e))?;
            
            writeln!(w, "{}", json_line)
                .map_err(|e| format!("Failed to write event: {}", e))?;
            
            w.flush()
                .map_err(|e| format!("Failed to flush writer: {}", e))?;
            
            *line_count += 1;
        }
        
        Ok(())
    }
    
    /// Rotate to new file
    fn rotate_file(&self) -> Result<(), String> {
        let mut file_index = self.current_file_index.lock()
            .map_err(|e| format!("Failed to lock file index: {}", e))?;
        
        let mut line_count = self.current_line_count.lock()
            .map_err(|e| format!("Failed to lock line count: {}", e))?;
        
        let mut writer = self.writer.lock()
            .map_err(|e| format!("Failed to lock writer: {}", e))?;
        
        // Close current writer
        *writer = None;
        
        // Create new file
        let file_path = self.metadata.log_directory.join(format!("events-{:03}.json", *file_index));
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| format!("Failed to open log file: {}", e))?;
        
        *writer = Some(BufWriter::new(file));
        *file_index += 1;
        *line_count = 0;
        
        Ok(())
    }
    
    /// Write session metadata to session.json
    fn write_session_metadata(metadata: &SessionMetadata) -> Result<(), String> {
        let metadata_path = metadata.log_directory.join("session.json");
        let file = File::create(&metadata_path)
            .map_err(|e| format!("Failed to create session metadata file: {}", e))?;
        
        serde_json::to_writer_pretty(file, metadata)
            .map_err(|e| format!("Failed to write session metadata: {}", e))?;
        
        Ok(())
    }
    
    /// Get session metadata
    pub fn metadata(&self) -> &SessionMetadata {
        &self.metadata
    }
}

/// Generate session ID: session-YYYYMMDD-HHMMSS-{short_uuid}
fn generate_session_id(now: &DateTime<Local>) -> String {
    let timestamp = now.format("%Y%m%d-%H%M%S");
    let short_id = uuid::Uuid::new_v4().to_string()[..6].to_string();
    format!("session-{}-{}", timestamp, short_id)
}

/// Get session directory path: logs/YYYY-MM-DD/session-{id}/
fn get_session_directory(now: &DateTime<Local>, session_id: &str) -> Result<PathBuf, String> {
    let base_log_dir = get_base_log_directory()?;
    let date_dir = now.format("%Y-%m-%d").to_string();
    let session_dir = base_log_dir.join(date_dir).join(session_id);
    
    // Create directory
    fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {}", e))?;
    
    Ok(session_dir)
}

/// Get base log directory
/// - Dev mode (debug build): ./logs/ (current directory)
/// - Release mode: ~/.local/share/claw-desktop/logs/
fn get_base_log_directory() -> Result<PathBuf, String> {
    let log_dir = if cfg!(debug_assertions) {
        // Dev mode: Log to current directory for easy AI access
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join("logs")
    } else {
        // Release mode: Log to user data directory
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "Failed to get data directory".to_string())?;
        data_dir.join("claw-desktop").join("logs")
    };
    
    // Create directory if not exists
    fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    
    Ok(log_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_session_id_generation() {
        let now = Local::now();
        let id = generate_session_id(&now);
        assert!(id.starts_with("session-"));
        assert!(id.len() > 20); // session-YYYYMMDD-HHMMSS-xxxxxx
    }
}

// Tracing Layer Integration
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::{Context, Layer as TracingLayer};

/// Custom tracing layer that writes to SessionLogger
pub struct SessionLoggerLayer {
    logger: Arc<SessionLogger>,
}

impl SessionLoggerLayer {
    pub fn new(logger: Arc<SessionLogger>) -> Self {
        Self { logger }
    }
}

impl<S> TracingLayer<S> for SessionLoggerLayer
where
    S: Subscriber,
{
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        // Extract event data
        let metadata = event.metadata();
        let level = metadata.level().to_string();
        let target = metadata.target().to_string();
        
        // Extract message and fields
        let mut visitor = JsonVisitor::default();
        event.record(&mut visitor);
        
        let log_event = LogEvent {
            timestamp: Local::now(),
            level,
            target,
            message: visitor.message.unwrap_or_default(),
            fields: if visitor.fields.is_empty() {
                None
            } else {
                Some(serde_json::Value::Object(visitor.fields))
            },
        };
        
        // Write to session logger (ignore errors to avoid logging loops)
        let _ = self.logger.write_event(log_event);
    }
}

/// Visitor to extract fields from tracing events
#[derive(Default)]
struct JsonVisitor {
    message: Option<String>,
    fields: serde_json::Map<String, serde_json::Value>,
}

impl tracing::field::Visit for JsonVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let value_str = format!("{:?}", value);
        
        // Special handling for "message" field
        if field.name() == "message" {
            self.message = Some(value_str);
        } else {
            self.fields.insert(
                field.name().to_string(),
                serde_json::Value::String(value_str),
            );
        }
    }
    
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = Some(value.to_string());
        } else {
            self.fields.insert(
                field.name().to_string(),
                serde_json::Value::String(value.to_string()),
            );
        }
    }
    
    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.fields.insert(
            field.name().to_string(),
            serde_json::Value::Number(value.into()),
        );
    }
    
    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.fields.insert(
            field.name().to_string(),
            serde_json::Value::Number(value.into()),
        );
    }
    
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.fields.insert(
            field.name().to_string(),
            serde_json::Value::Bool(value),
        );
    }
}
