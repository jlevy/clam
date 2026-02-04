---
title: Plan Spec - clam-code Coding Spike
description: Spike to build a true-scrollback ACP client for Claude Code with usable UX
author: Joshua Levy with LLM assistance
---

# clam-code - True Scrollback ACP Client for Claude Code

**Date:** 2026-02-03 (last updated 2026-02-03)

**Status:** In Progress - Phase 1 & 2 Complete, Phase 3 Not Started

### Implementation Progress Summary

| Phase                              | Status         | Notes                                       |
| ---------------------------------- | -------------- | ------------------------------------------- |
| **Phase 1: Minimal Viable Client** | ✅ Complete    | All 5 sub-phases done                       |
| **Phase 2: Usable UX Polish**      | ✅ Complete    | npm publishing pending                      |
| **Stretch: Slash Commands**        | 🔶 Partial     | Local commands done, ACP routing pending    |
| **Stretch: Autocomplete**          | 🔶 Partial     | Slash completion done, file/history pending |
| **Phase 3: Shell Support**         | ❌ Not Started | Design complete, no code yet                |

### Remaining Work (Priority Order)

**High Priority - Core Functionality:**

1. **ACP Command Routing** - Route `/commit`, `/review`, `/model`, etc. to Claude Code
   - Parse `available_commands_update` events (already received in acp.ts)
   - Display in `/help` and tab completion
   - Send commands through ACP session
2. **npm Packaging** - Test and publish to npm registry

**Medium Priority - UX Improvements:** 3. **File Path Completion** - Tab complete `@path/to/file` mentions 4. **Command History Persistence** - Save/load history from `~/.clam/code/history` 5. **History Navigation** - Enable readline's built-in up/down history

**Lower Priority - Phase 3 (Shell Support):** 6. **Shell Module** - Create `lib/shell.ts` with `which`, `exec`, `getCompletions` 7. **Mode Detection** - Create `lib/mode-detection.ts` for shell vs NL detection 8. **Input Integration** - Route shell commands directly, add input coloring 9. **Partial Command Rejection** - Reject incomplete single-word inputs

**Codename:** `clam-code`

## Overview

This is a **coding spike** to validate the feasibility of building a true terminal
scrollback ACP client for Claude Code.
The goal is a proof-of-concept that demonstrates:

1. **True terminal scrollback** - NOT TUI re-rendering (no alternate screen)
2. **Basic but usable UX** - Good enough to actually use for coding tasks
3. **ACP protocol integration** - Connect to Claude Code via the `claude-code-acp`
   adapter
4. **Foundation for Clam** - Suitable for eventual integration with Clam terminal

This spike does **NOT** implement Clam Codes or rich overlays - but it establishes the
architecture that will gracefully upgrade to Clam GUI behaviors when the terminal
supports Clam codes.
The spike should be a solid base for the real implementation.

### Why This Spike?

From
[research-2026-02-02-acp-clam-terminal-ui.md](../../research/active/research-2026-02-02-acp-clam-terminal-ui.md):

> **NO existing terminal-based ACP client uses true terminal scrollback.** All use
> either TUI re-rendering or web/DOM-based scrolling.

This is a significant gap.
Existing clients all have scrolling issues:

- **Toad**: Textual framework uses alternate screen (history disappears on exit)
- **OpenCode**: Web app with DOM scrolling (not a terminal at all)
- **Claude Code CLI**: ANSI cursor repositioning (causes scrolling artifacts)
- **Codex CLI**: Similar to Claude Code, uses ANSI positioning

The spike validates that we can build a client with:

- Content flowing into terminal’s native scrollback buffer
- No cursor repositioning during streaming output
- Works identically over SSH (just bytes through pipe)
- History preserved when exiting the app

## Goals

1. **Validate true scrollback architecture** - Sequential print to stdout works for ACP
   event rendering
2. **Prove ACP integration** - Connect to Claude Code via `claude-code-acp` adapter
3. **Usable UX** - Permission prompts, tool output, streaming text all work
4. **SSH-compatible** - Works over remote connections without modification
5. **Semantic output interface** - All output through a controlled API that can upgrade
   to Clam codes
6. **Rich input with autocomplete** - Slash commands, file completion, satisfying UX

## Non-Goals

- Clam Codes protocol support (future work)
- Rich overlays, tooltips, popovers (future - will upgrade from semantic blocks)
- Collapsible sections (future - will upgrade from truncated blocks)
- Diff viewers, embedded editors (future)
- Multi-session/tab support
- Session persistence/resume
- Full feature parity with Claude Code CLI

## Background

### ACP Protocol Summary

ACP (Agent Client Protocol) is Zed’s standard for agent-editor communication:

- **Transport**: JSON-RPC over stdin/stdout (NDJSON)
- **Events**: `session/update` notifications for streaming UI updates
- **Content**: Structured blocks (text, image, resource, diff, terminal)
- **Permissions**: `session/request_permission` for safety-critical operations

Key event types we need to handle:

- `agent_message_chunk` - Streaming model output
- `tool_call` - Tool invocation start (id, title, kind, status)
- `tool_call_update` - Progress and completion with content
- `plan` - Task plan entries
- `request_permission` - Permission requests with options

### Reference Implementations

