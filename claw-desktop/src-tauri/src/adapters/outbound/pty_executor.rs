use std::io::{Read, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use std::sync::Mutex;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use crossbeam_channel::Receiver;

use crate::core::use_cases::ports::IEventPublisher;
use crate::core::domain::types::StreamEvent;

pub struct PtyExecutor {
    event_publisher: Arc<dyn IEventPublisher>,
    cancel_flag: Arc<AtomicBool>,
    stdin_rx: Receiver<(String, String)>, // (tool_use_id, input)
    running_processes: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>, // tool_use_id -> cancel flag
}

impl PtyExecutor {
    pub fn new(
        event_publisher: Arc<dyn IEventPublisher>,
        cancel_flag: Arc<AtomicBool>,
        stdin_rx: Receiver<(String, String)>,
    ) -> Self {
        Self {
            event_publisher,
            cancel_flag,
            stdin_rx,
            running_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Cancel a specific tool execution by tool_use_id
    pub fn cancel_tool(&self, tool_use_id: &str) -> Result<(), String> {
        let processes = self.running_processes.lock().unwrap();
        if let Some(cancel_flag) = processes.get(tool_use_id) {
            cancel_flag.store(true, Ordering::Relaxed);
            eprintln!("[PTY] Cancelled tool execution: {}", tool_use_id);
            Ok(())
        } else {
            Err(format!("Tool execution not found: {}", tool_use_id))
        }
    }
    
    /// Get list of all running tool IDs
    pub fn get_running_tools(&self) -> Vec<String> {
        let processes = self.running_processes.lock().unwrap();
        processes.keys().cloned().collect()
    }
    
    /// Detach a tool execution - return current output but keep process running
    pub fn detach_tool(&self, tool_use_id: &str) -> Result<String, String> {
        let processes = self.running_processes.lock().unwrap();
        if processes.contains_key(tool_use_id) {
            // Tool exists and is running
            // We'll emit a special marker to indicate detachment
            // The actual output collection happens in the reader thread
            eprintln!("[PTY] Detached tool execution: {}", tool_use_id);
            
            // Emit detach event
            self.event_publisher.publish_stream_event(
                crate::core::domain::types::StreamEvent::ToolOutputChunk {
                    tool_use_id: tool_use_id.to_string(),
                    chunk: "\n[DETACHED: Process continues in background]\n".to_string(),
                }
            );
            
            Ok("Detached - process continues in background".to_string())
        } else {
            Err(format!("Tool execution not found: {}", tool_use_id))
        }
    }

    /// Execute command in PTY with real-time streaming
    pub fn execute_in_pty(
        &self,
        command: &str,
        tool_use_id: &str,
    ) -> Result<String, String> {
        // Create per-tool cancel flag
        let tool_cancel_flag = Arc::new(AtomicBool::new(false));
        
        // Register this tool execution
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.insert(tool_use_id.to_string(), tool_cancel_flag.clone());
        }

        // Create PTY system
        let pty_system = native_pty_system();
        
        // Create PTY with size (match xterm.js default)
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create PTY: {}", e))?;

        // Spawn command in PTY
        let mut cmd = if cfg!(target_os = "windows") {
            // Use cmd.exe for better PTY support on Windows
            CommandBuilder::new("cmd.exe")
        } else {
            CommandBuilder::new("sh")
        };

        if cfg!(target_os = "windows") {
            cmd.arg("/C");
            cmd.arg(command);
        } else {
            cmd.arg("-c");
            cmd.arg(command);
        }

        let mut child = pair.slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        // Get master PTY for reading/writing
        let mut reader = pair.master.try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;
        let mut writer = pair.master.take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let event_publisher = self.event_publisher.clone();
        let tool_use_id_owned = tool_use_id.to_string();
        let cancel_flag = self.cancel_flag.clone();
        let tool_cancel_flag_reader = tool_cancel_flag.clone();

        // Spawn reader thread - stream raw bytes to frontend
        let reader_handle = std::thread::spawn(move || {
            let mut buffer = [0u8; 1024];
            let mut accumulated = String::new();
            
            loop {
                // Check both global and tool-specific cancel flags
                if cancel_flag.load(Ordering::Relaxed) || tool_cancel_flag_reader.load(Ordering::Relaxed) {
                    break;
                }

                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk = &buffer[..n];

                        // Convert to string - preserve all bytes including \r\n
                        let text = String::from_utf8_lossy(chunk).to_string();
                        accumulated.push_str(&text);
                        
                        // Emit raw text (xterm.js handles all formatting)
                        event_publisher.publish_stream_event(StreamEvent::ToolOutputChunk {
                            tool_use_id: tool_use_id_owned.clone(),
                            chunk: text,
                        });
                    }
                    Err(e) => {
                        eprintln!("[PTY] Read error: {}", e);
                        break;
                    }
                }
            }
            
            accumulated
        });

        // Spawn stdin forwarder thread
        let stdin_rx = self.stdin_rx.clone();
        let tool_use_id_for_stdin = tool_use_id.to_string();
        let cancel_flag_stdin = self.cancel_flag.clone();
        
        std::thread::spawn(move || {
            while !cancel_flag_stdin.load(Ordering::Relaxed) {
                if let Ok((id, input)) = stdin_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    if id == tool_use_id_for_stdin {
                        if let Err(e) = writer.write_all(input.as_bytes()) {
                            eprintln!("[PTY] Failed to write stdin: {}", e);
                            break;
                        }
                        if let Err(e) = writer.flush() {
                            eprintln!("[PTY] Failed to flush stdin: {}", e);
                            break;
                        }
                    }
                }
            }
        });

        // Wait for process to finish or cancellation
        let result = loop {
            // Check both global and tool-specific cancel flags
            if self.cancel_flag.load(Ordering::Relaxed) || tool_cancel_flag.load(Ordering::Relaxed) {
                eprintln!("[PTY] Cancel detected - killing process");
                
                // CRITICAL: Kill child process immediately
                if let Err(e) = child.kill() {
                    eprintln!("[PTY] Failed to kill process: {}", e);
                }
                
                // Will drop pair after loop
                break Err("Tool execution cancelled by user".to_string());
            }

            // Check if child process finished
            match child.try_wait() {
                Ok(Some(_status)) => {
                    // Process finished
                    break Ok(());
                }
                Ok(None) => {
                    // Still running
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => {
                    eprintln!("[PTY] Error checking process status: {}", e);
                    break Ok(());
                }
            }
        };

        // Drop PTY pair to close pipes and signal reader thread to stop
        // This will kill the child process if still running (backup)
        drop(pair);
        
        // Wait for reader thread to finish
        let output = reader_handle.join()
            .map_err(|_| "Reader thread panicked".to_string())?;

        // Cleanup: remove from running processes
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(tool_use_id);
        }

        // Return result
        match result {
            Ok(()) => Ok(output),
            Err(e) => Err(e),
        }
    }
}

