use skills::*;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Default)]
pub struct SkillsState {
    // Cache cho installed agents
    pub detected_agents: Arc<Mutex<Option<Vec<String>>>>,
}

/// Lấy danh sách skills từ store
#[tauri::command]
pub async fn get_skills_catalog(
    limit: Option<usize>,
    offset: Option<usize>,
) -> std::result::Result<Vec<StoreSkill>, String> {
    store::get_store_catalog(limit.unwrap_or(100), offset.unwrap_or(0))
        .await
        .map_err(|e| e.to_string())
}

/// Tìm kiếm skills
#[tauri::command]
pub async fn search_skills_store(
    query: String,
    limit: Option<usize>,
) -> std::result::Result<Vec<StoreSkill>, String> {
    store::search_store(&query, limit.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

/// Preview skills từ source URL
#[tauri::command]
pub async fn preview_skills_source(
    source_url: String,
) -> std::result::Result<SourcePreview, String> {
    let (owner, repo) = github::parse_github_url(&source_url)
        .map_err(|e| e.to_string())?;
    
    github::fetch_github_skills(&owner, &repo, "main")
        .await
        .map_err(|e| e.to_string())
}

/// Lấy danh sách agents được hỗ trợ
#[tauri::command]
pub fn get_supported_agents() -> Vec<AgentInfo> {
    registry::get_supported_agents()
}

/// Phát hiện agents đã cài
#[tauri::command]
pub async fn detect_installed_agents(
    state: State<'_, SkillsState>,
) -> std::result::Result<Vec<String>, String> {
    // Check cache
    let mut cache = state.detected_agents.lock().await;
    
    if let Some(agents) = cache.as_ref() {
        return Ok(agents.clone());
    }
    
    // Detect và cache
    let agents = registry::detect_installed_agents()
        .map_err(|e| e.to_string())?;
    
    *cache = Some(agents.clone());
    Ok(agents)
}

/// Cài đặt skills
#[tauri::command]
pub async fn install_skills(
    request: InstallRequest,
    project_dir: Option<String>,
) -> std::result::Result<InstallResult, String> {
    installer::install_skills(request, project_dir.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Gỡ cài đặt skills
#[tauri::command]
pub fn uninstall_skills(
    skill_names: Vec<String>,
    target_agents: Vec<String>,
    scope: InstallScope,
    project_dir: Option<String>,
) -> std::result::Result<InstallResult, String> {
    installer::uninstall_skills(skill_names, target_agents, scope, project_dir.as_deref())
        .map_err(|e| e.to_string())
}

/// Lấy danh sách skills đã cài
#[tauri::command]
pub fn get_installed_skills(
    scope: InstallScope,
    project_dir: Option<String>,
) -> std::result::Result<Vec<Skill>, String> {
    let canonical_dir = registry::get_canonical_dir(scope, project_dir.as_deref())
        .map_err(|e| e.to_string())?;
    
    if !canonical_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut skills = Vec::new();
    
    for entry in std::fs::read_dir(&canonical_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if !path.is_dir() {
            continue;
        }
        
        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }
        
        // Đọc metadata
        let content = std::fs::read_to_string(&skill_md).map_err(|e| e.to_string())?;
        let metadata = github::parse_skill_frontmatter(&content)
            .map_err(|e| e.to_string())?;
        
        // Lấy thông tin từ lockfile
        let lockfile = lockfile::read_lockfile(scope, project_dir.as_deref())
            .map_err(|e| e.to_string())?;
        
        let lock_entry = lockfile.skills.get(&metadata.name);
        
        skills.push(Skill {
            name: metadata.name.clone(),
            description: metadata.description,
            version: metadata.version,
            author: metadata.author,
            tags: metadata.tags.unwrap_or_default(),
            category: metadata.category,
            path: path.to_string_lossy().to_string(),
            source: lock_entry
                .map(|e| e.source.clone())
                .unwrap_or(SkillSource::Local {
                    path: path.to_string_lossy().to_string(),
                }),
            installed: true,
            install_date: lock_entry.map(|e| e.installed_at.clone()),
        });
    }
    
    Ok(skills)
}

/// Kiểm tra updates
#[tauri::command]
pub async fn check_skills_updates(
    scope: InstallScope,
    project_dir: Option<String>,
) -> std::result::Result<Vec<UpdateCheck>, String> {
    let lockfile = lockfile::read_lockfile(scope, project_dir.as_deref())
        .map_err(|e| e.to_string())?;
    
    let mut updates = Vec::new();
    
    for (name, entry) in lockfile.skills {
        if let SkillSource::GitHub { owner, repo, path } = &entry.source {
            // Lấy latest SHA
            let latest_sha = github::get_tree_sha(owner, repo, "main", path)
                .await
                .ok();
            
            let needs_update = if let (Some(current), Some(latest)) = (&entry.tree_sha, &latest_sha) {
                current != latest
            } else {
                false
            };
            
            updates.push(UpdateCheck {
                skill_name: name,
                current_version: entry.version.clone(),
                latest_version: None,
                current_sha: entry.tree_sha,
                latest_sha,
                needs_update,
            });
        }
    }
    
    Ok(updates)
}

/// Apply updates
#[tauri::command]
pub async fn apply_skills_updates(
    skill_names: Vec<String>,
    scope: InstallScope,
    project_dir: Option<String>,
) -> std::result::Result<InstallResult, String> {
    let lockfile = lockfile::read_lockfile(scope, project_dir.as_deref())
        .map_err(|e| e.to_string())?;
    
    let mut installed = Vec::new();
    let mut errors = Vec::new();
    
    for skill_name in skill_names {
        if let Some(entry) = lockfile.skills.get(&skill_name) {
            if let SkillSource::GitHub { owner, repo, .. } = &entry.source {
                let request = InstallRequest {
                    source_url: format!("{}/{}", owner, repo),
                    selected_skills: vec![skill_name.clone()],
                    target_agents: entry.agents.clone(),
                    scope,
                    install_mode: InstallMode::Symlink,
                };
                
                match installer::install_skills(request, project_dir.as_deref()).await {
                    Ok(result) => {
                        installed.extend(result.installed_skills);
                        errors.extend(result.errors);
                    }
                    Err(e) => errors.push(format!("{}: {}", skill_name, e)),
                }
            }
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
