# Testing Strategy

## Core Backend Verification
- Use `cargo test --workspace` aggressively for system logic in crates.
- Run `cargo fmt` and `cargo clippy --workspace --all-targets -- -D warnings` on all backend layers before submitting PRs.

## Frontend Flexibility
- Testing is heavily mocked through dependency injection.
- UI test cases inject `MockChatGateway` adhering to `IChatGateway` as opposed to mocking Tauri internals.
- FSM pattern via Zustand enables deterministic testing of View states without backend wiring dependency.

## Parity
- Keep `src/` (Python parity) logically aligned when updating Rust core semantics to ensure compatibility is maintained across port phases.
