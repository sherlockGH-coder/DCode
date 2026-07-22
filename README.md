# DeepSeek App

DeepSeek App is a local-first desktop coding assistant for working with software projects through conversation. It combines project-aware chat, file and terminal tools, explicit approval controls, plan-driven execution, MCP integrations, and reusable skills in a native desktop workspace.

> [!IMPORTANT]
> DeepSeek App is an independent open-source project. It is not affiliated with, endorsed by, or an official client of DeepSeek.

## Capabilities

- **Project-aware coding workflows** - Open a local project, inspect its structure, search and read files, apply edits, and run commands without leaving the conversation.
- **Plan and execute modes** - Explore requirements and review a structured implementation plan before allowing the agent to make changes.
- **Human-in-the-loop approvals** - Control file writes, shell commands, external actions, and out-of-scope access with configurable permission policies.
- **MCP and skills** - Connect Model Context Protocol servers and add reusable, project-specific instructions through skills.
- **Agent delegation** - Delegate bounded exploration tasks to sub-agents while keeping the main conversation in control.
- **Integrated development surfaces** - Review tool activity and file changes, preview common file types, use the built-in terminal, and undo eligible edits from a conversation turn.
- **Rich input and context** - Attach files and images, use optional voice transcription and vision models, and compact long conversations when they approach the configured context limit.
- **Local persistence** - Store conversations, projects, tasks, and settings on the local machine. API keys are kept out of the renderer process and use platform secure storage when available.

## Requirements

- Node.js 22
- pnpm 10
- Git

Native dependencies are built for Electron during installation. On macOS, the current package target is Apple silicon. Windows packaging is also configured.

## Quick Start

```bash
git clone https://github.com/sherlockGH-coder/DCode.git
cd DCode
corepack enable
pnpm install
pnpm dev
```

The development command starts the Electron main process, preload bridge, and React renderer with hot reload.

## Model Configuration

Open **Settings > Models** in the application and configure an API profile with:

- an Anthropic Messages-compatible base URL;
- an API key;
- one or more model identifiers;
- a default model for new conversations.

Multiple API profiles can be stored and switched from the application. Optional services are configured separately:

- **Web search:** Tavily API key
- **Speech transcription:** OpenAI-compatible transcription endpoint
- **Vision:** Anthropic, OpenAI, or a custom vision endpoint

Secrets are stored locally and are never exposed through the renderer-facing settings API. Do not commit API keys, local settings, or generated data to the repository.

## Development Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the application in development mode |
| `pnpm typecheck` | Type-check the main, preload, and renderer code |
| `pnpm test` | Run the Vitest test suite |
| `pnpm test:e2e` | Build the app and run Playwright end-to-end tests |
| `pnpm native:smoke` | Verify Electron-native database, terminal, and document dependencies |
| `pnpm build` | Create production bundles |
| `pnpm package:dmg` | Build a macOS DMG |
| `pnpm package-win` | Build the Windows package |

Before packaging a release, run at least:

```bash
pnpm native:smoke
pnpm typecheck
pnpm test
pnpm build
```

## Architecture

DeepSeek App uses Electron, React, and TypeScript. The codebase is divided by process boundary:

```text
src/
├── main/       Electron lifecycle, agent runtime, tools, persistence, and IPC
├── preload/    Narrow, typed bridges exposed to the renderer
├── renderer/   React application and desktop user interface
└── shared/     Cross-process types and contracts
```

The main process owns filesystem access, command execution, model requests, MCP clients, and the SQLite conversation database. The renderer communicates with those capabilities through the preload bridge rather than importing Node.js APIs directly.

## Permissions and Local Access

Coding agents can read files, modify project contents, and execute commands. Review requested actions carefully, especially when working with unfamiliar repositories or MCP servers.

The application provides three permission policies:

- **Default:** read-only tools can run automatically; writes, commands, and external state changes require approval.
- **Auto review:** file operations can run automatically; commands and external state changes still require approval.
- **Full access:** approval prompts are skipped. Use this mode only in trusted projects and environments.

Project path checks and approval prompts reduce accidental access, but they are not a replacement for operating-system isolation. Use a sandbox or disposable environment for untrusted code.

## License

DeepSeek App is available under the [MIT License](LICENSE).
