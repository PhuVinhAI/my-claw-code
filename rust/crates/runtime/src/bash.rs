use std::env;
use std::io;
use std::process::{Command, Stdio};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;
use tokio::runtime::Builder;
use tokio::time::timeout;

use crate::sandbox::{
    build_linux_sandbox_command, resolve_sandbox_status_for_request, FilesystemIsolationMode,
    SandboxConfig, SandboxStatus,
};
use crate::ConfigLoader;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BashCommandInput {
    pub command: String,
    pub timeout: Option<u64>,
    pub description: Option<String>,
    #[serde(rename = "run_in_background")]
    pub run_in_background: Option<bool>,
    #[serde(rename = "dangerouslyDisableSandbox")]
    pub dangerously_disable_sandbox: Option<bool>,
    #[serde(rename = "namespaceRestrictions")]
    pub namespace_restrictions: Option<bool>,
    #[serde(rename = "isolateNetwork")]
    pub isolate_network: Option<bool>,
    #[serde(rename = "filesystemMode")]
    pub filesystem_mode: Option<FilesystemIsolationMode>,
    #[serde(rename = "allowedMounts")]
    pub allowed_mounts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BashCommandOutput {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "rawOutputPath")]
    pub raw_output_path: Option<String>,
    pub interrupted: bool,
    #[serde(rename = "isImage")]
    pub is_image: Option<bool>,
    #[serde(rename = "backgroundTaskId")]
    pub background_task_id: Option<String>,
    #[serde(rename = "backgroundedByUser")]
    pub backgrounded_by_user: Option<bool>,
    #[serde(rename = "assistantAutoBackgrounded")]
    pub assistant_auto_backgrounded: Option<bool>,
    #[serde(rename = "dangerouslyDisableSandbox")]
    pub dangerously_disable_sandbox: Option<bool>,
    #[serde(rename = "returnCodeInterpretation")]
    pub return_code_interpretation: Option<String>,
    #[serde(rename = "noOutputExpected")]
    pub no_output_expected: Option<bool>,
    #[serde(rename = "structuredContent")]
    pub structured_content: Option<Vec<serde_json::Value>>,
    #[serde(rename = "persistedOutputPath")]
    pub persisted_output_path: Option<String>,
    #[serde(rename = "persistedOutputSize")]
    pub persisted_output_size: Option<u64>,
    #[serde(rename = "sandboxStatus")]
    pub sandbox_status: Option<SandboxStatus>,
}

pub fn execute_bash(input: BashCommandInput) -> io::Result<BashCommandOutput> {
    execute_bash_with_callback(input, |_chunk| {}, None)
}

pub fn execute_bash_with_callback<F>(
    input: BashCommandInput,
    on_output: F,
    stdin_rx: Option<crossbeam_channel::Receiver<String>>,
) -> io::Result<BashCommandOutput>
where
    F: FnMut(&str) + Send + 'static,
{
    let cwd = env::current_dir()?;
    let sandbox_status = sandbox_status_for_input(&input, &cwd);

    if input.run_in_background.unwrap_or(false) {
        let mut child = prepare_command(&input.command, &cwd, &sandbox_status, false);
        let child = child
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;

        return Ok(BashCommandOutput {
            stdout: String::new(),
            stderr: String::new(),
            raw_output_path: None,
            interrupted: false,
            is_image: None,
            background_task_id: Some(child.id().to_string()),
            backgrounded_by_user: Some(false),
            assistant_auto_backgrounded: Some(false),
            dangerously_disable_sandbox: input.dangerously_disable_sandbox,
            return_code_interpretation: None,
            no_output_expected: Some(true),
            structured_content: None,
            persisted_output_path: None,
            persisted_output_size: None,
            sandbox_status: Some(sandbox_status),
        });
    }

    let runtime = Builder::new_current_thread().enable_all().build()?;
    runtime.block_on(execute_bash_async(input, sandbox_status, cwd, on_output, stdin_rx))
}

