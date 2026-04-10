use crate::{error::*, github::*, lockfile::*, registry::*, types::*};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use tokio::process::Command;

// Blacklist files/dirs (giống CLI gốc)
const EXCLUDE_FILES: &[&str] = &["metadata.json"];
const EXCLUDE_DIRS: &[&str] = &[".git", "__pycache__", "__pypackages__", "node_modules"];

/// Cài đặt skills từ source
pub async fn install_skills(request: InstallRequest, project_dir: Option<&str>) -> Result<InstallResult> {
    let mut installed = Vec::new();
    let mut errors = Vec::new();

    // Parse source URL
    let (owner, repo) = parse_github_url(&request.source_url)?;

    // Lấy canonical directory
    let canonical_dir = get_canonical_dir(request.scope, project_dir)?;
    fs::create_dir_all(&canonical_dir)?;

    // Cài đặt từng skill
    for skill_name in &request.selected_skills {
        match install_single_skill(
            &owner,
            &repo,
            skill_name,
            &canonical_dir,
            &request.target_agents,
            request.scope,
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

/// Cài đặt một skill (ưu tiên Blob API, fallback Git Clone)
async fn install_single_skill(
    owner: &str,
    repo: &str,
    skill_name: &str,
    canonical_dir: &Path,
    target_agents: &[String],
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<()> {
    // Sanitize skill name
    let safe_name = sanitize_skill_name(skill_name)?;
    
    // Tạo thư mục canonical
    let skill_dir = canonical_dir.join(&safe_name);
    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)?;
    }
    fs::create_dir_all(&skill_dir)?;
    
    // LUỒNG 2: Thử download từ Blob API trước (nhanh nhất)
    match download_skill_blob(owner, repo, skill_name).await {
        Ok(blob) => {
            // Ghi tất cả files từ blob
            write_blob_files(&skill_dir, blob.files).await?;
            println!("✅ Đã cài skill '{}' từ Blob API", safe_name);
        }
        Err(e) => {
            // LUỒNG 1: Git Clone (đầy đủ nhất)
            eprintln!("⚠️  Blob API thất bại ({}), thử Git Clone...", e);
            
            match clone_and_copy_skill(owner, repo, skill_name, &skill_dir).await {
                Ok(_) => {
                    println!("✅ Đã cài skill '{}' từ Git Clone", safe_name);
                }
                Err(git_err) => {
                    // CẢ 2 LUỒNG ĐỀU FAIL → RETURN ERROR
                    // Cleanup thư mục đã tạo
                    let _ = fs::remove_dir_all(&skill_dir);
                    
                    return Err(SkillError::Other(format!(
                        "Không thể cài skill '{}'. Blob API failed: {}. Git Clone failed: {}. \
                        Vui lòng kiểm tra: (1) Skill có tồn tại trong repo không? (2) Git đã cài chưa?",
                        skill_name, e, git_err
                    )));
                }
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
        tree_sha: None,
        installed_at: Utc::now().to_rfc3339(),
        agents: target_agents.to_vec(),
    };
    
    add_lock_entry(&safe_name, lock_entry, scope, project_dir)?;
    
    Ok(())
}

/// LUỒNG 1: Git Clone + Copy Directory với Blacklist
async fn clone_and_copy_skill(
    owner: &str,
    repo: &str,
    skill_name: &str,
    dest_dir: &Path,
) -> Result<()> {
    // 1. Tạo temp directory
    let temp_dir = std::env::temp_dir().join(format!("skill-clone-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir)?;
    
    // 2. Git clone --depth 1
    let repo_url = format!("https://github.com/{}/{}.git", owner, repo);
    let output = Command::new("git")
        .args(&["clone", "--depth", "1", &repo_url, temp_dir.to_str().unwrap()])
        .output()
        .await?;
    
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(SkillError::Other(format!("Git clone failed: {}", err)));
    }
    
    // 3. Tìm thư mục skill trong repo
    let skill_source_dir = temp_dir.join("skills").join(skill_name);
    
    if !skill_source_dir.exists() {
        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(SkillError::Other(format!(
            "Skill '{}' not found in repo",
            skill_name
        )));
    }
    
    // 4. Copy directory với blacklist
    copy_skill_directory(&skill_source_dir, dest_dir)?;
    
    // 5. Cleanup temp
    let _ = fs::remove_dir_all(&temp_dir);
    
    Ok(())
}

/// Copy thư mục skill với blacklist (giống CLI gốc)
fn copy_skill_directory(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name().into_string().unwrap_or_default();
        let file_type = entry.file_type()?;
        
        // BLACKLIST RULES (giống isExcluded trong installer.ts)
        // 1. Bỏ qua file ẩn (.env, .gitignore, ...)
        if name.starts_with('.') {
            continue;
        }
        
        // 2. Bỏ qua file trong blacklist
        if EXCLUDE_FILES.contains(&name.as_str()) {
            continue;
        }
        
        // 3. Bỏ qua thư mục trong blacklist
        if file_type.is_dir() && EXCLUDE_DIRS.contains(&name.as_str()) {
            continue;
        }
        
        let src_path = entry.path();
        let dest_path = dest.join(&name);
        
        // 4. Đệ quy copy thư mục con
        if file_type.is_dir() {
            copy_skill_directory(&src_path, &dest_path)?;
        } else {
            // 5. Copy file (fs::copy tự động follow symlinks)
            fs::copy(&src_path, &dest_path)?;
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
    _target_agents: &[String],
    canonical_dir: &Path,
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<()> {
    let safe_name = sanitize_skill_name(skill_name)?;
    
    // Xóa từ canonical dir
    let canonical_skill_dir = canonical_dir.join(&safe_name);
    if canonical_skill_dir.exists() {
        fs::remove_dir_all(&canonical_skill_dir)?;
    }
    
    // Xóa khỏi lockfile
    remove_lock_entry(&safe_name, scope, project_dir)?;
    
    Ok(())
}
