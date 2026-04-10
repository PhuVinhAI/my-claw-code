use crate::{error::*, types::*};

const STORE_API_BASE: &str = "https://skills.sh/api";

/// Tìm kiếm skills trên store
pub async fn search_store(query: &str, limit: usize) -> Result<Vec<StoreSkill>> {
    let client = reqwest::Client::new();
    
    // Nếu query quá ngắn, dùng "ai" làm fallback
    let search_query = if query.len() < 2 { "ai" } else { query };
    
    let response = client
        .get(format!("{}/search", STORE_API_BASE))
        .query(&[
            ("q", search_query),
            ("limit", &limit.to_string()),
        ])
        .header("User-Agent", "claw-desktop-skills")
        .send()
        .await?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(SkillError::Other(format!(
            "Store API returned status {}: {}",
            status, body
        )));
    }
    
    // Parse wrapper response
    let wrapper: StoreSearchResponse = response.json().await?;
    Ok(wrapper.skills)
}
