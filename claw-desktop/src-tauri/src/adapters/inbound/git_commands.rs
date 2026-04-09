// Git Commands - Inbound Adapters using git2 (libgit2)
use serde::{Deserialize, Serialize};
use git2::{Repository, StatusOptions, StatusShow};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileChange {
    pub path: String,
    pub status: String, // "new", "modified", "deleted", "renamed"
    pub additions: usize,
    pub deletions: usize,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub remote: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitStatusResponse {
    pub changes: Vec<GitFileChange>,
    pub staged: Vec<GitFileChange>,
}

#[derive(Debug, Serialize)]
pub struct GitBranchesResponse {
    pub current: String,
    pub branches: Vec<GitBranch>,
}

/// Get git status (changed and staged files) using git2
#[tauri::command]
pub fn git_status() -> Result<GitStatusResponse, String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir);
    opts.include_untracked(true);
    
    let statuses = repo.statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get git status: {}", e))?;
    
    let mut changes = Vec::new();
    let mut staged = Vec::new();
    
    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();
        
        if path.is_empty() {
            continue;
        }
        
        // Check if file is staged (in index)
        let is_staged = status.is_index_new() || status.is_index_modified() || 
                       status.is_index_deleted() || status.is_index_renamed();
        
        // Check if file has working tree changes (including untracked)
        let is_wt_changed = status.is_wt_new() || status.is_wt_modified() || 
                           status.is_wt_deleted() || status.is_wt_renamed() ||
                           status.contains(git2::Status::WT_NEW); // Untracked files
        
        // Determine status string
        let status_str = if status.is_index_new() || status.is_wt_new() {
            "new"
        } else if status.is_index_deleted() || status.is_wt_deleted() {
            "deleted"
        } else if status.is_index_renamed() || status.is_wt_renamed() {
            "renamed"
        } else {
            "modified"
        };
        
        // Get diff stats
        let (additions, deletions) = get_diff_stats_git2(&repo, &path, is_staged)?;
        
        let change = GitFileChange {
            path: path.clone(),
            status: status_str.to_string(),
            additions,
            deletions,
            staged: is_staged,
        };
        
        if is_staged {
            staged.push(change.clone());
        }
        
        if is_wt_changed {
            let mut wt_change = change.clone();
            wt_change.staged = false;
            changes.push(wt_change);
        }
    }
    
    Ok(GitStatusResponse { changes, staged })
}

/// Get diff stats using git2
fn get_diff_stats_git2(repo: &Repository, path: &str, staged: bool) -> Result<(usize, usize), String> {
    use git2::Delta;
    
    // For unstaged files, check if it's untracked first
    if !staged {
        let index = repo.index()
            .map_err(|e| format!("Failed to get index: {}", e))?;
        
        // If file not in index, it's untracked - count from filesystem
        if index.get_path(std::path::Path::new(path), 0).is_none() {
            let cwd = std::env::current_dir()
                .map_err(|e| format!("Failed to get cwd: {}", e))?;
            let file_path = cwd.join(path);
            if file_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    let line_count = content.lines().count();
                    return Ok((line_count, 0)); // All additions for untracked
                }
            }
        }
    }
    
    let mut opts = git2::DiffOptions::new();
    opts.context_lines(0); // No context for accurate line counting
    
    let diff = if staged {
        // Staged changes: diff between HEAD and index
        let head = repo.head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_tree = head.peel_to_tree()
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
        
        repo.diff_tree_to_index(Some(&head_tree), None, Some(&mut opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?
    } else {
        // Working tree changes: diff between index and working tree
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| format!("Failed to get workdir diff: {}", e))?
    };
    
    let mut additions = 0;
    let mut deletions = 0;
    let mut file_status = None;
    
    // First pass: detect file status and count lines
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let delta_path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str());
        
        if delta_path == Some(path) {
            if file_status.is_none() {
                file_status = Some(delta.status());
            }
            
            match line.origin() {
                '+' => additions += 1,
                '-' => deletions += 1,
                _ => {}
            }
        }
        true
    }).map_err(|e| format!("Failed to process diff: {}", e))?;
    
    // For new/deleted files, if diff didn't capture all lines, count from blob
    match file_status {
        Some(Delta::Added) | Some(Delta::Untracked) if additions == 0 => {
            // Count lines from index or filesystem
            if staged {
                let index = repo.index()
                    .map_err(|e| format!("Failed to get index: {}", e))?;
                if let Some(entry) = index.get_path(std::path::Path::new(path), 0) {
                    let blob = repo.find_blob(entry.id)
                        .map_err(|e| format!("Failed to find blob: {}", e))?;
                    if let Ok(content) = std::str::from_utf8(blob.content()) {
                        additions = content.lines().count();
                    }
                }
            } else {
                let cwd = std::env::current_dir()
                    .map_err(|e| format!("Failed to get cwd: {}", e))?;
                let file_path = cwd.join(path);
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    additions = content.lines().count();
                }
            }
        }
        Some(Delta::Deleted) if deletions == 0 => {
            // Count lines from HEAD or index
            if staged {
                let head = repo.head()
                    .map_err(|e| format!("Failed to get HEAD: {}", e))?;
                let head_commit = head.peel_to_commit()
                    .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
                let tree = head_commit.tree()
                    .map_err(|e| format!("Failed to get tree: {}", e))?;
                if let Ok(entry) = tree.get_path(std::path::Path::new(path)) {
                    let blob = repo.find_blob(entry.id())
                        .map_err(|e| format!("Failed to find blob: {}", e))?;
                    if let Ok(content) = std::str::from_utf8(blob.content()) {
                        deletions = content.lines().count();
                    }
                }
            } else {
                let index = repo.index()
                    .map_err(|e| format!("Failed to get index: {}", e))?;
                if let Some(entry) = index.get_path(std::path::Path::new(path), 0) {
                    let blob = repo.find_blob(entry.id)
                        .map_err(|e| format!("Failed to find blob: {}", e))?;
                    if let Ok(content) = std::str::from_utf8(blob.content()) {
                        deletions = content.lines().count();
                    }
                }
            }
        }
        _ => {}
    }
    
    Ok((additions, deletions))
}

