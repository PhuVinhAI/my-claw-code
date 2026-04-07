# Race Condition Fix Plan

## Problem Summary
Khi user gửi prompt mới trong khi AI đang respond và nhấn Enter, race condition xảy ra:
- Cancel flag được reset quá sớm
- Tool execution từ turn cũ tiếp tục chạy
- Tool result không emit proper events
- UI state không sync với backend
- **UI message disappears**: User message biến mất nhưng AI vẫn chạy (MessageStop từ turn cũ xóa message của turn mới)

## Root Causes

### 1. Cancel Flag Reset Timing
**File**: `chat_actor.rs:253`
```rust
async fn handle_prompt(&mut self, text: String) {
    // ❌ Reset ngay đầu - tool từ turn cũ có thể đang chạy
    self.cancel_flag.store(false, std::sync::atomic::Ordering::Relaxed);
```

**Problem**: Tool execution check cancel_flag TRONG khi đang chạy. Nếu reset quá sớm, tool sẽ nghĩ là không bị cancel.

### 2. Async Command Race
**File**: `commands.rs:129-157`
- `cancel_prompt()` set flag + send Cancel command (async)
- `send_prompt()` send Prompt command (async)
- Không có synchronization giữa 2 commands
- Prompt command có thể đến Actor TRƯỚC Cancel command

### 3. Missing Tool Cancellation Events
**File**: `tool_executor.rs:189-195`
```rust
recv(self.cancel_rx) -> _ => {
    // ❌ Return error nhưng KHÔNG emit ToolResult event
    Err(ToolError::new("Tool execution cancelled by user".to_string()))
}
```

**Problem**: UI không biết tool đã cancelled → state machine stuck ở TOOL_EXECUTING

### 4. MessageStop Event Không Có Turn ID
**File**: `useChatStore.ts:754-790`
```typescript
case 'message_stop':
    // ❌ Không biết MessageStop này từ turn nào
    // Nếu là turn cũ → có thể xóa nhầm user message của turn mới
    if (!hasAssistantResponse && storeState.currentSessionId) {
        // Remove last user message from UI
    }
```

**Problem**: 
- Backend emit MessageStop cho turn cũ (sau khi cancel)
- UI nhận MessageStop → check "empty turn" → xóa user message
- Nhưng user message đó là của turn MỚI, không phải turn cũ
- Kết quả: User message biến mất, AI vẫn chạy

## Solution Strategy

### Phase 1: Add Turn ID to Events ✅
**Priority**: CRITICAL (prevents message disappearing)

1. Thêm `turn_id` vào tất cả stream events (text_delta, tool_use, tool_result, message_stop)
2. UI track `currentTurnId` - chỉ process events từ turn hiện tại
3. Ignore events từ turn cũ (cancelled turns)

**Files to modify**:
- `StreamEvent.ts` - Add turn_id to all event types
- `chat_actor.rs` - Include turn_id in all emitted events
- `useChatStore.ts` - Track currentTurnId, filter events by turn_id

### Phase 2: Fix Tool Cancellation Events ✅
**Priority**: HIGH (prevents UI stuck)

1. Thêm callback parameter vào `execute_with_context()` để emit events
2. Emit `ToolResult` event với `is_cancelled: true` khi tool bị cancel
3. Đảm bảo UI state machine chuyển về IDLE khi nhận cancelled event

**Files to modify**:
- `tool_executor.rs` - Add event emission on cancel
- `chat_actor.rs` - Pass event publisher to tool executor
- `runtime/src/lib.rs` - Update ToolExecutor trait (nếu cần)

### Phase 3: Synchronize Cancel and Prompt Commands ✅
**Priority**: HIGH (prevents race condition)

1. Đợi Cancel command hoàn thành TRƯỚC KHI accept Prompt command mới
2. Actor phải process Cancel command trước khi reset cancel_flag
3. Use turn_id để distinguish giữa các turns

**Files to modify**:
- `commands.rs` - Make cancel_prompt wait for completion
- `chat_actor.rs` - Ensure Cancel is processed before Prompt

### Phase 4: Improve Cancel Flag Management ✅
**Priority**: MEDIUM (defensive programming)

1. Chỉ reset cancel_flag SAU KHI đã confirm không còn tool nào đang chạy
2. Tool executor check cả cancel_flag VÀ turn_id

**Files to modify**:
- `chat_actor.rs` - Better cancel flag management
- `tool_executor.rs` - Add turn_id checking

## Implementation Checklist

- [ ] Phase 1: Add Turn ID to Events (CRITICAL - prevents message disappearing)
  - [ ] Add `turn_id: String` to StreamEvent types
  - [ ] Modify `chat_actor.rs` to include turn_id in all events
  - [ ] Add `currentTurnId` to useChatStore
  - [ ] Filter events by turn_id in event handlers
  - [ ] Test: Cancel → new prompt → verify old events ignored
  
- [ ] Phase 2: Tool Cancellation Events
  - [ ] Modify `TauriToolExecutor::execute_with_context()` to emit cancel event
  - [ ] Test: Cancel tool → verify UI receives event → state goes to IDLE
  
- [ ] Phase 3: Command Synchronization
  - [ ] Make `cancel_prompt()` wait for Actor to process Cancel
  - [ ] Add barrier/lock to prevent Prompt during Cancel
  - [ ] Test: Cancel → immediate new prompt → verify no race
  
- [ ] Phase 4: Cancel Flag Management
  - [ ] Reset cancel_flag only after confirming no running tools
  - [ ] Test: Multiple rapid cancel/prompt cycles

## Testing Strategy

1. **Manual Test**: Reproduce original bug
   - Send prompt
   - While AI responding, type new message and press Enter
   - Verify: No race, UI updates correctly, no stuck state

2. **Stress Test**: Rapid cancel/prompt cycles
   - Send prompt → cancel → send prompt → cancel (repeat 10x)
   - Verify: No crashes, state always consistent

3. **Tool Execution Test**: Cancel during long-running tool
   - Send prompt that triggers bash tool with sleep
   - Cancel during sleep
   - Verify: Tool stops, event emitted, UI goes to IDLE

## Notes

- Cần careful với thread safety - cancel_flag là AtomicBool shared giữa nhiều threads
- Event emission phải happen TRƯỚC KHI return từ tool executor
- UI state machine phải handle cancelled tools correctly (đã có logic trong chat.machine.ts)
