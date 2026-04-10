use thiserror::Error;

#[derive(Error, Debug)]
pub enum SkillError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("YAML parsing error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Skill not found: {0}")]
    SkillNotFound(String),

    #[error("Invalid skill name: {0}")]
    InvalidSkillName(String),

    #[error("Invalid source URL: {0}")]
    InvalidSourceUrl(String),

    #[error("Path traversal detected: {0}")]
    PathTraversal(String),

    #[error("Symlink creation failed: {0}")]
    SymlinkFailed(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Skill already installed: {0}")]
    AlreadyInstalled(String),

    #[error("GitHub API error: {0}")]
    GitHubApi(String),

    #[error("Lockfile error: {0}")]
    Lockfile(String),

    #[error("Other error: {0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, SkillError>;