| Project                                                                                  | What to Study                                                                                     | What NOT to Copy                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| [claude-code-acp](https://github.com/zed-industries/claude-code-acp)                     | ACP adapter for Claude Code                                                                       | -                                |
| [Toad](https://github.com/batrachianai/toad)                                             | Autocomplete, slash commands, diff logic, permission UX                                           | TUI rendering (alternate screen) |
| [OpenCode](https://github.com/anomalyco/opencode)                                        | Auto-scroll logic, state management                                                               | Web UI architecture              |
| [Codex CLI](https://github.com/openai/codex)                                             | Input UX, slash commands, terminal interaction                                                    | ANSI cursor positioning          |
| [@agentclientprotocol/sdk](https://github.com/agentclientprotocol/agent-client-protocol) | TypeScript SDK for ACP clients                                                                    | -                                |
| [kash](repos/kash)                                                                       | **Hybrid shell/NL mode, `which`-based detection, partial command rejection, semantic completion** | Python/xonsh (we use TypeScript) |

**Key learnings from reference implementations:**

- **Toad**: Has excellent autocomplete and slash command UX via Textual's completion
  widgets. Study the completion matching algorithms and UX patterns, but NOT the TUI
  rendering approach.
- **OpenCode**: Sophisticated auto-scroll handling that distinguishes between user
  scroll and auto-scroll.
  Worth studying for overlay anchoring (future work).
- **Codex CLI**: Clean slash command implementation.
  Study the command parsing and help system.
- **kash**: Production implementation of hybrid shell/NL mode. Key patterns for Phase 3:
  - Automatic mode detection via `which` lookup on first word
  - Space-at-start shortcut for NL mode
  - Partial command rejection (don't submit invalid single words)
  - Two-stage Tab completion (lexical first, semantic second)
  - Prompt visual feedback (different colors for shell vs NL mode)
  - See [research-2026-02-03-richer-terminal-shell-uis.md](../../research/active/research-2026-02-03-richer-terminal-shell-uis.md) for detailed analysis.

### CLI Best Practices Reference

This spike is a proof-of-concept but should follow **production-ready best practices**
from established TypeScript CLI tools.

**Primary Reference**: [tbd](https://github.com/jlevy/tbd) - A well-structured
TypeScript CLI that demonstrates modern patterns for standalone CLI tools.

**Key patterns to follow** (from `tbd guidelines typescript-cli-tool-rules`):

| Pattern                | Implementation                                                              |
| ---------------------- | --------------------------------------------------------------------------- |
| **Colors**             | Use `picocolors` (aliased as `pc`) - NEVER hardcoded ANSI codes             |
| **Shared formatting**  | Create `lib/formatting.ts` with `colors.success()`, `colors.error()`, etc.  |
| **TTY detection**      | Let picocolors handle it automatically (respects `NO_COLOR`, `FORCE_COLOR`) |
| **Error handling**     | Catch at top level, clear messages, proper exit codes (0/1)                 |
| **Environment vars**   | Support `.env` and `.env.local` via `dotenv`, fail fast on missing vars     |
| **Testing with pipes** | Verify `clam-code                                                           |
| **Global options**     | `--verbose`, `--quiet`, `--dry-run` (future: `--format json`)               |
| **Stdout/stderr**      | Data to stdout, errors to stderr for pipeline compatibility                 |

**Package structure** (adapted from tbd patterns):

```
packages/clam-code/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── bin.ts            # #!/usr/bin/env node shebang entry
│   ├── lib/
│   │   ├── output.ts     # OutputWriter implementation
│   │   ├── input.ts      # InputReader implementation
│   │   ├── formatting.ts # Shared color utilities
│   │   ├── acp.ts        # ACP client wrapper
│   │   └── config.ts     # Configuration loading
│   └── commands/
│       └── slash.ts      # Slash command registry
├── package.json
├── tsconfig.json
└── tsdown.config.ts      # Build configuration
```

**Build tooling**:

- **tsdown** for ESM/CJS dual output with TypeScript declarations
- **Vitest** for unit testing
- **lefthook** for git hooks (format, lint, typecheck on commit)
- **Biome** for formatting and linting (consistent with clamg monorepo)

### ACP Client Integration Pattern

Based on research into Toad and the claude-code-acp adapter, here is exactly how ACP
clients integrate with agents like Claude Code:

#### How It Works

1. **Agent Discovery**: Agents are registered in TOML files with metadata and a
   `run_command`:

   ```toml
   # repos/toad/src/toad/data/agents/claude.com.toml
   name = "Claude Code"
   run_command."*" = "claude-code-acp"  # The command to spawn
   ```

2. **Client Spawns Agent**: The ACP client (e.g., Toad, Zed, or our clam-code) spawns
   the agent as a subprocess:

   ```python
   # From toad/src/toad/acp/agent.py:480
   process = await asyncio.create_subprocess_shell(
       command,  # "claude-code-acp"
       stdin=PIPE,
       stdout=PIPE,
       stderr=PIPE,
       cwd=str(project_root_path),
   )
   ```

3. **Communication Protocol**: JSON-RPC over NDJSON (newline-delimited JSON):
   - Client sends requests via stdin
   - Agent sends responses and notifications via stdout
   - All errors/logs go to stderr to keep stdout clean

4. **Session Flow**:
   ```
   Client                           Agent (claude-code-acp)
     |                                    |
     |-- initialize ---------------------->|  (establish connection)
     |<----------------- capabilities ----|  (agent capabilities)
     |                                    |
     |-- session/new -------------------->|  (create session)
     |<----------------- session_id ------|
     |                                    |
     |-- session/prompt ----------------->|  (send user input)
     |<--- session/update (streaming) ----|  (tool calls, messages, etc.)
     |<--- session/request_permission ----|  (permission requests)
     |-- permission response ------------>|
     |<--- session/update (more) ---------|
     |<--- session/prompt response -------|  (stop reason)
   ```

#### Claude Options Exposure

Claude options ARE exposed through the `NewSessionMeta` object.
From `repos/claude-code-acp/src/acp-agent.ts`:

```typescript
// Claude Agent SDK integration
const { session, result } = await query({
  prompt: userInput,
  options: {
    cwd: meta.workingDirectory,           // Working directory
    permissionMode: "always-ask",          // Permission mode
    mcpServers: meta.mcpServers,           // MCP servers
    hooks: { ... },                         // Event hooks
    tools: { allowed: [...], denied: [...] },
    systemPrompt: meta.customSystemPrompt, // Custom system prompt
  }
});
```

Available options include:

- `cwd` - Working directory for the session
- `permissionMode` - How to handle permissions
- `mcpServers` - MCP servers to connect
- `systemPrompt` - Custom system prompt
- `tools` - Tool allow/deny lists

#### DX Summary

**For ACP Client Developers (us)**:

- We spawn `claude-code-acp` as a subprocess
- We send prompts via `session/prompt` method
- We receive streaming updates via `session/update` notifications
- We handle permission requests via `session/request_permission`
- We do NOT need to interact with Claude CLI directly

**For End Users**:

- They run our client (e.g., `clam-code`)
- We internally spawn the appropriate agent
- They never see the underlying `claude-code-acp` command
- Configuration can be passed through our client

#### Agent Commands from Toad Registry

Example commands for various agents: | Agent | Command | | --- | --- | | Claude Code |
`claude-code-acp` | | OpenCode | `opencode acp` | | Gemini | `gemini --experimental-acp`
| | Codex | `npx @zed-industries/codex-acp` | | Goose | `goose acp` | | OpenHands |
`openhands acp` |

### Key Architecture Decision: Semantic Output Interface

All output goes through a **semantic output interface** (`OutputWriter`) that:

1. Provides methods for different content types (info, warning, error, codeBlock, etc.)
2. Renders to ANSI-colored text in standard terminals
3. **Gracefully upgrades** to Clam GUI behaviors when Clam codes are enabled
4. Allows centralized control over output formatting and behavior

```
┌─────────────────────────────────────────────────────────────────────┐
│  clam-code CLI                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ACP Client                                                   │  │
│  │  - Spawns claude-code-acp adapter as subprocess               │  │
│  │  - Receives session/update events via NDJSON                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  OutputWriter (Semantic Interface)                            │  │
│  │  - .info(), .warning(), .error(), .codeBlock(), etc.          │  │
│  │  - .toolHeader(), .toolOutput(), .diffSummary()               │  │
│  │  - .permissionPrompt(), .thinking(), .streaming()             │  │
│  │  - NO direct console.log() anywhere else in codebase          │  │
│  │  - Renders ANSI now, Clam codes in future                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  User's Terminal                                              │  │
│  │  - Native scrollback buffer (instant scroll, no re-render)    │  │
│  │  - Works in any terminal (xterm, iTerm, Ghostty, SSH)         │  │
│  │  - Gracefully upgrades to Clam GUI if terminal supports it    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Core Principle**: NO `console.log()` anywhere in the codebase.
All output through `OutputWriter`. This gives us full control and enables future Clam
code integration.

## Design

### Naming and Configuration

**Codename:** `clam-code`

**Configuration location:** `~/.clam/code/`

```
~/.clam/
└── code/
    ├── config.json       # User configuration
    ├── permissions.json  # Saved permission decisions
    └── history/          # Command history (future)
```

### Technology Choices

| Component           | Choice                     | Rationale                                             |
| ------------------- | -------------------------- | ----------------------------------------------------- |
| **Language**        | TypeScript                 | ACP SDK is TypeScript, team expertise                 |
| **Runtime**         | Node.js 22+                | Better npm compatibility than Bun for native modules  |
| **Package Manager** | npm                        | Consistency with clamg monorepo, broad compatibility  |
| **ACP SDK**         | `@agentclientprotocol/sdk` | Official SDK                                          |
| **Adapter**         | `claude-code-acp`          | Official Claude Code adapter                          |
| **CLI Framework**   | None (minimal)             | Avoid framework overhead, direct stdin/stdout         |
| **Colors**          | `picocolors`               | Fast, dependency-free ANSI colors, auto TTY detection |
| **Input**           | Custom `InputReader`       | Rich input with autocomplete (see below)              |
| **Output**          | Custom `OutputWriter`      | Semantic output interface                             |
| **Env Loading**     | `dotenv`                   | Support `.env` and `.env.local` files                 |
| **Build**           | `tsdown`                   | Fast ESM/CJS dual output with declarations            |
| **Testing**         | `Vitest`                   | Fast, TypeScript-native testing                       |
| **Linting**         | `Biome`                    | Formatting + linting (clamg monorepo standard)        |
| **Git Hooks**       | `lefthook`                 | Fast pre-commit hooks                                 |

### Launch Mechanism

```bash
# Run clam-code directly
npx clam-code

# Or installed globally
npm install -g @clam/code
clam-code

# With options
clam-code --config ~/.clam/code/config.json
clam-code --cwd /path/to/project
```

### OutputWriter: Semantic Output Interface

**Critical design requirement**: All output through `OutputWriter`, never direct
`console.log()`. This enables:

- Centralized formatting control
- Easy enable/disable of output types
- Future Clam code integration without code changes

```typescript
interface OutputWriter {
  // Basic output types
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  success(message: string): void;
  debug(message: string): void; // Only if verbose mode

  // Structured content
  codeBlock(code: string, language?: string): void;
  diffBlock(path: string, additions: number, deletions: number, content: string): void;
  toolHeader(title: string, kind: string, status: ToolStatus): void;
  toolOutput(content: string, options?: { truncateAfter?: number }): void;

  // Interactive elements
  permissionPrompt(tool: string, command: string, options: PermissionOption[]): void;
  thinking(charCount: number): void; // Collapsed indicator

  // Streaming
  streamStart(): void;
  streamChunk(text: string): void;
  streamEnd(): void;

  // Separators and formatting
  separator(): void;
  newline(): void;
}
```

**Output Truncation (Spike Default):**

For this spike, all tool outputs are **truncated after 10 lines** by default:

```
▶ Tool: bash [execute] ✓
$ npm test

> @clam/code@0.1.0 test
> vitest run

 ✓ src/output.test.ts (5)
 ✓ src/input.test.ts (3)
 ✓ src/acp.test.ts (8)
... (47 more lines)
───────────────────────────────────────────────────────────
```

**TODO (Future Clam Integration):** These truncated blocks will become expandable
overlay blocks when Clam codes are enabled.
The truncation markers will trigger popovers showing full content.

### InputReader: Rich Input Interface

The input system must provide satisfying autocomplete and slash command support, similar
to Toad and Codex CLI, but without TUI rendering.

**Research needed:** Study how OpenCode, Toad, and Codex CLI implement autocomplete:

- **Tab completion** for slash commands, file paths, `@` mentions
- **Inline suggestions** that appear as you type (ghost text)
- **History navigation** with up/down arrows

**Input modes:**

1. **Single-line**: Normal prompt input with readline
2. **Multi-line**: Similar to other tools - detect paste, support `\` line continuation
3. **Permission response**: Numbered options (1-4)

**Multi-line input** should work like other terminal tools:

- Detect multi-line paste and handle gracefully
- Support backslash (`\`) for line continuation
- `$EDITOR` integration for complex input (`/edit` command)

```typescript
interface InputReader {
  // Prompt for input with optional completion
  prompt(options?: PromptOptions): Promise<string>;

  // Register completion providers
  registerCompletions(provider: CompletionProvider): void;

  // Slash command registration
  registerSlashCommand(command: SlashCommand): void;
}

interface CompletionProvider {
  // Return completions for current input
  getCompletions(input: string, cursorPos: number): Completion[];
}

interface SlashCommand {
  name: string; // e.g., "help", "clear", "model"
  description: string;
  execute(args: string): Promise<void>;
}
```

### Slash Commands (Spike)

| Command            | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `/help`            | Show available commands                                 |
| `/quit` or `/exit` | Exit clam-code                                          |
| `/clear`           | Clear terminal (if possible without cursor positioning) |
| `/status`          | Show session status (permissions, token usage)          |
| `/model`           | Show or switch model                                    |
| `/config`          | Show current configuration                              |

**Stretch goal**: `/edit` to open `$EDITOR` for multi-line input.

### Permission Prompt UX

Critical for usability - must be clear and easy to respond:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Permission Required                                                  │
│                                                                      │
│ Tool: bash                                                           │
│ Command: rm -rf node_modules && npm install                          │
│                                                                      │
│ Options:                                                             │
│   [1] Allow once                                                     │
│   [2] Allow always (this session)                                    │
│   [3] Reject once                                                    │
│   [4] Reject always (this session)                                   │
│                                                                      │
│ Enter choice (1-4):                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

User types `1`, `2`, `3`, or `4` and presses Enter.
Simple and unambiguous.

### Error Handling

- **Connection errors**: Print clear message via `output.error()`, offer retry
- **Adapter not found**: Guide user to install `claude-code-acp`
- **Permission denied**: Show what was denied and continue
- **Stream errors**: Graceful recovery, don’t crash

## Implementation Plan

### Phase 1: Minimal Viable Client

**Goal**: Connect to Claude Code via ACP and render streaming output with true
scrollback through semantic output interface.

#### 1.1 Project Setup ✅ COMPLETE

- [x] Create `packages/clam-code/` in clamg monorepo
- [x] Create `package.json` with proper `bin`, `exports`, `engines` fields
- [x] Configure `tsconfig.json` extending monorepo base
- [ ] Configure `tsdown.config.ts` for ESM/CJS dual output (using tsx directly for now)
- [x] Add dependencies:
  - `@agentclientprotocol/sdk` - ACP client
  - `picocolors` - Terminal colors
  - `dotenv` - Environment loading
- [x] Add dev dependencies:
  - `vitest` - Testing
  - `@types/node` - Node.js types
- [x] Create directory structure:
  - `src/bin.ts` - CLI entry with shebang
  - `src/index.ts` - Main exports
  - `src/lib/` - Core implementations
  - (slash commands in lib/input.ts, not separate folder)
- [x] Create `lib/formatting.ts` with shared color utilities
- [x] Set up `~/.clam/code/` config directory structure
- [x] Add npm scripts: `build`, `dev`, `test`, `typecheck`

#### 1.2 OutputWriter Implementation ✅ COMPLETE

- [x] Create `OutputWriter` interface and implementation
- [x] Implement all semantic output methods (info, warning, error, etc.)
- [x] Implement `codeBlock()` with syntax highlighting hints
- [x] Implement `toolHeader()` and `toolOutput()` with 10-line truncation
- [x] Implement `diffBlock()` with color-coded +/- lines
- [x] Implement `permissionPrompt()` rendering
- [x] Add `// TODO: Clam code upgrade point` comments at key locations
- [x] **Strict rule**: No `console.log()` anywhere else in codebase

#### 1.3 ACP Connection ✅ COMPLETE

- [x] Implement subprocess spawn for `claude-code-acp`
- [x] Handle NDJSON stream parsing
- [x] Implement event loop for `session/update` events
- [x] Handle connection lifecycle (connect, disconnect, errors)
- [x] Route all ACP events through `OutputWriter`

#### 1.4 Basic InputReader ✅ COMPLETE

- [x] Create `InputReader` interface and implementation
- [x] Implement basic readline-based prompt
- [x] Handle special commands (`/quit`, `/help`)
- [x] Handle Ctrl+C for interruption (with double-Ctrl+C to exit)
- [x] Send user input to ACP session

#### 1.5 Permission Handling ✅ COMPLETE

- [x] Parse `request_permission` events
- [x] Render permission prompt via `OutputWriter.permissionPrompt()`
- [x] Capture user response and send to ACP (letter shortcuts a/A/d/D)
- [x] Handle "allow always" / "reject always" session state
- [x] Save permission decisions to `~/.clam/code/permissions.json`

### Phase 2: Usable UX Polish

**Goal**: Make the client pleasant to use for real coding tasks.

#### 2.1 Enhanced OutputWriter ✅ COMPLETE

- [x] Refine all output formatting based on testing
- [x] Add visual separators between tool calls
- [x] Add timestamps to tool outputs (optional, via config)
- [x] Implement `thinking()` indicator (collapsed by default)
- [x] Show token usage after completion

#### 2.2 Configuration System ✅ COMPLETE

- [x] Load config from `~/.clam/code/config.json`
- [x] Support environment variable overrides (`CLAM_CODE_*`)
- [x] Document all configuration options (in --help and README)
- [x] `/config` command to show current settings

#### 2.3 Multi-line Input ✅ COMPLETE

- [x] Detect paste events (multi-line input) - via two-enters mode
- [x] Support backslash line continuation
- [x] `/edit` command to open `$EDITOR`
- [x] Handle multi-line gracefully without cursor positioning

#### 2.4 Documentation & Packaging 🔶 PARTIAL

- [x] Write README with installation and usage instructions
- [x] Document launch options and configuration
- [x] Add `--help` output
- [ ] Package for npm distribution (not yet tested/published)

### Stretch Goal: Slash Commands & Autocomplete

**Goal**: Clone satisfying autocomplete and slash command UX from Claude Code, Toad, and
Codex CLI.

#### S.1 Slash Command Framework 🔶 PARTIAL

- [x] Research Toad's slash command implementation (`toad/slash_command.py`)
- [x] Research Codex CLI's command system
- [x] Implement slash command registry (local commands)
- [x] Tab completion for slash commands
- [x] Help text for each command
- [ ] Expose ACP commands via `available_commands_update` event
- [ ] Route ACP commands (e.g., `/commit`, `/review`) to Claude Code

#### S.2 Autocomplete System 🔶 PARTIAL

- [x] Research terminal autocomplete libraries (Node.js) - see research doc
- [x] Research how OpenCode/Toad/Codex implement inline suggestions
- [x] Implement completion provider interface (for slash commands)
- [ ] File path completion for `@` mentions
- [ ] History-based completion
- [ ] Ghost text / inline suggestions (requires Rust bindings or Clam overlays)

#### S.3 Additional Slash Commands 🔶 PARTIAL

Local commands implemented:

| Command          | Description                 | Status |
| ---------------- | --------------------------- | ------ |
| `/help`          | Show available commands     | ✅     |
| `/quit`, `/exit` | Exit clam-code              | ✅     |
| `/clear`         | Clear screen                | ✅     |
| `/status`        | Show session status         | ✅     |
| `/config`        | Show current configuration  | ✅     |
| `/edit`          | Open $EDITOR for multi-line | ✅     |

ACP commands (need routing implementation):

| Command         | Description                  | Status        |
| --------------- | ---------------------------- | ------------- |
| `/model [name]` | Show or switch model         | ❌ Not routed |
| `/compact`      | Compact conversation history | ❌ Not routed |
| `/tokens`       | Show token usage             | ❌ Not routed |
| `/permissions`  | Show granted permissions     | ❌ Not routed |
| `/commit`       | Git commit workflow          | ❌ Not routed |
| `/review`       | Code review                  | ❌ Not routed |

## Testing Strategy

### Manual Testing Checklist

1. **True scrollback verification**:
   - Start client, run several prompts
   - Scroll up with mouse/keyboard - should work instantly
   - Exit client (`/quit`), scroll up in terminal - history should remain

2. **SSH compatibility**:
   - SSH to remote machine
   - Run clam-code
   - Verify identical behavior to local

3. **Permission flow**:
   - Trigger a tool that requires permission
   - Test all four options (allow once/always, reject once/always)
   - Verify state persists correctly within session

4. **Output truncation**:
   - Run a command with long output (>10 lines)
   - Verify truncation with “... (N more lines)” indicator
   - (Future: verify this becomes expandable in Clam)

5. **Semantic output**:
   - Verify all output goes through `OutputWriter`
   - Grep codebase for `console.log` - should find none (except in tests)

6. **Error handling**:
   - Start without `claude-code-acp` installed
   - Interrupt mid-stream with Ctrl+C
   - Network disconnect during operation

### Automated Tests

- Unit tests for `OutputWriter`:
  - Verify ANSI output format
  - Verify NO cursor positioning codes (`\x1b[H`, `\x1b[2J`, etc.)
  - Verify truncation at 10 lines
  - Test with `NO_COLOR=1` (should strip ANSI)
- Unit tests for `InputReader` (command parsing, completion)
- Unit tests for permission prompt parsing
- Integration test: connect to mock ACP server
- **Pipeline test**: `echo "test" | clam-code --help | cat` should have no ANSI codes
- **Lint rule**: Biome rule or grep check for no `console.log` outside of `OutputWriter`
- **Exit code test**: Verify proper exit codes (0 for success, 1 for errors)

## Resolved Questions

1. **Configuration location**: Files in `~/.clam/code/`

2. **Multi-line input**: Similar to other tools - paste detection, backslash
   continuation, `$EDITOR` integration

3. **Output truncation**: 10 lines default, with TODO markers for future Clam overlay
   upgrade

4. **How does ACP client integration work?** (See “ACP Client Integration Pattern”
   section above)
   - Client spawns agent as subprocess (e.g., `claude-code-acp`)
   - Communication via JSON-RPC over NDJSON on stdin/stdout
   - Claude options ARE exposed via `NewSessionMeta` (cwd, permissionMode, mcpServers,
     systemPrompt, tools)
   - No direct Claude CLI interaction - the adapter handles everything

## Open Questions

1. ~~**Best library for terminal autocomplete in Node.js?**~~
   - **RESOLVED:** Using Node.js readline’s built-in `completer` option for Tab
     completion. Works with scrollback.
     Ghost text/hints would require Rust bindings (rustyline/reedline) or future Clam
     overlays. See
     [research-2026-02-03-terminal-ui-libraries.md](../../research/active/research-2026-02-03-terminal-ui-libraries.md).

2. **How to handle `$EDITOR` integration?**
   - ✅ Implemented: Spawn editor, read temp file after close
   - Falls back to `nano` if no `$EDITOR` set

3. **Should we support conversation resume?**
   - ACP may support session persistence
   - Defer to future work

4. **How to expose Claude Code’s slash commands?**
   - See “Slash Command Integration” section in Spike Learnings
   - Parse `available_commands_update` from ACP
   - Display in `/help` and tab completion
   - Route directly to Claude Code

## References

### ACP & Agent Clients

- [ACP Protocol Spec](https://agentclientprotocol.com/protocol/overview)
- [claude-code-acp adapter](https://github.com/zed-industries/claude-code-acp)
- [OpenAI Codex CLI](https://github.com/openai/codex) - Terminal UX reference
- [Toad](https://github.com/batrachianai/toad) - Autocomplete/slash command patterns
- [OpenCode](https://github.com/anomalyco/opencode) - Auto-scroll, state management

### CLI Best Practices

- [tbd](https://github.com/jlevy/tbd) - Production-quality TypeScript CLI reference
- `tbd guidelines typescript-cli-tool-rules` - CLI development patterns
- `tbd guidelines cli-agent-skill-patterns` - Agent-integrated CLI patterns

### Clam Project

- [ACP Research Brief](../../research/active/research-2026-02-02-acp-clam-terminal-ui.md)
- [Clam Ghostty Plan Spec](./plan-2026-02-02-clam-rich-terminal.md)

### Research Documents (clam-code specific)

- [Terminal UI Libraries for TypeScript](../../research/active/research-2026-02-03-terminal-ui-libraries-for-typescript.md)
  - Comprehensive survey of readline, TUI frameworks, Rust bindings
  - Comparison table: scrollback compatibility, ghost text, keybindings
  - Recommendation: Node.js readline for now, Rust bindings (reedline/rustyline) for future
- [Richer Terminal Shell UIs](../../research/active/research-2026-02-03-richer-terminal-shell-uis.md)
  - Hybrid shell/NL mode design patterns from kash
  - Mode detection rules, partial command rejection, input coloring
  - Kitty keyboard protocol for Shift+Enter detection

### Shell Integration Reference (Phase 3)

- [kash source](repos/kash) - Python/xonsh hybrid shell implementation
  - `src/kash/xonsh_custom/xonsh_keybindings.py` - Keybinding patterns
  - `src/kash/shell/completions/shell_completions.py` - Completion scoring
  - `src/kash/help/help_embeddings.py` - Semantic search

---

## Detailed Implementation: Main Loop Integration (Bead kg-mfpi)

This section provides the complete implementation plan for wiring up the existing
modules (`AcpClient`, `InputReader`, `OutputWriter`) in `bin.ts` to create a working
end-to-end ACP client.

### Current State Analysis

**Existing Modules (All Implemented):**

| Module         | File                | Status      | Key Methods                                                                     |
| -------------- | ------------------- | ----------- | ------------------------------------------------------------------------------- |
| `OutputWriter` | `src/lib/output.ts` | ✅ Complete | `info()`, `toolHeader()`, `toolOutput()`, `permissionPrompt()`, `streamChunk()` |
| `InputReader`  | `src/lib/input.ts`  | ✅ Complete | `start()`, `stop()`, `onPrompt` callback, slash commands                        |
| `AcpClient`    | `src/lib/acp.ts`    | ✅ Complete | `connect()`, `prompt()`, `disconnect()`, `onPermission` callback                |
| `Config`       | `src/lib/config.ts` | ✅ Complete | `loadConfig()`, `ensureConfigDir()`                                             |

**Missing Piece:** The `main()` function in `bin.ts` currently shows a warning message
instead of wiring these modules together.

### ACP Protocol Flow (From Research)

Based on analysis of `claude-code-acp` adapter and `@agentclientprotocol/sdk`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  clam-code bin.ts                                                           │
│                                                                             │
│  1. Create OutputWriter                                                     │
│  2. Create AcpClient with callbacks:                                        │
│     - onPermission: async (tool, command, options) => selectedOptionId      │
│     - onComplete: (stopReason) => void                                      │
│     - onError: (error) => void                                              │
│  3. Connect AcpClient (spawns claude-code-acp, initializes, creates session)│
│  4. Create InputReader with callbacks:                                      │
│     - onPrompt: async (text) => AcpClient.prompt(text)                      │
│     - onQuit: () => cleanup and exit                                        │
│  5. Start InputReader loop                                                  │
│                                                                             │
│  Main Loop:                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  User types prompt                                                    │  │
│  │       ↓                                                               │  │
│  │  InputReader.onPrompt(text)                                           │  │
│  │       ↓                                                               │  │
│  │  AcpClient.prompt(text)                                               │  │
│  │       ↓                                                               │  │
│  │  ACP sends session/update events:                                     │  │
│  │    - agent_message_chunk → OutputWriter.streamChunk()                 │  │
│  │    - agent_thought_chunk → OutputWriter.thinking()                    │  │
│  │    - tool_call → OutputWriter.toolHeader()                            │  │
│  │    - tool_call_update → OutputWriter.toolOutput()                     │  │
│  │    - plan → OutputWriter.info() for each entry                        │  │
│  │       ↓                                                               │  │
│  │  If permission needed:                                                │  │
│  │    AcpClient.onPermission(tool, command, options)                     │  │
│  │       ↓                                                               │  │
│  │    OutputWriter.permissionPrompt() displays options                   │  │
│  │       ↓                                                               │  │
│  │    Wait for user input (1-4)                                          │  │
│  │       ↓                                                               │  │
│  │    Return selected optionId                                           │  │
│  │       ↓                                                               │  │
│  │  Agent completes → back to input prompt                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Exit: /quit → InputReader.stop() → AcpClient.disconnect() → process.exit() │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Permission Handling Challenge

**Problem:** The `onPermission` callback in `AcpClient` is async and must return a
Promise that resolves with the selected option ID. But `InputReader` has its own running
readline loop.

**Solution:** Use a Promise + resolver pattern:

```typescript
// State for permission handling
let permissionResolver: ((optionId: string) => void) | null = null;
let pendingPermissionOptions: PermissionOption[] | null = null;

// In AcpClient.onPermission callback:
onPermission: async (_tool, _command, options) => {
  pendingPermissionOptions = options;
  // OutputWriter.permissionPrompt() already called by AcpClient
  return new Promise<string>((resolve) => {
    permissionResolver = resolve;
  });
};

// In InputReader.onPrompt callback:
onPrompt: async (text) => {
  // Check if we're waiting for a permission response
  if (permissionResolver && pendingPermissionOptions) {
    const choice = parseInt(text, 10);
    if (choice >= 1 && choice <= pendingPermissionOptions.length) {
      const optionId = pendingPermissionOptions[choice - 1].id;
      permissionResolver(optionId);
      permissionResolver = null;
      pendingPermissionOptions = null;
      return; // Don't send as prompt
    }
    // Invalid choice - re-display prompt
    output.warning(`Please enter a number 1-${pendingPermissionOptions.length}`);
    return;
  }

  // Normal prompt - send to ACP
  await acpClient.prompt(text);
};
```

### Implementation Steps

#### Step 1: Add Imports to bin.ts

```typescript
import { createAcpClient, type AcpClient } from './lib/acp.js';
import { createInputReader, type InputReader } from './lib/input.js';
import type { PermissionOption } from './lib/output.js';
```

#### Step 2: Add State Variables

```typescript
// Permission handling state
let permissionResolver: ((optionId: string) => void) | null = null;
let pendingPermissionOptions: PermissionOption[] | null = null;

// Component references
let acpClient: AcpClient | null = null;
let inputReader: InputReader | null = null;
```

#### Step 3: Create AcpClient with Callbacks

```typescript
const cwd = args.cwd ?? process.cwd();

acpClient = createAcpClient({
  output,
  config,
  cwd,
  onPermission: async (_tool, _command, options) => {
    // Store options and wait for user response
    pendingPermissionOptions = options;
    return new Promise<string>((resolve) => {
      permissionResolver = resolve;
    });
  },
  onComplete: (stopReason) => {
    output.debug(`Completed: ${stopReason}`);
    output.separator();
  },
  onError: (error) => {
    output.error(`Agent error: ${error.message}`);
  },
});
```

#### Step 4: Connect to Agent

```typescript
try {
  await acpClient.connect();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  output.error(`Failed to connect to Claude Code: ${message}`);

  if (message.includes('ENOENT')) {
    output.info('');
    output.info('Make sure claude-code-acp is installed:');
    output.info('  npm install -g @zed-industries/claude-code-acp');
  }

  process.exit(1);
}
```

#### Step 5: Create InputReader with Callbacks

```typescript
inputReader = createInputReader({
  output,
  config,
  onQuit: () => {
    output.info('Goodbye!');
    acpClient?.disconnect();
    inputReader?.stop();
    process.exit(0);
  },
  onPrompt: async (text) => {
    // Handle permission responses
    if (permissionResolver && pendingPermissionOptions) {
      const choice = parseInt(text, 10);
      if (choice >= 1 && choice <= pendingPermissionOptions.length) {
        const optionId = pendingPermissionOptions[choice - 1].id;
        permissionResolver(optionId);
        permissionResolver = null;
        pendingPermissionOptions = null;
        return;
      }
      output.warning(`Please enter 1-${pendingPermissionOptions.length}`);
      output.permissionPrompt('', '', pendingPermissionOptions);
      return;
    }

    // Send prompt to ACP
    if (acpClient?.isConnected()) {
      try {
        await acpClient.prompt(text);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        output.error(`Error: ${msg}`);
      }
    } else {
      output.error('Not connected to agent');
    }
  },
  onCancel: () => {
    // TODO: Implement ACP cancel
    output.info('Cancellation not yet implemented');
  },
});
```

#### Step 6: Start Input Loop

```typescript
// Start the input loop (blocks until quit)
await inputReader.start();
```

#### Step 7: Graceful Shutdown

```typescript
// Handle process signals
process.on('SIGINT', () => {
  output.newline();
  output.info('Interrupted. Cleaning up...');
  acpClient?.disconnect();
  inputReader?.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  acpClient?.disconnect();
  inputReader?.stop();
  process.exit(0);
});
```

### Complete main() Function

```typescript
async function main(): Promise<void> {
  const args = parseArgs();
  const config = loadConfig(args.cwd);

  // Apply CLI overrides
  if (args.verbose) config.verbose = true;
  if (args.timestamps) config.showTimestamps = true;

  const output = createOutputWriter({ config });

  if (args.help) {
    showHelp(output);
    process.exit(0);
  }

  if (args.version) {
    showVersion(output);
    process.exit(0);
  }

  ensureConfigDir();

  // Permission handling state
  let permissionResolver: ((optionId: string) => void) | null = null;
  let pendingPermissionOptions: PermissionOption[] | null = null;

  const cwd = args.cwd ?? process.cwd();

  // Create ACP client
  const acpClient = createAcpClient({
    output,
    config,
    cwd,
    onPermission: async (_tool, _command, options) => {
      pendingPermissionOptions = options;
      return new Promise<string>((resolve) => {
        permissionResolver = resolve;
      });
    },
    onComplete: (stopReason) => {
      output.debug(`Completed: ${stopReason}`);
      output.separator();
    },
    onError: (error) => {
      output.error(`Agent error: ${error.message}`);
    },
  });

  // Connect to agent
  output.newline();
  output.info(`${colors.bold('clam-code')} - Claude Code with true terminal scrollback`);
  output.info(colors.muted('Connecting to Claude Code...'));

  try {
    await acpClient.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to connect: ${message}`);
    if (message.includes('ENOENT')) {
      output.info('');
      output.info('Install claude-code-acp:');
      output.info('  npm install -g @zed-industries/claude-code-acp');
    }
    process.exit(1);
  }

  output.info(colors.muted('Type /help for commands, /quit to exit'));
  output.newline();

  // Create input reader
  const inputReader = createInputReader({
    output,
    config,
    onQuit: () => {
      output.info('Goodbye!');
      acpClient.disconnect();
      inputReader.stop();
      process.exit(0);
    },
    onPrompt: async (text) => {
      if (permissionResolver && pendingPermissionOptions) {
        const choice = parseInt(text, 10);
        if (choice >= 1 && choice <= pendingPermissionOptions.length) {
          permissionResolver(pendingPermissionOptions[choice - 1].id);
          permissionResolver = null;
          pendingPermissionOptions = null;
          return;
        }
        output.warning(`Enter 1-${pendingPermissionOptions.length}`);
        return;
      }

      if (acpClient.isConnected()) {
        try {
          await acpClient.prompt(text);
        } catch (error) {
          output.error(error instanceof Error ? error.message : String(error));
        }
      }
    },
  });

  // Handle signals
  const cleanup = () => {
    acpClient.disconnect();
    inputReader.stop();
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Start input loop
  await inputReader.start();
}
```

### Testing Checklist

After implementation, verify:

1. **Connection**: `npm run start` connects to claude-code-acp without errors
2. **Prompt flow**: Type a prompt, get streaming response via OutputWriter
3. **True scrollback**: Scroll up during output - instant, native scrolling
4. **Permission flow**: Trigger a permission request, respond with 1-4
5. **Slash commands**: `/help`, `/quit`, `/status` work correctly
6. **Multi-line**: Backslash continuation works
7. **Ctrl+C**: Interrupts gracefully
8. **Exit**: `/quit` disconnects cleanly, scroll history preserved
9. **SSH test**: Run over SSH, verify identical behavior

### Files to Modify

| File         | Changes                                                      |
| ------------ | ------------------------------------------------------------ |
| `src/bin.ts` | Replace TODO comments with complete main loop implementation |

### Dependencies Verified

All required dependencies are already in `package.json`:

- `@agentclientprotocol/sdk` - ACP client SDK
- `picocolors` - Terminal colors
- `dotenv` - Environment loading

---

## Spike Learnings

_This section will be updated as the spike progresses._

### Slash Command Integration (Added 2026-02-03)

Based on research into Claude Code and the ACP adapter, here is the complete mapping of
slash commands and their implementation status/difficulty.

#### Currently Implemented (Local - EASY)

These commands are handled entirely within clam-code, no ACP needed:

| Command   | Description                       | Status         |
| --------- | --------------------------------- | -------------- |
| `/help`   | Show available commands           | ✅ Implemented |
| `/quit`   | Exit clam-code                    | ✅ Implemented |
| `/exit`   | Alias for /quit                   | ✅ Implemented |
| `/clear`  | Clear terminal (prints newlines)  | ✅ Implemented |
| `/status` | Show session status               | ✅ Implemented |
| `/config` | Show current configuration        | ✅ Implemented |
| `/edit`   | Open $EDITOR for multi-line input | ✅ Implemented |

#### Claude Code Commands via ACP (MEDIUM Difficulty)

These exist in Claude Code and are exposed through ACP’s `available_commands_update`
event. Implementation requires:

1. Parse the `available_commands_update` event (already done in acp.ts)
2. Display available commands in `/help` or via tab completion
3. Route user input directly to Claude Code via ACP

| Command        | Description                  | Notes                      |
| -------------- | ---------------------------- | -------------------------- |
| `/commit`      | Create git commits           | Popular, high value        |
| `/review`      | Code review of changes       | High value                 |
| `/compact`     | Compact conversation history | Memory management          |
| `/clear`       | Clear context/history        | Distinct from local /clear |
| `/model`       | Show or switch model         | Config                     |
| `/permissions` | Show granted permissions     | Status                     |
| `/tokens`      | Show token usage             | Status                     |
| `/bug`         | Report a bug                 | Support                    |
| `/init`        | Initialize project config    | Setup                      |
| `/mcp`         | MCP server management        | Advanced                   |
| `/vim`         | Toggle vim mode              | Preference                 |

**Implementation approach:**

```typescript
// In acp.ts, we already receive available_commands_update events
// Need to expose these to InputReader for completion and /help

interface AcpCommand {
  name: string;
  description: string;
  argumentHint?: string;
}

// Route ACP commands by sending as prompt with / prefix
// Claude Code handles them internally
```

#### User-Defined Custom Commands (MEDIUM)

Users can define custom slash commands in `.claude/commands/` directory:

```markdown
---
description: Say hello
argument-hint: name
---

Respond with "Hello $1" and nothing else.
```

**Implementation:** Read from filesystem, treat as ACP pass-through.

#### Blocked/Filtered Commands (HARD - Require Rich UI)

The ACP adapter explicitly filters these as “unsupported” because they require GUI
features:

| Command             | Why Blocked              | Future Clam Support |
| ------------------- | ------------------------ | ------------------- |
| `/cost`             | Requires dashboard UI    | Clam overlay panel  |
| `/login`            | Auth flow                | Web redirect        |
| `/logout`           | Auth flow                | Web redirect        |
| `/output-style:new` | Output rendering options | Clam style system   |
| `/release-notes`    | Web content              | Clam webview        |
| `/todos`            | Persistent TODO panel    | Clam overlay panel  |

#### Input Color Modes

Different input types now use distinct colors (defined in `formatting.ts`):

| Mode             | Color     | Trigger                                |
| ---------------- | --------- | -------------------------------------- |
| Natural language | Magenta   | Default input                          |
| Slash command    | Bold blue | Input starting with `/`                |
| Shell command    | White     | Future: Input starting with `!` or `$` |

### Spec Gaps Found

- (To be filled during implementation)

### Complexity Surprises

- (To be filled during implementation)

### Better Approaches Discovered

- (To be filled during implementation)

### Risks & Concerns

- (To be filled during implementation)

---

## Minimal Shell Support (Phase 3) ❌ NOT STARTED

**Status:** Design complete, implementation not started.

This section describes a minimal but complete shell integration layer that enables
hybrid natural language and shell command input, based on research in
[research-2026-02-03-richer-terminal-shell-uis.md](../../research/active/research-2026-02-03-richer-terminal-shell-uis.md).

### Goals

1. **Seamless mode switching** - User types naturally; system detects shell vs NL
2. **Visual feedback** - Input color indicates current mode
3. **Shell completion** - Tab completes commands/files when in shell mode
4. **Direct execution** - Shell commands run directly (not via Claude)

### Non-Goals (This Phase)

- Semantic/embedding-based NL completion (future)
- Double-enter for NL mode (already implemented separately)
- Full xonsh/prompt_toolkit integration

### Architecture: Shell Module (`lib/shell.ts`)

A self-contained module that encapsulates all shell interaction:

```typescript
// lib/shell.ts - Shell execution and completion module

export interface ShellModule {
  // Command detection
  which(command: string): Promise<string | null>;
  isCommand(word: string): Promise<boolean>;

  // Execution
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;

  // Completion
  getCompletions(partial: string, cursorPos: number): Promise<string[]>;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  captureOutput?: boolean;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
}

export function createShellModule(options: ShellModuleOptions): ShellModule;
```

#### Implementation Details

**1. `which` lookup (cached)**

```typescript
// Cache which results to avoid repeated lookups
const whichCache = new Map<string, string | null>();

async function which(command: string): Promise<string | null> {
  if (whichCache.has(command)) {
    return whichCache.get(command)!;
  }

  try {
    const { stdout } = await execPromise(`which ${shellEscape(command)}`, {
      timeout: 500, // Fast timeout
    });
    const path = stdout.trim() || null;
    whichCache.set(command, path);
    return path;
  } catch {
    whichCache.set(command, null);
    return null;
  }
}

async function isCommand(word: string): Promise<boolean> {
  // Quick validation: must be alphanumeric/dash/underscore, no spaces
  if (!/^[a-zA-Z0-9_-]+$/.test(word)) return false;
  return (await which(word)) !== null;
}
```

**2. Command execution**

```typescript
import { spawn } from 'node:child_process';

async function exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: options.captureOutput ? 'pipe' : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (options.captureOutput) {
      proc.stdout?.on('data', (data) => {
        stdout += data;
      });
      proc.stderr?.on('data', (data) => {
        stderr += data;
      });
    }

    const timeout = options.timeout
      ? setTimeout(() => proc.kill('SIGTERM'), options.timeout)
      : null;

    proc.on('close', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code ?? 0, signal: signal ?? undefined });
    });

    proc.on('error', reject);
  });
}
```

**3. Bash completion integration**

```typescript
// Use bash's compgen for completions
async function getCompletions(partial: string, cursorPos: number): Promise<string[]> {
  const beforeCursor = partial.slice(0, cursorPos);
  const words = beforeCursor.split(/\s+/);
  const currentWord = words[words.length - 1] || '';
  const isFirstWord = words.length === 1;

  try {
    if (isFirstWord) {
      // Complete commands
      const { stdout } = await execPromise(`compgen -c -- ${shellEscape(currentWord)} | head -20`, {
        timeout: 500,
      });
      return stdout.trim().split('\n').filter(Boolean);
    } else {
      // Complete files/directories
      const { stdout } = await execPromise(`compgen -f -- ${shellEscape(currentWord)} | head -20`, {
        timeout: 500,
      });
      return stdout.trim().split('\n').filter(Boolean);
    }
  } catch {
    return [];
  }
}
```

### Mode Detection (`lib/mode-detection.ts`)

A separate module for input mode detection:

```typescript
// lib/mode-detection.ts

export type InputMode = 'shell' | 'nl' | 'slash';

export interface ModeDetector {
  detectMode(input: string): Promise<InputMode>;
  detectModeSync(input: string): InputMode; // For real-time coloring
}

export interface ModeDetectorOptions {
  shell: ShellModule;
  enabled: boolean; // Config flag to enable/disable
}

export function createModeDetector(options: ModeDetectorOptions): ModeDetector;
```

**Detection rules (in order):**

| Input Pattern               | Mode    | Rationale                           |
| --------------------------- | ------- | ----------------------------------- | -------------------------- | --- | ------ |
| Empty or whitespace only    | `nl`    | Default to natural language         |
| Starts with `/`             | `slash` | Explicit slash command              |
| Starts with `!`             | `shell` | Explicit shell mode (like IPython)  |
| Starts with space           | `nl`    | Space-at-start shortcut (like kash) |
| Contains shell operators    | `shell` | `                                   | `, `>`, `>>`, `<`, `&&`, ` |     | `, `;` |
| Contains `$` (env var)      | `shell` | `$HOME`, `${PATH}`                  |
| Contains subshell syntax    | `shell` | `$(...)` or backticks               |
| First word is shell builtin | `shell` | `cd`, `export`, `alias`, etc.       |
| First word passes `which`   | `shell` | Recognized command                  |
| First word fails `which`    | `nl`    | Assume natural language             |

**Implementation:**

```typescript
// Shell operators that indicate shell mode
const SHELL_OPERATORS = /[|><;]|&&|\|\||\$\(|`/;

// Shell built-ins (don't show up in `which`)
const SHELL_BUILTINS = new Set([
  'cd',
  'export',
  'alias',
  'unalias',
  'source',
  '.',
  'eval',
  'exec',
  'exit',
  'return',
  'set',
  'unset',
  'readonly',
  'local',
  'declare',
  'typeset',
  'builtin',
  'command',
  'type',
  'hash',
  'pwd',
  'pushd',
  'popd',
]);

function detectModeSync(input: string): InputMode {
  const trimmed = input.trim();

  if (!trimmed) return 'nl';
  if (trimmed.startsWith('/')) return 'slash';
  if (trimmed.startsWith('!')) return 'shell'; // Explicit shell trigger
  if (input.startsWith(' ')) return 'nl';

  // Check for shell operators/syntax
  if (SHELL_OPERATORS.test(trimmed)) return 'shell';
  if (trimmed.includes('$')) return 'shell'; // Environment variables

  const firstWord = trimmed.split(/\s+/)[0];

  // Check for shell built-ins
  if (SHELL_BUILTINS.has(firstWord)) return 'shell';

  // For sync detection, assume shell if it looks command-like
  if (/^[a-zA-Z0-9_-]+$/.test(firstWord)) {
    return 'shell'; // Tentative - will be refined async
  }

  return 'nl';
}

async function detectMode(input: string): Promise<InputMode> {
  const syncMode = detectModeSync(input);

  // Refine shell detection with actual which lookup
  if (syncMode === 'shell') {
    // If we already matched operators/builtins, it's definitely shell
    const trimmed = input.trim();
    if (SHELL_OPERATORS.test(trimmed) || trimmed.includes('$')) {
      return 'shell';
    }

    const firstWord = trimmed.split(/\s+/)[0];
    if (SHELL_BUILTINS.has(firstWord)) return 'shell';

    // Check `which` for the first word
    const isCmd = await shell.isCommand(firstWord);
    return isCmd ? 'shell' : 'nl';
  }

  return syncMode;
}
```

### Input Coloring

Update `InputReader` to color input based on detected mode:

| Mode    | Color           | Example                |
| ------- | --------------- | ---------------------- |
| `shell` | White (default) | `ls -la`, `git status` |
| `nl`    | Magenta         | `how do I list files?` |
| `slash` | Bold blue       | `/help`, `/commit`     |

**Integration with readline:**

Since Node.js readline doesn’t support real-time input coloring natively, we have two
options:

1. **Post-submission coloring** (simpler): Color the echoed input after Enter
2. **Raw mode coloring** (complex): Use raw stdin mode with manual echo

For the spike, use **post-submission coloring**:

```typescript
// In InputReader.onLine handler
const mode = await modeDetector.detectMode(line);
const coloredLine = colorForMode(line, mode);
output.info(coloredLine); // Echo with color
```

### Shell Command Execution Flow

When user submits input in shell mode:

```
User types: "ls -la"
    ↓
InputReader detects mode → 'shell'
    ↓
Instead of sending to ACP, execute directly:
    shell.exec("ls -la", { captureOutput: true })
    ↓
Display output via OutputWriter.shellOutput()
    ↓
Return to prompt
```

**New OutputWriter method:**

```typescript
interface OutputWriter {
  // ... existing methods ...

  // Shell command output (distinct from tool output)
  shellOutput(command: string, result: ExecResult): void;
}
```

### Partial Command Rejection

A nice UX feature from kash: **reject incomplete/invalid commands instead of
submitting.**

**The problem:**

- User types `l<Enter>`
- `l` is not a valid command
- But it’s also not clearly natural language (too short)
- Traditional shells would show “command not found”
- NL mode would send it to Claude, which is wasteful

**The solution:**

- If input is a single short word that’s not a valid command, don’t submit
- Keep cursor on line and let user continue typing
- Prevents accidental submissions

**Implementation in ModeDetector:**

```typescript
export interface ModeDetector {
  // ... existing methods ...

  // Returns true if input should be rejected (not submitted)
  shouldRejectSubmission(input: string): Promise<boolean>;
}

async function shouldRejectSubmission(input: string): Promise<boolean> {
  const trimmed = input.trim();

  // Allow empty, explicit modes
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith(' ') || trimmed.startsWith('?')) {
    return false;
  }

  // Single word, no spaces
  if (!trimmed.includes(' ')) {
    const isCommand = await shell.isCommand(trimmed);
    if (!isCommand && trimmed.length < 10) {
      // Too short for NL, not a valid command → reject
      return true;
    }
  }

  return false;
}
```

**Behavior examples:**

```
l<Enter>      → Rejected (not a command, too short for NL)
ls<Enter>     → Executes (valid command)
how<Enter>    → Rejected (ambiguous - could be start of question)
how are<Enter> → Submitted to NL (has spaces, looks like sentence)
```

### Tab Completion Routing

Tab completion behavior depends on current mode:

| Mode    | Tab Behavior                         |
| ------- | ------------------------------------ |
| `shell` | Bash completion (commands, files)    |
| `slash` | Slash command completion             |
| `nl`    | No completion (future: FAQ snippets) |

**Integration with readline completer:**

```typescript
// In InputReader
const completer = async (line: string): Promise<[string[], string]> => {
  const mode = modeDetector.detectModeSync(line);

  switch (mode) {
    case 'shell':
      const completions = await shell.getCompletions(line, line.length);
      const lastWord = line.split(/\s+/).pop() || '';
      return [completions, lastWord];

    case 'slash':
      const slashCompletions = getSlashCommandCompletions(line);
      return [slashCompletions, line];

    default:
      return [[], line];
  }
};
```

### Implementation Plan

#### Phase 3.1: Shell Module

- [ ] Create `src/lib/shell.ts` with `ShellModule` interface
- [ ] Implement `which()` with caching
- [ ] Implement `isCommand()` validation
- [ ] Implement `exec()` with output capture
- [ ] Implement `getCompletions()` via compgen
- [ ] Add unit tests for shell module

#### Phase 3.2: Mode Detection

- [ ] Create `src/lib/mode-detection.ts`
- [ ] Implement sync detection for real-time use
- [ ] Implement async detection with `which` lookup
- [ ] Implement `shouldRejectSubmission()` for partial command rejection
- [ ] Add config flag `shellModeEnabled` (default: false)
- [ ] Add unit tests for mode detection

#### Phase 3.3: Input Integration

- [ ] Add `shellOutput()` to OutputWriter
- [ ] Update InputReader to detect mode on submission
- [ ] Route shell commands to `shell.exec()` instead of ACP
- [ ] Add post-submission input coloring
- [ ] Update tab completion to route based on mode

#### Phase 3.4: Polish

- [ ] Handle shell command errors gracefully
- [ ] Add `!` prefix as explicit shell mode trigger (like IPython)
- [ ] Support `$SHELL` environment variable (not just bash)

#### Phase 3.5: Unified Command History (Later)

**Goal:** Persist and navigate command history across both NL and shell modes.

**Features:**

- Up/down arrow navigation through history
- Ctrl+R reverse incremental search
- Unified history (NL + shell + slash commands in one stream)
- Persistent across sessions (save to `~/.clam/code/history`)

**Difficulty Assessment:**

| Feature             | Difficulty      | Notes                                                     |
| ------------------- | --------------- | --------------------------------------------------------- |
| Up/down navigation  | **EASY**        | Node.js readline has built-in `history` option            |
| History persistence | **EASY**        | Read/write JSON or line-delimited file on startup/exit    |
| Ctrl+R search       | **MEDIUM-HARD** | Readline doesn't support this natively; requires raw mode |

**Up/down implementation (built-in):**

```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  history: loadHistory(), // Array of previous commands
  historySize: 1000, // Max entries
});

// On exit, save history
process.on('exit', () => saveHistory(rl.history));
```

**Ctrl+R implementation options:**

1. **Raw mode + custom UI** (HARD): Take over terminal, implement search UI manually
2. **Use `inquirer` or `prompts`** (MEDIUM): These have search built in but may conflict
   with our readline setup
3. **Shell out to `fzf`** (EASY but external dep): Pipe history to fzf, get selection
   back
4. **Defer to Clam overlays** (FUTURE): Ctrl+R triggers overlay search panel

**Recommendation:** Start with up/down only (trivial), add Ctrl+R later or via Clam
overlay.

**Implementation plan:**

- [ ] Add `history` option to readline interface
- [ ] Load history from `~/.clam/code/history` on startup
- [ ] Save history on clean exit and SIGINT
- [ ] Add `maxHistorySize` to config (default: 1000)
- [ ] (Future) Implement Ctrl+R via raw mode or Clam overlay

#### Phase 3.6: Standard Readline Keybindings

**Goal:** Ensure all standard Emacs-style readline keybindings work as expected.

Node.js readline supports most of these **out of the box** - we just need to verify they
work and not break them with our custom handling.

**Standard keybindings (should work automatically):**

| Keybinding        | Action                          | Notes                           |
| ----------------- | ------------------------------- | ------------------------------- |
| **Navigation**    |                                 |                                 |
| `Ctrl+A`          | Move to beginning of line       | ✅ Built-in                     |
| `Ctrl+E`          | Move to end of line             | ✅ Built-in                     |
| `Ctrl+B`          | Move back one character         | ✅ Built-in                     |
| `Ctrl+F`          | Move forward one character      | ✅ Built-in                     |
| `Alt+B`           | Move back one word              | ✅ Built-in                     |
| `Alt+F`           | Move forward one word           | ✅ Built-in                     |
| **Editing**       |                                 |                                 |
| `Ctrl+K`          | Kill (cut) to end of line       | ✅ Built-in                     |
| `Ctrl+U`          | Kill (cut) to beginning of line | ✅ Built-in                     |
| `Ctrl+W`          | Kill previous word              | ✅ Built-in                     |
| `Alt+D`           | Kill next word                  | ✅ Built-in                     |
| `Ctrl+Y`          | Yank (paste) killed text        | ✅ Built-in                     |
| `Ctrl+T`          | Transpose characters            | ✅ Built-in                     |
| `Alt+T`           | Transpose words                 | ✅ Built-in                     |
| **History**       |                                 |                                 |
| `Up` / `Ctrl+P`   | Previous history entry          | ✅ Built-in                     |
| `Down` / `Ctrl+N` | Next history entry              | ✅ Built-in                     |
| `Ctrl+R`          | Reverse search                  | ❌ Not built-in (see Phase 3.5) |
| **Other**         |                                 |                                 |
| `Ctrl+L`          | Clear screen                    | ⚠️ May need custom handling     |
| `Ctrl+C`          | Interrupt/cancel                | ✅ We handle this               |
| `Ctrl+D`          | EOF (exit if line empty)        | ⚠️ May need custom handling     |
| `Tab`             | Completion                      | ✅ We handle this               |

**Potential issues to watch for:**

1. **Ctrl+C**: We override this for cancellation - make sure it still works for
   interrupt
2. **Ctrl+D**: Should exit cleanly if line is empty, otherwise delete char
3. **Ctrl+L**: May need to emit clear screen escape sequence manually
4. **Alt+\* keys**: May not work in all terminals (especially over SSH)

**Implementation plan:**

- [ ] Verify all standard keybindings work with our readline setup
- [ ] Add Ctrl+L handler to clear screen (print `\x1b[2J\x1b[H` or many newlines)
- [ ] Ensure Ctrl+D on empty line triggers clean exit
- [ ] Test Alt+\* keybindings work (they use escape sequences)
- [ ] Document any keybindings that don’t work in certain terminals

**Difficulty: EASY** - Readline handles most of this; we just need to not break it and
handle a few edge cases.

### Files to Create/Modify

| File                        | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `src/lib/shell.ts`          | **New** - Shell execution and completion |
| `src/lib/mode-detection.ts` | **New** - Input mode detection           |
| `src/lib/output.ts`         | Add `shellOutput()` method               |
| `src/lib/input.ts`          | Add mode detection and routing           |
| `src/lib/config.ts`         | Add `shellModeEnabled` flag              |

### Corner Cases

1. **Commands that are also English words**: `test`, `time`, `which`, `date`
   - Accept ambiguity for now; user can prefix with space for NL mode
   - Future: add heuristics (sentence structure, question words)

2. **Piped commands**: `ls | grep foo`
   - Detect `|` in input → treat as shell regardless of first word

3. **Environment variables**: `$HOME`, `${PATH}`
   - Detect `$` in input → treat as shell

4. **Subshells**: `$(pwd)`, `` `date` ``
   - Detect `$(` or backticks → treat as shell

5. **Shell built-ins**: `cd`, `export`, `alias`
   - These don't show up in `which` but are valid
   - Maintain a list of common built-ins for detection:
     ```typescript
     const SHELL_BUILTINS = new Set([
       'cd',
       'export',
       'alias',
       'unalias',
       'source',
       '.',
       'eval',
       'exec',
       'exit',
       'return',
       'set',
       'unset',
       'readonly',
       'local',
       'declare',
       'typeset',
       'builtin',
       'command',
       'type',
       'hash',
       'pwd',
       'pushd',
       'popd',
       'dirs',
       'bg',
       'fg',
       'jobs',
       'kill',
       'wait',
       'disown',
       'suspend',
       'trap',
       'ulimit',
       'umask',
       'shopt',
       'enable',
     ]);
     ```

6. **Redirection operators**: `echo foo > file`, `cat < input`
   - Detect `>`, `>>`, `<`, `2>` → treat as shell

7. **Logical operators**: `cmd1 && cmd2`, `cmd1 || cmd2`
   - Detect `&&`, `||` → treat as shell

8. **Question words in NL mode**: "how", "what", "why", "when", "where", "can"
   - Could use these to detect NL even without spaces
   - Future enhancement for better mode detection

### Testing Checklist

1. **Mode detection**:
   - `ls -la` → shell (white)
   - `how do I list files` → nl (magenta)
   - `/help` → slash (blue)
   - ` explain this` (space prefix) → nl (magenta)
   - `git status` → shell (white)
   - `nonexistentcmd foo` → nl (magenta)
   - `!echo hello` → shell (explicit trigger)
   - `ls | grep foo` → shell (pipe operator)
   - `echo $HOME` → shell (env var)
   - `cd /tmp` → shell (builtin)
   - `echo foo > file` → shell (redirection)
   - `cmd1 && cmd2` → shell (logical operator)

2. **Shell execution**:
   - `echo hello` outputs “hello”
   - `ls` lists current directory
   - `cd /tmp && pwd` changes directory and shows /tmp
   - `exit 1` returns exit code 1

3. **Tab completion**:
   - `ls ` + Tab → file completions
   - `gi` + Tab → `git` (and other g\* commands)
   - `/he` + Tab → `/help`

4. **Partial command rejection**:
   - `l` + Enter → stays on line (rejected, not a command)
   - `ls` + Enter → executes (valid command)
   - `how` + Enter → stays on line (rejected, ambiguous)
   - `how do I` + Enter → submits to NL (has spaces)

5. **Command history** (Phase 3.5):
   - Up arrow → previous command (any mode)
   - Down arrow → next command
   - History persists across sessions
   - (Future) Ctrl+R → reverse search

6. **Readline keybindings** (Phase 3.6):
   - Ctrl+A/E → beginning/end of line
   - Ctrl+K/U → kill to end/beginning
   - Ctrl+W → kill previous word
   - Ctrl+Y → yank (paste)
   - Alt+B/F → word navigation (may vary by terminal)
   - Ctrl+L → clear screen

### Critical Implementation Details

These details need explicit decisions before implementation.

**Legend:**

- 🔶 **OPEN QUESTION** - Requires design decision before coding
- ✅ **DECIDED** - Decision made, ready to implement

**Summary of Open Questions:**

| #   | Topic                 | Key Decision Needed                                     |
| --- | --------------------- | ------------------------------------------------------- |
| 2   | Working Directory     | Should shell `cd` affect ACP session cwd?               |
| 5   | Mode Toggle           | Should shell mode be enabled or disabled by default?    |
| 7   | Prompt Indicator      | How to visually indicate current input mode?            |
| 8   | Ambiguous Commands    | How to handle words that are both commands and English? |
| 9   | Long-Running Commands | Capture vs stream output?                               |

#### 1. Rejection UX Feedback ✅ **DECIDED**

When input is rejected (partial command rejection), the cursor simply stays on the line
with no additional feedback. This is the simplest approach and acceptable for v0.1.

**Decision:** Option A - Silent stay. No message, no bell. User can continue typing or
use space prefix for NL mode. Future versions may add visual feedback.

**Options considered:**

- **A) Silent stay**: Cursor stays on line, no message ← **Selected for v0.1**
- **B) Inline hint**: Show subtle hint below input (future enhancement)
- **C) Bell + message**: Audible bell + status bar message

#### 2. Working Directory Persistence 🔶 **OPEN QUESTION**

When user runs `cd /tmp` in shell mode:

- The shell subprocess changes directory
- **Question:** Should this affect the ACP session's `cwd`?

**Options:**

- **A) Independent**: Shell cwd and ACP cwd are separate (confusing)
- **B) Sync shell→ACP**: After `cd`, update ACP session cwd (complex - ACP may not support)
- **C) Sync both**: Track cwd in clam, pass to both shell and ACP (preferred)

