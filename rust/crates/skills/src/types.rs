use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Skill metadata từ SKILL.md frontmatter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
}

/// Skill đầy đủ với path và content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub path: String,
    pub source: SkillSource,
    pub installed: bool,
    pub install_date: Option<String>,
}

/// Nguồn cài đặt skill
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SkillSource {
    GitHub { owner: String, repo: String, path: String },
    Local { path: String },
    Store { slug: String },
}

/// Skill từ Store (skills.sh)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreSkill {
    pub id: String,
    #[serde(rename = "skillId")]
    pub skill_id: String,
    pub name: String,
    pub installs: u32,
    pub source: String,
}

/// Response wrapper từ Store API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreSearchResponse {
    pub query: String,
    #[serde(rename = "searchType")]
    pub search_type: String,
    pub skills: Vec<StoreSkill>,
    pub count: usize,
    #[serde(rename = "duration_ms")]
    pub duration_ms: u64,
}

/// Kết quả preview source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcePreview {
    pub source_type: String,
    pub resolved_url: String,
    pub available_skills: Vec<PreviewSkill>,
}

/// Skill trong preview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewSkill {
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub size: Option<u64>,
}

/// Request cài đặt skills
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRequest {
    pub source_url: String,
    pub selected_skills: Vec<String>,
    pub target_agents: Vec<String>,
    pub scope: InstallScope,
    pub install_mode: InstallMode,
}

/// Phạm vi cài đặt
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InstallScope {
    Global,
    Project,
}

/// Chế độ cài đặt
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InstallMode {
    Symlink,
    Copy,
}

/// Kết quả cài đặt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub installed_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
    pub installed_skills: Vec<String>,
}

/// Thông tin Agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub skills_path: String,
    pub installed: bool,
    pub universal: bool, // Dùng chung .codex/skills
}

/// Entry trong lockfile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockEntry {
    pub name: String,
    pub source: SkillSource,
    pub version: Option<String>,
    pub tree_sha: Option<String>, // GitHub tree SHA
    pub installed_at: String,
    pub agents: Vec<String>,
}

/// Lockfile structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Lockfile {
    pub version: String,
    pub skills: HashMap<String, LockEntry>,
}

/// Update check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheck {
    pub skill_name: String,
    pub current_version: Option<String>,
    pub latest_version: Option<String>,
    pub current_sha: Option<String>,
    pub latest_sha: Option<String>,
    pub needs_update: bool,
}
