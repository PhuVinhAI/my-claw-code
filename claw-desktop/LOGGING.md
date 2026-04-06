# Hệ Thống Logging - Claw Desktop

## Tổng Quan

Claw Desktop sử dụng **structured logging** với `tracing` crate để ghi lại toàn bộ quá trình xử lý từ user input đến AI response.

**ĐẶC BIỆT**: Logs được format đặc biệt cho AI đọc với emoji markers và JSON structured data.

## Emoji Markers (AI-Readable)

Các log quan trọng được đánh dấu bằng emoji để AI dễ nhận diện:

- 🎯 `TURN_START` - Bắt đầu conversation turn
- 🤖 `AI_READABLE_TURN` - Snapshot đầy đủ của turn (JSON)
- 🌐 `API_REQUEST_START` - Gọi API LLM
- 🌐 `AI_READABLE_API` - Chi tiết API call (JSON)
- 🔧 `TOOL_EXEC_START` - Bắt đầu tool execution
- 🔧 `AI_READABLE_TOOL` - Chi tiết tool execution (JSON)
- ✅ `TOOL_EXEC_SUCCESS` - Tool thành công
- ❌ `TOOL_EXEC_FAILED` - Tool thất bại
- 🛑 `TURN_CANCELLED` - Turn bị cancel
- 🛑 `TOOL_EXEC_CANCELLED` - Tool bị cancel

## Cấu Hình

### Log Levels

- **ERROR**: Lỗi nghiêm trọng (API failures, tool execution errors)
- **WARN**: Cảnh báo (tool cancelled, permission denied)
- **INFO**: Thông tin quan trọng (user message, tool execution, turn completed)
- **DEBUG**: Chi tiết debug (API requests, state transitions, token usage)
- **TRACE**: Chi tiết cực kỳ sâu (stream events, parsed inputs)

### Log Outputs

1. **Console (stderr)**: INFO level, human-readable format
2. **File**: DEBUG level, JSON format (dễ parse)

### Log File Location

```
Windows: C:\Users\<username>\AppData\Roaming\claw-desktop\logs\
Linux:   ~/.local/share/claw-desktop/logs/
macOS:   ~/Library/Application Support/claw-desktop/logs/
```

Files: `claw-desktop-YYYY-MM-DD.log` (daily rotation)

## Log Structure

### User Message Flow

```
INFO  🎯 TURN_START turn_id=abc-123 text_len=25
INFO  🤖 AI_READABLE_TURN turn_data={"turn_id":"abc-123","iteration":0,"user_input":"write hello world","messages":[...]}
INFO  🌐 API_REQUEST_START model=claude-3-5-sonnet message_count=3 system_prompt_len=1234 tool_count=15
INFO  🌐 AI_READABLE_API api_data={"model":"claude-3-5-sonnet","message_count":3,"response_type":"tool_use"}
INFO  🔧 TOOL_EXEC_START tool_name=bash tool_use_id=toolu_123 input_len=45
INFO  🔧 AI_READABLE_TOOL tool_data={"tool_use_id":"toolu_123","tool_name":"bash","input":"{\"command\":\"echo hello\"}","output":"hello\n","duration_ms":150}
INFO  ✅ TOOL_EXEC_SUCCESS tool_name=bash duration_ms=150
INFO  🌐 API_REQUEST_START model=claude-3-5-sonnet message_count=5
INFO  🌐 AI_READABLE_API api_data={"model":"claude-3-5-sonnet","response_type":"text"}
```

### AI-Readable JSON Logs

Mỗi turn có snapshot đầy đủ ở format JSON:

```json
{
  "turn_id": "abc-123",
  "iteration": 0,
  "user_input": "write a hello world program",
  "user_input_truncated": false,
  "message_count": 3,
  "messages": [
    {
      "role": "user",
      "blocks": [
        {
          "type": "text",
          "text": "write a hello world program",
          "truncated": false
        }
      ]
    },
    {
      "role": "assistant",
      "blocks": [
        {
          "type": "tool_use",
          "id": "toolu_123",
          "name": "bash",
          "input": "{\"command\":\"echo 'hello world'\"}",
          "truncated": false
        }
      ],
      "usage": {
        "input_tokens": 1234,
        "output_tokens": 567
      }
    },
    {
      "role": "tool",
      "blocks": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_123",
          "output": "hello world\n",
          "truncated": false,
          "is_error": false,
          "is_cancelled": false
        }
      ]
    }
  ]
}
```

### Permission Request Flow

```
INFO  Processing tool use (tool_name=bash)
INFO  Permission requested (tool_name=bash, mode=normal)
INFO  answer_permission command called (request_id=abc123, allow=true)
INFO  Permission granted
INFO  Executing tool
```

### Error Flow

```
ERROR API error: rate limit exceeded
ERROR Prompt failed: API error
ERROR Actor returned error
```

## Đọc Log Files cho AI

### Filter logs cho AI

```bash
# Xem tất cả AI-readable logs
grep "AI_READABLE" claw-desktop.log

# Xem tất cả turns
grep "🎯 TURN_START" claw-desktop.log

# Xem tất cả tool executions
grep "🔧 TOOL_EXEC" claw-desktop.log

# Xem errors
grep "❌" claw-desktop.log

# Extract JSON data từ AI_READABLE logs
grep "AI_READABLE_TURN" claw-desktop.log | sed 's/.*turn_data=//' | jq .
```

