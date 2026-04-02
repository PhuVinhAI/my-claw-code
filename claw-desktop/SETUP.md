# CLAW DESKTOP - SETUP GUIDE

## Prerequisites

1. **Rust** (latest stable)
2. **Node.js** (v18+)
3. **npm** or **yarn**

## Environment Setup

### 1. Copy `.env` file

Từ workspace root, copy `.env.example` thành `.env`:

```bash
cp .env.example .env
```

### 2. Configure API Credentials

Edit `.env` file với credentials của bạn:

#### Option A: NVIDIA API (Recommended for testing)

```env
OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
OPENAI_API_KEY=nvapi-YOUR_KEY_HERE
CLAW_MODEL=stepfun-ai/step-3.5-flash
```

#### Option B: Anthropic API

```env
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
CLAW_MODEL=sonnet
```

#### Option C: OpenAI API

```env
OPENAI_API_KEY=sk-YOUR_KEY_HERE
OPENAI_BASE_URL=https://api.openai.com/v1
CLAW_MODEL=gpt-4o
```

#### Option D: Local LLM (LM Studio, Ollama)

```env
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_API_KEY=lm-studio
CLAW_MODEL=your-local-model
```

## Installation

### 1. Install Frontend Dependencies

```bash
cd claw-desktop
npm install
```

### 2. Build Rust Backend

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

## Running the App

### Development Mode

```bash
cd claw-desktop
npm run tauri dev
```

### Production Build

```bash
cd claw-desktop
npm run tauri build
```

Build output sẽ ở `src-tauri/target/release/bundle/`

## Troubleshooting

### Error: "missing Claw credentials"

**Cause:** `.env` file không được load hoặc thiếu API key

**Solution:**
1. Đảm bảo `.env` file ở workspace root (không phải trong `claw-desktop/`)
2. Check `.env` có đúng format không
3. Restart app sau khi edit `.env`

### Error: "Failed to create API client"

**Cause:** API credentials không hợp lệ hoặc model không tồn tại

**Solution:**
1. Verify API key còn valid
2. Check model name đúng với provider
3. Test API key với curl:

```bash
# NVIDIA API
curl -X POST "https://integrate.api.nvidia.com/v1/chat/completions" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"stepfun-ai/step-3.5-flash","messages":[{"role":"user","content":"Hello"}]}'
```

### Error: TypeScript build fails

**Solution:**
```bash
cd claw-desktop
npm run build
```

Fix any type errors shown.

### Error: Rust compilation fails

**Solution:**
```bash
cargo clean --manifest-path claw-desktop/src-tauri/Cargo.toml
cargo build --manifest-path claw-desktop/src-tauri/Cargo.toml
```

## Features

### ✅ Working
- Real-time streaming chat
- Markdown rendering với syntax highlighting
- Tool execution (bash, read_file, write_file, etc.)
- Permission prompts
- Loading indicators

### 🚧 In Progress
- Session management
- Chat history sidebar
- Settings panel
- Dark mode toggle

## Architecture

```
Frontend (React + Zustand)
  ↓ Gateway (Anti-Corruption Layer)
Tauri IPC
  ↓ Commands
Actor (MPSC)
  ↓
ConversationRuntime
  ↓
API Client + Tool Executor
```

## Development Tips

1. **Hot Reload:** Frontend hot reloads, backend cần restart
2. **Logs:** Check terminal cho Rust logs, DevTools cho JS logs
3. **Debug:** Use `eprintln!()` trong Rust, `console.log()` trong JS
4. **State:** Zustand DevTools extension để debug state

## Support

- GitHub Issues: [claw-code issues](https://github.com/your-repo/issues)
- Documentation: See `ARCHITECTURE.md` và `UI_DESIGN.md`
