use std::io::{Read, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use std::sync::Mutex;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use crossbeam_channel::Receiver;

use crate::core::use_cases::ports::IEventPublisher;
use crate::core::domain::types::StreamEvent;

struct ToolProcess {
    cancel_flag: Arc<AtomicBool>,
    detach_flag: Arc<AtomicBool>,
}

pub struct PtyExecutor {
    event_publisher: Arc<dyn IEventPublisher>,
    cancel_flag: Arc<AtomicBool>,
    stdin_rx: Receiver<(String, String)>, // (tool_use_id, input)
    running_processes: Arc<Mutex<HashMap<String, ToolProcess>>>, // tool_use_id -> process control
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
        if let Some(process) = processes.get(tool_use_id) {
            process.cancel_flag.store(true, Ordering::Relaxed);
            eprintln!("[PTY] Cancelled tool execution: {}", tool_use_id);
            Ok(())
        } else {
            // Tool might be detached (not in running_processes anymore)
            // Can't kill detached processes directly
            eprintln!("[PTY] Tool not found in running processes (might be detached): {}", tool_use_id);
            Err(format!("Tool execution not found or already detached: {}", tool_use_id))
        }
    }
    
    /// Get list of all running tool IDs
    pub fn get_running_tools(&self) -> Vec<String> {
        let processes = self.running_processes.lock().unwrap();
        processes.keys().cloned().collect()
    }
    
    /// Detach a tool execution - return current output but keep process running
    pub fn detach_tool(&self, tool_use_id: &str) -> Result<(), String> {
        let processes = self.running_processes.lock().unwrap();
        if let Some(process) = processes.get(tool_use_id) {
            // Set detach flag - this will cause execute_in_pty to return current output
            process.detach_flag.store(true, Ordering::Relaxed);
            eprintln!("[PTY] Detached tool execution: {}", tool_use_id);
            Ok(())
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
        // Create per-tool control flags
        let tool_process = ToolProcess {
            cancel_flag: Arc::new(AtomicBool::new(false)),
            detach_flag: Arc::new(AtomicBool::new(false)),
        };
        
        // Register this tool execution
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.insert(tool_use_id.to_string(), ToolProcess {
                cancel_flag: tool_process.cancel_flag.clone(),
                detach_flag: tool_process.detach_flag.clone(),
            });
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
        let tool_cancel_flag_reader = tool_process.cancel_flag.clone();
        let tool_detach_flag_reader = tool_process.detach_flag.clone();

        // Shared output buffer
        let output_buffer = Arc::new(Mutex::new(String::new()));
        let output_buffer_reader = output_buffer.clone();

        // Spawn reader thread - stream raw bytes to frontend
        let reader_handle = std::thread::spawn(move || {
            let mut buffer = [0u8; 1024];
            
            loop {
                // Check cancel flag (stop reading if cancelled)
                if cancel_flag.load(Ordering::Relaxed) || tool_cancel_flag_reader.load(Ordering::Relaxed) {
                    break;
                }

                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk = &buffer[..n];

                        // Convert to string - preserve all bytes including \r\n
                        let text = String::from_utf8_lossy(chunk).to_string();
                        
                        // Always accumulate to buffer
                        {
                            let mut output = output_buffer_reader.lock().unwrap();
                            output.push_str(&text);
                        }
                        
                        // ALWAYS emit - even if detached (user wants to see output)
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

        // Wait for process to finish, cancellation, or detachment
        let result = loop {
            // Check cancel flag
            if self.cancel_flag.load(Ordering::Relaxed) || tool_process.cancel_flag.load(Ordering::Relaxed) {
                eprintln!("[PTY] Cancel detected - killing process");
                
                // CRITICAL: Kill child process immediately
                if let Err(e) = child.kill() {
                    eprintln!("[PTY] Failed to kill process: {}", e);
                }
                
                break Err("Tool execution cancelled by user".to_string());
            }
            
            // Check detach flag - return current output but DON'T kill process  
            if tool_process.detach_flag.load(Ordering::Relaxed) {
                eprintln!("[PTY] Detach detected - returning current output, process continues");
                
                // Get current output
                let current_output = {
                    let output = output_buffer.lock().unwrap();
                    output.clone()
                };
                
                // Add detach marker
                let detached_output = format!("{}\n\n[Process detached - continues running in background]", current_output);
                
                // Note: We can't move child to detached list because it's borrowed
                // Instead, just remove from running_processes and let it continue
                // User can still see output via reader thread
                {
                    let mut processes = self.running_processes.lock().unwrap();
                    processes.remove(tool_use_id);
                }
                
                // DON'T drop pair - process continues running
                // DON'T join reader thread - let it continue streaming
                // DON'T drop child - let it continue running
                
                // Leak the resources intentionally (process continues in background)
                std::mem::forget(pair);
                std::mem::forget(child);
                std::mem::forget(reader_handle);
                
                // Return current output to AI
                return Ok(detached_output);
            }

            // Check if child process finished
            match child.try_wait() {
                Ok(Some(_status)) => {
                    // Process finished normally
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

        // Drop PTY pair to close pipes (only if not detached)
        drop(pair);
        
        // Wait for reader thread to finish (with timeout for detached case)
        let _ = reader_handle.join();

        // Get final output
        let output = {
            let output = output_buffer.lock().unwrap();
            output.clone()
        };

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