### Parse AI-Readable Logs

```python
import json
import re

def parse_ai_logs(log_file):
    """Parse AI-readable logs thành structured data"""
    turns = []
    tools = []
    apis = []
    
    with open(log_file) as f:
        for line in f:
            # Parse turn data
            if 'AI_READABLE_TURN' in line:
                match = re.search(r'turn_data=({.*})', line)
                if match:
                    turns.append(json.loads(match.group(1)))
            
            # Parse tool data
            elif 'AI_READABLE_TOOL' in line:
                match = re.search(r'tool_data=({.*})', line)
                if match:
                    tools.append(json.loads(match.group(1)))
            
            # Parse API data
            elif 'AI_READABLE_API' in line:
                match = re.search(r'api_data=({.*})', line)
                if match:
                    apis.append(json.loads(match.group(1)))
    
    return {
        'turns': turns,
        'tools': tools,
        'apis': apis
    }

# Usage
data = parse_ai_logs('claw-desktop.log')
print(f"Found {len(data['turns'])} turns")
print(f"Found {len(data['tools'])} tool executions")
print(f"Found {len(data['apis'])} API calls")
```

## Debug Workflow

### 1. User gửi message nhưng không có response

Kiểm tra:
```bash
# Xem có nhận được message không
grep "send_prompt command called" claw-desktop.log

# Xem có gọi API không
grep "Starting API stream request" claw-desktop.log

# Xem có lỗi API không
grep "ERROR" claw-desktop.log | grep -i "api"
```

### 2. Tool execution bị stuck

Kiểm tra:
```bash
# Xem tool nào đang chạy
jq 'select(.fields.tool_name != null and .message == "Executing tool")' claw-desktop.log

# Xem có tool nào chưa complete không
jq 'select(.fields.tool_name != null) | {time: .timestamp, tool: .fields.tool_name, status: .message}' claw-desktop.log
```

### 3. State machine bị sai

Kiểm tra:
```bash
# Xem state transitions (Frontend logs - browser console)
# Backend logs:
jq 'select(.message | contains("iteration"))' claw-desktop.log
```

### 4. Token usage không đúng

Kiểm tra:
```bash
# Xem tất cả token usage events
jq 'select(.fields.input_tokens != null)' claw-desktop.log
```

## Best Practices

### Khi thêm logging mới

1. **Chọn level phù hợp**:
   - User actions → INFO
   - Internal state changes → DEBUG
   - Stream events → TRACE

2. **Thêm context fields**:
```rust
tracing::info!(
    tool_name = %tool_name,
    tool_use_id = %tool_use_id,
    "Executing tool"
);
```

3. **Truncate long strings**:
```rust
tracing::debug!(
    input = %input.chars().take(100).collect::<String>(),
    "Tool input"
);
```

4. **Log errors với context**:
```rust
tracing::error!(
    error = %e,
    tool_name = %tool_name,
    "Tool execution failed"
);
```

### Performance

- Logging có overhead nhỏ (~1-5% CPU)
- JSON serialization chỉ xảy ra khi write file
- Console logs (INFO) có overhead thấp hơn file logs (DEBUG)

## Troubleshooting

### Log files quá lớn

- Daily rotation tự động
- Xóa log files cũ:
```bash
find ~/.local/share/claw-desktop/logs/ -name "*.log" -mtime +7 -delete
```

### Không thấy logs

1. Kiểm tra log directory tồn tại:
```bash
ls ~/.local/share/claw-desktop/logs/
```

2. Kiểm tra permissions:
```bash
ls -la ~/.local/share/claw-desktop/logs/
```

3. Xem console output (stderr) để debug logging system

### Cần thêm chi tiết

Thay đổi log level trong code:
```rust
// In setup/logging.rs
let console_layer = fmt::layer()
    .pretty()
    .with_writer(std::io::stderr)
    .with_filter(EnvFilter::new("debug")); // Change from "info" to "debug"
```

## Log Format Examples

### JSON Log Entry

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "target": "claw_desktop::core::use_cases::chat_actor",
  "fields": {
    "message": "Executing tool",
    "tool_name": "bash",
    "tool_use_id": "toolu_abc123",
    "input_len": 45
  },
  "span": {
    "name": "handle_prompt"
  }
}
```

### Console Log Entry

```
2024-01-15T10:30:45.123Z  INFO claw_desktop::core::use_cases::chat_actor: Executing tool
    tool_name: bash
    tool_use_id: toolu_abc123
    input_len: 45
```

## Tích Hợp với Monitoring Tools

### Export logs sang monitoring service

```bash
# Tail logs và gửi sang service
tail -f claw-desktop.log | your-log-shipper
```

### Parse logs với Python

```python
import json

with open('claw-desktop.log') as f:
    for line in f:
        log = json.loads(line)
        if log['level'] == 'ERROR':
            print(f"{log['timestamp']}: {log['fields']['message']}")
```

## Kết Luận

Hệ thống logging này giúp:
- Debug nhanh các vấn đề về state
- Hiểu rõ flow xử lý từ user → AI
- Track performance (token usage, tool execution time)
- Audit trail cho tool executions
- Troubleshoot production issues

Khi gặp bug, LUÔN kiểm tra log files trước!
