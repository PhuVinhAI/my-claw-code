# UI DESIGN - CLAW DESKTOP CHATBOT

## NGUYÊN TẮC THIẾT KẾ

**Đơn giản, tập trung vào chat, theo style Claude.ai**

- Sidebar bên trái chứa lịch sử chat
- Không avatar
- Không bubble chat
- User message: 80% width, có nền xám nhẹ
- Assistant message: full-width, KHÔNG nền (transparent)
- Tool calls hiển thị inline với icons
- Input area cố định ở bottom
- Empty state: Input ở giữa màn hình khi chưa có chat

---

## 1. LAYOUT TỔNG QUAN

### Layout với Sidebar (Style Claude.ai)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLAW DESKTOP CHATBOT                          │
├────────────────┬─────────────────────────────────────────────────────┤
│   SIDEBAR      │              MAIN CHAT AREA                         │
│   (260px)      │                                                     │
│                │                                                     │
│ ┌────────────┐ │  ┌───────────────────────────────────────────────┐ │
│ │ Claw       │ │  │         CHAT VIEW (có messages)               │ │
│ └────────────┘ │  │                                               │ │
│                │  │  ┌─────────────────────────────────────────┐  │ │
│ + New chat     │  │  │ USER (80% width, right)                 │  │ │
│                │  │  │ Hãy đọc file main.rs                    │  │ │
│ 🔍 Search      │  │  └─────────────────────────────────────────┘  │ │
│                │  │                                               │ │
│ Recents        │  │  ┌─────────────────────────────────────────┐  │ │
│                │  │  │ ASSISTANT (full width)                  │  │ │
│ • Chat 1   ... │  │  │ [📄 read_file: main.rs ✓]              │  │ │
│ • Chat 2   ... │  │  │ Tôi đã đọc file...                      │  │ │
│ • Chat 3   ... │  │  └─────────────────────────────────────────┘  │ │
│                │  │                                               │ │
│                │  └───────────────────────────────────────────────┘ │
│                │                                                     │
│                │  ┌───────────────────────────────────────────────┐ │
│                │  │ INPUT (Fixed Bottom)                          │ │
│                │  │ ┌───────────────────────────────────────────┐ │ │
│                │  │ │ Nhập câu hỏi...                           │ │ │
│                │  │ └───────────────────────────────────────────┘ │ │
│                │  │ [Ask ▼] [Model: Sonnet 4.6 ▼]      [Gửi 📤] │ │
│                │  └───────────────────────────────────────────────┘ │
└────────────────┴─────────────────────────────────────────────────────┘
```

### Empty State (Chưa có chat)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLAW DESKTOP CHATBOT                          │
├────────────────┬─────────────────────────────────────────────────────┤
│   SIDEBAR      │              EMPTY STATE                            │
│   (260px)      │                                                     │
│                │                                                     │
│ ┌────────────┐ │                                                     │
│ │ Claw       │ │              ✨ Good morning, User                  │
│ └────────────┘ │                                                     │
│                │         ┌─────────────────────────────────────┐     │
│ + New chat     │         │ How can I help you today?           │     │
│                │         │                                     │     │
│ 🔍 Search      │         │ +  [Sonnet 4.6 ▼]  [|||]           │     │
│                │         └─────────────────────────────────────┘     │
│ (No chats)     │                                                     │
│                │                                                     │
└────────────────┴─────────────────────────────────────────────────────┘
```

---

## 2. COMPONENT STRUCTURE

```
App.tsx
└── ChatWindow
    ├── Sidebar (260px, fixed left)
    │   ├── Logo
    │   ├── NewChatButton
    │   ├── SearchInput
    │   └── ChatHistoryList
    │       └── ChatHistoryItem[]
    │           ├── Title
    │           └── MoreMenu (... button on hover)
    │               ├── Edit
    │               └── Delete
    │
    └── MainArea
        ├── EmptyState (khi chưa có chat)
        │   ├── Greeting
        │   └── CenteredInput
        │       ├── Textarea
        │       ├── AttachButton (+)
        │       ├── ModelSelector
        │       └── VoiceButton (|||)
        │
        └── ChatView (khi đã có messages)
            ├── ChatMessageList (Scrollable)
            │   └── ChatMessage[] (User/Assistant)
            │       ├── MessageContent (Text + Markdown)
            │       └── ToolCallBadge[] (Inline)
            └── ChatInput (Fixed Bottom)
                ├── Textarea (Auto-resize)
                ├── ModeSelector (Ask/Agent)
                ├── ModelSelector (Dropdown)
                └── SendButton
```

