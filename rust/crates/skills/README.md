# Skills Management Crate

Core Rust library for managing AI skills across multiple AI agents.

## Features

- **Store Integration**: Browse and search skills from skills.sh
- **GitHub Support**: Install skills directly from GitHub repositories
- **Multi-Agent**: Install skills to multiple AI agents (Cursor, Claude Code, Windsurf, etc.)
- **Symlink/Copy**: Flexible installation modes
- **Lockfile**: Track installed skills and versions
- **Update Detection**: Check for skill updates using GitHub tree SHA

## Architecture

```
skills/
├── types.rs          # Core types and structs
├── store.rs          # Skills store API integration
├── github.rs         # GitHub API integration
├── registry.rs       # Agent registry and detection
├── installer.rs      # Installation engine
├── lockfile.rs       # Lockfile management
└── error.rs          # Error types
```

## Usage

### Browse Store

```rust
use skills::store;

let skills = store::get_store_catalog(100, 0).await?;
for skill in skills {
    println!("{}: {}", skill.name, skill.description.unwrap_or_default());
}
```

### Preview GitHub Source

```rust
use skills::github;

let (owner, repo) = github::parse_github_url("vercel-labs/agent-skills")?;
let preview = github::fetch_github_skills(&owner, &repo, "main").await?;

for skill in preview.available_skills {
    println!("Found skill: {}", skill.name);
}
```

### Install Skills

```rust
use skills::{installer, types::*};

let request = InstallRequest {
    source_url: "vercel-labs/agent-skills".to_string(),
    selected_skills: vec!["react".to_string(), "git".to_string()],
    target_agents: vec!["cursor".to_string(), "claude-code".to_string()],
    scope: InstallScope::Global,
    install_mode: InstallMode::Symlink,
};

let result = installer::install_skills(request, None).await?;
println!("Installed {} skills", result.installed_count);
```

### Detect Agents

```rust
use skills::registry;

let agents = registry::detect_installed_agents()?;
println!("Detected agents: {:?}", agents);
```

## Canonical Directory

Skills are stored in a canonical directory to avoid duplication:

- **Global**: `~/.codex/skills/`
- **Project**: `./.codex/skills/`

For non-universal agents (e.g., Cursor), symlinks are created from the canonical directory to the agent's skills directory:

```
~/.codex/skills/react/  (canonical)
    ↓ symlink
~/.cursor/skills/react/
```

## Lockfile

The lockfile tracks installed skills and their versions:

```json
{
  "version": "1.0",
  "skills": {
    "react": {
      "name": "react",
      "source": {
        "type": "GitHub",
        "owner": "vercel-labs",
        "repo": "agent-skills",
        "path": "skills/react"
      },
      "version": null,
      "tree_sha": "abc123...",
      "installed_at": "2026-04-10T10:30:00Z",
      "agents": ["cursor", "claude-code"]
    }
  }
}
```

## Security

- **Path Traversal Protection**: Skill names are sanitized to prevent `../` attacks
- **Canonical Path Validation**: All paths are canonicalized before operations
- **Safe Base Directory**: Operations are restricted to allowed directories

## Cross-Platform

- **Windows**: Uses `symlink_dir` (requires admin or Developer Mode)
- **Unix**: Uses standard `symlink`
- **Fallback**: Automatically falls back to copy mode if symlink fails

## Testing

```bash
cargo test -p skills
```

## Integration with Tauri

See `claw-desktop/src-tauri/src/adapters/inbound/skills_commands.rs` for Tauri command integration.
