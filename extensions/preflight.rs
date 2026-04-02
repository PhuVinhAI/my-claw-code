// File: extensions/preflight.rs
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

/// Chạy các thiết lập môi trường trước khi khởi động Core của Claw Code
pub fn setup_env() {
    // 1. [VÁ LỖI WINDOWS] Fix lỗi "HOME is not set"
    // Nếu biến HOME không tồn tại (như trên Windows), lấy USERPROFILE bù vào.
    if env::var("HOME").is_err() {
        if let Ok(user_profile) = env::var("USERPROFILE") {
            env::set_var("HOME", user_profile);
        }
    }
    
    // 2. Tự động đọc file .env (tìm ở nhiều vị trí)
    let env_path = find_env_file();
    
    if let Some(path) = env_path {
        if let Ok(contents) = fs::read_to_string(&path) {
            for line in contents.lines() {
                let trimmed = line.trim();
                
                // Bỏ qua dòng trống và comment
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                
                // Tách key và value an toàn
                if let Some((key, value)) = trimmed.split_once('=') {
                    let clean_key = key.trim();
                    let clean_value = value.trim().trim_matches('"').trim_matches('\'');
                    
                    // Chỉ set nếu biến chưa tồn tại (tôn trọng biến thật của OS)
                    if env::var(clean_key).is_err() {
                        env::set_var(clean_key, clean_value);
                    }
                }
            }
        }
    }
    
    // 3. [TÙY CHỌN] Bạn có thể ghi đè cứng (Hardcode) các cấu hình ở đây:
    // Chuyển sang dùng OpenAI / xAI / Local LLM
    // env::set_var("OPENAI_BASE_URL", "http://localhost:1234/v1");
    // env::set_var("OPENAI_API_KEY", "lm-studio");
    // env::set_var("CLAW_MODEL", "gpt-4o");
}

/// Tìm file .env ở nhiều vị trí (thư mục hiện tại, thư mục cha, thư mục gốc dự án)
fn find_env_file() -> Option<PathBuf> {
    // Thử thư mục hiện tại trước
    let current = Path::new(".env");
    if current.exists() {
        return Some(current.to_path_buf());
    }
    
    // Thử thư mục cha (cho trường hợp chạy từ rust/)
    let parent = Path::new("../.env");
    if parent.exists() {
        return Some(parent.to_path_buf());
    }
    
    // Thử tìm từ thư mục làm việc hiện tại lên trên
    if let Ok(mut current_dir) = env::current_dir() {
        // Thử thư mục hiện tại
        let env_in_current = current_dir.join(".env");
        if env_in_current.exists() {
            return Some(env_in_current);
        }
        
        // Thử thư mục cha
        if current_dir.pop() {
            let env_in_parent = current_dir.join(".env");
            if env_in_parent.exists() {
                return Some(env_in_parent);
            }
        }
    }
    
    None
}
