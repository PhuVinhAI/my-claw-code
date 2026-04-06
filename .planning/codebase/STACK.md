# Tech Stack

## Frontend (Claw Desktop)
- **Language**: TypeScript, HTML, CSS
- **Framework**: React (Vite bundler)
- **State Management**: Zustand (Finite State Machine pattern)
- **UI Components**: Shadcn, Base UI
- **Styling**: Tailwind CSS v4, Framer Motion
- **Terminal Emulator**: xterm.js (with various addons)

## Backend (Claw Core)
- **Language**: Rust
- **Framework**: Tauri v2
- **Crates**: api-client, runtime, tools, commands, plugins, compat-harness, claw-cli
- **Concurrency**: Tokio (Actor Pattern via MPSC)

## Build Tools
- **Package Manager**: npm/cargo
- **Dev Server**: Vite for React, Cargo for Rust