/// Get list of branches using git2
#[tauri::command]
pub fn git_branches() -> Result<GitBranchesResponse, String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    
    let current_branch = head.shorthand().unwrap_or("main").to_string();
    
    let mut branches = Vec::new();
    let branch_iter = repo.branches(None)
        .map_err(|e| format!("Failed to get branches: {}", e))?;
    
    for branch_result in branch_iter {
        let (branch, _branch_type) = branch_result
            .map_err(|e| format!("Failed to read branch: {}", e))?;
        
        let name = branch.name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("")
            .to_string();
        
        let is_current = name == current_branch;
        
        branches.push(GitBranch {
            name,
            current: is_current,
            remote: None,
        });
    }
    
    Ok(GitBranchesResponse { 
        current: current_branch, 
        branches 
    })
}

/// Stage a file using git2
#[tauri::command]
pub fn git_stage_file(path: String) -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    
    index.add_path(std::path::Path::new(&path))
        .map_err(|e| format!("Failed to stage file: {}", e))?;
    
    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;
    
    Ok(())
}

/// Unstage a file using git2
#[tauri::command]
pub fn git_unstage_file(path: String) -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_commit = head.peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
    
    repo.reset_default(Some(&head_commit.into_object()), &[std::path::Path::new(&path)])
        .map_err(|e| format!("Failed to unstage file: {}", e))?;
    
    Ok(())
}

/// Stage all changes using git2
#[tauri::command]
pub fn git_stage_all() -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    
    index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage all: {}", e))?;
    
    index.write()
        .map_err(|e| format!("Failed to write index: {}", e))?;
    
    Ok(())
}

/// Unstage all changes using git2
#[tauri::command]
pub fn git_unstage_all() -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_commit = head.peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
    
    repo.reset_default(Some(&head_commit.into_object()), &[std::path::Path::new(".")])
        .map_err(|e| format!("Failed to unstage all: {}", e))?;
    
    Ok(())
}

/// Discard changes to a file using git2
#[tauri::command]
pub fn git_discard_changes(path: String) -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    repo.checkout_head(Some(
        git2::build::CheckoutBuilder::new()
            .path(&path)
            .force()
    )).map_err(|e| format!("Failed to discard changes: {}", e))?;
    
    Ok(())
}

