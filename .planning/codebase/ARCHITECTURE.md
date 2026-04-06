# Architecture overview

## Hexagonal (Ports & Adapters) Design
- **Presentation Layer**: React UI Components.
- **Application Layer**: Zustand FSM Stores managing UI business logic.
- **Primary Adapters (Inbound)**: Tauri Commands (`#[tauri::command]`) for IPC without raw business logic.
- **Core Domain**: Rust Crates containing ConversationRuntime, Session, PermissionPolicy, etc.
- **Secondary Adapters (Outbound)**: ToolExecutor, ApiClient, PermissionPrompter handling execution and external I/O.

## Concurrency
- Uses Tokio Actor Pattern (`ChatSessionActor`) to avoid blocking the main thread during heavy operations.
- Suspend & Resume mechanism utilized for permission grants (`TauriPermissionAdapter`) via `oneshot` channels.

## Presentation Logic
- Uses "Dumb Components" paired with Block Renderers (`TextBlock`, `TerminalBlock`, `FileDiffBlock`, `ToolExecutionBlock`).
- Eliminates giant switch-statements from React UI components.
