# KIẾN TRÚC CHÉN THÁNH (HOLY GRAIL ARCHITECTURE)
## CLAW DESKTOP - TÀI LIỆU KIẾN TRÚC CHUẨN

> **Nguyên tắc tối thượng:** Dependency Inversion (Đảo ngược phụ thuộc)  
> Các lớp cấp thấp (UI, Network, IPC) phải phụ thuộc vào các lớp cấp cao (Nghiệp vụ), không có chiều ngược lại.

---

## MỤC LỤC

1. [Tổng quan Kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Backend Architecture (Rust + Tauri)](#2-backend-architecture-rust--tauri)
3. [Frontend Architecture (React + TypeScript)](#3-frontend-architecture-react--typescript)
4. [Core Runtime Crates](#4-core-runtime-crates)
5. [Luồng Kiến trúc Tổng hợp](#5-luồng-kiến-trúc-tổng-hợp)
6. [Design Patterns Cốt lõi](#6-design-patterns-cốt-lõi)
7. [Cấu trúc Thư mục Chuẩn](#7-cấu-trúc-thư-mục-chuẩn)

---

## 1. TỔNG QUAN KIẾN TRÚC

### 1.1. Phân tầng Hexagonal (Lục giác)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│              (React UI - View Components)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│         (Zustand Stores - State Management FSM)              │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              PRIMARY ADAPTERS (Inbound)                      │
│    Tauri Gateway (IChatGateway) - IPC Communication          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    DOMAIN LAYER                              │
│    ConversationRuntime, Session, PermissionPolicy            │
│         (Core Business Logic - Rust Crates)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│             SECONDARY ADAPTERS (Outbound)                    │
│   ToolExecutor, ApiClient, PermissionPrompter                │
└─────────────────────────────────────────────────────────────┘
```

### 1.2. Các Ranh giới Kiến trúc (Boundaries)

| Ranh giới | Mô tả | Bảo vệ bởi |
|-----------|-------|------------|
| **UI ↔ State** | React Components không gọi trực tiếp Tauri | Zustand Store |
| **State ↔ IPC** | Store không biết về Tauri API | IChatGateway Interface |
| **IPC ↔ Backend** | Tauri Commands không chứa logic nghiệp vụ | Actor Pattern + MPSC |
| **Backend ↔ Tools** | Runtime không biết chi tiết Tool | ToolExecutor Trait |
| **Backend ↔ API** | Runtime không biết Provider | ApiClient Trait |

---

## 2. BACKEND ARCHITECTURE (RUST + TAURI)

### 2.1. Phân mảnh theo Hexagonal


**Core Domain (Đã có ở rust/crates/):**
- `ConversationRuntime` - Điều phối vòng đời hội thoại
- `Session` - Quản lý lịch sử tin nhắn
- `ToolExecutor` - Thực thi công cụ
- `PermissionPolicy` - Chính sách phân quyền

**Application Service (Use Cases):**
- Quản lý vòng đời phiên Chat trên Desktop
- Xử lý đa luồng (Concurrency) để không block UI
- Điều phối giữa API Client và Tool Executor

**Primary Adapters (Inbound - Cổng vào):**
- Tauri Commands (`#[tauri::command]`)
- Nhận tín hiệu từ UI và kích hoạt Use Case
- Không chứa logic nghiệp vụ

**Secondary Adapters (Outbound - Cổng ra):**
- Tauri Event Emitter (đẩy stream về UI)
- Custom Permission Prompter (treo luồng để hỏi UI)
- MCP Client Transport (giao tiếp với MCP servers)

### 2.2. Design Pattern: Actor Pattern

**Vấn đề:** Không bao giờ đặt logic chạy LLM trực tiếp trong Tauri Command → Block luồng chính

**Giải pháp:**

```rust
// ChatSessionActor chạy trên tokio::task độc lập
pub struct ChatSessionActor {
    runtime: ConversationRuntime<ApiClient, ToolExecutor>,
    inbox: mpsc::Receiver<ActorCommand>,
    event_publisher: Arc<dyn IEventPublisher>,
}

pub enum ActorCommand {
    Prompt { text: String, response_tx: oneshot::Sender<Result<()>> },
    Cancel,
    GrantPermission { request_id: String, allow: bool },
}

impl ChatSessionActor {
    pub async fn run(mut self) {
        while let Some(command) = self.inbox.recv().await {
            match command {
                ActorCommand::Prompt { text, response_tx } => {
                    let result = self.handle_prompt(text).await;
                    let _ = response_tx.send(result);
                }
                ActorCommand::Cancel => self.handle_cancel(),
                ActorCommand::GrantPermission { request_id, allow } => {
                    self.handle_permission(request_id, allow);
                }
            }
        }
    }
}
```

**Lợi ích:**
- State của `ConversationRuntime` không cần Mutex/RwLock
- Tauri Commands trả về ngay lập tức (Return fast)
- Tách biệt hoàn toàn luồng UI và luồng xử lý AI

### 2.3. Design Pattern: Suspend & Resume (Cấp quyền)

**Vấn đề:** `PermissionPrompter::decide()` là đồng bộ nhưng cần hỏi UI bất đồng bộ

**Giải pháp:**

```rust
pub struct TauriPermissionAdapter {
    pending_requests: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    app_handle: AppHandle,
}

impl PermissionPrompter for TauriPermissionAdapter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        
        // Lưu sender để Tauri Command có thể trả lời sau
        self.pending_requests.lock().unwrap().insert(request_id.clone(), tx);
        
        // Bắn event ra Frontend
        self.app_handle.emit("permission_requested", PermissionEvent {
            request_id: request_id.clone(),
            tool_name: request.tool_name.clone(),
            input: request.input.clone(),
        }).unwrap();
        
        // ĐÌNH CHỈ luồng hiện tại, chờ UI trả lời
        match rx.blocking_recv() {
            Ok(true) => PermissionPromptDecision::Allow,
            Ok(false) | Err(_) => PermissionPromptDecision::Deny {
                reason: "User denied".to_string()
            },
        }
    }
}
```

**Luồng hoạt động:**
1. Runtime gọi `decide()` → Adapter tạo oneshot channel
2. Adapter bắn Tauri Event → Frontend hiển thị modal
3. Adapter gọi `blocking_recv()` → Luồng ngủ
4. User click "Allow" → Tauri Command gửi `true` vào channel
5. Adapter tỉnh dậy → Trả về `Allow` → Tool chạy tiếp

### 2.4. Hiện trạng Code (Cần Refactor)

**File hiện tại:** `claw-desktop/src-tauri/src/lib.rs`

```rust
// ❌ CHƯA ĐÚNG: Chỉ có command mẫu
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

**Cần triển khai:**


```rust
// ✅ ĐÚNG: Commands gọi Actor thông qua MPSC
#[tauri::command]
async fn send_prompt(
    text: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();
    state.actor_tx.send(ActorCommand::Prompt { text, response_tx: tx })
        .await
        .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn answer_permission(
    request_id: String,
    allow: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.actor_tx.send(ActorCommand::GrantPermission { request_id, allow })
        .await
        .map_err(|e| e.to_string())
}
```

---

## 3. FRONTEND ARCHITECTURE (REACT + TYPESCRIPT)

### 3.1. Phân mảnh theo Hexagonal

**Entities (Frontend Rep):**
- TypeScript types: `Message`, `StreamEvent`, `ToolCall`, `PermissionRequest`

**Use Cases (State Management):**
- Zustand Store quản lý FSM (Finite State Machine)
- Xử lý luồng stream từ Backend
- Điều phối UI state transitions

**Outbound Ports:**
- `IChatGateway` - Interface định nghĩa cách gọi Backend

**Outbound Adapters:**
- `TauriChatGateway` - Implement `IChatGateway` dùng `@tauri-apps/api`

**View Layer:**
- React Components hook vào Zustand Store
- Tự động re-render khi state thay đổi


### 3.2. Design Pattern: Gateway / Facade (Anti-Corruption Layer)

**Vấn đề:** UI gọi trực tiếp `invoke()` → Khó test, khó thay đổi provider

**Giải pháp:**

```typescript
// core/gateways/IChatGateway.ts
export interface IChatGateway {
  sendPrompt(text: string): Promise<void>;
  approvePermission(requestId: string, allow: boolean): Promise<void>;
  onStreamEvent(callback: (event: StreamEvent) => void): UnsubscribeFn;
  onPermissionRequest(callback: (request: PermissionRequest) => void): UnsubscribeFn;
}

// adapters/tauri/tauri-chat.gateway.ts
export class TauriChatGateway implements IChatGateway {
  async sendPrompt(text: string): Promise<void> {
    await invoke('send_prompt', { text });
  }

  async approvePermission(requestId: string, allow: boolean): Promise<void> {
    await invoke('answer_permission', { requestId, allow });
  }

  onStreamEvent(callback: (event: StreamEvent) => void): UnsubscribeFn {
    return listen('stream_event', (event) => {
      callback(event.payload as StreamEvent);
    });
  }

  onPermissionRequest(callback: (request: PermissionRequest) => void): UnsubscribeFn {
    return listen('permission_requested', (event) => {
      callback(event.payload as PermissionRequest);
    });
  }
}
```

**Lợi ích:**
- UI không biết về Tauri
- Dễ dàng tạo `MockChatGateway` cho testing
- Có thể chuyển sang Web version bằng cách implement `WebSocketChatGateway`


### 3.3. Design Pattern: Strict Finite State Machine

**Vấn đề:** Zustand thường trở thành "thùng rác" chứa biến

**Giải pháp:**

```typescript
// store/chat.machine.ts
export type ChatMachineState =
  | { status: 'IDLE' }
  | { status: 'GENERATING' }
  | { status: 'TOOL_EXECUTING'; toolName: string; toolInput: string }
  | { status: 'AWAITING_PERMISSION'; request: PermissionRequest };

export type ChatEvent =
  | { type: 'USER_SENT_PROMPT'; text: string }
  | { type: 'STREAM_TEXT_DELTA'; delta: string }
  | { type: 'STREAM_TOOL_USE'; toolName: string; toolInput: string }
  | { type: 'PERMISSION_REQUESTED'; request: PermissionRequest }
  | { type: 'PERMISSION_ANSWERED'; allow: boolean }
  | { type: 'MESSAGE_STOP' };

export function chatReducer(
  state: ChatMachineState,
  event: ChatEvent
): ChatMachineState {
  switch (state.status) {
    case 'IDLE':
      if (event.type === 'USER_SENT_PROMPT') {
        return { status: 'GENERATING' };
      }
      throw new Error(`Invalid transition: ${state.status} + ${event.type}`);

    case 'GENERATING':
      if (event.type === 'STREAM_TOOL_USE') {
        return {
          status: 'TOOL_EXECUTING',
          toolName: event.toolName,
          toolInput: event.toolInput,
        };
      }
      if (event.type === 'MESSAGE_STOP') {
        return { status: 'IDLE' };
      }
      return state; // Text delta không thay đổi state

    case 'TOOL_EXECUTING':
      if (event.type === 'PERMISSION_REQUESTED') {
        return { status: 'AWAITING_PERMISSION', request: event.request };
      }
      if (event.type === 'MESSAGE_STOP') {
        return { status: 'IDLE' };
      }
      return state;

    case 'AWAITING_PERMISSION':
      if (event.type === 'PERMISSION_ANSWERED') {
        return { status: 'GENERATING' };
      }
      return state;

    default:
      return state;
  }
}
```


**Zustand Store:**

```typescript
// store/useChatStore.ts
interface ChatStore {
  state: ChatMachineState;
  messages: Message[];
  gateway: IChatGateway;
  
  dispatch: (event: ChatEvent) => void;
  sendPrompt: (text: string) => Promise<void>;
  answerPermission: (allow: boolean) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  state: { status: 'IDLE' },
  messages: [],
  gateway: new TauriChatGateway(), // Inject ở đây

  dispatch: (event) => {
    set((prev) => ({
      state: chatReducer(prev.state, event),
    }));
  },

  sendPrompt: async (text) => {
    const { gateway, dispatch } = get();
    dispatch({ type: 'USER_SENT_PROMPT', text });
    await gateway.sendPrompt(text);
  },

  answerPermission: async (allow) => {
    const { gateway, dispatch, state } = get();
    if (state.status !== 'AWAITING_PERMISSION') return;
    
    await gateway.approvePermission(state.request.id, allow);
    dispatch({ type: 'PERMISSION_ANSWERED', allow });
  },
}));

// Khởi tạo listeners khi app mount
export function initializeChatStore() {
  const { gateway, dispatch } = useChatStore.getState();

  gateway.onStreamEvent((event) => {
    if (event.type === 'text_delta') {
      dispatch({ type: 'STREAM_TEXT_DELTA', delta: event.delta });
    } else if (event.type === 'tool_use') {
      dispatch({ type: 'STREAM_TOOL_USE', toolName: event.name, toolInput: event.input });
    } else if (event.type === 'message_stop') {
      dispatch({ type: 'MESSAGE_STOP' });
    }
  });

  gateway.onPermissionRequest((request) => {
    dispatch({ type: 'PERMISSION_REQUESTED', request });
  });
}
```


### 3.4. Design Pattern: Component Strategy (Render Blocks)

**Vấn đề:** Tin nhắn phức tạp (Text, Bash, File, Error) → Switch-case khổng lồ trong JSX

**Giải pháp:**

```typescript
// ui/blocks/index.ts
import { TextBlock } from './TextBlock';
import { TerminalBlock } from './TerminalBlock';
import { FileDiffBlock } from './FileDiffBlock';
import { ToolExecutionBlock } from './ToolExecutionBlock';

export const BlockRendererStrategy: Record<string, React.FC<any>> = {
  text: TextBlock,
  bash: TerminalBlock,
  file_diff: FileDiffBlock,
  tool_use: ToolExecutionBlock,
};

// ui/features/MessageList.tsx
export function MessageList() {
  const messages = useChatStore((s) => s.messages);

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.blocks.map((block, idx) => {
            const BlockComponent = BlockRendererStrategy[block.type];
            if (!BlockComponent) {
              console.warn(`Unknown block type: ${block.type}`);
              return null;
            }
            return <BlockComponent key={idx} {...block} />;
          })}
        </div>
      ))}
    </div>
  );
}
```

**Lợi ích:**
- Thêm block type mới chỉ cần thêm vào Map
- Mỗi Block Component là Dumb Component, dễ test
- Không có logic điều kiện phức tạp trong JSX

### 3.5. Hiện trạng Code (Cần Refactor)

**File hiện tại:** `claw-desktop/src/App.tsx`

```tsx
// ❌ CHƯA ĐÚNG: Logic trộn lẫn trong component
function App() {
  const [messages, setMessages] = useState([...]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    // Logic xử lý trực tiếp trong component
    setMessages([...messages, { role: "user", content: input }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "..." }]);
    }, 500);
  };
  // ...
}
```


**Cần triển khai:**

```tsx
// ✅ ĐÚNG: Component chỉ hook vào Store
function App() {
  const { state, messages, sendPrompt } = useChatStore();
  const [input, setInput] = useState("");

  useEffect(() => {
    initializeChatStore(); // Khởi tạo listeners
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendPrompt(input);
    setInput("");
  };

  return (
    <div>
      <MessageList />
      {state.status === 'AWAITING_PERMISSION' && (
        <PermissionModal request={state.request} />
      )}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={state.status !== 'IDLE'}
      />
    </div>
  );
}
```

---

## 4. CORE RUNTIME CRATES

### 4.1. Crate: `runtime`

**Trách nhiệm:**
- Điều phối vòng đời hội thoại (`ConversationRuntime`)
- Quản lý session và lịch sử tin nhắn (`Session`)
- Chính sách phân quyền (`PermissionPolicy`, `PermissionPrompter`)
- Thực thi công cụ (`ToolExecutor` trait)
- Tích hợp MCP (Model Context Protocol)
- File operations (read, write, edit, search)
- Bash execution với sandbox

**Các Module chính:**


```rust
// conversation.rs - Lõi điều phối
pub struct ConversationRuntime<C, T> {
    session: Session,
    api_client: C,              // Trait ApiClient
    tool_executor: T,           // Trait ToolExecutor
    permission_policy: PermissionPolicy,
    system_prompt: Vec<String>,
    max_iterations: usize,
    hook_runner: HookRunner,
}

impl<C: ApiClient, T: ToolExecutor> ConversationRuntime<C, T> {
    pub fn run_turn(
        &mut self,
        user_input: String,
        prompter: Option<&mut dyn PermissionPrompter>,
    ) -> Result<TurnSummary, RuntimeError> {
        // 1. Thêm user message vào session
        // 2. Loop: Gọi API → Nhận tool_use → Xin phép → Thực thi → Lặp lại
        // 3. Trả về summary với usage tracking
    }
}

// permissions.rs - Hệ thống phân quyền
pub enum PermissionMode {
    ReadOnly,           // Chỉ đọc file
    WorkspaceWrite,     // Ghi trong workspace
    DangerFullAccess,   // Toàn quyền (bash, delete)
    Prompt,             // Hỏi từng lần
    Allow,              // Cho phép tất cả
}

pub trait PermissionPrompter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision;
}