**Recommendation:** Option C - clam maintains authoritative `cwd`, passes to shell spawns and ACP session. `cd` updates this internal state.

**⚠️ ACP investigation needed:** Does ACP support changing `cwd` mid-session? If not,
option A may be the only choice.

```typescript
// In shell.exec()
async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
  // If command starts with 'cd ', update internal cwd
  if (command.trim().startsWith('cd ')) {
    const newDir = resolveCdTarget(command, this.cwd);
    if (newDir) this.cwd = newDir;
  }
  // Always use current cwd for execution
  return execInDir(command, this.cwd);
}
```

#### 3. Interactive Command Handling ✅ **DECIDED**

Commands like `vim`, `less`, `top`, `htop` require full terminal control (alternate screen, raw mode). These conflict with clam's input handling.

**Options:**

- **A) Block them**: Detect and show error "Interactive commands not supported" ← **Selected**
- **B) Allow with warning**: Run them but they may behave oddly
- **C) Temporary handoff**: Give full terminal control, resume clam after exit (complex)

**Decision:** Option A for spike - maintain a blocklist of known interactive commands:

```typescript
const INTERACTIVE_COMMANDS = new Set([
  'vim',
  'vi',
  'nvim',
  'nano',
  'emacs',
  'pico',
  'less',
  'more',
  'most',
  'top',
  'htop',
  'btop',
  'glances',
  'man',
  'info',
  'ssh',
  'telnet',
  'ftp',
  'sftp',
  'python',
  'node',
  'irb',
  'ghci', // REPLs
  'mysql',
  'psql',
  'sqlite3',
  'redis-cli', // DB clients
]);
```