/// Commit staged changes using git2
#[tauri::command]
pub fn git_commit(message: String) -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let signature = repo.signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;
    
    let mut index = repo.index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    
    let tree_id = index.write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    
    let tree = repo.find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;
    
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let parent_commit = head.peel_to_commit()
        .map_err(|e| format!("Failed to get parent commit: {}", e))?;
    
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &[&parent_commit],
    ).map_err(|e| format!("Failed to commit: {}", e))?;
    
    Ok(())
}

/// Push to remote (still using git command for now - git2 push is complex)
#[tauri::command]
pub fn git_push() -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let output = std::process::Command::new("git")
        .args(&["push"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(())
}

/// Pull from remote (still using git command for now)
#[tauri::command]
pub fn git_pull() -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let output = std::process::Command::new("git")
        .args(&["pull"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Failed to pull: {}", e))?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(())
}

/// Sync with remote (pull then push)
#[tauri::command]
pub fn git_sync() -> Result<(), String> {
    // First pull
    git_pull()?;
    
    // Then push
    git_push()?;
    
    Ok(())
}

/// Check if there are unpushed commits
#[tauri::command]
pub fn git_has_unpushed_commits() -> Result<bool, String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    // Get local HEAD
    let head = repo.head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    
    let local_oid = head.target()
        .ok_or_else(|| "HEAD has no target".to_string())?;
    
    // Get remote tracking branch
    let branch_name = head.shorthand().unwrap_or("main");
    let remote_branch_name = format!("origin/{}", branch_name);
    
    // Try to find remote branch and get its OID
    let remote_oid = match repo.find_branch(&remote_branch_name, git2::BranchType::Remote) {
        Ok(remote_branch) => {
            let remote_ref = remote_branch.get();
            remote_ref.target()
                .ok_or_else(|| "Remote branch has no target".to_string())?
        }
        Err(_) => {
            // No remote branch found, assume there are unpushed commits
            return Ok(true);
        }
    };
    
    // If local and remote are different, there are unpushed commits
    Ok(local_oid != remote_oid)
}

/// Switch branch using git2
#[tauri::command]
pub fn git_switch_branch(branch: String) -> Result<(), String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let (object, reference) = repo.revparse_ext(&branch)
        .map_err(|e| format!("Failed to find branch: {}", e))?;
    
    repo.checkout_tree(&object, None)
        .map_err(|e| format!("Failed to checkout tree: {}", e))?;
    
    match reference {
        Some(gref) => repo.set_head(gref.name().unwrap()),
        None => repo.set_head_detached(object.id()),
    }.map_err(|e| format!("Failed to set HEAD: {}", e))?;
    
    Ok(())
}

/// Generate commit message using AI - Direct API call (no session storage)
#[tauri::command]
pub async fn git_generate_commit_message(
    state: tauri::State<'_, crate::setup::app_state::AppState>,
) -> Result<String, String> {
    use api::{MessageRequest, ProviderClient};
    
    // PHASE 1: Get git diff (all git2 objects dropped before await)
    let diff_text = {
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        
        let repo = Repository::open(&cwd)
            .map_err(|e| format!("Failed to open git repository: {}", e))?;
        
        let mut diff_text = String::new();
        
        // Get staged diff
        {
            let mut opts = git2::DiffOptions::new();
            opts.context_lines(3);
            
            let head = repo.head().ok();
            let head_tree = head.as_ref().and_then(|h| h.peel_to_tree().ok());
            let staged_diff = repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
                .map_err(|e| format!("Failed to get staged diff: {}", e))?;
            
            staged_diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
                let origin = line.origin();
                let content = std::str::from_utf8(line.content()).unwrap_or("");
                match origin {
                    '+' | '-' | ' ' => {
                        diff_text.push(origin);
                        diff_text.push_str(content);
                    }
                    _ => {}
                }
                true
            }).ok();
        } // Drop staged_diff, head_tree, head, opts
        
        // Get unstaged diff
        {
            let mut opts = git2::DiffOptions::new();
            opts.context_lines(3);
            
            let unstaged_diff = repo.diff_index_to_workdir(None, Some(&mut opts))
                .map_err(|e| format!("Failed to get unstaged diff: {}", e))?;
            
            unstaged_diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
                let origin = line.origin();
                let content = std::str::from_utf8(line.content()).unwrap_or("");
                match origin {
                    '+' | '-' | ' ' => {
                        diff_text.push(origin);
                        diff_text.push_str(content);
                    }
                    _ => {}
                }
                true
            }).ok();
        } // Drop unstaged_diff, opts
        
        diff_text
    }; // Drop repo - all git2 objects are now dropped
    
    if diff_text.trim().is_empty() {
        return Err("No changes to commit".to_string());
    }
    
    // Truncate diff if too long (max 4000 chars)
    let diff_text = if diff_text.len() > 4000 {
        let mut truncated = diff_text;
        truncated.truncate(4000);
        truncated.push_str("\n... (truncated)");
        truncated
    } else {
        diff_text
    };
    
    // PHASE 2: Load settings and call API (can now safely await)
    let settings = state.settings_manager.load()
        .map_err(|e| format!("Failed to load settings: {}", e))?;
    
    let (model, base_url, api_key, provider_id) = if let Some(ref selected) = settings.selected_model {
        let provider = settings.get_provider(&selected.provider_id)
            .ok_or_else(|| "No provider configured".to_string())?;
        
        let model_obj = provider.models.iter()
            .find(|m| m.id == selected.model_id)
            .ok_or_else(|| "No model configured".to_string())?;
        
        (
            model_obj.id.clone(), 
            provider.base_url.clone(), 
            provider.api_key.clone(),
            selected.provider_id.clone()
        )
    } else {
        return Err("No model selected in settings".to_string());
    };
    
    // Create API client - Pass provider_id to handle Antigravity correctly
    let client = ProviderClient::from_model_and_base_url(
        &model,
        base_url,
        api_key,
        Some(&provider_id), // Pass provider_id so Antigravity is detected
    ).map_err(|e| format!("Failed to create API client: {}", e))?;
    
    // Build prompt with diff - Request detailed commit message
    let system_prompt = "You are an expert at writing detailed, professional git commit messages. Follow these rules:

1. Use conventional commits format: type(scope): subject
2. Types: feat, fix, refactor, docs, style, test, chore, perf, ci, build
3. Subject line: Clear, concise summary (50-72 chars)
4. Body (optional but recommended): Explain WHAT changed and WHY
5. Include bullet points for multiple changes
6. Mention affected components/files if relevant
7. Return ONLY the commit message, no markdown code blocks or explanations

Example format:
feat(auth): add OAuth2 login support

- Implement OAuth2 authentication flow
- Add Google and GitHub providers
- Update login UI with provider buttons
- Add token refresh mechanism

This enables users to sign in with their existing accounts,
improving onboarding experience and reducing friction.";
    
    let user_message = format!(
        "Analyze these git changes and generate a detailed commit message:\n\n```diff\n{}\n```\n\nProvide a commit message with:\n- Conventional commits format header\n- Detailed body explaining what changed and why\n- Bullet points for key changes",
        diff_text
    );
    
    let request = MessageRequest {
        model: model.clone(),
        messages: vec![api::InputMessage {
            role: "user".to_string(),
            content: vec![api::InputContentBlock::Text {
                text: user_message,
            }],
        }],
        max_tokens: 2048, // Allow detailed response
        system: Some(system_prompt.to_string()),
        tools: None,
        tool_choice: None,
        stream: false,
        temperature: Some(0.7),
        top_p: None,
        frequency_penalty: None,
        presence_penalty: None,
        stop: None,
        reasoning_effort: None,
    };
    
    // Call API (safe to await now - all git2 objects dropped)
    let response = client.send_message(&request).await
        .map_err(|e| format!("API error: {}", e))?;
    
    // Extract text from response
    let commit_message = response.content.iter()
        .filter_map(|block| match block {
            api::OutputContentBlock::Text { text } => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    
    if commit_message.is_empty() {
        Err("AI returned empty response".to_string())
    } else {
        Ok(commit_message)
    }
}

/// Get file diff using git2
#[tauri::command]
pub fn git_get_diff(path: String, staged: bool) -> Result<String, String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    // Check if file is untracked (not in index at all)
    if !staged {
        let file_path = cwd.join(&path);
        if file_path.exists() {
            let index = repo.index()
                .map_err(|e| format!("Failed to get index: {}", e))?;
            
            // If file not in index, it's untracked - show as all additions
            if index.get_path(std::path::Path::new(&path), 0).is_none() {
                let content = std::fs::read_to_string(&file_path)
                    .map_err(|e| format!("Failed to read untracked file: {}", e))?;
                
                let mut diff_text = String::new();
                for line in content.lines() {
                    diff_text.push('+');
                    diff_text.push_str(line);
                    diff_text.push('\n');
                }
                if !content.is_empty() && !content.ends_with('\n') {
                    diff_text.push('\n');
                }
                return Ok(diff_text);
            }
        }
    }
    
    let mut opts = git2::DiffOptions::new();
    opts.context_lines(0); // No context - we want full file content for new/deleted
    
    let diff = if staged {
        // Staged changes: diff between HEAD and index
        let head = repo.head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_tree = head.peel_to_tree()
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
        
        repo.diff_tree_to_index(Some(&head_tree), None, Some(&mut opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?
    } else {
        // Working tree changes: diff between index and working tree
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| format!("Failed to get workdir diff: {}", e))?
    };
    
    let mut diff_text = String::new();
    let mut file_status = None;
    
    // First pass: detect file status
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, _line| {
        let delta_path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str());
        
        if delta_path == Some(&path) {
            file_status = Some(delta.status());
        }
        true
    }).map_err(|e| format!("Failed to check file status: {}", e))?;
    
    use git2::Delta;
    match file_status {
        Some(Delta::Added) | Some(Delta::Untracked) => {
            // NEW FILE: Read from index (if staged) or filesystem (if unstaged)
            if staged {
                // Read from index
                let index = repo.index()
                    .map_err(|e| format!("Failed to get index: {}", e))?;
                
                if let Some(entry) = index.get_path(std::path::Path::new(&path), 0) {
                    let oid = entry.id;
                    let blob = repo.find_blob(oid)
                        .map_err(|e| format!("Failed to find blob: {}", e))?;
                    
                    let content = std::str::from_utf8(blob.content())
                        .map_err(|e| format!("File is not valid UTF-8: {}", e))?;
                    
                    for line in content.lines() {
                        diff_text.push('+');
                        diff_text.push_str(line);
                        diff_text.push('\n');
                    }
                    // Add final line if content doesn't end with newline
                    if !content.is_empty() && !content.ends_with('\n') {
                        diff_text.push('\n');
                    }
                }
            } else {
                // Read from filesystem
                let file_path = cwd.join(&path);
                let content = std::fs::read_to_string(&file_path)
                    .map_err(|e| format!("Failed to read new file: {}", e))?;
                
                for line in content.lines() {
                    diff_text.push('+');
                    diff_text.push_str(line);
                    diff_text.push('\n');
                }
                // Add final line if content doesn't end with newline
                if !content.is_empty() && !content.ends_with('\n') {
                    diff_text.push('\n');
                }
            }
        }
        Some(Delta::Deleted) => {
            // DELETED FILE: Read from HEAD (if staged) or index (if unstaged)
            if staged {
                // Read from HEAD
                let head = repo.head()
                    .map_err(|e| format!("Failed to get HEAD: {}", e))?;
                let head_commit = head.peel_to_commit()
                    .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
                let tree = head_commit.tree()
                    .map_err(|e| format!("Failed to get tree: {}", e))?;
                
                let entry = tree.get_path(std::path::Path::new(&path))
                    .map_err(|e| format!("Failed to find file in HEAD: {}", e))?;
                let oid = entry.id();
                let blob = repo.find_blob(oid)
                    .map_err(|e| format!("Failed to find blob: {}", e))?;
                
                let content = std::str::from_utf8(blob.content())
                    .map_err(|e| format!("File is not valid UTF-8: {}", e))?;
                
                for line in content.lines() {
                    diff_text.push('-');
                    diff_text.push_str(line);
                    diff_text.push('\n');
                }
                // Add final line if content doesn't end with newline
                if !content.is_empty() && !content.ends_with('\n') {
                    diff_text.push('\n');
                }
            } else {
                // Read from index
                let index = repo.index()
                    .map_err(|e| format!("Failed to get index: {}", e))?;
                
                if let Some(entry) = index.get_path(std::path::Path::new(&path), 0) {
                    let oid = entry.id;
                    let blob = repo.find_blob(oid)
                        .map_err(|e| format!("Failed to find blob: {}", e))?;
                    
                    let content = std::str::from_utf8(blob.content())
                        .map_err(|e| format!("File is not valid UTF-8: {}", e))?;
                    
                    for line in content.lines() {
                        diff_text.push('-');
                        diff_text.push_str(line);
                        diff_text.push('\n');
                    }
                    // Add final line if content doesn't end with newline
                    if !content.is_empty() && !content.ends_with('\n') {
                        diff_text.push('\n');
                    }
                }
            }
        }
        _ => {
            // MODIFIED FILE: Use normal diff with context
            let mut opts_with_context = git2::DiffOptions::new();
            opts_with_context.context_lines(3);
            
            let diff_with_context = if staged {
                let head = repo.head()
                    .map_err(|e| format!("Failed to get HEAD: {}", e))?;
                let head_tree = head.peel_to_tree()
                    .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
                
                repo.diff_tree_to_index(Some(&head_tree), None, Some(&mut opts_with_context))
                    .map_err(|e| format!("Failed to get staged diff: {}", e))?
            } else {
                repo.diff_index_to_workdir(None, Some(&mut opts_with_context))
                    .map_err(|e| format!("Failed to get workdir diff: {}", e))?
            };
            
            diff_with_context.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
                let delta_path = delta.new_file().path()
                    .or_else(|| delta.old_file().path())
                    .and_then(|p| p.to_str());
                
                if delta_path == Some(&path) {
                    let origin = line.origin();
                    let content = std::str::from_utf8(line.content()).unwrap_or("");
                    
                    match origin {
                        '+' | '-' | ' ' => {
                            diff_text.push(origin);
                            diff_text.push_str(content);
                        }
                        _ => {} // Skip headers
                    }
                }
                true
            }).map_err(|e| format!("Failed to process diff: {}", e))?;
        }
    }
    
    Ok(diff_text)
}