// session.rs - Lưu trữ hội thoại
pub struct Session {
    pub version: u32,
    pub messages: Vec<ConversationMessage>,
}

// file_ops.rs - Thao tác file
pub fn read_file(path: &str, offset: Option<usize>, limit: Option<usize>) -> io::Result<ReadFileOutput>;
pub fn write_file(path: &str, content: &str) -> io::Result<WriteFileOutput>;
pub fn edit_file(path: &str, hunks: Vec<StructuredPatchHunk>) -> io::Result<EditFileOutput>;
pub fn grep_search(input: GrepSearchInput) -> io::Result<GrepSearchOutput>;

// bash.rs - Thực thi lệnh
pub fn execute_bash(input: BashCommandInput) -> io::Result<BashCommandOutput>;
```


### 4.2. Crate: `api`

**Trách nhiệm:**
- Trừu tượng hóa các LLM providers (Claw API, OpenAI, X.ai)
- Streaming SSE (Server-Sent Events)
- OAuth authentication
- Token management

**Các Module chính:**

```rust
// client.rs - Provider abstraction
pub enum ProviderClient {
    ClawApi(ClawApiClient),
    Xai(OpenAiCompatClient),
    OpenAi(OpenAiCompatClient),
}

impl ProviderClient {
    pub async fn stream_message(&self, request: &MessageRequest) -> Result<MessageStream, ApiError>;
}

