// Logging Setup - Session-based structured logging
use std::sync::Arc;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

use super::session_logger::{SessionLogger, SessionLoggerLayer, SessionMetadata};

/// Initialize logging system with session-based JSON logging
/// 
/// Architecture:
/// - Console output: INFO level (human-readable)
/// - Session-based JSON files: DEBUG level
///   - Directory: logs/YYYY-MM-DD/session-{timestamp}-{id}/
///   - Files: events-001.json, events-002.json, ... (1000 lines each)
///   - Metadata: session.json
/// 
/// Returns: SessionMetadata for tracking current session
pub fn init_logging() -> Result<SessionMetadata, String> {
    // Create session logger
    let session_logger = Arc::new(SessionLogger::new()?);
    let metadata = session_logger.metadata().clone();
    
    // Session logger layer: JSON format, DEBUG level
    let session_layer = SessionLoggerLayer::new(session_logger.clone())
        .with_filter(EnvFilter::new("debug"));
    
    // Console layer: Human-readable, INFO level
    let console_layer = fmt::layer()
        .pretty()
        .with_writer(std::io::stderr)
        .with_filter(EnvFilter::new("info"));
    
    // Combine layers
    tracing_subscriber::registry()
        .with(session_layer)
        .with(console_layer)
        .init();
    
    tracing::info!("Logging initialized");
    tracing::info!("Session ID: {}", metadata.session_id);
    tracing::info!("Log directory: {}", metadata.log_directory.display());
    
    Ok(metadata)
}
