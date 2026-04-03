// Settings Domain Types
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub models: Vec<Model>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Model {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SelectedModel {
    pub provider_id: String,
    pub model_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Settings {
    pub providers: Vec<Provider>,
    pub selected_model: Option<SelectedModel>,
}

impl Settings {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
            selected_model: None,
        }
    }

    pub fn get_provider(&self, provider_id: &str) -> Option<&Provider> {
        self.providers.iter().find(|p| p.id == provider_id)
    }

    pub fn get_provider_mut(&mut self, provider_id: &str) -> Option<&mut Provider> {
        self.providers.iter_mut().find(|p| p.id == provider_id)
    }

    pub fn add_provider(&mut self, provider: Provider) -> Result<(), String> {
        if self.providers.iter().any(|p| p.id == provider.id) {
            return Err(format!("Provider with id '{}' already exists", provider.id));
        }
        self.providers.push(provider);
        Ok(())
    }

    pub fn update_provider(&mut self, provider: Provider) -> Result<(), String> {
        let existing = self.get_provider_mut(&provider.id)
            .ok_or_else(|| format!("Provider with id '{}' not found", provider.id))?;
        *existing = provider;
        Ok(())
    }

    pub fn delete_provider(&mut self, provider_id: &str) -> Result<(), String> {
        let index = self.providers.iter().position(|p| p.id == provider_id)
            .ok_or_else(|| format!("Provider with id '{}' not found", provider_id))?;
        self.providers.remove(index);
        
        // Clear selected model if it belongs to deleted provider
        if let Some(selected) = &self.selected_model {
            if selected.provider_id == provider_id {
                self.selected_model = None;
            }
        }
        Ok(())
    }

    pub fn add_model(&mut self, provider_id: &str, model: Model) -> Result<(), String> {
        let provider = self.get_provider_mut(provider_id)
            .ok_or_else(|| format!("Provider with id '{}' not found", provider_id))?;
        
        if provider.models.iter().any(|m| m.id == model.id) {
            return Err(format!("Model with id '{}' already exists in provider '{}'", model.id, provider_id));
        }
        provider.models.push(model);
        Ok(())
    }

    pub fn update_model(&mut self, provider_id: &str, model: Model) -> Result<(), String> {
        let provider = self.get_provider_mut(provider_id)
            .ok_or_else(|| format!("Provider with id '{}' not found", provider_id))?;
        
        let existing = provider.models.iter_mut().find(|m| m.id == model.id)
            .ok_or_else(|| format!("Model with id '{}' not found in provider '{}'", model.id, provider_id))?;
        *existing = model;
        Ok(())
    }

    pub fn delete_model(&mut self, provider_id: &str, model_id: &str) -> Result<(), String> {
        let provider = self.get_provider_mut(provider_id)
            .ok_or_else(|| format!("Provider with id '{}' not found", provider_id))?;
        
        let index = provider.models.iter().position(|m| m.id == model_id)
            .ok_or_else(|| format!("Model with id '{}' not found in provider '{}'", model_id, provider_id))?;
        provider.models.remove(index);
        
        // Clear selected model if it was deleted
        if let Some(selected) = &self.selected_model {
            if selected.provider_id == provider_id && selected.model_id == model_id {
                self.selected_model = None;
            }
        }
        Ok(())
    }

    pub fn set_selected_model(&mut self, provider_id: String, model_id: String) -> Result<(), String> {
        // Validate provider and model exist
        let provider = self.get_provider(&provider_id)
            .ok_or_else(|| format!("Provider with id '{}' not found", provider_id))?;
        
        if !provider.models.iter().any(|m| m.id == model_id) {
            return Err(format!("Model with id '{}' not found in provider '{}'", model_id, provider_id));
        }
        
        self.selected_model = Some(SelectedModel { provider_id, model_id });
        Ok(())
    }

    pub fn is_configured(&self) -> bool {
        !self.providers.is_empty() && self.selected_model.is_some()
    }
}

pub struct SettingsManager {
    settings_path: PathBuf,
}

impl SettingsManager {
    pub fn new(settings_path: PathBuf) -> Self {
        Self { settings_path }
    }

    pub fn load(&self) -> Result<Settings, String> {
        if !self.settings_path.exists() {
            return Ok(Settings::new());
        }

        let content = fs::read_to_string(&self.settings_path)
            .map_err(|e| format!("Failed to read settings file: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings file: {}", e))
    }

    pub fn save(&self, settings: &Settings) -> Result<(), String> {
        // Ensure parent directory exists
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create settings directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        
        fs::write(&self.settings_path, content)
            .map_err(|e| format!("Failed to write settings file: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_provider() {
        let mut settings = Settings::new();
        let provider = Provider {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            api_key: "sk-test".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            models: vec![],
        };
        
        assert!(settings.add_provider(provider.clone()).is_ok());
        assert_eq!(settings.providers.len(), 1);
        assert!(settings.add_provider(provider).is_err()); // Duplicate
    }

    #[test]
    fn test_add_model() {
        let mut settings = Settings::new();
        let provider = Provider {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            api_key: "sk-test".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            models: vec![],
        };
        settings.add_provider(provider).unwrap();
        
        let model = Model {
            id: "gpt-4".to_string(),
            name: "GPT-4".to_string(),
        };
        
        assert!(settings.add_model("openai", model).is_ok());
        assert_eq!(settings.providers[0].models.len(), 1);
    }

    #[test]
    fn test_set_selected_model() {
        let mut settings = Settings::new();
        let mut provider = Provider {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            api_key: "sk-test".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            models: vec![],
        };
        provider.models.push(Model {
            id: "gpt-4".to_string(),
            name: "GPT-4".to_string(),
        });
        settings.add_provider(provider).unwrap();
        
        assert!(settings.set_selected_model("openai".to_string(), "gpt-4".to_string()).is_ok());
        assert!(settings.selected_model.is_some());
        assert!(settings.is_configured());
    }
}