// sse.rs - SSE Parser
pub struct SseParser {
    buffer: Vec<u8>,
}

impl SseParser {
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<StreamEvent>, ApiError>;
}

// types.rs - API Types
pub struct MessageRequest {
    pub model: String,
    pub messages: Vec<InputMessage>,
    pub tools: Vec<ToolDefinition>,
    pub max_tokens: u32,
}

pub enum StreamEvent {
    MessageStart(MessageStartEvent),
    ContentBlockStart(ContentBlockStartEvent),
    ContentBlockDelta(ContentBlockDeltaEvent),
    ContentBlockStop(ContentBlockStopEvent),
    MessageDelta(MessageDeltaEvent),
    MessageStop(MessageStopEvent),
}
```

### 4.3. Crate: `plugins`

**Trách nhiệm:**
- Plugin registry và lifecycle
- Hook system (pre/post tool execution)
- Plugin manifest parsing
- Tool và command registration


```rust
// lib.rs - Plugin Registry
pub struct PluginRegistry {
    plugins: Vec<PluginMetadata>,
}

impl PluginRegistry {
    pub fn aggregated_hooks(&self) -> Result<PluginHooks, PluginError>;
}

// hooks.rs - Hook Runner
pub struct HookRunner {
    hooks: PluginHooks,
}

