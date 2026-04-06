# Conventions

## Software Design
1. **Dependency Inversion**: High-level layers never depend on low-level interfaces. The UI calls Gatways, and Gateways interface with Tauri IPC.
2. **Strict FSM State**: Zustand stores are used structurally via a defined state machine (`ChatMachineState`), preventing accumulation of unstructured state.
3. **Actor Pattern Backend**: Never place business logic directly in Tauri commands; offload it onto Actors via MPSC buffers.

## Language Specifics
- **Rust**: Enforce `#![forbid(unsafe_code)]`. Use `clippy::pedantic` level for code quality. Exclude specific lints explicitly like `module_name_repetitions`.
- **TypeScript**: Rely on strictly typed DTOs matching Rust schema (`StreamEvent`, `Message`, `PermissionRequest`).

## GSD Processes
- Operate using GSD documentation workflow. State-tracking relies purely on outputs inside `.planning/`.
