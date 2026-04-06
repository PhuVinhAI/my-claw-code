# Code Structure

## Primary Workspaces Folder Array

- `.planning/`: GSD and codebase orchestration artifacts.
- `claw-desktop/`:
  - `src/`: React UI code
    - `core/gateways/`: `IChatGateway.ts` definition
    - `adapters/tauri/`: `TauriChatGateway.ts` implementation
    - `store/`: Zustand definitions (`useChatStore.ts`, `chat.machine.ts`)
    - `ui/`: Component layout (blocks, features)
  - `src-tauri/`: Tauri build scaffolding and rust binding layer
- `rust/`: Systems backend code
  - `crates/api/`: LLM abstraction and streaming
  - `crates/commands/`: Slash commands logic
  - `crates/plugins/`: Hook runners and plugin extensions
  - `crates/runtime/`: Session orchestration and MCP protocols
  - `crates/tools/`: Tool implementation definitions