impl HookRunner {
    pub fn run_pre_tool_use(&self, tool_name: &str, tool_input: &str) -> HookRunResult;
    pub fn run_post_tool_use(&self, tool_name: &str, tool_input: &str, tool_output: &str, is_error: bool) -> HookRunResult;
}

pub struct HookRunResult {
    denied: bool,
    messages: Vec<String>,
}
```

### 4.4. Crate: `tools`

**Trách nhiệm:**
- Tool manifest registry
- Tool definition và schema
- Built-in tools (bash, read_file, write_file, etc.)

### 4.5. Crate: `commands`

**Trách nhiệm:**
- Slash command registry
- Command parsing và execution

---

## 5. LUỒNG KIẾN TRÚC TỔNG HỢP

### 5.1. Use Case: User gửi prompt "Xóa file log" (Cần cấp quyền)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. [React UI] User gõ "Xóa file log" → Nhấn Enter               │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 2. [Zustand Store] FSM: IDLE → GENERATING                        │
│    Gọi: gateway.sendPrompt("Xóa file log")                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 3. [TauriChatGateway] invoke('send_prompt', { text: "..." })    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 4. [Tauri Command] Nhận IPC, gửi ActorCommand::Prompt vào MPSC  │
│    Trả về ngay (non-blocking)                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 5. [ChatSessionActor] Nhận message từ inbox                      │
│    Gọi: runtime.run_turn("Xóa file log", Some(&mut prompter))   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 6. [ConversationRuntime] Gọi api_client.stream(request)         │
│    LLM trả về: tool_use { name: "bash", input: "rm *.log" }     │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 7. [Runtime] Kiểm tra permission_policy.authorize("bash", ...)  │
│    → Cần DangerFullAccess nhưng đang ở WorkspaceWrite           │
│    → Gọi prompter.decide(request)                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 8. [TauriPermissionAdapter]                                      │
│    - Tạo oneshot channel (tx, rx)                                │
│    - Lưu tx vào pending_requests                                 │
│    - Emit event: "permission_requested"                          │
│    - Gọi rx.blocking_recv() → ĐÌNH CHỈ luồng Actor              │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 9. [TauriChatGateway] Bắt event "permission_requested"          │
│    Gọi callback → Dispatch event vào Zustand Store               │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 10. [Zustand Store] FSM: GENERATING → AWAITING_PERMISSION       │
│     state.request = { tool: "bash", input: "rm *.log" }         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 11. [React UI] Component re-render, hiển thị PermissionModal    │
│     Hiển thị: "Bash muốn chạy: rm *.log" [Deny] [Allow]         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 12. [React UI] User nhấn "Deny"                                  │
│     Gọi: store.answerPermission(false)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 13. [Zustand Store] FSM: AWAITING_PERMISSION → GENERATING       │
│     Gọi: gateway.approvePermission(requestId, false)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 14. [TauriChatGateway] invoke('answer_permission', {...})       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 15. [Tauri Command] Lấy tx từ pending_requests                   │
│     Gửi false vào channel: tx.send(false)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 16. [TauriPermissionAdapter] rx.blocking_recv() nhận false      │
│     Trả về: PermissionPromptDecision::Deny                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 17. [Runtime] Tool bị chặn, ghi vào session:                     │
│     tool_result { error: "Permission denied" }                   │
│     Gọi lại LLM với kết quả này                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 18. [LLM] Trả về text: "Tôi không được phép xóa file log"       │
│     Runtime emit stream events về Frontend                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 19. [Zustand Store] Nhận text_delta events, cập nhật messages   │
│     Nhận message_stop → FSM: GENERATING → IDLE                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│ 20. [React UI] Re-render, hiển thị tin nhắn từ Assistant        │
│     PermissionModal đóng lại                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Kết luận:** Kiến trúc này cô lập hoàn toàn sự phức tạp. Mỗi lớp có thể test độc lập bằng cách mock các Ports.

---

## 6. DESIGN PATTERNS CỐT LÕI

### 6.1. Dependency Inversion Principle (DIP)

```
High-level modules (ConversationRuntime) không phụ thuộc vào low-level modules (TauriEventEmitter).
Cả hai phụ thuộc vào abstractions (IEventPublisher trait).
```

**Ví dụ:**

```rust
// ❌ SAI: Runtime phụ thuộc trực tiếp vào Tauri
impl ConversationRuntime {
    fn emit_event(&self, event: StreamEvent) {
        self.app_handle.emit("stream_event", event).unwrap();
    }
}

