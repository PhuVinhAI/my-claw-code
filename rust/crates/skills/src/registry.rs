use crate::{error::*, types::*};
use std::path::PathBuf;

/// Expand ~ thành home directory
pub fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

/// Lấy canonical directory (thư mục gốc chứa skills)
pub fn get_canonical_dir(scope: InstallScope, project_dir: Option<&str>) -> Result<PathBuf> {
    match scope {
        InstallScope::Global => {
            let home = dirs::home_dir()
                .ok_or_else(|| SkillError::Other("Cannot find home directory".to_string()))?;
            Ok(home.join(".agents").join("skills"))
        }
        InstallScope::Project => {
            let project = project_dir
                .ok_or_else(|| SkillError::Other("Project directory not specified".to_string()))?;
            Ok(PathBuf::from(project).join(".codex").join("skills"))
        }
    }
}

/// Sanitize skill name (chống path traversal)
pub fn sanitize_skill_name(name: &str) -> Result<String> {
    // Chỉ cho phép a-z, 0-9, dấu gạch ngang
    let re = regex::Regex::new(r"^[a-z0-9-]+$").unwrap();
    
    if !re.is_match(name) {
        return Err(SkillError::InvalidSkillName(name.to_string()));
    }

    // Chặn path traversal
    if name.contains("..") || name.contains("/") || name.contains("\\") {
        return Err(SkillError::PathTraversal(name.to_string()));
    }

    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_skill_name() {
        assert!(sanitize_skill_name("react").is_ok());
        assert!(sanitize_skill_name("my-skill-123").is_ok());
        assert!(sanitize_skill_name("../etc/passwd").is_err());
        assert!(sanitize_skill_name("skill/name").is_err());
        assert!(sanitize_skill_name("UPPERCASE").is_err());
    }

    #[test]
    fn test_detect_agents() {
        let agents = detect_installed_agents().unwrap();
        println!("Detected agents: {:?}", agents);
    }
}
