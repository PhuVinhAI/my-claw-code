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
            cancel_tool_execution,
            get_work_mode,
            set_work_mode,
            get_workspace_path,
            reload_tool_definitions,
            set_selected_tools,
            // Settings commands
            check_onboarding_complete,
            get_settings,
            save_settings,
            add_provider,
            update_provider,
            delete_provider,
            add_model,
            update_model,
            delete_model,
            set_selected_model,
            get_selected_model_info,
            reload_api_client
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
