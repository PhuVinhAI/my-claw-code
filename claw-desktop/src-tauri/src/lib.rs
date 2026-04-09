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
    // WINDOWS FIX: Allocate hidden console to prevent ConPTY from creating visible windows
    // When app runs with windows_subsystem="windows", it has no console. ConPTY requires
    // a console host, so it creates visible console windows that flicker on screen.
    // Solution: Allocate a hidden console once at startup. All ConPTY instances will
    // use this hidden console instead of creating new visible ones.
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Console::{AllocConsole, GetConsoleWindow};
        use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
        
        unsafe {
            // Allocate console if we don't have one
            let _ = AllocConsole();
            
            // Hide the console window immediately
            let console_window = GetConsoleWindow();
            if !console_window.is_invalid() {
                ShowWindow(console_window, SW_HIDE);
            }
        }
    }
    
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
            save_context_to_file,
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
            test_antigravity_connection,
            // Terminal commands
            execute_terminal_command,
            spawn_terminal_shell,
            send_terminal_input,
            resize_terminal,
            kill_terminal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