// ============================================================================
// Git File Watcher - Auto-refresh on file system changes
// ============================================================================

use notify_debouncer_full::{new_debouncer, notify::{RecursiveMode, Watcher}, DebounceEventResult};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Start watching git repository for changes
#[tauri::command]
pub fn git_start_watch(app: AppHandle) -> Result<(), String> {
    // Get current directory
    let cwd = match std::env::current_dir() {
        Ok(dir) => dir,
        Err(e) => return Err(format!("Failed to get current directory: {}", e)),
    };
    
    // Check if it's a git repo
    let repo = match Repository::open(&cwd) {
        Ok(r) => r,
        Err(e) => return Err(format!("Not a git repository: {}", e)),
    };
    
    let git_dir = repo.path().to_path_buf();
    let work_dir = match repo.workdir() {
        Some(dir) => dir.to_path_buf(),
        None => return Err("No working directory".to_string()),
    };
    
    // Clone paths for the closure
    let git_dir_clone = git_dir.clone();
    let work_dir_clone = work_dir.clone();
    
    // Clone app handle for the closure
    let app_clone = app.clone();
    
    // Create debounced watcher (500ms debounce)
    let mut debouncer = match new_debouncer(
        Duration::from_millis(500),
        None,
        move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    // Check if any event is git-related
                    let has_git_change = events.iter().any(|event| {
                        event.paths.iter().any(|path| {
                            // Watch for changes in .git directory or working tree
                            path.starts_with(&git_dir_clone) || path.starts_with(&work_dir_clone)
                        })
                    });
                    
                    if has_git_change {
                        // Emit event to frontend
                        if let Err(e) = app_clone.emit("git-changed", ()) {
                            eprintln!("[GIT_WATCHER] Failed to emit event: {}", e);
                        }
                    }
                }
                Err(errors) => {
                    for error in errors {
                        eprintln!("[GIT_WATCHER] Error: {:?}", error);
                    }
                }
            }
        },
    ) {
        Ok(d) => d,
        Err(e) => return Err(format!("Failed to create watcher: {}", e)),
    };
    
    // Watch .git directory for index/HEAD changes
    if let Err(e) = debouncer.watcher().watch(&git_dir, RecursiveMode::Recursive) {
        return Err(format!("Failed to watch .git directory: {}", e));
    }
    
    // Watch working directory for file changes
    if let Err(e) = debouncer.watcher().watch(&work_dir, RecursiveMode::Recursive) {
        return Err(format!("Failed to watch working directory: {}", e));
    }
    
    // Store debouncer in app state to keep it alive
    app.manage(Arc::new(Mutex::new(debouncer)));
    
    println!("[GIT_WATCHER] Started watching: {:?}", work_dir);
    
    Ok(())
}