Error message: "Interactive command detected. Use a standard terminal for: vim"

#### 4. Shell Output Display ✅ **DECIDED**

How to display stdout, stderr, and exit codes:

```typescript
interface OutputWriter {
  shellOutput(command: string, result: ExecResult): void;
}

// Rendering:
shellOutput(command: string, result: ExecResult): void {
  // Show command that was run
  writeLine(colors.muted(`$ ${command}`));

  // Show stdout (if any)
  if (result.stdout.trim()) {
    writeLine(result.stdout.trimEnd());
  }

  // Show stderr in error color (if any)
  if (result.stderr.trim()) {
    writeLine(colors.error(result.stderr.trimEnd()));
  }

  // Show exit code if non-zero
  if (result.exitCode !== 0) {
    writeLine(colors.error(`exit code: ${result.exitCode}`));
  }
}
```

#### 5. Dynamic Mode Toggle 🔶 **OPEN QUESTION**

Add `/shell` command to toggle shell mode on/off:

```
/shell on    → Enable shell mode detection
/shell off   → Disable (all input goes to NL)
/shell       → Show current status
```

Also consider environment variable: `CLAM_SHELL_MODE=0` to disable by default.

**⚠️ Design question:** Should shell mode be:

- **Enabled by default** (detect automatically) - more powerful but may surprise users
- **Disabled by default** (opt-in via `/shell on` or config) - safer for initial release

