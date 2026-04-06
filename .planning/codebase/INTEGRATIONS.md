# Integrations

## External LLM APIs
- **Providers**: OpenAI, Anthropic, X.ai, and custom API endpoints via `api-client` crate.
- **Protocol**: SSE (Server-Sent Events) for streaming responses in real-time.

## System Integrations
- **File System**: Rust handles native file operations (`read_file`, `write_file`, `edit_file`) executing securely via `tools`.
- **Shell**: Bash command execution sandboxed by Rust.
- **MCP (Model Context Protocol)**: Outbound adapter in the domain layer integrates with external MCP servers for context sharing.

## Tauri IPC
- Custom UI bindings use `__TAURI__` internals.
- Handled via `TauriChatGateway` adhering to `IChatGateway` to provide a decoupled adapter.