// ✅ ĐÚNG: Runtime phụ thuộc vào trait
pub trait IEventPublisher: Send + Sync {
    fn publish(&self, event: StreamEvent);
}

impl ConversationRuntime<C, T, P: IEventPublisher> {
    fn emit_event(&self, event: StreamEvent) {
        self.publisher.publish(event);
    }
}

// Adapter implement trait
pub struct TauriEventPublisher {
    app_handle: AppHandle,
}

impl IEventPublisher for TauriEventPublisher {
    fn publish(&self, event: StreamEvent) {
        self.app_handle.emit("stream_event", event).unwrap();
    }
}
```


### 6.2. Repository Pattern (Session Persistence)

```rust
pub trait ISessionRepository {
    fn load(&self, session_id: &str) -> Result<Session, SessionError>;
    fn save(&self, session_id: &str, session: &Session) -> Result<(), SessionError>;
}

pub struct FileSessionRepository {
    base_path: PathBuf,
}

impl ISessionRepository for FileSessionRepository {
    fn load(&self, session_id: &str) -> Result<Session, SessionError> {
        let path = self.base_path.join(format!("{}.json", session_id));
        let content = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&content)?)
    }

    fn save(&self, session_id: &str, session: &Session) -> Result<(), SessionError> {
        let path = self.base_path.join(format!("{}.json", session_id));
        let content = serde_json::to_string_pretty(session)?;
        fs::write(path, content)?;
        Ok(())
    }
}
```

### 6.3. Strategy Pattern (Tool Execution)

```rust
pub trait ToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError>;
}

pub struct StaticToolExecutor {
    tools: HashMap<String, Box<dyn Fn(&str) -> Result<String, ToolError>>>,
}

impl ToolExecutor for StaticToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        let tool = self.tools.get(tool_name)
            .ok_or_else(|| ToolError::new(format!("Unknown tool: {}", tool_name)))?;
        tool(input)
    }
}
```

### 6.4. Observer Pattern (Event Streaming)

```typescript
// Frontend subscribe vào Backend events
export function initializeChatStore() {
  const { gateway, dispatch } = useChatStore.getState();

  // Observer 1: Stream events
  gateway.onStreamEvent((event) => {
    dispatch(mapStreamEventToAction(event));
  });

  // Observer 2: Permission requests
  gateway.onPermissionRequest((request) => {
    dispatch({ type: 'PERMISSION_REQUESTED', request });
  });

  // Observer 3: Errors
  gateway.onError((error) => {
    dispatch({ type: 'ERROR_OCCURRED', error });
  });
}
```


### 6.5. Command Pattern (Actor Messages)

```rust
pub enum ActorCommand {
    Prompt {
        text: String,
        response_tx: oneshot::Sender<Result<TurnSummary, RuntimeError>>,
    },
    Cancel,
    GrantPermission {
        request_id: String,
        allow: bool,
    },
    LoadSession {
        session_id: String,
    },
    SaveSession,
}
```

---

## 7. CẤU TRÚC THƯ MỤC CHUẨN

### 7.1. Backend (Tauri)

```
claw-desktop/src-tauri/
├── src/
│   ├── core/                       # Domain Layer (không phụ thuộc Tauri)
│   │   ├── domain/
│   │   │   ├── mod.rs
│   │   │   ├── types.rs           # Wrapper types từ runtime crate
│   │   │   └── events.rs          # Domain events
│   │   └── use_cases/
│   │       ├── mod.rs
│   │       ├── chat_actor.rs      # Actor pattern implementation
│   │       └── ports.rs           # Trait definitions (IEventPublisher, etc.)
│   │
│   ├── adapters/                   # Adapter Layer
│   │   ├── inbound/               # Primary Adapters (UI → Backend)
│   │   │   ├── mod.rs
│   │   │   ├── commands.rs        # Tauri commands
│   │   │   └── dtos.rs            # Data Transfer Objects
│   │   └── outbound/              # Secondary Adapters (Backend → External)
│   │       ├── mod.rs
│   │       ├── tauri_publisher.rs # Implement IEventPublisher
│   │       ├── tauri_prompter.rs  # Implement PermissionPrompter
│   │       └── file_repository.rs # Implement ISessionRepository
│   │
│   ├── setup/                      # Application Setup
│   │   ├── mod.rs
│   │   ├── di_container.rs        # Dependency Injection
│   │   └── app_state.rs           # Tauri State Management
│   │
│   ├── lib.rs                      # Library entry point
│   └── main.rs                     # Binary entry point
│
├── Cargo.toml
└── tauri.conf.json
```


### 7.2. Frontend (React)

```
claw-desktop/src/
├── core/                           # Domain Layer (không phụ thuộc React/Tauri)
│   ├── entities/
│   │   ├── index.ts
│   │   ├── Message.ts             # Message entity
│   │   ├── StreamEvent.ts         # Stream event types
│   │   ├── PermissionRequest.ts   # Permission request types
│   │   └── ToolCall.ts            # Tool call types
│   └── gateways/
│       ├── index.ts
│       └── IChatGateway.ts        # Gateway interface (Port)
│
├── store/                          # Application Layer (State Management)
│   ├── index.ts
│   ├── chat.machine.ts            # FSM logic (reducer)
│   ├── useChatStore.ts            # Zustand store
│   └── types.ts                   # Store types
│
├── adapters/                       # Adapter Layer
│   └── tauri/
│       ├── index.ts
│       ├── tauri-chat.gateway.ts  # Implement IChatGateway
│       └── tauri-events.ts        # Tauri event listeners
│
├── ui/                             # Presentation Layer
│   ├── blocks/                    # Strategy Pattern Components
│   │   ├── index.ts               # BlockRendererStrategy Map
│   │   ├── TextBlock.tsx
│   │   ├── TerminalBlock.tsx
│   │   ├── ToolExecutionBlock.tsx
│   │   └── FileDiffBlock.tsx
│   │
│   ├── features/                  # Smart Components (Connected to Store)
│   │   ├── ChatThread.tsx
│   │   ├── ChatInput.tsx
│   │   ├── PermissionModal.tsx
│   │   └── MessageList.tsx
│   │
│   └── shared/                    # Dumb Components (shadcn/ui)
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       └── ...
│
├── lib/
│   └── utils.ts                   # Utility functions
│
├── App.tsx                         # Root component
├── main.tsx                        # Entry point
└── index.css                       # Global styles
```


### 7.3. Core Crates (Rust Workspace)

```
rust/crates/
├── runtime/                        # Core business logic
│   ├── src/
│   │   ├── conversation.rs        # ConversationRuntime
│   │   ├── session.rs             # Session management
│   │   ├── permissions.rs         # Permission system
│   │   ├── bash.rs                # Bash execution
│   │   ├── file_ops.rs            # File operations
│   │   ├── mcp.rs                 # MCP utilities
│   │   ├── mcp_client.rs          # MCP client bootstrap
│   │   ├── hooks.rs               # Hook runner
│   │   └── lib.rs
│   └── Cargo.toml
│
├── api/                            # API client abstraction
│   ├── src/
│   │   ├── client.rs              # ProviderClient
│   │   ├── sse.rs                 # SSE parser
│   │   ├── types.rs               # API types
│   │   ├── error.rs               # Error types
│   │   └── lib.rs
│   └── Cargo.toml
│
├── plugins/                        # Plugin system
│   ├── src/
│   │   ├── lib.rs                 # PluginRegistry
│   │   └── hooks.rs               # HookRunner
│   └── Cargo.toml
│
├── tools/                          # Tool registry
│   └── ...
│
└── commands/                       # Command registry
    └── ...