**Recommendation:** Disabled by default in v0.1, with clear `/shell on` to enable.

#### 6. Command Timeout Handling ✅ **DECIDED**

Shell commands should have a default timeout (e.g., 30 seconds) to prevent hangs:

```typescript
const DEFAULT_SHELL_TIMEOUT = 30_000; // 30 seconds

async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
  const timeout = options?.timeout ?? DEFAULT_SHELL_TIMEOUT;
  // ... spawn with timeout ...
  // On timeout: kill process, return { exitCode: 124, signal: 'SIGTERM', ... }
}
```

**User feedback on timeout:**

```
$ long-running-command
(timed out after 30s - use Ctrl+C to cancel earlier)
exit code: 124
```

#### 7. Shell Mode Indicator in Prompt 🔶 **OPEN QUESTION**

When shell mode is enabled, show indicator in prompt:

**Option A - Badge approach:**

```
▶ [shell] how do I list files   ← NL mode (magenta)
▶ [shell] ls -la                ← Shell mode (white)
▶ ls -la                        ← Shell mode disabled, all goes to NL
```

**Option B - Dynamic prompt character:**

```
▶ how do I list files    ← NL mode (magenta, triangle)
$ ls -la                 ← Shell mode (white, dollar)
/ /help                  ← Slash mode (blue, slash)
```

