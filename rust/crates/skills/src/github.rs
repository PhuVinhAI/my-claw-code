use crate::{error::*, types::*};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const GITHUB_API_BASE: &str = "https://api.github.com";
const RAW_GITHUB_BASE: &str = "https://raw.githubusercontent.com";

#[derive(Debug, Deserialize)]
struct GitHubTree {
    sha: String,
    tree: Vec<GitHubTreeItem>,
    truncated: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubTreeItem {
    path: String,
    #[serde(rename = "type")]
    item_type: String,
    sha: String,
    size: Option<u64>,
}

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

/// Lấy danh sách skills từ GitHub repo
pub async fn fetch_github_skills(
    owner: &str,
    repo: &str,
    branch: &str,
) -> Result<SourcePreview> {
    let client = reqwest::Client::new();
    
    // Gọi GitHub Trees API
    let url = format!(
        "{}/repos/{}/{}/git/trees/{}?recursive=1",
        GITHUB_API_BASE, owner, repo, branch
    );
    
    let response = client
        .get(&url)
        .header("User-Agent", "claw-desktop-skills")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(SkillError::GitHubApi(format!(
            "GitHub API returned status {}",
            response.status()
        )));
    }

    let tree: GitHubTree = response.json().await?;
    
    // Lọc các file SKILL.md
    let skill_paths: Vec<_> = tree
        .tree
        .iter()
        .filter(|item| {
            item.item_type == "blob" && 
            item.path.ends_with("SKILL.md")
        })
        .collect();

    // Fetch metadata từ mỗi SKILL.md
    let mut skills = Vec::new();
    
    for item in skill_paths {
        // Lấy raw content
        let raw_url = format!(
            "{}/{}/{}/{}/{}",
            RAW_GITHUB_BASE, owner, repo, branch, item.path
        );
        
        match fetch_skill_metadata(&client, &raw_url).await {
            Ok(metadata) => {
                skills.push(PreviewSkill {
                    name: metadata.name,
                    description: metadata.description,
                    path: item.path.clone(),
                    size: item.size,
                });
            }
            Err(e) => {
                eprintln!("Failed to fetch metadata for {}: {}", item.path, e);
            }
        }
    }

    Ok(SourcePreview {
        source_type: "github".to_string(),
        resolved_url: format!("https://github.com/{}/{}.git", owner, repo),
        available_skills: skills,
    })
}

/// Fetch và parse SKILL.md metadata
async fn fetch_skill_metadata(client: &reqwest::Client, url: &str) -> Result<SkillMetadata> {
    let content = client
        .get(url)
        .header("User-Agent", "claw-desktop-skills")
        .send()
        .await?
        .text()
        .await?;

    parse_skill_frontmatter(&content)
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

/// Download skill content từ GitHub
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

/// Lấy tree SHA của một thư mục trên GitHub
pub async fn get_tree_sha(
    owner: &str,
    repo: &str,
    branch: &str,
    path: &str,
) -> Result<String> {
    let client = reqwest::Client::new();
    
    // Lấy commit SHA của branch
    let commit_url = format!(
        "{}/repos/{}/{}/commits/{}",
        GITHUB_API_BASE, owner, repo, branch
    );
    
    #[derive(Deserialize)]
    struct CommitResponse {
        sha: String,
    }
    
    let commit: CommitResponse = client
        .get(&commit_url)
        .header("User-Agent", "claw-desktop-skills")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await?
        .json()
        .await?;

    // Lấy tree của commit
    let tree_url = format!(
        "{}/repos/{}/{}/git/trees/{}?recursive=1",
        GITHUB_API_BASE, owner, repo, commit.sha
    );
    
    let tree: GitHubTree = client
        .get(&tree_url)
        .header("User-Agent", "claw-desktop-skills")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await?
        .json()
        .await?;

    // Tìm SHA của thư mục cụ thể
    for item in tree.tree {
        if item.path == path && item.item_type == "tree" {
            return Ok(item.sha);
        }
    }

    // Nếu không tìm thấy, trả về commit SHA
    Ok(commit.sha)
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
