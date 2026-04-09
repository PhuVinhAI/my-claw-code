// Git Commands - Inbound Adapters using git2 (libgit2)
use serde::{Deserialize, Serialize};
use git2::{Repository, StatusOptions, StatusShow};

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
        
        // Check if file has working tree changes
        let is_wt_changed = status.is_wt_new() || status.is_wt_modified() || 
                           status.is_wt_deleted() || status.is_wt_renamed();
        
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
    let diff = if staged {
        // Staged changes: diff between HEAD and index
        let head = repo.head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_tree = head.peel_to_tree()
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
        
        repo.diff_tree_to_index(Some(&head_tree), None, None)
            .map_err(|e| format!("Failed to get staged diff: {}", e))?
    } else {
        // Working tree changes: diff between index and working tree
        repo.diff_index_to_workdir(None, None)
            .map_err(|e| format!("Failed to get workdir diff: {}", e))?
    };
    
    let mut additions = 0;
    let mut deletions = 0;
    
    // Use print to iterate and count lines for specific file
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        // Check if this delta is for our target file
        let delta_path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str());
        
        if delta_path == Some(path) {
            match line.origin() {
                '+' => additions += 1,
                '-' => deletions += 1,
                _ => {}
            }
        }
        true
    }).map_err(|e| format!("Failed to process diff: {}", e))?;
    
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

/// Get file diff using git2
#[tauri::command]
pub fn git_get_diff(path: String, staged: bool) -> Result<String, String> {
    let cwd = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let repo = Repository::open(&cwd)
        .map_err(|e| format!("Failed to open git repository: {}", e))?;
    
    let diff = if staged {
        // Staged changes: diff between HEAD and index
        let head = repo.head()
            .map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let head_tree = head.peel_to_tree()
            .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
        
        let mut opts = git2::DiffOptions::new();
        opts.context_lines(3); // Add 3 lines of context
        
        repo.diff_tree_to_index(Some(&head_tree), None, Some(&mut opts))
            .map_err(|e| format!("Failed to get staged diff: {}", e))?
    } else {
        // Working tree changes: diff between index and working tree
        let mut opts = git2::DiffOptions::new();
        opts.context_lines(3); // Add 3 lines of context
        
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| format!("Failed to get workdir diff: {}", e))?
    };
    
    let mut diff_text = String::new();
    let mut is_new_file = false;
    let mut is_deleted_file = false;
    
    // First pass: check if file is new or deleted
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, _line| {
        let delta_path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str());
        
        if delta_path == Some(&path) {
            use git2::Delta;
            match delta.status() {
                Delta::Added => is_new_file = true,
                Delta::Deleted => is_deleted_file = true,
                _ => {}
            }
        }
        true
    }).map_err(|e| format!("Failed to check file status: {}", e))?;
    
    // Second pass: collect diff content
    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let delta_path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str());
        
        if delta_path == Some(&path) {
            let origin = line.origin();
            let content = std::str::from_utf8(line.content()).unwrap_or("");
            
            // For new files: show all lines as additions (+)
            // For deleted files: show all lines as deletions (-)
            // For modified files: only include actual diff lines (+, -, space)
            match origin {
                '+' => {
                    diff_text.push('+');
                    diff_text.push_str(content);
                }
                '-' => {
                    diff_text.push('-');
                    diff_text.push_str(content);
                }
                ' ' => {
                    // Context lines - only for modified files
                    if !is_new_file && !is_deleted_file {
                        diff_text.push(' ');
                        diff_text.push_str(content);
                    }
                }
                _ => {} // Skip headers
            }
        }
        true
    }).map_err(|e| format!("Failed to process diff: {}", e))?;
    
    // Debug log - LOG TOÀN BỘ
    eprintln!("=== GIT DIFF DEBUG ===");
    eprintln!("Path: {}", path);
    eprintln!("Staged: {}", staged);
    eprintln!("Is New: {}", is_new_file);
    eprintln!("Is Deleted: {}", is_deleted_file);
    eprintln!("Diff length: {} bytes", diff_text.len());
    eprintln!("FULL DIFF CONTENT:");
    eprintln!("{}", diff_text);
    eprintln!("======================");
    
    Ok(diff_text)
}

