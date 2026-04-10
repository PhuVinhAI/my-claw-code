use skills::*;

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
        
        // Lấy tên thư mục (đây là tên đã sanitize, khớp với tên khi cài)
        let folder_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        
        // Đọc metadata
        let content = std::fs::read_to_string(&skill_md).map_err(|e| e.to_string())?;
        let metadata = github::parse_skill_frontmatter(&content)
            .unwrap_or_else(|_| SkillMetadata {
                name: folder_name.clone(),
                description: None,
                version: None,
                author: None,
                tags: None,
                category: None,
            });
        
        // Lấy thông tin từ lockfile
        let lockfile = lockfile::read_lockfile(scope, project_dir.as_deref())
            .map_err(|e| e.to_string())?;
        
        let lock_entry = lockfile.skills.get(&folder_name);
        
        skills.push(Skill {
            name: folder_name.clone(),
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
