# Active Concerns

## Porting Process Fragmentation
- Ongoing refactoring: `claw-desktop/src/App.tsx` contains legacy component-coupled logic and requires migration to `useChatStore` FSM definitions.
- Tauri IPC wiring is stubbed or partially implemented (`lib.rs` missing proper `ActorCommand` relay implementation).

## Error Handling
- Ensuring the Suspend/Resume (`oneshot` block) pattern used in `TauriPermissionAdapter` correctly accounts for timeout logic or unexpected failures to answer from the UI layer to avoid deadlocking the runtime worker.
