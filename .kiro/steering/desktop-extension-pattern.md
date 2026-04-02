---
description: "Hướng dẫn pattern phát triển claw-desktop: KHÔNG sửa trực tiếp core/CLI, dùng extension pattern trong extensions/ để mở rộng functionality. Desktop phải tái sử dụng bánh xe có sẵn từ core, không reinvent."
---

# Desktop Extension Pattern

## Nguyên tắc quan trọng

Khi phát triển `claw-desktop`, TUYỆT ĐỐI tuân thủ các nguyên tắc sau:

### 1. KHÔNG SỬA TRỰC TIẾP VÀO CORE/CLI

- `rust/crates/runtime/` - Core runtime logic
- `rust/crates/claw-cli/` - CLI application
- `rust/crates/api/` - API client
- `rust/crates/plugins/` - Plugin system

**Lý do:**
- Core/CLI là "bánh xe có sẵn" - đã stable và tested
- Desktop phải tái sử dụng, không reinvent
- Mọi thay đổi vào core ảnh hưởng cả CLI

### 2. SỬ DỤNG EXTENSION PATTERN

Khi cần:
- **Thêm tính năng mới** cho desktop
- **Sửa đổi behavior** của core
- **Mở rộng functionality** 

**Quy trình:**

```
1. Tạo extension trong extensions/
   - Đặt tên rõ ràng: extensions/feature_name.rs
   - Document rõ problem + solution
   - Copy logic từ core nếu cần modify
   
2. Extension wraps hoặc extends core types
   - Implement same interface
   - Add callback/hook points
   - Delegate to core khi có thể
   
3. Desktop include extension
   - Import từ extensions/
   - Use extension thay vì core trực tiếp
   - Keep core imports minimal
```

### 3. CLEAN ARCHITECTURE TRONG DESKTOP

```
claw-desktop/src-tauri/src/
├── core/              # Business logic (domain)
│   ├── domain/        # Entities, value objects
│   ├── use_cases/     # Application services
│   └── ports/         # Interfaces (traits)
│
├── adapters/          # Infrastructure
│   ├── inbound/       # Tauri commands (controllers)
│   └── outbound/      # External services (API, storage)
│
└── setup/             # DI container, app initialization
```

**Dependency flow:**
```
Tauri Commands → Use Cases → Domain
                    ↓
                 Adapters (implement ports)
```

### 4. KHI NÀO DÙNG EXTENSION

#### ✅ Dùng extension khi:

1. **Cần real-time events** (như tool execution callbacks)
2. **Cần modify behavior** mà core không support
3. **Cần thêm hooks/callbacks** vào existing flow
4. **Desktop-specific features** (UI updates, notifications)

#### ❌ KHÔNG dùng extension khi:

1. Core đã có API phù hợp → dùng trực tiếp
2. Chỉ cần compose existing types → dùng wrapper
3. Pure UI logic → để trong React components

### 5. EXAMPLE: Real-time Tool Events

**Problem:**
- Core `ConversationRuntime::run_turn()` returns results sau khi ALL tools complete
- Desktop UI cần updates real-time: Tool 1 → Result 1 → Tool 2 → Result 2

**❌ Sai - Sửa trực tiếp core:**
```rust
// rust/crates/runtime/src/conversation.rs
impl ConversationRuntime {
    pub fn run_turn_with_callback(...) { // ← WRONG!
        // Modified core code
    }
}
```

**✅ Đúng - Tạo extension:**
```rust
// extensions/realtime_tool_events.rs
pub struct RealtimeConversationRuntime<C, T> {
    // Wraps core types
}

impl RealtimeConversationRuntime {
    pub fn run_turn_with_callback<F>(..., on_tool_result: F) {
        // Copy core logic + add callback
        // ...
        on_tool_result(&result_message); // ← Extension point
    }
}
```

**Desktop usage:**
```rust
// claw-desktop/src-tauri/src/core/use_cases/chat_actor.rs
use crate::extensions::realtime_tool_events::RealtimeConversationRuntime;

impl ChatSessionActor {
    fn handle_prompt(&mut self, text: String) {
        self.runtime.run_turn_with_callback(
            text,
            Some(&mut self.prompter),
            |tool_result| {
                // Emit event to UI immediately
                self.event_publisher.publish(...);
            }
        )
    }
}
```

### 6. EXTENSION STRUCTURE

```rust
// extensions/feature_name.rs

// 1. Document problem + solution
/// Extension: Feature Name
/// 
/// Problem: [Describe what core doesn't support]
/// Solution: [Describe extension approach]

// 2. Wrapper/Extended type
pub struct ExtendedType<C, T> {
    // Same fields as core type (if wrapping)
}

// 3. Implementation with extension points
impl ExtendedType {
    pub fn extended_method<F>(..., callback: F) {
        // Core logic (copied if needed)
        // + Extension points (callbacks, hooks)
    }
    
    // Delegate other methods to core
    pub fn core_method(&self) {
        // Call core implementation
    }
}

// 4. Helper functions (copy from core if private)
fn helper_function() {
    // Copied from core if needed
}
```

### 7. TESTING EXTENSIONS

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_extension_behavior() {
        // Test extension-specific functionality
        // Ensure core behavior is preserved
    }
}
```

### 8. DOCUMENTATION

Mỗi extension PHẢI có:
1. **Problem statement** - Tại sao cần extension
2. **Solution approach** - Cách giải quyết
3. **Core differences** - Khác gì với core
4. **Usage example** - Cách dùng trong desktop

## Checklist khi thêm feature mới

- [ ] Kiểm tra core/CLI đã có chưa?
- [ ] Nếu có → dùng trực tiếp, không reinvent
- [ ] Nếu cần modify → tạo extension trong `extensions/`
- [ ] Extension document rõ problem + solution
- [ ] Desktop import từ extension, không từ core
- [ ] Test extension behavior
- [ ] Update steering file này nếu cần pattern mới

## Anti-patterns cần tránh

❌ Sửa trực tiếp `rust/crates/runtime/`
❌ Copy-paste code từ core mà không document
❌ Tạo logic mới trong desktop khi core đã có
❌ Bypass clean architecture (UI → Database trực tiếp)
❌ Hardcode thay vì dùng DI container

## Khi nào được sửa core?

Chỉ khi:
1. Bug trong core ảnh hưởng cả CLI
2. Feature cần thiết cho CẢ CLI và Desktop
3. Refactor để expose API tốt hơn

→ Trong trường hợp này, tạo PR riêng cho core, test kỹ với CLI trước.