async fn execute_bash_async<F>(
    input: BashCommandInput,
    sandbox_status: SandboxStatus,
    cwd: std::path::PathBuf,
    mut on_output: F,
    stdin_rx: Option<crossbeam_channel::Receiver<String>>,
) -> io::Result<BashCommandOutput>
where
    F: FnMut(&str) + Send,
{
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    
    let mut command = prepare_tokio_command(&input.command, &cwd, &sandbox_status, true);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    command.stdin(Stdio::piped()); // Enable stdin for interactive commands

    let mut child = command.spawn()?;
    
    let stdout = child.stdout.take().expect("stdout not captured");
    let stderr = child.stderr.take().expect("stderr not captured");
    let mut stdin = child.stdin.take().expect("stdin not captured");
    
    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();
    
    let mut stdout_lines = Vec::new();
    let mut stderr_lines = Vec::new();
    
    // Stream output line by line + handle stdin input
    let stream_task = async {
        let mut last_output_time = tokio::time::Instant::now();
        let input_timeout = tokio::time::Duration::from_secs(3); // 3s no output = might be waiting for input
        
        loop {
            tokio::select! {
                result = stdout_reader.next_line() => {
                    match result {
                        Ok(Some(line)) => {
                            last_output_time = tokio::time::Instant::now();
                            on_output(&format!("{}\n", line));
                            stdout_lines.push(line);
                        }
                        Ok(None) => break,
                        Err(e) => {
                            eprintln!("[BASH] Error reading stdout: {}", e);
                            break;
                        }
                    }
                }
                result = stderr_reader.next_line() => {
                    match result {
                        Ok(Some(line)) => {
                            last_output_time = tokio::time::Instant::now();
                            on_output(&format!("{}\n", line));
                            stderr_lines.push(line);
                        }
                        Ok(None) => {},
                        Err(e) => {
                            eprintln!("[BASH] Error reading stderr: {}", e);
                        }
                    }
                }
                // Check for stdin input from UI
                _ = tokio::time::sleep(tokio::time::Duration::from_millis(50)) => {
                    if let Some(ref rx) = stdin_rx {
                        if let Ok(input_line) = rx.try_recv() {
                            last_output_time = tokio::time::Instant::now();
                            
                            // Check if input is a control sequence (starts with ESC)
                            let is_control_seq = input_line.starts_with('\x1b');
                            
                            // Write input to process stdin
                            let input_bytes = if is_control_seq {
                                // Control sequences don't need newline
                                input_line.as_bytes().to_vec()
                            } else {
                                // Regular input needs newline
                                format!("{}\n", input_line).into_bytes()
                            };
                            
                            if let Err(e) = stdin.write_all(&input_bytes).await {
                                eprintln!("[BASH] Error writing to stdin: {}", e);
                            } else if !is_control_seq {
                                // Echo regular input to output (not control sequences)
                                on_output(&format!("{}\n", input_line));
                                stdout_lines.push(input_line);
                            }
                        }
                    }
                    
                    // Check if process might be waiting for input
                    // Reduced timeout to 1s for faster detection
                    if last_output_time.elapsed() > tokio::time::Duration::from_secs(1) && !stdout_lines.is_empty() {
                        // Check last few lines for input patterns
                        let last_lines: Vec<&str> = stdout_lines.iter().rev().take(3).map(|s| s.as_str()).collect();
                        let combined = last_lines.join(" ").to_lowercase();
                        
                        // Detect common interactive patterns
                        if combined.contains("? ") 
                            || combined.contains("(y/n)")
                            || combined.contains("»")
                            || combined.contains("›")
                            || combined.contains("select")
                            || combined.contains("choose")
                            || combined.contains("enter")
                            || combined.contains("input")
                            || combined.contains("continue")
                            || combined.ends_with('?')
                            || combined.ends_with(':') {
                            // Likely waiting for input - emit signal via callback
                            on_output("\n[WAITING_FOR_INPUT]\n");
                            last_output_time = tokio::time::Instant::now(); // Reset timer to avoid spam
                        }
                    }
                }
            }
        }
    };

    let output_result = if let Some(timeout_ms) = input.timeout {
        match timeout(Duration::from_millis(timeout_ms), stream_task).await {
            Ok(_) => {
                // Wait for process to finish
                let status = child.wait().await?;
                (status, false)
            }
            Err(_) => {
                // Timeout - kill process
                let _ = child.kill().await;
                return Ok(BashCommandOutput {
                    stdout: stdout_lines.join("\n"),
                    stderr: format!("Command exceeded timeout of {timeout_ms} ms\n{}", stderr_lines.join("\n")),
                    raw_output_path: None,
                    interrupted: true,
                    is_image: None,
                    background_task_id: None,
                    backgrounded_by_user: None,
                    assistant_auto_backgrounded: None,
                    dangerously_disable_sandbox: input.dangerously_disable_sandbox,
                    return_code_interpretation: Some(String::from("timeout")),
                    no_output_expected: Some(true),
                    structured_content: None,
                    persisted_output_path: None,
                    persisted_output_size: None,
                    sandbox_status: Some(sandbox_status),
                });
            }
        }
    } else {
        stream_task.await;
        let status = child.wait().await?;
        (status, false)
    };

    let (status, interrupted) = output_result;
    let stdout = stdout_lines.join("\n");
    let stderr = stderr_lines.join("\n");
    let no_output_expected = Some(stdout.trim().is_empty() && stderr.trim().is_empty());
    let return_code_interpretation = status.code().and_then(|code| {
        if code == 0 {
            None
        } else {
            Some(format!("exit_code:{code}"))
        }
    });

    Ok(BashCommandOutput {
        stdout,
        stderr,
        raw_output_path: None,
        interrupted,
        is_image: None,
        background_task_id: None,
        backgrounded_by_user: None,
        assistant_auto_backgrounded: None,
        dangerously_disable_sandbox: input.dangerously_disable_sandbox,
        return_code_interpretation,
        no_output_expected,
        structured_content: None,
        persisted_output_path: None,
        persisted_output_size: None,
        sandbox_status: Some(sandbox_status),
    })
}

