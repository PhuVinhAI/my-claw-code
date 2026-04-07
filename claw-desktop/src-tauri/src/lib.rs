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
    // Initialize logging FIRST - Returns session metadata
    let session_metadata = match setup::logging::init_logging() {
        Ok(metadata) => {
            tracing::info!("Logging initialized successfully");
            Some(metadata)
        }
        Err(e) => {
            eprintln!("Failed to initialize logging: {}", e);
            None
        }
    };
    
    tracing::info!("Starting Claw Desktop...");
    if let Some(ref metadata) = session_metadata {
        tracing::info!("Session ID: {}", metadata.session_id);
        tracing::info!("Log directory: {}", metadata.log_directory.display());
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
            submit_prompt_answer,
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
            set_user_language,
            send_tool_input,
            cancel_tool_execution,
            detach_tool_execution,
            get_work_mode,
            set_work_mode,
            get_workspace_path,
            reload_tool_definitions,
            set_selected_tools,
            open_external_terminal,
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
            reload_api_client,
            fetch_kilo_models,
            test_antigravity_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
