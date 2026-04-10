use crate::{error::*, types::*};
use std::fs;
use std::path::PathBuf;

/// Lấy đường dẫn lockfile
pub fn get_lockfile_path(scope: InstallScope, project_dir: Option<&str>) -> Result<PathBuf> {
    match scope {
        InstallScope::Global => {
            let home = dirs::home_dir()
                .ok_or_else(|| SkillError::Other("Cannot find home directory".to_string()))?;
            Ok(home.join(".agents").join(".skill-lock.json"))
        }
        InstallScope::Project => {
            let project = project_dir
                .ok_or_else(|| SkillError::Other("Project directory not specified".to_string()))?;
            Ok(PathBuf::from(project).join(".codex").join("skills-lock.json"))
        }
    }
}

/// Đọc lockfile
pub fn read_lockfile(scope: InstallScope, project_dir: Option<&str>) -> Result<Lockfile> {
    let path = get_lockfile_path(scope, project_dir)?;
    
    if !path.exists() {
        return Ok(Lockfile {
            version: "1.0".to_string(),
            skills: Default::default(),
        });
    }

    let content = fs::read_to_string(&path)?;
    let lockfile: Lockfile = serde_json::from_str(&content)?;
    Ok(lockfile)
}

/// Ghi lockfile
pub fn write_lockfile(
    lockfile: &Lockfile,
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<()> {
    let path = get_lockfile_path(scope, project_dir)?;
    
    // Tạo thư mục cha nếu chưa tồn tại
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(lockfile)?;
    fs::write(&path, content)?;
    Ok(())
}

/// Thêm entry vào lockfile
pub fn add_lock_entry(
    skill_name: &str,
    entry: LockEntry,
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<()> {
    let mut lockfile = read_lockfile(scope, project_dir)?;
    lockfile.skills.insert(skill_name.to_string(), entry);
    write_lockfile(&lockfile, scope, project_dir)?;
    Ok(())
}

/// Xóa entry khỏi lockfile
pub fn remove_lock_entry(
    skill_name: &str,
    scope: InstallScope,
    project_dir: Option<&str>,
) -> Result<()> {
    let mut lockfile = read_lockfile(scope, project_dir)?;
    lockfile.skills.remove(skill_name);
    write_lockfile(&lockfile, scope, project_dir)?;
    Ok(())
}