---

## 3. SIDEBAR

### Sidebar Container

```tsx
<div className="w-[260px] h-full bg-background border-r flex flex-col">
  {/* Logo */}
  <div className="p-4 border-b">
    <h1 className="text-xl font-bold">Claw</h1>
  </div>

  {/* New Chat Button */}
  <div className="p-2">
    <Button
      variant="ghost"
      className="w-full justify-start gap-2"
      onClick={handleNewChat}
    >
      <Plus className="h-4 w-4" />
      New chat
    </Button>
  </div>

  {/* Search */}
  <div className="px-2 pb-2">
    <div className="relative">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search"
        className="pl-8"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  </div>

  {/* Chat History */}
  <div className="flex-1 overflow-y-auto">
    <div className="px-2">
      <p className="text-xs text-muted-foreground px-2 py-2">Recents</p>
      <ChatHistoryList sessions={chatSessions} />
    </div>
  </div>
</div>
```

### Chat History Item (với ... menu on hover)

```tsx
<div
  className={cn(
    "group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors",
    isActive ? "bg-accent" : "hover:bg-accent/50"
  )}
  onClick={() => onSelectSession(session.id)}
>
  <div className="flex items-center gap-2 min-w-0 flex-1">
    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
    <span className="truncate text-sm">{session.title}</span>
  </div>
  
  {/* More menu - hiện khi hover */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onEdit(session.id)}>
        <Edit className="h-4 w-4 mr-2" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => onDelete(session.id)}
        className="text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

---

## 4. EMPTY STATE

### Empty State (Input ở giữa màn hình)

```tsx
<div className="flex flex-col items-center justify-center h-full p-8">
  {/* Greeting */}
  <div className="mb-8 text-center">
    <h1 className="text-3xl font-serif text-foreground mb-2">
      ✨ Good morning, {userName}
    </h1>
  </div>

  {/* Centered Input */}
  <div className="w-full max-w-3xl">
    <div className="rounded-lg border bg-background shadow-sm">
      <Textarea
        placeholder="How can I help you today?"
        className="min-h-[120px] resize-none border-0 focus-visible:ring-0 p-4"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      
      <div className="flex items-center justify-between p-3 border-t">
        <div className="flex items-center gap-2">
          {/* Attach button */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Model selector */}
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sonnet-4.6">Sonnet 4.6 Extended</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Voice button */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Mic className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
    
    {/* Connect tools hint */}
    <div className="mt-4 text-center">
      <Button variant="link" className="text-sm text-muted-foreground">
        Connect your tools to Claude →
      </Button>
    </div>
  </div>
</div>
```

---

## 5. MESSAGE STYLES

### User Message

```tsx
<div
  className={cn(
    "group flex w-full items-start gap-2 min-w-0 justify-end"
  )}
>
  <div className="flex flex-col items-end transition-all">
    <div
      className={cn(
        "max-w-xs md:max-w-md lg:max-w-lg", // 80% width tương đối
        "text-sm rounded-lg bg-muted px-3 py-2 group-hover:bg-accent cursor-pointer"
      )}
      onClick={() => onStartEdit(index)}
    >
      <div className="markdown-content w-full min-w-0 max-w-full overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {message.content || ""}
        </ReactMarkdown>
      </div>
    </div>
  </div>
</div>
```

**Đặc điểm:**
- Justify end (căn phải)
- Max-width responsive: xs/md/lg (~80% width)
- Background: `bg-muted`, hover: `bg-accent`
- Rounded corners, padding: px-3 py-2
- Click để edit
- Markdown rendering với syntax highlighting

### Assistant Message

```tsx
<div
  className={cn(
    "group flex w-full items-start gap-2 min-w-0 justify-start"
  )}
