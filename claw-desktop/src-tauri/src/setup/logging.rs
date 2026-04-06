// Logging Setup - Structured logging với tracing
use std::path::PathBuf;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};
use tracing_appender::rolling::{RollingFileAppender, Rotation};

/// Initialize logging system
/// - Console output: INFO level (colored)
/// - File output: DEBUG level (JSON format for parsing)
/// - Log files: ~/.local/share/claw-desktop/logs/claw-desktop-YYYY-MM-DD.log
pub fn init_logging() -> Result<(), String> {
    // Get log directory
    let log_dir = get_log_directory()?;
    
    // Create rolling file appender (daily rotation)
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        log_dir,
        "claw-desktop.log"
    );
    
    // File layer: JSON format, DEBUG level
    let file_layer = fmt::layer()
        .json()
        .with_writer(file_appender)
        .with_filter(EnvFilter::new("debug"));
    
    // Console layer: Human-readable, INFO level
    let console_layer = fmt::layer()
        .pretty()
        .with_writer(std::io::stderr)
        .with_filter(EnvFilter::new("info"));
    
    // Combine layers
    tracing_subscriber::registry()
        .with(file_layer)
        .with(console_layer)
        .init();
    
    tracing::info!("Logging initialized");
    tracing::info!("Log directory: {}", get_log_directory()?.display());
    
    Ok(())
}

/// Get log directory path
fn get_log_directory() -> Result<PathBuf, String> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Failed to get data directory".to_string())?;
    
    let log_dir = data_dir.join("claw-desktop").join("logs");
    
    // Create directory if not exists
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    
    Ok(log_dir)
}