**Option C - Color only (no character change):**

```
▶ how do I list files    ← NL mode (magenta prompt + text)
▶ ls -la                 ← Shell mode (white prompt + text)
▶ /help                  ← Slash mode (blue prompt + text)
```

**⚠️ Technical challenge:** Real-time prompt updates require either:

- Raw mode input handling (complex)
- Post-submit color echo (simpler but delayed feedback)

**Recommendation:** Start with Option C (color only, post-submit) for spike. Consider
Option B (dynamic character) as polish if raw mode is implemented for other features.

#### 8. Ambiguous Command Words 🔶 **NEEDS RESEARCH**

Words like `test`, `time`, `which`, `date`, `make` are both:

- Valid shell commands
- Common English words

**Current approach:** If first word passes `which`, treat as shell.

**Problem:** `test something` would run `/usr/bin/test something` instead of asking
Claude about "test something".

**Possible mitigations:**

1. **Require arguments for certain commands**: `test` alone → shell, but `test the API` → NL
2. **Contextual heuristics**: If followed by question words (how, what, why) → NL
3. **Confirmation for ambiguous**: "Did you mean to run the `test` command? (y/n)"
4. **Explicit shell prefix**: Only `!test` runs as shell, `test` goes to NL

**⚠️ No decision yet** - needs user testing to determine which approach feels natural.

