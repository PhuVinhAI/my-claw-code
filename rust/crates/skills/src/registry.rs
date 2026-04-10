use crate::{error::*, types::*};
use std::path::PathBuf;

/// Danh sách các AI Agents được hỗ trợ
pub fn get_supported_agents() -> Vec<AgentInfo> {
    vec![
        AgentInfo {
            id: "codex".to_string(),
            name: "Codex (Claw)".to_string(),
            skills_path: "~/.codex/skills".to_string(),
            installed: false,
            universal: true,
        },
        AgentInfo {
            id: "cursor".to_string(),
            name: "Cursor".to_string(),
            skills_path: "~/.cursor/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            skills_path: "~/.claude/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "windsurf".to_string(),
            name: "Windsurf".to_string(),
            skills_path: "~/.windsurf/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "amp".to_string(),
            name: "Amp".to_string(),
            skills_path: "~/.amp/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "continue".to_string(),
            name: "Continue".to_string(),
            skills_path: "~/.continue/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "aider".to_string(),
            name: "Aider".to_string(),
            skills_path: "~/.aider/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "cline".to_string(),
            name: "Cline".to_string(),
            skills_path: "~/.cline/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "roo-cline".to_string(),
            name: "Roo Cline".to_string(),
            skills_path: "~/.roo-cline/skills".to_string(),
            installed: false,
            universal: false,
        },
        AgentInfo {
            id: "copilot".to_string(),
            name: "GitHub Copilot".to_string(),
            skills_path: "~/.github-copilot/skills".to_string(),
            installed: false,
            universal: false,
        },
    ]
}

/// Phát hiện các agents đã cài trên máy
pub fn detect_installed_agents() -> Result<Vec<String>> {
    let agents = get_supported_agents();
    let mut installed = Vec::new();

    for agent in agents {
        let path = expand_tilde(&agent.skills_path);
        
        // Check parent directory (config dir) tồn tại
        if let Some(parent) = path.parent() {
            if parent.exists() {
                installed.push(agent.id);
            }
        }
    }

    Ok(installed)
}

/// Lấy thông tin agent theo ID
pub fn get_agent_info(agent_id: &str) -> Result<AgentInfo> {
    get_supported_agents()
        .into_iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| SkillError::AgentNotFound(agent_id.to_string()))
}

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
            Ok(home.join(".codex").join("skills"))
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
