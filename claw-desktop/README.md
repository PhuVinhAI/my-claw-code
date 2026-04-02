# Claw Desktop

AI Coding Assistant Desktop App built with Tauri + React + shadcn/ui

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS 4
- **Desktop**: Tauri 2.0
- **Backend**: Rust (Claw Code runtime)

## Development

```bash
# Install dependencies
npm install

# Run dev server (frontend only)
npm run dev

# Run Tauri app (desktop)
npm run tauri dev

# Build for production
npm run tauri build
```

## Features

- ✅ Modern chat UI with shadcn/ui components
- ✅ Dark mode support
- ✅ Responsive design
- 🚧 Integration with Claw Code runtime (coming soon)
- 🚧 Real-time streaming responses
- 🚧 Tool execution visualization
- 🚧 Permission prompts

## Project Structure

```
claw-desktop/
├── src/                    # React frontend
│   ├── components/         # shadcn/ui components
│   ├── lib/               # Utilities
│   └── App.tsx            # Main app
├── src-tauri/             # Tauri Rust backend
│   ├── src/               # Rust code
│   └── Cargo.toml         # Rust dependencies
└── package.json           # Node dependencies
```

## Next Steps

1. Test shadcn/ui components: `npm run dev`
2. Integrate Claw Code runtime into Tauri backend
3. Implement IPC commands for chat
4. Add streaming support with SSE or WebSocket
5. Build permission prompt system