```

---

## 8. ROADMAP TRIỂN KHAI

### Phase 1: Backend Foundation (Tuần 1-2)

**Mục tiêu:** Xây dựng lớp Core và Adapter cơ bản

1. **Tạo cấu trúc thư mục chuẩn** (theo mục 7.1)
2. **Implement Core Domain:**
   - `core/use_cases/ports.rs`: Định nghĩa traits
     - `IEventPublisher`
     - `ISessionRepository`
   - `core/use_cases/chat_actor.rs`: Actor pattern
     - `ChatSessionActor` struct
     - `ActorCommand` enum
     - `run()` method với MPSC loop

3. **Implement Outbound Adapters:**
   - `adapters/outbound/tauri_publisher.rs`
   - `adapters/outbound/tauri_prompter.rs`
   - `adapters/outbound/file_repository.rs`

4. **Implement Inbound Adapters:**
   - `adapters/inbound/commands.rs`:
     - `send_prompt()`
     - `answer_permission()`
     - `load_session()`
     - `save_session()`

5. **Setup Dependency Injection:**
   - `setup/di_container.rs`: Khởi tạo Actor, MPSC channel
   - `setup/app_state.rs`: Tauri State với `mpsc::Sender`


**Kiểm tra:**
- [ ] Tauri command `send_prompt` không block
- [ ] Actor nhận message và gọi `ConversationRuntime`
- [ ] Permission modal hiển thị khi tool cần cấp quyền
- [ ] Stream events được emit về Frontend

### Phase 2: Frontend Foundation (Tuần 3-4)

**Mục tiêu:** Xây dựng lớp Gateway, Store và UI cơ bản

1. **Tạo cấu trúc thư mục chuẩn** (theo mục 7.2)

2. **Implement Core Entities:**
   - `core/entities/Message.ts`
   - `core/entities/StreamEvent.ts`
   - `core/entities/PermissionRequest.ts`

3. **Implement Gateway:**
   - `core/gateways/IChatGateway.ts`: Interface
   - `adapters/tauri/tauri-chat.gateway.ts`: Implementation

4. **Implement State Machine:**
   - `store/chat.machine.ts`:
     - `ChatMachineState` type
     - `ChatEvent` type
     - `chatReducer()` function
   - `store/useChatStore.ts`: Zustand store

5. **Implement UI Components:**
   - `ui/features/ChatInput.tsx`
   - `ui/features/MessageList.tsx`
   - `ui/features/PermissionModal.tsx`
   - `ui/blocks/TextBlock.tsx`
   - `ui/blocks/TerminalBlock.tsx`

6. **Integrate vào App.tsx:**
   - Khởi tạo store listeners
   - Render components

**Kiểm tra:**
- [ ] Gửi prompt từ UI → Backend nhận được
- [ ] Stream text hiển thị real-time
- [ ] Permission modal bật lên khi cần
- [ ] FSM transitions đúng


### Phase 3: Advanced Features (Tuần 5-6)

**Mục tiêu:** Hoàn thiện các tính năng nâng cao

1. **Session Management:**
   - Load/Save session từ file
   - Session list UI
   - Session switching

2. **Tool Execution UI:**
   - `ToolExecutionBlock` component
   - Progress indicator
   - Error handling

3. **MCP Integration:**
   - MCP server configuration UI
   - MCP tool discovery
   - MCP tool execution

4. **Plugin System:**
   - Plugin list UI
   - Plugin enable/disable
   - Hook configuration

5. **Settings:**
   - Permission mode selector
   - Model selector
   - API key configuration

**Kiểm tra:**
- [ ] Session persistence hoạt động
- [ ] Tool execution hiển thị đúng
- [ ] MCP tools có thể gọi được
- [ ] Plugins có thể enable/disable

### Phase 4: Polish & Testing (Tuần 7-8)

**Mục tiêu:** Hoàn thiện UI/UX và testing

1. **Unit Tests:**
   - Backend: Test Actor, Adapters với mock
   - Frontend: Test Store reducer, Gateway với mock

2. **Integration Tests:**
   - Test full flow: UI → Backend → Runtime → UI

3. **UI/UX Polish:**
   - Animations
   - Loading states
   - Error messages
   - Keyboard shortcuts

4. **Performance:**
   - Optimize re-renders
   - Lazy load components
   - Debounce inputs

**Kiểm tra:**
- [ ] Test coverage > 80%
- [ ] Không có memory leaks
- [ ] UI responsive < 100ms
- [ ] Build size < 50MB

---

## 9. TESTING STRATEGY

### 9.1. Backend Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    struct MockEventPublisher {
        events: Arc<Mutex<Vec<StreamEvent>>>,
    }

    impl IEventPublisher for MockEventPublisher {
        fn publish(&self, event: StreamEvent) {
            self.events.lock().unwrap().push(event);
        }
    }

    #[tokio::test]
    async fn test_actor_handles_prompt() {
        let (tx, rx) = mpsc::channel(10);
        let publisher = Arc::new(MockEventPublisher::default());
        let actor = ChatSessionActor::new(rx, publisher.clone());

        tokio::spawn(actor.run());

        let (response_tx, response_rx) = oneshot::channel();
        tx.send(ActorCommand::Prompt {
            text: "Hello".to_string(),
            response_tx,
        }).await.unwrap();

        let result = response_rx.await.unwrap();
        assert!(result.is_ok());
        assert!(!publisher.events.lock().unwrap().is_empty());
    }
}
```


