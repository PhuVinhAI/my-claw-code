use crate::{error::*, types::*};
use regex::Regex;
use std::path::Path;

const RAW_GITHUB_BASE: &str = "https://raw.githubusercontent.com";
const SKILLS_API_BASE: &str = "https://skills.sh/api";

/// Parse GitHub shorthand (owner/repo) hoặc full URL
pub fn parse_github_url(input: &str) -> Result<(String, String)> {
    // Shorthand: owner/repo
    let shorthand_re = Regex::new(r"^([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)$").unwrap();
    if let Some(caps) = shorthand_re.captures(input) {
        return Ok((caps[1].to_string(), caps[2].to_string()));
    }

    // Full URL: https://github.com/owner/repo
    let url_re = Regex::new(r"github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)").unwrap();
    if let Some(caps) = url_re.captures(input) {
        return Ok((caps[1].to_string(), caps[2].to_string()));
    }

    Err(SkillError::InvalidSourceUrl(input.to_string()))
}

/// Parse YAML frontmatter từ SKILL.md
pub fn parse_skill_frontmatter(content: &str) -> Result<SkillMetadata> {
    // Tìm YAML frontmatter giữa --- và ---
    let re = Regex::new(r"(?s)^---\s*\n(.*?)\n---").unwrap();
    
    if let Some(caps) = re.captures(content) {
        let yaml_str = &caps[1];
        let metadata: SkillMetadata = serde_yaml::from_str(yaml_str)?;
        Ok(metadata)
    } else {
        Err(SkillError::Other("No frontmatter found in SKILL.md".to_string()))
    }
}

/// LUỒNG 2: Download skill từ Blob API (skills.sh)
pub async fn download_skill_blob(
    owner: &str,
    repo: &str,
    skill_name: &str,
) -> Result<BlobResponse> {
    let client = reqwest::Client::new();
    
    // API: https://skills.sh/api/download/{owner}/{repo}/{skill_name}
    let api_url = format!(
        "{}/download/{}/{}/{}",
        SKILLS_API_BASE, owner, repo, skill_name
    );
    
    let response = client
        .get(&api_url)
        .header("User-Agent", "claw-desktop-skills")
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(SkillError::Other(format!(
            "Blob API failed: {}",
            response.status()
        )));
    }
    
    let blob: BlobResponse = response.json().await?;
    Ok(blob)
}

/// Ghi blob files vào thư mục đích (với path traversal protection)
pub async fn write_blob_files(target_dir: &Path, files: Vec<BlobFile>) -> Result<()> {
    use tokio::fs;
    
    for file in files {
        // CHỐNG PATH TRAVERSAL
        if file.path.contains("..") || file.path.starts_with('/') || file.path.starts_with('\\') {
            eprintln!("CẢNH BÁO: Bỏ qua file độc hại: {}", file.path);
            continue;
        }
        
        // Tạo đường dẫn đầy đủ
        let full_path = target_dir.join(&file.path);
        
        // Tạo thư mục cha nếu cần
        if let Some(parent_dir) = full_path.parent() {
            if parent_dir != target_dir {
                fs::create_dir_all(parent_dir).await?;
            }
        }
        
        // Ghi file
        fs::write(full_path, file.contents).await?;
    }
    
    Ok(())
}

/// LUỒNG 1: Download skill content từ GitHub raw (fallback - chỉ SKILL.md)
pub async fn download_skill_content(
    owner: &str,
    repo: &str,
    branch: &str,
    skill_path: &str,
) -> Result<String> {
    let client = reqwest::Client::new();
    let raw_url = format!(
        "{}/{}/{}/{}/{}",
        RAW_GITHUB_BASE, owner, repo, branch, skill_path
    );
    
    let content = client
        .get(&raw_url)
        .header("User-Agent", "claw-desktop-skills")
        .send()
        .await?
        .text()
        .await?;

    Ok(content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_url() {
        let (owner, repo) = parse_github_url("vercel-labs/agent-skills").unwrap();
        assert_eq!(owner, "vercel-labs");
        assert_eq!(repo, "agent-skills");

        let (owner, repo) = parse_github_url("https://github.com/vercel-labs/agent-skills").unwrap();
        assert_eq!(owner, "vercel-labs");
        assert_eq!(repo, "agent-skills");
    }

    #[test]
    fn test_parse_frontmatter() {
        let content = r#"---
name: react
description: React development rules
version: 1.0.0
---

# React Skill

Content here...
"#;
        let metadata = parse_skill_frontmatter(content).unwrap();
        assert_eq!(metadata.name, "react");
        assert_eq!(metadata.description, Some("React development rules".to_string()));
    }
}
