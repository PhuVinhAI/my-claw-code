use std::io::{Read, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use std::sync::Mutex;
use std::path::PathBuf;
use portable_pty::{CommandBuilder, PtySize, native_pty_system, Child, MasterPty};
use crossbeam_channel::Receiver;

use crate::core::use_cases::ports::IEventPublisher;
use crate::core::domain::types::StreamEvent;

struct ToolProcess {
    cancel_flag: Arc<AtomicBool>,
    detach_flag: Arc<AtomicBool>,
}

struct DetachedProcess {
    child: Box<dyn Child + Send + Sync>,
    cancel_flag: Arc<AtomicBool>,
}

struct PtySession {
    _master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    stdin_tx: crossbeam_channel::Sender<String>, // Per-terminal stdin channel
}

pub struct PtyExecutor {
    event_publisher: Arc<dyn IEventPublisher>,
    cancel_flag: Arc<AtomicBool>,
    stdin_rx: Receiver<(String, String)>, // DEPRECATED: Keep for backward compat, but not used for terminals
    running_processes: Arc<Mutex<HashMap<String, ToolProcess>>>, // tool_use_id -> process control
    detached_processes: Arc<Mutex<HashMap<String, DetachedProcess>>>, // tool_use_id -> detached child
    pty_sessions: Arc<Mutex<HashMap<String, PtySession>>>, // tool_use_id -> PTY session (includes per-terminal stdin)
    workspace_path: PathBuf, // CRITICAL: Working directory for commands
    current_turn_id: Arc<std::sync::Mutex<String>>, // Track current turn ID for event emission
}

impl PtyExecutor {
    pub fn new(
        event_publisher: Arc<dyn IEventPublisher>,
        cancel_flag: Arc<AtomicBool>,
        stdin_rx: Receiver<(String, String)>,
        workspace_path: PathBuf,
    ) -> Self {
        Self {
            event_publisher,
            cancel_flag,
            stdin_rx,
            running_processes: Arc::new(Mutex::new(HashMap::new())),
            detached_processes: Arc::new(Mutex::new(HashMap::new())),
            pty_sessions: Arc::new(Mutex::new(HashMap::new())),
            workspace_path,
            current_turn_id: Arc::new(std::sync::Mutex::new(String::new())),
        }
    }
    
    /// Set current turn ID for event emission
    pub fn set_turn_id(&self, turn_id: String) {
        let mut current = self.current_turn_id.lock().unwrap();
        *current = turn_id;
    }
    
    /// Get current turn ID
    fn get_turn_id(&self) -> String {
        let current = self.current_turn_id.lock().unwrap();
        current.clone()
    }
    
    /// Resize PTY (send SIGWINCH to shell)
    pub fn resize_pty(&self, tool_use_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.pty_sessions.lock().unwrap();
        
        if let Some(session) = sessions.get(tool_use_id) {
            let size = PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            };
            
            let master = session._master.lock().unwrap();
            master.resize(size)
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            
            eprintln!("[PTY] Resized terminal {} to {}x{}", tool_use_id, cols, rows);
            Ok(())
        } else {
            Err(format!("PTY session not found: {}", tool_use_id))
        }
    }
    
    /// Send input to specific terminal (NEW: per-terminal channel)
    pub fn send_terminal_input(&self, tool_use_id: &str, input: String) -> Result<(), String> {
        let sessions = self.pty_sessions.lock().unwrap();
        
        if let Some(session) = sessions.get(tool_use_id) {
            session.stdin_tx.send(input)
                .map_err(|e| format!("Failed to send input to terminal: {}", e))?;
            Ok(())
        } else {
            Err(format!("Terminal session not found: {}", tool_use_id))
        }
    }

    /// Cancel a specific tool execution by tool_use_id
    pub fn cancel_tool(&self, tool_use_id: &str) -> Result<(), String> {
        // ALWAYS lock in same order to prevent deadlock: running_processes THEN detached_processes
        
        // Check running processes first (without holding lock)
        let found_in_running = {
            let processes = self.running_processes.lock().unwrap();
            if let Some(process) = processes.get(tool_use_id) {
                process.cancel_flag.store(true, Ordering::Relaxed);
                true
            } else {
                false
            }
        }; // Lock released here
        
        if found_in_running {
            eprintln!("[PTY] Cancelled running tool: {}", tool_use_id);
            return Ok(());
        }
        
        // Try detached processes (separate lock to avoid deadlock)
        let mut detached = self.detached_processes.lock().unwrap();
        if let Some(mut process) = detached.remove(tool_use_id) {
            // Set cancel flag first
            process.cancel_flag.store(true, Ordering::Relaxed);
            
            // Kill the child process
            if let Err(e) = process.child.kill() {
                eprintln!("[PTY] Failed to kill detached process: {}", e);
                return Err(format!("Failed to kill detached process: {}", e));
            }
            
            eprintln!("[PTY] Killed detached tool: {}", tool_use_id);
            return Ok(());
        }
        
        eprintln!("[PTY] Tool not found: {}", tool_use_id);
        Err(format!("Tool execution not found: {}", tool_use_id))
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
        timeout_secs: Option<u64>, // Timeout in seconds
    ) -> Result<String, String> {
        self.execute_in_pty_with_cwd(command, tool_use_id, timeout_secs, None)
    }
    
    /// Execute command in PTY with real-time streaming and custom working directory
    pub fn execute_in_pty_with_cwd(
        &self,
        command: &str,
        tool_use_id: &str,
        timeout_secs: Option<u64>, // Timeout in seconds
        cwd: Option<&str>, // Optional custom working directory
    ) -> Result<String, String> {
        // Get current turn_id for event emission
        let turn_id = self.get_turn_id();
        
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
            // Use PowerShell for consistency with bash runtime
            // Note: Console window flickering is prevented by allocating a hidden console
            // at app startup (see lib.rs). ConPTY will use that hidden console instead
            // of creating new visible windows.
            let mut c = CommandBuilder::new("powershell");
            c.arg("-NoProfile");
            c.arg("-NonInteractive");
            c.arg("-Command");
            // CRITICAL: Add explicit exit to ensure PowerShell terminates after command
            // This fixes ConPTY bug where process exits but pipe doesn't close
            c.arg(format!("{}; exit $LASTEXITCODE", command));
            c
        } else {
            let mut c = CommandBuilder::new("sh");
            c.arg("-lc");
            c.arg(command);
            c
        };

        // CRITICAL: Inherit environment variables (especially PATH) from parent process
        // This ensures commands in PATH can be found
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }
        
        // CRITICAL: Set working directory
        // Priority: custom cwd > current process CWD > workspace_path
        let working_dir = if let Some(custom_cwd) = cwd {
            PathBuf::from(custom_cwd)
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| self.workspace_path.clone())
        };
        cmd.cwd(&working_dir);

        let mut child = pair.slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        // Get master PTY for reading/writing BEFORE wrapping in Arc
        let mut reader = pair.master.try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;
        let mut writer = pair.master.take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        // Wrap master in Arc<Mutex<>> for sharing (after taking reader/writer)
        let master_arc = Arc::new(Mutex::new(pair.master));

        // CRITICAL FIX: Create per-terminal stdin channel to prevent input stealing
        let (stdin_tx, stdin_rx_terminal) = crossbeam_channel::unbounded::<String>();

        // Store PTY session for resize capability AND per-terminal stdin
        {
            let mut sessions = self.pty_sessions.lock().unwrap();
            sessions.insert(tool_use_id.to_string(), PtySession {
                _master: master_arc.clone(),
                stdin_tx, // Store sender for this terminal
            });
        }

        let event_publisher = self.event_publisher.clone();
        let tool_use_id_owned = tool_use_id.to_string();
        let cancel_flag = self.cancel_flag.clone();
        let tool_cancel_flag_reader = tool_process.cancel_flag.clone();
        let tool_detach_flag_reader = tool_process.detach_flag.clone();
        let turn_id_for_thread = turn_id.clone(); // Clone turn_id for thread

        // Shared output buffer
        let output_buffer = Arc::new(Mutex::new(String::new()));
        let output_buffer_reader = output_buffer.clone();
        
        // Output size limit: 10MB (prevent memory issues with huge outputs like `tree /F`)
        const MAX_OUTPUT_SIZE: usize = 10 * 1024 * 1024; // 10MB
        let output_truncated = Arc::new(AtomicBool::new(false));
        let output_truncated_reader = output_truncated.clone();

        // Spawn reader thread - stream raw bytes to frontend
        let reader_handle = std::thread::spawn(move || {
            let mut buffer = [0u8; 1024];
            
            loop {
                // Check cancel flag (stop reading if cancelled)
                if cancel_flag.load(Ordering::Relaxed) || tool_cancel_flag_reader.load(Ordering::Relaxed) {
                    break;
                }

                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - process finished
                        // Check if this was a detached process
                        if tool_detach_flag_reader.load(Ordering::Relaxed) {
                            // Detached process completed - notify frontend
                            eprintln!("[PTY] Detached process completed: {}", tool_use_id_owned);
                            
                            // Get final output
                            let final_output = {
                                let output = output_buffer_reader.lock().unwrap();
                                output.clone()
                            };
                            
                            // Emit completion event with full output
                            event_publisher.publish_stream_event(StreamEvent::ToolResult {
                                tool_use_id: tool_use_id_owned.clone(),
                                output: final_output,
                                is_error: false,
                                is_cancelled: false,
                                is_timed_out: false,
                                turn_id: turn_id_for_thread.clone(),
                            });
                        }
                        break;
                    }
                    Ok(n) => {
                        let chunk = &buffer[..n];

                        // Convert to string - preserve all bytes including \r\n
                        let text = String::from_utf8_lossy(chunk).to_string();
                        
                        // Check output size limit
                        let current_size = {
                            let output = output_buffer_reader.lock().unwrap();
                            output.len()
                        };
                        
                        if current_size >= MAX_OUTPUT_SIZE && !output_truncated_reader.load(Ordering::Relaxed) {
                            // Output too large - emit truncation warning and stop accumulating
                            output_truncated_reader.store(true, Ordering::Relaxed);
                            
                            let warning = format!("\n\n[OUTPUT TRUNCATED - Exceeded {}MB limit. Use filters or pagination for large outputs]\n", MAX_OUTPUT_SIZE / (1024 * 1024));
                            
                            {
                                let mut output = output_buffer_reader.lock().unwrap();
                                output.push_str(&warning);
                            }
                            
                            event_publisher.publish_stream_event(StreamEvent::ToolOutputChunk {
                                tool_use_id: tool_use_id_owned.clone(),
                                chunk: warning,
                                turn_id: turn_id_for_thread.clone(),
                            });
                            
                            // Continue reading to drain pipe but don't accumulate
                            continue;
                        }
                        
                        // Accumulate to buffer (if not truncated)
                        if !output_truncated_reader.load(Ordering::Relaxed) {
                            let mut output = output_buffer_reader.lock().unwrap();
                            output.push_str(&text);
                        }
                        
                        // ALWAYS emit - even if detached (user wants to see output)
                        event_publisher.publish_stream_event(StreamEvent::ToolOutputChunk {
                            tool_use_id: tool_use_id_owned.clone(),
                            chunk: text,
                            turn_id: turn_id_for_thread.clone(),
                        });
                    }
                    Err(e) => {
                        eprintln!("[PTY] Read error: {}", e);
                        break;
                    }
                }
            }
        });

        // Spawn stdin forwarder thread - CRITICAL FIX: Use per-terminal channel
        let tool_use_id_for_stdin = tool_use_id.to_string();
        let cancel_flag_stdin = self.cancel_flag.clone();
        
        std::thread::spawn(move || {
            while !cancel_flag_stdin.load(Ordering::Relaxed) {
                // FIXED: Use per-terminal channel instead of global channel
                // This prevents input stealing between multiple terminals
                match stdin_rx_terminal.recv() {
                    Ok(input) => {
                        if let Err(e) = writer.write_all(input.as_bytes()) {
                            eprintln!("[PTY] Failed to write stdin for {}: {}", tool_use_id_for_stdin, e);
                            break;
                        }
                        if let Err(e) = writer.flush() {
                            eprintln!("[PTY] Failed to flush stdin for {}: {}", tool_use_id_for_stdin, e);
                            break;
                        }
                    }
                    Err(_) => {
                        // Channel closed - terminal session ended
                        break;
                    }
                }
            }
            eprintln!("[PTY] Stdin forwarder thread exiting for {}", tool_use_id_for_stdin);
        });

        // Wait for process to finish, cancellation, detachment, or timeout
        let start_time = std::time::Instant::now();
        let result = loop {
            // Check timeout
            if let Some(timeout) = timeout_secs {
                if start_time.elapsed().as_secs() >= timeout {
                    eprintln!("[PTY] Timeout reached - killing process");
                    
                    // Kill child process
                    if let Err(e) = child.kill() {
                        eprintln!("[PTY] Failed to kill process: {}", e);
                    }
                    
                    break Err("TIMEOUT".to_string());
                }
            }
            
            // Check cancel flag
            if self.cancel_flag.load(Ordering::Relaxed) || tool_process.cancel_flag.load(Ordering::Relaxed) {
                eprintln!("[PTY] Cancel detected - killing process");
                
                // CRITICAL: Kill child process immediately and CHECK result
                match child.kill() {
                    Ok(_) => {
                        eprintln!("[PTY] Process killed successfully");
                        break Err("Tool execution cancelled by user".to_string());
                    }
                    Err(e) => {
                        eprintln!("[PTY] Failed to kill process: {}", e);
                        // Still break - process might be already dead
                        break Err(format!("Tool execution cancelled (kill failed: {})", e));
                    }
                }
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
                
                // Remove from running_processes
                {
                    let mut processes = self.running_processes.lock().unwrap();
                    processes.remove(tool_use_id);
                }
                
                // Move child to detached_processes (so we can kill it later)
                {
                    let mut detached = self.detached_processes.lock().unwrap();
                    detached.insert(tool_use_id.to_string(), DetachedProcess {
                        child,
                        cancel_flag: tool_process.cancel_flag.clone(),
                    });
                }
                
                // DON'T drop master/slave - process continues running
                // DON'T join reader thread - let it continue streaming
                // Note: pair.master already moved to master_arc at line 225
                // We only need to forget the slave to prevent it from being dropped
                std::mem::forget(pair.slave);
                std::mem::forget(master_arc);
                std::mem::forget(reader_handle);
                
                // Return current output to AI
                return Ok(detached_output);
            }

            // Check if child process finished
            match child.try_wait() {
                Ok(Some(_status)) => {
                    // Process finished normally
                    eprintln!("[PTY] Process exited, waiting for output to flush...");
                    
                    // CRITICAL: Wait a bit for reader thread to drain remaining output
                    // ConPTY may have buffered output that hasn't been read yet
                    std::thread::sleep(std::time::Duration::from_millis(200));
                    
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

        // Drop PTY slave AND master to close pipes (only if not detached)
        // CRITICAL: On Windows ConPTY, must drop BOTH slave and master to close pipes
        // Otherwise reader thread will block forever on read()
        drop(pair.slave);
        drop(master_arc); // This will close the master PTY, triggering EOF for reader
        
        // Wait for reader thread to finish (with timeout)
        let reader_result = std::thread::spawn(move || {
            let timeout = std::time::Duration::from_secs(2);
            let start = std::time::Instant::now();
            
            loop {
                if reader_handle.is_finished() {
                    let _ = reader_handle.join();
                    return true;
                }
                
                if start.elapsed() > timeout {
                    eprintln!("[PTY] Reader thread timeout - forcing continue");
                    return false;
                }
                
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }).join();
        
        if let Ok(false) = reader_result {
            eprintln!("[PTY] Warning: Reader thread did not finish cleanly");
        }

        // Get final output
        let output = {
            let output = output_buffer.lock().unwrap();
            output.clone()
        };

        // Cleanup: remove from running processes and PTY sessions
        {
            let mut processes = self.running_processes.lock().unwrap();
            processes.remove(tool_use_id);
            
            let mut sessions = self.pty_sessions.lock().unwrap();
            sessions.remove(tool_use_id);
        }

        // Return result
        match result {
            Ok(()) => Ok(output),
            Err(e) => Err(e),
        }
    }
}
