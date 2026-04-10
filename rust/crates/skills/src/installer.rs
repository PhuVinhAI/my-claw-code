use crate::{error::*, github::*, lockfile::*, registry::*, types::*};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;

/// Cài đặt skills từ source
pub async fn install_skills(request: InstallRequest, project_dir: Option<&str>) -> Result<InstallResult> {
    let mut installed = Vec::new();
    let mut errors = Vec::new();

    // Parse source URL
    let (owner, repo) = parse_github_url(&request.source_url)?;
    let branch = "main"; // TODO: Support custom branch

    // Lấy canonical directory
    let canonical_dir = get_canonical_dir(request.scope, project_dir)?;
    fs::create_dir_all(&canonical_dir)?;

    // Cài đặt từng skill
    for skill_name in &request.selected_skills {
        match install_single_skill(
            &owner,
            &repo,
            branch,
            skill_name,
            &canonical_dir,
            &request.target_agents,
            request.scope,
            request.install_mode,
            project_dir,
        )
        .await
        {
            Ok(_) => installed.push(skill_name.clone()),
            Err(e) => errors.push(format!("{}: {}", skill_name, e)),
        }
    }

    Ok(InstallResult {
        success: errors.is_empty(),
        installed_count: installed.len(),
        failed_count: errors.len(),
        errors,
        installed_skills: installed,
    })
}

/// Cài đặt một skill
async fn install_single_skill(
    owner: &str,
    repo: &str,
    branch: &str,
    skill_name: &str,
    canonical_dir: &Path,
    target_agents: &[String],
    scope: InstallScope,
    install_mode: InstallMode,
    project_dir: Option<&str>,
) -> Result<()> {
    // Sanitize skill name
    let safe_name = sanitize_skill_name(skill_name)?;
    
    // Tìm skill path trong repo (giả sử skills/{name}/SKILL.md)
    let skill_path = format!("skills/{}/SKILL.md", safe_name);
    
    // Download content
    let content = download_skill_content(owner, repo, branch, &skill_path).await?;
    
    // Tạo thư mục canonical
    let skill_dir = canonical_dir.join(&safe_name);
    fs::create_dir_all(&skill_dir)?;
    
    // Ghi SKILL.md
    fs::write(skill_dir.join("SKILL.md"), content)?;
    
    // Lấy tree SHA để lưu vào lockfile
    let tree_sha = get_tree_sha(owner, repo, branch, &format!("skills/{}", safe_name))
        .await
        .ok();
    
    // Tạo symlinks/copies cho các agents
    for agent_id in target_agents {
        let agent_info = get_agent_info(agent_id)?;
        
        // Skip nếu agent dùng universal path
        if agent_info.universal {
            continue;
        }
        
        let agent_skills_dir = expand_tilde(&agent_info.skills_path);
        fs::create_dir_all(&agent_skills_dir)?;
        
        let target_path = agent_skills_dir.join(&safe_name);
        
        match install_mode {
            InstallMode::Symlink => {
                create_symlink(&skill_dir, &target_path)?;
            }
            InstallMode::Copy => {
                copy_dir_recursive(&skill_dir, &target_path)?;
            }
        }
    }
    
    // Ghi vào lockfile
    let lock_entry = LockEntry {
        name: safe_name.clone(),
        source: SkillSource::GitHub {
            owner: owner.to_string(),
            repo: repo.to_string(),
            path: format!("skills/{}", safe_name),
        },
        version: None,
        tree_sha,
        installed_at: Utc::now().to_rfc3339(),
        agents: target_agents.to_vec(),
    };
    
    add_lock_entry(&safe_name, lock_entry, scope, project_dir)?;
    
    Ok(())
}

/// Tạo symlink (cross-platform)
fn create_symlink(source: &Path, target: &Path) -> Result<()> {
    // Xóa target nếu đã tồn tại
    if target.exists() {
        fs::remove_dir_all(target)?;
    }
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        symlink(source, target)
            .map_err(|e| SkillError::SymlinkFailed(e.to_string()))?;
    }
    
    #[cfg(windows)]
    {
        use std::os::windows::fs::symlink_dir;
        symlink_dir(source, target)
            .map_err(|e| SkillError::SymlinkFailed(e.to_string()))?;
    }
    
    Ok(())
}

/// Copy thư mục đệ quy
fn copy_dir_recursive(source: &Path, target: &Path) -> Result<()> {
    fs::create_dir_all(target)?;
    
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        
        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path)?;
        }
    }
    
    Ok(())
}

/// Gỡ cài đặt skills
pub fn uninstall_skills(
    skill_names: Vec<String>,
    target_agents: Vec<String>,
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<InstallResult> {
    let mut removed = Vec::new();
    let mut errors = Vec::new();
    
    let canonical_dir = get_canonical_dir(scope, project_dir)?;
    
    for skill_name in skill_names {
        match uninstall_single_skill(
            &skill_name,
            &target_agents,
            &canonical_dir,
            scope,
            project_dir,
        ) {
            Ok(_) => removed.push(skill_name),
            Err(e) => errors.push(format!("{}: {}", skill_name, e)),
        }
    }
    
    Ok(InstallResult {
        success: errors.is_empty(),
        installed_count: removed.len(),
        failed_count: errors.len(),
        errors,
        installed_skills: removed,
    })
}

/// Gỡ một skill
fn uninstall_single_skill(
    skill_name: &str,
    target_agents: &[String],
    canonical_dir: &Path,
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<()> {
    let safe_name = sanitize_skill_name(skill_name)?;
    
    // Xóa từ các agents
    for agent_id in target_agents {
        let agent_info = get_agent_info(agent_id)?;
        if agent_info.universal {
            continue;
        }
        
        let agent_skills_dir = expand_tilde(&agent_info.skills_path);
        let target_path = agent_skills_dir.join(&safe_name);
        
        if target_path.exists() {
            fs::remove_dir_all(&target_path)?;
        }
    }
    
    // Kiểm tra xem còn agent nào dùng skill này không
    let lockfile = read_lockfile(scope, project_dir)?;
    let should_remove_canonical = if let Some(entry) = lockfile.skills.get(&safe_name) {
        entry.agents.is_empty() || target_agents.iter().all(|a| entry.agents.contains(a))
    } else {
        true
    };
    
    // Xóa canonical nếu không còn agent nào dùng
    if should_remove_canonical {
        let canonical_skill_dir = canonical_dir.join(&safe_name);
        if canonical_skill_dir.exists() {
            fs::remove_dir_all(&canonical_skill_dir)?;
        }
        remove_lock_entry(&safe_name, scope, project_dir)?;
    } else {
        // Chỉ update agents list
        let remaining_agents: Vec<_> = lockfile
            .skills
            .get(&safe_name)
            .unwrap()
            .agents
            .iter()
            .filter(|a| !target_agents.contains(a))
            .cloned()
            .collect();
        update_lock_agents(&safe_name, remaining_agents, scope, project_dir)?;
    }
    
    Ok(())
}
