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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_context: Option<u32>,
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

// Structure for loading default providers from JSON
#[derive(Debug, Deserialize)]
struct DefaultProviderConfig {
    id: String,
    name: String,
    base_url: String,
    models: Vec<Model>,
}

#[derive(Debug, Deserialize)]
struct DefaultProvidersFile {
    providers: Vec<DefaultProviderConfig>,
}

impl Settings {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
            selected_model: None,
        }
    }

    /// Create default settings by loading providers from JSON file
    /// Only Kilo has default model, others require manual model configuration
    pub fn default_settings() -> Self {
        // Load from embedded JSON file
        let json_data = include_str!("default_providers.json");
        
        match serde_json::from_str::<DefaultProvidersFile>(json_data) {
            Ok(config) => {
                let providers = config.providers.into_iter().map(|p| Provider {
                    id: p.id,
                    name: p.name,
                    api_key: String::new(), // Empty - user needs to fill
                    base_url: p.base_url,
                    models: p.models,
                }).collect();

                Self {
                    providers,
                    selected_model: None,
                }
            }
            Err(e) => {
                eprintln!("[SETTINGS] Failed to parse default_providers.json: {}", e);
                // Fallback to hardcoded defaults if JSON parsing fails
                Self::fallback_defaults()
            }
        }
    }

    /// Fallback defaults in case JSON loading fails
    fn fallback_defaults() -> Self {
        let kilo_provider = Provider {
            id: "kilo".to_string(),
            name: "Kilo AI Gateway".to_string(),
            api_key: String::new(),
            base_url: "https://api.kilo.ai/api/gateway".to_string(),
            models: vec![
                Model {
                    id: "kilo-auto/free".to_string(),
                    name: "Kilo Auto (Free)".to_string(),
                    max_context: None,
                },
            ],
        };

        Self {
            providers: vec![kilo_provider],
            selected_model: None,
        }
    }

    /// Check if settings has at least one provider with API key configured
    pub fn has_api_key(&self) -> bool {
        self.providers.iter().any(|p| !p.api_key.is_empty())
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
        self.has_api_key() && self.selected_model.is_some()
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
            eprintln!("[SETTINGS] Settings file not found, creating default settings");
            // Create default settings on first run
            let default = Settings::default_settings();
            eprintln!("[SETTINGS] Default settings: {:?}", default);
            self.save(&default)?;
            eprintln!("[SETTINGS] Default settings saved to {:?}", self.settings_path);
            return Ok(default);
        }

        eprintln!("[SETTINGS] Loading settings from {:?}", self.settings_path);
        let content = fs::read_to_string(&self.settings_path)
            .map_err(|e| format!("Failed to read settings file: {}", e))?;
        
        let settings: Settings = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings file: {}", e))?;
        
        eprintln!("[SETTINGS] Loaded settings with {} providers", settings.providers.len());
        
        // If settings exist but have no providers, replace with default
        if settings.providers.is_empty() {
            eprintln!("[SETTINGS] No providers found, replacing with default settings");
            let default = Settings::default_settings();
            self.save(&default)?;
            return Ok(default);
        }
        
        Ok(settings)
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
            max_context: None,
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
            max_context: None,
        });
        settings.add_provider(provider).unwrap();
        
        assert!(settings.set_selected_model("openai".to_string(), "gpt-4".to_string()).is_ok());
        assert!(settings.selected_model.is_some());
        assert!(settings.is_configured());
    }
}
