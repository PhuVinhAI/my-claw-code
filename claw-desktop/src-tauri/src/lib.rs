use tauri::Manager;

// Modules
mod core;
mod adapters;
mod setup;

// Re-exports
pub use adapters::inbound::commands::*;
pub use setup::di_container::initialize_app;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize DI Container và spawn Actor
            let state = initialize_app(app.handle().clone())
                .map_err(|e| format!("Failed to initialize app: {}", e))?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            send_prompt,
            answer_permission,
            load_session,
            save_session,
            get_session,
            cancel_prompt,
            get_model,
            list_sessions,
            delete_session,
            rename_session,
            new_session,
            get_current_session_id,
            set_working_directory,
            get_working_directory,
            select_and_set_workspace,
            reload_system_prompt,
            send_tool_input,
            get_work_mode,
            set_work_mode,
            get_workspace_path,
            reload_tool_definitions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