#### 9. Long-Running Commands 🔶 **OPEN QUESTION**

Commands like `npm install`, `docker build`, `make` can run for minutes.

**Questions:**

- Should there be real-time output streaming? (Currently using `captureOutput: true`)
- How to handle Ctrl+C during long-running commands?
- Should there be a progress indicator?

**Options:**

- **A) Capture mode**: Wait for completion, show all output at end (current design)
- **B) Stream mode**: Inherit stdio, show output in real-time
- **C) Hybrid**: Stream stderr, capture stdout

**⚠️ Needs decision** - Option B (stream) is more useful but conflicts with clam's
readline-based input handling during command execution.

**Recommendation:** Start with Option A for spike. Long-running commands are better
suited for direct terminal use anyway.

---

## Future: Clam Code Integration Points

This section documents where the spike code will upgrade to Clam GUI behaviors.
These are marked with `// TODO: Clam code upgrade point` comments in the code.

| Spike Behavior                   | Future Clam Behavior                        |
| -------------------------------- | ------------------------------------------- |
| Truncated tool output (10 lines) | Expandable overlay block                    |
| `thinking()` collapsed indicator | Expandable thinking section                 |
| Permission prompt (text)         | Clickable button overlay                    |
| Diff summary (text)              | Diff viewer popover                         |
| Code blocks (ANSI)               | Syntax-highlighted overlay with copy button |
| Slash command help (text)        | Autocomplete popover menu                   |

The semantic `OutputWriter` interface is designed so that enabling Clam codes requires
only changing the implementation of each method, not the calling code.

---

## Automation and Status Visibility (Phase 4) ❌ NOT STARTED

**Status:** Research/design phase - exploring feasibility.

One of the challenges with Claude Code (and similar agents) is that they often stop working
before a task is complete - waiting for user input, hitting context limits, or simply
stopping after a turn. This section explores how to:

1. **Reliably detect agent state** - Is it working? Idle? Waiting for input? Blocked?
2. **Automate continuation** - Hooks to continue work when the agent is idle
3. **Surface status visibility** - Show real-time status to the user

### The Problem

When using Claude Code interactively, the agent frequently stops and requires the user to:

- Type "continue" or similar to resume work
- Approve permissions
- Provide additional context
- Wait out rate limits

This breaks the flow of autonomous work and requires constant monitoring.

### Questions to Answer

1. **Can we detect idle state via ACP?**
   - What events indicate the agent has finished a turn?
   - Can we distinguish "done with task" vs "stopped mid-task"?
   - How do we detect rate limiting or errors?

2. **Can we monitor the agent process?**
   - CPU/memory usage as proxy for "working"
   - Stdout/stderr activity
   - Process state (running, sleeping, etc.)

3. **What automation is safe?**
   - Auto-continue seems safe for most tasks
   - Auto-approve permissions is risky (security implications)
   - Auto-retry on errors may cause loops

4. **How to design hooks?**
   - User-configurable automation rules
   - Escape hatches to stop automation
   - Logging and auditability

### ACP Protocol Analysis

#### Relevant Events

| Event                        | What It Tells Us          | Idle Detection Value              |
| ---------------------------- | ------------------------- | --------------------------------- |
| `session/prompt response`    | Agent finished responding | **High** - includes `stop_reason` |
| `session/update`             | Streaming content         | Activity indicator                |
| `session/request_permission` | Waiting for user          | Blocked, not idle                 |
| `available_commands_update`  | Commands changed          | Low relevance                     |

#### Stop Reasons (from ACP spec)

The `stop_reason` field in prompt responses is key:

| Stop Reason     | Meaning                  | Auto-Continue?                  |
| --------------- | ------------------------ | ------------------------------- |
| `end_turn`      | Agent finished its turn  | Maybe - check if task complete  |
| `max_tokens`    | Hit context/output limit | Yes - likely needs continuation |
| `tool_use`      | Waiting for tool result  | No - handled by ACP             |
| `stop_sequence` | Hit stop sequence        | Depends on context              |

**Key insight:** `end_turn` is ambiguous - the agent may be done with the task, or may be
waiting for acknowledgment to continue. We need heuristics to distinguish.

#### Proposed State Machine

```
                                    ┌─────────────┐
                                    │   IDLE      │
                                    │ (no session)│
                                    └──────┬──────┘
                                           │ connect()
                                           ▼
                                    ┌─────────────┐
                          ┌────────▶│  CONNECTED  │◀────────┐
                          │         │ (awaiting   │         │
                          │         │  user input)│         │
                          │         └──────┬──────┘         │
                          │                │ prompt()       │
                          │                ▼                │
                          │         ┌─────────────┐         │
                          │         │  PROMPTING  │         │
                          │         │ (agent      │         │
                          │         │  working)   │         │
                          │         └──────┬──────┘         │
                          │                │                │
                          │       ┌────────┼────────┐       │
                          │       │        │        │       │
                          │       ▼        ▼        ▼       │
                   ┌──────┴──────┐ ┌──────────┐ ┌──────────┐│
                   │ PERMISSION  │ │  DONE    │ │  ERROR   ││
                   │ (blocked on │ │ (turn    │ │ (failed) ││
                   │  user)      │ │  ended)  │ │          ││
                   └──────┬──────┘ └────┬─────┘ └────┬─────┘│
                          │             │            │      │
                          │ respond     │ (auto?)    │ retry│
                          └─────────────┴────────────┴──────┘
```

