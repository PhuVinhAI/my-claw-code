---
description: "Desktop PHẢI dùng lại core. KHÔNG duplicate code. Khi cần feature mới có thể share → thêm vào core."
---

# Desktop: Reuse Core

## Nguyên Tắc

**Desktop = Core + Platform Adapters**

KHÔNG: Desktop = Core + Duplicate Code

## Core Crates

```
rust/crates/
├── runtime/     # Conversation, permissions, hooks
├── api/         # API client, message conversion  
├── tools/       # Tool registry
├── commands/    # Slash commands
└── plugins/     # Plugin system
```

Desktop PHẢI dùng từ core. KHÔNG tự code lại.

## Rules

### ✅ LUÔN dùng từ core:
- Core đã có logic → Import và dùng
- Logic có thể share → Phải ở core

### ❌ KHÔNG BAO GIỜ:
- Copy-paste từ core/CLI
- Tự implement lại logic core đã có
- Tạo "desktop version" của core types

### 🔧 Khi cần feature mới:
1. Core chưa có + có thể share → Thêm vào core
2. Chỉ desktop dùng → Implement trong adapter layer

## Anti-Patterns

### ❌ #1: Duplicate Functions
```rust
// SAI - Desktop tự code
fn convert_messages(...) { /* giống CLI */ }
```
**Fix:** Export từ core, desktop import

### ❌ #2: Duplicate Types  
```rust
// SAI - Desktop tạo wrapper
struct DesktopConversationRuntime { /* duplicate core */ }
```
**Fix:** Dùng `ConversationRuntime` từ core

### ❌ #3: Inconsistent Logic
```rust
// SAI - Desktop: 8192, CLI: 64000
```
**Fix:** Centralize trong core

## Good Patterns

### ✅ Platform Adapters
```rust
// ĐÚNG - Implement trait từ core
impl PermissionPrompter for TauriPermissionAdapter {
    // Desktop-specific: UI modal
}
```

### ✅ Shared Utilities
```rust
// ĐÚNG - Dùng từ core
use api::convert_runtime_messages;
use runtime::ConversationRuntime;
```

### ✅ Core Feature với Callback
```rust
// ĐÚNG - Thêm vào core nếu có thể share
impl ConversationRuntime {
    pub fn run_turn_with_callback<F>(..., on_tool_result: F) {
        // Desktop dùng callback để emit events
    }
}
```

## Checklist

Trước khi code:
- [ ] Core đã có? → Dùng từ core
- [ ] Code giống CLI 80%+? → STOP! Dùng từ core
- [ ] Logic có thể share? → Phải ở core
- [ ] Đang duplicate? → STOP! Refactor

## Red Flags 🚩

- Code giống CLI → Dùng từ core
- Copy-paste → Export từ core  
- "Desktop version" → Dùng core type
- Inconsistent với CLI → Centralize

## Green Lights 🟢

- Implement trait từ core (adapters)
- Platform-specific UI/infra
- Compose core types
- Thêm feature vào core (nếu có thể share)