>
  <div className="flex flex-col items-start transition-all">
    <div
      className={cn(
        "max-w-full lg:max-w-3xl w-full", // Full width
        "text-sm rounded-lg"
      )}
    >
      {message.tool_calls ? (
        // Tool calls
        <div className="space-y-2 w-full min-w-0 max-w-full">
          {message.tool_calls.map(renderToolCall)}
        </div>
      ) : (
        // Text content
        <div className="flex flex-col w-full min-w-0 max-w-full">
          {message.thoughts && (
            <div className="mb-3 rounded-md border border-border/50 bg-muted/20 overflow-hidden">
              <button
                className="flex w-full items-center justify-between p-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setShowThoughts(!showThoughts)}
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <span className="uppercase tracking-wider">THINKING</span>
                </div>
                {showThoughts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showThoughts && (
                <div className="p-3 pt-0 text-sm text-muted-foreground border-t border-border/50 markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.thoughts}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
          <div className="markdown-content w-full min-w-0 max-w-full overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content || ""}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
    {/* Regenerate button */}
    {message.role === "assistant" && !isAiPanelLoading && isLastAssistantMessageInTurn && (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 mt-1"
        onClick={() => onRegenerate(index)}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    )}
  </div>
</div>
```

**Đặc điểm:**
- Justify start (căn trái)
- Full width (max-w-full lg:max-w-3xl)
- KHÔNG background (transparent)
- Tool calls: space-y-2
- Thinking process: collapsible với border
- Regenerate button: hiện khi hover
- Markdown rendering với syntax highlighting

---

## 4. TOOL CALL BADGE

```tsx
const renderToolCall = (tool: ToolCall) => {
  let toolContent: React.ReactNode;
  let ToolIcon: React.ElementType | null = null;
  const isPending = tool.status === "pending";
  const isError = tool.status === "error";
  const statusKey = isPending ? "pending" : (isError ? "error" : "success");

  // Example: read_file tool
  if (tool.function.name === "read_file") {
    ToolIcon = FileText;
    try {
      const args = JSON.parse(tool.function.arguments);
      const fileName = args.file_path?.split("/").pop() || "unknown";
      toolContent = (
        <div className="w-full">
          <p className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
            Đọc file: <code className="ml-1 text-xs text-muted-foreground">{fileName}</code>
          </p>
        </div>
      );
    } catch (e) {
      toolContent = <p className={cn("font-medium", isError && "text-destructive")}>Đọc file</p>;
    }
  }

  // Example: bash tool
  if (tool.function.name === "bash") {
    ToolIcon = Terminal;
    try {
      const args = JSON.parse(tool.function.arguments);
      toolContent = (
        <div className="w-full flex flex-col gap-1.5">
          <p className={cn("font-medium flex items-center gap-2", isError ? "text-destructive" : "text-foreground")}>
            Bash: <code className="text-xs text-muted-foreground truncate max-w-[300px]">{args.command}</code>
          </p>
          {tool.result && (
            <details className="group/details mt-1">
              <summary className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none list-none flex items-center gap-1 w-fit">
                <ChevronRight className="h-3 w-3 transition-transform group-open/details:rotate-90" />
                Xem chi tiết
              </summary>
              <pre className="mt-1.5 bg-muted/50 border border-border/50 p-2 rounded-md text-[11px] font-mono max-h-60 overflow-auto custom-scrollbar whitespace-pre-wrap text-foreground/80">
                {tool.result}
              </pre>
            </details>
          )}
        </div>
      );
    } catch (e) {
      toolContent = <p className={cn("font-medium", isError && "text-destructive")}>Bash</p>;
    }
  }

  return (
    <div
      key={tool.id}
      className="flex text-sm bg-muted/60 dark:bg-muted/30 rounded-lg p-3 border w-full flex-row items-start gap-2.5"
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Status Icon */}
        {tool.status === "error" ? (
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        ) : tool.status === "partial" ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
        ) : tool.status === "pending" ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
        )}
        {/* Tool Icon */}
        {ToolIcon && <ToolIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />}
      </div>
      <div className="flex-1 w-full min-w-0">
        {toolContent}
      </div>
    </div>
  );
};
```

**Tool Icons:**
- `read_file`: FileText
- `write`: FileEdit
- `edit`: Pencil
- `bash`: Terminal
- `grep`: Search
- `glob`: Files

**Status Icons:**
- `pending`: Loader2 (spinning, blue-500)
- `success`: CheckCircle2 (green-500)
- `error`: XCircle (destructive)
- `partial`: AlertTriangle (yellow-500)

**Styling:**
- Background: `bg-muted/60 dark:bg-muted/30`
- Border + rounded-lg
- Padding: p-3
- Gap giữa icons và content: gap-2.5
- Icon size: h-5 w-5

---

## 5. INPUT AREA

```tsx
<div className="border-t bg-background p-4">
  <div className="max-w-4xl mx-auto space-y-3">
    {/* Textarea */}
    <Textarea
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Nhập câu hỏi của bạn..."
      className="w-full min-h-[44px] max-h-[120px] resize-none"
      rows={1}
    />
    
    {/* Mode, Model Selectors & Send Button */}
    <div className="flex items-center gap-2">
      <Select value={mode} onValueChange={setMode}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ask">Ask</SelectItem>
          <SelectItem value="agent">Agent</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={model} onValueChange={setModel}>
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="claude-sonnet-4.5">Claude Sonnet 4.5</SelectItem>
          <SelectItem value="gpt-4">GPT-4</SelectItem>
          <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
        </SelectContent>
      </Select>
      
      <Button
        onClick={handleSend}
        disabled={!prompt.trim() || isLoading}
        size="icon"
        className="h-[44px] w-[44px] shrink-0"
      >
        {isLoading ? (
          <Square className="h-4 w-4" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  </div>
</div>
```

**Đặc điểm:**
- Fixed ở bottom
- Border top để phân tách
- Max-width 4xl, center
- Textarea ở trên (auto-resize: min 1 row, max 5 rows)
- Mode selector (120px) + Model selector (flex-1) + Send button (44x44) ở dưới cùng hàng

---

## 6. MODES & MODELS

### Modes

**Ask Mode:**
- Hỏi đáp thông thường
- Không tự động gọi tools
- AI chỉ trả lời bằng text

**Agent Mode:**
- AI có thể tự động gọi tools
- Thực thi bash, đọc/ghi file
- Hiển thị tool calls trong message

### Models

Dropdown hiển thị:
- Provider name (Claude, GPT, Gemini)
- Model name (Sonnet 4.5, GPT-4, Pro)
- Context length (nếu có)

```tsx
<SelectItem value="claude-sonnet-4.5">
  <div className="flex flex-col">
    <span className="font-medium">Claude Sonnet 4.5</span>
    <span className="text-xs text-muted-foreground">200K context</span>
  </div>
</SelectItem>
```

---

## 7. KEYBOARD SHORTCUTS

- `Enter`: Gửi message (nếu không giữ Shift)
- `Shift + Enter`: Xuống dòng
- `Ctrl/Cmd + K`: Focus vào input
- `Escape`: Clear input

---

## 8. LOADING STATES

### Đang chờ AI response:

```tsx
export function LoadingIndicator() {
  return (
    <div className="flex items-center justify-start gap-2 text-muted-foreground italic text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      <p>AI đang trả lời...</p>
    </div>
  );
}

// Trong ChatMessageList
{isAiPanelLoading && <LoadingIndicator />}
```

### Tool đang thực thi:

Tool call với `status="pending"` sẽ tự động hiển thị Loader2 spinning icon (xem section 4).

---

## 9. ERROR HANDLING

### API Error (trong message):

```tsx
const assistantErrorMessage: ChatMessage = {
  role: "assistant",
  content: `❌ Lỗi\n\n${errorMessage}`,
};

// Render như assistant message bình thường
```

### Tool Error:

Tool call với `status="error"` sẽ tự động hiển thị XCircle icon đỏ và text-destructive (xem section 4).

---

## 10. RESPONSIVE DESIGN

### Message Max-Width:

```typescript
// User message (80% width tương đối)
const USER_MESSAGE_WIDTH = "max-w-xs md:max-w-md lg:max-w-lg";

// Assistant message (full width)
const ASSISTANT_MESSAGE_WIDTH = "max-w-full lg:max-w-3xl w-full";
```

### Desktop (> 1024px):
- User message: max-w-lg (~512px)
- Assistant message: max-w-3xl (~768px)
- Font size: text-sm

### Tablet (768px - 1024px):
- User message: max-w-md (~448px)
- Assistant message: max-w-full
- Font size: text-sm

### Mobile (< 768px):
- User message: max-w-xs (~320px)
- Assistant message: max-w-full
- Font size: text-sm

---

## 11. DARK MODE

### Colors (từ template thực tế):

```css
/* Light Mode */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--muted: 210 40% 96.1%;
--muted-foreground: 215.4 16.3% 46.9%;
--border: 214.3 31.8% 91.4%;
--destructive: 0 84.2% 60.2%;

/* Dark Mode */
--background: 222.2 84% 4.9%;
--foreground: 210 40% 98%;
--muted: 217.2 32.6% 17.5%;
--muted-foreground: 215 20.2% 65.1%;
--border: 217.2 32.6% 17.5%;
--destructive: 0 62.8% 30.6%;
```

### User Message:
- Light: `bg-muted` (xám nhẹ)
- Dark: `bg-muted` (xám đậm)
- Hover: `bg-accent`

### Assistant Message:
- Light & Dark: `bg-transparent` (KHÔNG nền)

### Tool Call:
- Light: `bg-muted/60`
- Dark: `bg-muted/30`

---

## 12. ANIMATION

### Message Appear (không cần animation phức tạp):

Messages được thêm vào array và React tự động render. Không cần framer-motion.

### Auto-scroll:

```tsx
const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
  messagesEndRef.current?.scrollIntoView({ behavior });
};

useEffect(() => {
  const viewport = viewportRef.current;
  if (!viewport) return;

  // Chỉ auto-scroll nếu user đang ở gần bottom
  const isScrolledToBottom =
    viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 100;

  if (isScrolledToBottom) {
    scrollToBottom("smooth");
  }
}, [chatMessages, isAiPanelLoading]);
```

### Scroll to Bottom Button:

```tsx
const [showScrollButton, setShowScrollButton] = useState(false);

const updateScrollButtonVisibility = () => {
  const viewport = viewportRef.current;
  if (!viewport) {
    setShowScrollButton(false);
    return;
  }
  const isScrollable = viewport.scrollHeight > viewport.clientHeight + 1;
  const isNearBottom =
    viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 10;

  setShowScrollButton(isScrollable && !isNearBottom);
};

// Trong render
<Button
  variant="outline"
  size="icon"
  className={cn(
    "absolute bottom-2 right-2 z-10 rounded-full h-10 w-10 transition-opacity duration-300",
    showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none"
  )}
  onClick={() => scrollToBottom()}
>
  <ArrowDownCircle className="h-5 w-5" />
</Button>
```

---

## 13. IMPLEMENTATION CHECKLIST

### Phase 1: Basic Layout
- [ ] ChatWindow container
- [ ] ChatMessageList (scrollable)
- [ ] ChatInput (fixed bottom)
- [ ] Basic styling

### Phase 2: Message Rendering
- [ ] User message component
- [ ] Assistant message component
- [ ] Markdown rendering
- [ ] Syntax highlighting

### Phase 3: Tool Calls
- [ ] ToolCallBadge component
- [ ] Tool icons mapping
- [ ] Status icons
- [ ] Inline display

### Phase 4: Input Area
- [ ] Mode selector (Ask/Agent)
- [ ] Model selector dropdown
- [ ] Textarea auto-resize
- [ ] Send button
- [ ] Keyboard shortcuts

### Phase 5: States & Interactions
- [ ] Loading states
- [ ] Error handling
- [ ] Streaming response
- [ ] Auto-scroll

### Phase 6: Polish
- [ ] Dark mode
- [ ] Animations
- [ ] Responsive design
- [ ] Accessibility

---

**UI này đơn giản, tập trung vào chat, dễ implement và maintain.**