### Idle Detection Strategies

#### Strategy 1: ACP Event-Based (Recommended)

Track state based on ACP events:

```typescript
interface AgentState {
  status: 'idle' | 'connected' | 'prompting' | 'permission_blocked' | 'done' | 'error';
  lastActivity: number; // Timestamp of last event
  lastStopReason?: string; // From prompt response
  pendingPermission?: boolean; // Waiting for permission response
  turnCount: number; // Number of turns in current task
}

// State transitions
function handleEvent(state: AgentState, event: AcpEvent): AgentState {
  switch (event.type) {
    case 'session/update':
      return { ...state, status: 'prompting', lastActivity: Date.now() };

    case 'session/request_permission':
      return { ...state, status: 'permission_blocked', pendingPermission: true };

    case 'session/prompt_response':
      return {
        ...state,
        status: 'done',
        lastStopReason: event.stop_reason,
        turnCount: state.turnCount + 1,
        lastActivity: Date.now(),
      };

    case 'error':
      return { ...state, status: 'error', lastActivity: Date.now() };
  }
}
```

**Pros:**

- Direct from ACP protocol
- Reliable, no polling
- Includes semantic information (stop_reason)

**Cons:**

- May not detect all failure modes (e.g., process crash)
- `end_turn` is ambiguous

#### Strategy 2: Process Monitoring (Supplemental)

Monitor the claude-code-acp process:

```typescript
interface ProcessMetrics {
  pid: number;
  cpuPercent: number;
  memoryMB: number;
  isRunning: boolean;
  lastStdoutActivity: number;
}

// Poll every N seconds
async function monitorProcess(pid: number): Promise<ProcessMetrics> {
  const stats = await pidusage(pid);
  return {
    pid,
    cpuPercent: stats.cpu,
    memoryMB: stats.memory / 1024 / 1024,
    isRunning: stats.cpu !== undefined,
    lastStdoutActivity: Date.now(), // Track separately
  };
}

// Heuristic: agent is "working" if CPU > 5% or recent stdout
function isAgentWorking(metrics: ProcessMetrics, state: AgentState): boolean {
  const recentActivity = Date.now() - state.lastActivity < 5000;
  return metrics.cpuPercent > 5 || recentActivity;
}
```

**Pros:**

- Detects process crashes
- Can detect "stuck" states (high CPU, no output)
- Works even if ACP events are missed

**Cons:**

- Platform-specific (need different approaches for Windows/macOS/Linux)
- CPU usage is noisy (background processes, GC, etc.)
- Requires additional dependency (e.g., `pidusage`)

#### Strategy 3: Activity Timeout (Simple Fallback)

If no events for N seconds, consider agent idle:

```typescript
const IDLE_TIMEOUT_MS = 30_000; // 30 seconds

function checkIdle(state: AgentState): boolean {
  if (state.status === 'prompting') {
    return Date.now() - state.lastActivity > IDLE_TIMEOUT_MS;
  }
  return state.status === 'done' || state.status === 'connected';
}
```

**Pros:**

- Simple to implement
- Catches edge cases other strategies miss

**Cons:**

- False positives (agent may be thinking)
- Arbitrary timeout value

### Automation Hooks

#### Hook Types

| Hook                  | Trigger                   | Action               | Risk Level |
| --------------------- | ------------------------- | -------------------- | ---------- |
| `onTurnEnd`           | Agent finishes turn       | Auto-continue prompt | Low        |
| `onMaxTokens`         | Hit token limit           | Send "continue"      | Low        |
| `onPermissionRequest` | Permission needed         | Auto-approve/reject  | **High**   |
| `onError`             | Agent error               | Retry or abort       | Medium     |
| `onIdle`              | No activity for N seconds | Nudge or alert       | Low        |
| `onRateLimit`         | Rate limit hit            | Wait and retry       | Low        |

#### Auto-Continue Design

```typescript
interface AutoContinueConfig {
  enabled: boolean;
  maxTurns: number; // Safety limit (default: 50)
  continuePrompt: string; // What to send (default: "continue")
  stopPatterns: string[]; // Patterns that indicate "done"
  cooldownMs: number; // Min time between auto-continues
}

const defaultConfig: AutoContinueConfig = {
  enabled: false, // Off by default for safety
  maxTurns: 50,
  continuePrompt: 'continue',
  stopPatterns: ['task complete', 'finished', 'done', 'let me know if', 'anything else'],
  cooldownMs: 2000,
};

async function maybeAutoContinue(
  state: AgentState,
  config: AutoContinueConfig,
  lastResponse: string
): Promise<boolean> {
  if (!config.enabled) return false;

  // Safety checks
  if (state.turnCount >= config.maxTurns) {
    output.warning(`Auto-continue disabled: hit max turns (${config.maxTurns})`);
    return false;
  }

  // Check if agent seems done
  const lowerResponse = lastResponse.toLowerCase();
  for (const pattern of config.stopPatterns) {
    if (lowerResponse.includes(pattern)) {
      output.info('Auto-continue: agent appears to have finished task');
      return false;
    }
  }

  // Check stop reason
  if (state.lastStopReason === 'max_tokens') {
    output.info('Auto-continue: hit token limit, sending continue...');
    await acpClient.prompt(config.continuePrompt);
    return true;
  }

  if (state.lastStopReason === 'end_turn') {
    // Ambiguous - use heuristics
    // TODO: Better heuristics for detecting incomplete tasks
    output.debug('Auto-continue: end_turn - checking if task complete...');
    // For now, don't auto-continue on end_turn
    return false;
  }

  return false;
}
```

#### Permission Automation (Careful!)

Auto-approving permissions is risky. Consider a tiered approach:

```typescript
interface PermissionAutomationConfig {
  mode: 'manual' | 'allow_safe' | 'allow_all'; // Default: manual
  safeTools: string[]; // Tools that are always safe to approve
  safePatterns: RegExp[]; // Commands that match are safe
  denyPatterns: RegExp[]; // Commands that match are always denied
  requireConfirmation: boolean; // Show what was auto-approved
}

const defaultPermissionConfig: PermissionAutomationConfig = {
  mode: 'manual',
  safeTools: [
    'Read', // Reading files is safe
    'Glob', // Listing files is safe
    'Grep', // Searching is safe
  ],
  safePatterns: [
    /^git status$/,
    /^git diff/,
    /^git log/,
    /^ls /,
    /^cat /,
    /^npm test$/,
    /^npm run (lint|typecheck|build)$/,
  ],
  denyPatterns: [/rm -rf/, /sudo/, /chmod 777/, /> \/etc\//],
  requireConfirmation: true,
};
```

### Status Visibility

#### Real-Time Status Display

Show agent status in the prompt or status line:

```
┌─────────────────────────────────────────────────────────┐
│ clam-code                                               │
│ Status: ● Working (turn 3/50) | Tokens: 12,340/100,000  │
│ Last activity: 2s ago | Auto-continue: ON               │
└─────────────────────────────────────────────────────────┘

> [agent is typing...]
```

Status indicators:

- `● Working` (green) - Agent is actively processing
- `○ Idle` (gray) - Waiting for user input
- `◐ Permission` (yellow) - Blocked on permission
- `✖ Error` (red) - Agent encountered error

#### Status API

```typescript
interface StatusInfo {
  state: AgentState;
  metrics?: ProcessMetrics;
  session: {
    turnCount: number;
    totalTokens: number;
    startTime: number;
  };
  automation: {
    autoContinueEnabled: boolean;
    autoContinueCount: number;
    autoApproveCount: number;
  };
}

// Expose via /status command
function formatStatus(info: StatusInfo): string {
  return `
Agent Status: ${formatState(info.state)}
Session: ${info.session.turnCount} turns, ${info.session.totalTokens} tokens
Duration: ${formatDuration(Date.now() - info.session.startTime)}
Auto-continue: ${info.automation.autoContinueEnabled ? 'ON' : 'OFF'} (${info.automation.autoContinueCount} times)
Last activity: ${formatTimeAgo(info.state.lastActivity)}
  `.trim();
}
```

### Implementation Plan

#### Phase 4.1: Status Visibility

- [ ] Add `AgentState` tracking to AcpClient
- [ ] Track turn count, token usage, timestamps
- [ ] Enhance `/status` command with real-time info
- [ ] Add status indicator to prompt (optional)

#### Phase 4.2: Idle Detection

- [ ] Implement ACP event-based state tracking
- [ ] Add activity timeout detection
- [ ] Expose `isIdle()` and `isWorking()` methods
- [ ] Add `onStateChange` callback for UI updates

#### Phase 4.3: Auto-Continue (Experimental)

- [ ] Add `AutoContinueConfig` to config system
- [ ] Implement `maybeAutoContinue()` logic
- [ ] Add stop pattern detection (heuristic)
- [ ] Add `--auto-continue` CLI flag (off by default)
- [ ] Add safety limits (max turns, cooldown)

#### Phase 4.4: Process Monitoring (Optional)

- [ ] Add optional `pidusage` dependency
- [ ] Implement process metrics collection
- [ ] Add crash detection
- [ ] Add stuck detection (high CPU, no output)

#### Phase 4.5: Permission Automation (Careful)

- [ ] Design permission automation config
- [ ] Implement safe-tools whitelist
- [ ] Implement pattern-based auto-approve
- [ ] Add audit logging for auto-approvals
- [ ] Add `--auto-approve-safe` CLI flag

### Research Questions

1. **What patterns reliably indicate "task complete"?**
   - Need to analyze Claude Code responses to find reliable signals
   - May need LLM-based classification of "done" vs "needs continuation"

2. **How do other tools handle this?**
   - Does Cursor have auto-continue?
   - Does Copilot Workspace?
   - What about aider, continue.dev?

3. **What's the failure mode of aggressive auto-continue?**
   - Infinite loops?
   - Wasted tokens?
   - Unintended side effects?

4. **Can we use the agent's own judgment?**
   - Add system prompt asking agent to signal completion
   - Use structured output (JSON) for status
   - Ask agent to rate its confidence that task is complete

### Safety Considerations

1. **Resource limits**: Always have max turns, max tokens, max time
2. **Audit logging**: Log all automated actions
3. **Kill switch**: Easy way to stop automation (Ctrl+C, /stop)
4. **Dry run mode**: Preview what automation would do
5. **Gradual rollout**: Start with read-only automation, then expand

### Configuration Example

```json
{
  "automation": {
    "autoContinue": {
      "enabled": false,
      "maxTurns": 50,
      "cooldownMs": 2000,
      "stopPatterns": ["task complete", "finished", "done"]
    },
    "autoPermission": {
      "mode": "manual",
      "safeTools": ["Read", "Glob", "Grep"],
      "auditLog": true
    },
    "statusDisplay": {
      "showInPrompt": true,
      "showTokenUsage": true,
      "showTurnCount": true
    }
  }
}
```

### References

- [ACP Protocol Spec](https://agentclientprotocol.com/protocol/overview) - Stop reasons, events
- [pidusage](https://www.npmjs.com/package/pidusage) - Cross-platform process monitoring
- [aider](https://aider.chat) - Has similar continuation challenges
- [continue.dev](https://continue.dev) - IDE agent with automation features