### 9.2. Frontend Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { chatReducer } from './chat.machine';

describe('chatReducer', () => {
  it('transitions from IDLE to GENERATING on USER_SENT_PROMPT', () => {
    const state: ChatMachineState = { status: 'IDLE' };
    const event: ChatEvent = { type: 'USER_SENT_PROMPT', text: 'Hello' };
    
    const nextState = chatReducer(state, event);
    
    expect(nextState).toEqual({ status: 'GENERATING' });
  });

  it('transitions to AWAITING_PERMISSION on PERMISSION_REQUESTED', () => {
    const state: ChatMachineState = { status: 'TOOL_EXECUTING', toolName: 'bash', toolInput: 'rm *.log' };
    const request = { id: '123', tool: 'bash', input: 'rm *.log' };
    const event: ChatEvent = { type: 'PERMISSION_REQUESTED', request };
    
    const nextState = chatReducer(state, event);
    
    expect(nextState).toEqual({ status: 'AWAITING_PERMISSION', request });
  });

  it('throws error on invalid transition', () => {
    const state: ChatMachineState = { status: 'IDLE' };
    const event: ChatEvent = { type: 'MESSAGE_STOP' };
    
    expect(() => chatReducer(state, event)).toThrow();
  });
});
```

### 9.3. Integration Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore, initializeChatStore } from './useChatStore';
import { MockChatGateway } from '../adapters/mock/mock-chat.gateway';

describe('Chat Integration', () => {
  beforeEach(() => {
    const store = useChatStore.getState();
    store.gateway = new MockChatGateway();
    initializeChatStore();
  });

  it('sends prompt and receives response', async () => {
    const store = useChatStore.getState();
    
    await store.sendPrompt('Hello');
    
    expect(store.state.status).toBe('GENERATING');
    
    // Simulate stream events
    const gateway = store.gateway as MockChatGateway;
    gateway.simulateTextDelta('Hi there!');
    gateway.simulateMessageStop();
    
    expect(store.state.status).toBe('IDLE');
    expect(store.messages).toHaveLength(2);
  });
});
```

---

## 10. BEST PRACTICES

### 10.1. Backend

1. **Không bao giờ block Tauri Commands:**
   - Dùng Actor Pattern với MPSC
   - Commands chỉ gửi message và trả về ngay

2. **Dependency Injection:**
   - Inject dependencies qua constructor
   - Dùng traits thay vì concrete types

3. **Error Handling:**
   - Dùng `Result<T, E>` thay vì panic
   - Log errors với context đầy đủ

4. **Async/Await:**
   - Dùng `tokio::spawn` cho long-running tasks
   - Dùng `oneshot` channel cho request-response

5. **State Management:**
   - Actor sở hữu state, không dùng Mutex/RwLock
   - Immutable messages giữa các luồng


### 10.2. Frontend

1. **Component Purity:**
   - Smart Components: Kết nối với Store
   - Dumb Components: Chỉ nhận Props
   - Không gọi `invoke()` trực tiếp trong components

2. **State Management:**
   - Dùng FSM thay vì boolean flags
   - Validate state transitions
   - Immutable updates

3. **Performance:**
   - Dùng `React.memo` cho Dumb Components
   - Dùng `useCallback` cho event handlers
   - Lazy load heavy components

4. **Type Safety:**
   - Định nghĩa types cho tất cả entities
   - Dùng discriminated unions cho FSM states
   - Avoid `any` type

5. **Testing:**
   - Mock Gateway cho unit tests
   - Test FSM transitions riêng biệt
   - Test components với mock store

### 10.3. Architecture

1. **Boundaries:**
   - Không import Tauri API ngoài Adapter layer
   - Không import React ngoài UI layer
   - Core domain không phụ thuộc vào framework

2. **Naming:**
   - Interfaces bắt đầu với `I` (IEventPublisher)
   - Adapters kết thúc với tên framework (TauriEventPublisher)
   - Use Cases là động từ (SendPrompt, AnswerPermission)