fn sandbox_status_for_input(input: &BashCommandInput, cwd: &std::path::Path) -> SandboxStatus {
    let config = ConfigLoader::default_for(cwd).load().map_or_else(
        |_| SandboxConfig::default(),
        |runtime_config| runtime_config.sandbox().clone(),
    );
    let request = config.resolve_request(
        input.dangerously_disable_sandbox.map(|disabled| !disabled),
        input.namespace_restrictions,
        input.isolate_network,
        input.filesystem_mode,
        input.allowed_mounts.clone(),
    );
    resolve_sandbox_status_for_request(&request, cwd)
}

fn prepare_command(
    command: &str,
    cwd: &std::path::Path,
    sandbox_status: &SandboxStatus,
    create_dirs: bool,
) -> Command {
    if create_dirs {
        prepare_sandbox_dirs(cwd);
    }

    if let Some(launcher) = build_linux_sandbox_command(command, cwd, sandbox_status) {
        let mut prepared = Command::new(launcher.program);
        prepared.args(launcher.args);
        prepared.current_dir(cwd);
        prepared.envs(launcher.env);
        return prepared;
    }

    // Tự động chọn shell phù hợp với OS
    let mut prepared = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("powershell");
        cmd.arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(command);
        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.arg("-lc").arg(command);
        cmd
    };

    prepared.current_dir(cwd);
    if sandbox_status.filesystem_active {
        prepared.env("HOME", cwd.join(".sandbox-home"));
        prepared.env("TMPDIR", cwd.join(".sandbox-tmp"));
    }
    prepared
}

fn prepare_tokio_command(
    command: &str,
    cwd: &std::path::Path,
    sandbox_status: &SandboxStatus,
    create_dirs: bool,
) -> TokioCommand {
    if create_dirs {
        prepare_sandbox_dirs(cwd);
    }

    if let Some(launcher) = build_linux_sandbox_command(command, cwd, sandbox_status) {
        let mut prepared = TokioCommand::new(launcher.program);
        prepared.args(launcher.args);
        prepared.current_dir(cwd);
        prepared.envs(launcher.env);
        return prepared;
    }

    // Tự động chọn shell phù hợp với OS
    let mut prepared = if cfg!(target_os = "windows") {
        let mut cmd = TokioCommand::new("powershell");
        cmd.arg("-NoProfile")
            .arg("-NonInteractive")
            .arg("-Command")
            .arg(command);
        cmd
    } else {
        let mut cmd = TokioCommand::new("sh");
        cmd.arg("-lc").arg(command);
        cmd
    };

    prepared.current_dir(cwd);
    if sandbox_status.filesystem_active {
        prepared.env("HOME", cwd.join(".sandbox-home"));
        prepared.env("TMPDIR", cwd.join(".sandbox-tmp"));
    }
    prepared
}

fn prepare_sandbox_dirs(cwd: &std::path::Path) {
    let _ = std::fs::create_dir_all(cwd.join(".sandbox-home"));
    let _ = std::fs::create_dir_all(cwd.join(".sandbox-tmp"));
}

#[cfg(test)]
mod tests {
    use super::{execute_bash, BashCommandInput};
    use crate::sandbox::FilesystemIsolationMode;

    #[test]
    fn executes_simple_command() {
        let output = execute_bash(BashCommandInput {
            command: String::from("printf 'hello'"),
            timeout: Some(1_000),
            description: None,
            run_in_background: Some(false),
            dangerously_disable_sandbox: Some(false),
            namespace_restrictions: Some(false),
            isolate_network: Some(false),
            filesystem_mode: Some(FilesystemIsolationMode::WorkspaceOnly),
            allowed_mounts: None,
        })
        .expect("bash command should execute");

        assert_eq!(output.stdout, "hello");
        assert!(!output.interrupted);
        assert!(output.sandbox_status.is_some());
    }

    #[test]
    fn disables_sandbox_when_requested() {
        let output = execute_bash(BashCommandInput {
            command: String::from("printf 'hello'"),
            timeout: Some(1_000),
            description: None,
            run_in_background: Some(false),
            dangerously_disable_sandbox: Some(true),
            namespace_restrictions: None,
            isolate_network: None,
            filesystem_mode: None,
            allowed_mounts: None,
        })
        .expect("bash command should execute");

        assert!(!output.sandbox_status.expect("sandbox status").enabled);
    }
}