3. **File Organization:**
   - Một file một responsibility
   - Index files chỉ export, không chứa logic
   - Collocate related files

4. **Documentation:**
   - Document public APIs
   - Explain "why" không phải "what"
   - Keep architecture docs updated

---

## 11. TROUBLESHOOTING

### 11.1. Backend Issues

**Vấn đề:** Tauri Command bị block

```rust
// ❌ SAI
#[tauri::command]
async fn send_prompt(text: String) -> Result<String, String> {
    let runtime = ConversationRuntime::new(...);
    let result = runtime.run_turn(text, None)?; // BLOCK!
    Ok(result)
}

// ✅ ĐÚNG
#[tauri::command]
async fn send_prompt(text: String, state: State<'_, AppState>) -> Result<(), String> {
    let (tx, rx) = oneshot::channel();
    state.actor_tx.send(ActorCommand::Prompt { text, response_tx: tx }).await?;
    rx.await??; // Chỉ chờ Actor nhận message, không chờ xử lý xong
    Ok(())
}
```

**Vấn đề:** Permission Prompter deadlock

```rust
// ❌ SAI: Dùng async channel trong sync context
impl PermissionPrompter for TauriPermissionAdapter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision {
        let (tx, rx) = mpsc::channel();
        // ...
        rx.recv().unwrap() // DEADLOCK nếu không có runtime
    }
}

// ✅ ĐÚNG: Dùng oneshot channel với blocking_recv
impl PermissionPrompter for TauriPermissionAdapter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision {
        let (tx, rx) = oneshot::channel();
        // ...
        rx.blocking_recv().unwrap() // OK trong tokio runtime
    }
}
```


### 11.2. Frontend Issues

**Vấn đề:** Store không update UI

```typescript
// ❌ SAI: Mutate state trực tiếp
export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => {
    const { messages } = useChatStore.getState();
    messages.push(msg); // MUTATE!
  },
}));

// ✅ ĐÚNG: Immutable update
export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg],
  })),
}));
```

**Vấn đề:** Event listeners không cleanup

```typescript
// ❌ SAI: Không unsubscribe
useEffect(() => {
  const { gateway } = useChatStore.getState();
  gateway.onStreamEvent((event) => {
    // Handle event
  });
}, []);

// ✅ ĐÚNG: Cleanup trong useEffect
useEffect(() => {
  const { gateway } = useChatStore.getState();
  const unsubscribe = gateway.onStreamEvent((event) => {
    // Handle event
  });
  return () => unsubscribe();
}, []);
```

**Vấn đề:** FSM invalid transition

```typescript
// ❌ SAI: Không validate transition
export function chatReducer(state: ChatMachineState, event: ChatEvent): ChatMachineState {
  if (event.type === 'MESSAGE_STOP') {
    return { status: 'IDLE' }; // Có thể sai nếu đang AWAITING_PERMISSION
  }
  // ...
}

// ✅ ĐÚNG: Validate mọi transition
export function chatReducer(state: ChatMachineState, event: ChatEvent): ChatMachineState {
  switch (state.status) {
    case 'AWAITING_PERMISSION':
      if (event.type === 'MESSAGE_STOP') {
        throw new Error('Cannot stop while awaiting permission');
      }
      // ...
  }
}
```

---

## 12. REFERENCES

### 12.1. Architecture Patterns

- **Clean Architecture** - Robert C. Martin
- **Hexagonal Architecture** - Alistair Cockburn
- **Domain-Driven Design** - Eric Evans
- **Ports and Adapters** - Alistair Cockburn

### 12.2. Design Patterns

- **Actor Model** - Carl Hewitt
- **Finite State Machine** - Mealy & Moore
- **Repository Pattern** - Martin Fowler
- **Strategy Pattern** - Gang of Four
- **Observer Pattern** - Gang of Four

### 12.3. Technologies

- **Tauri** - https://tauri.app/
- **Rust** - https://www.rust-lang.org/
- **React** - https://react.dev/
- **Zustand** - https://zustand-demo.pmnd.rs/
- **TypeScript** - https://www.typescriptlang.org/

---

## 13. APPENDIX

### 13.1. Glossary

- **Actor:** Đơn vị xử lý độc lập với inbox riêng
- **Adapter:** Lớp chuyển đổi giữa domain và external systems
- **Boundary:** Ranh giới kiến trúc giữa các lớp
- **DIP:** Dependency Inversion Principle
- **FSM:** Finite State Machine
- **Gateway:** Interface định nghĩa cách gọi external system
- **IPC:** Inter-Process Communication
- **MCP:** Model Context Protocol
- **Port:** Interface định nghĩa contract giữa layers
- **Prompter:** Component hỏi user về quyết định
- **Repository:** Pattern quản lý persistence
- **Strategy:** Pattern cho pluggable algorithms
- **Use Case:** Business logic operation

### 13.2. Acronyms

- **API:** Application Programming Interface
- **CLI:** Command Line Interface
- **DI:** Dependency Injection
- **DTO:** Data Transfer Object
- **FSM:** Finite State Machine
- **IPC:** Inter-Process Communication
- **LLM:** Large Language Model
- **MCP:** Model Context Protocol
- **MPSC:** Multi-Producer Single-Consumer
- **SSE:** Server-Sent Events
- **UI:** User Interface
- **UX:** User Experience

---

## KẾT LUẬN

Tài liệu này định nghĩa kiến trúc chuẩn Holy Grail cho Claw Desktop. Tuân thủ nghiêm ngặt các nguyên tắc:

1. **Dependency Inversion:** High-level không phụ thuộc low-level
2. **Separation of Concerns:** Mỗi lớp có trách nhiệm rõ ràng
3. **Testability:** Mọi component có thể test độc lập
4. **Maintainability:** Dễ dàng thay đổi và mở rộng
5. **Scalability:** Có thể scale theo chiều ngang và dọc

Bám sát tài liệu này để đảm bảo code base luôn clean, maintainable và professional.

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-XX  
**Author:** Claw Desktop Team
