---
title: "Research Brief: Coding Agent GUI Interfaces & Reusable UI Components"
description: Comprehensive survey of web and desktop GUI interfaces for AI coding agents, their UI/UX patterns, constituent widgets, and reusable open-source component libraries
author: Joshua Levy with LLM assistance
---

# Research: Coding Agent GUI Interfaces & Reusable UI Components

**Date:** 2026-02-08 (last updated 2026-02-08)

**Author:** Joshua Levy with LLM assistance

**Status:** Complete

## Overview

This research surveys the ecosystem of AI coding agents that provide **web-based or desktop
GUI interfaces** — not just terminal CLIs.
We catalog the **UI elements** each tool uses for displaying agent output and accepting user
input, identify **open-source widget/component libraries** for building such interfaces, and
note **UX design challenges and lessons learned**.

The goal is to inform the design of a new coding agent interface by understanding what
exists, what works, and what could be improved.

## Questions to Answer

1. What coding agents have rich GUI interfaces (web or desktop)?
2. What constituent UI widgets and elements do they use for output and input?
3. What open-source component libraries exist for building such interfaces?
4. What are the key UX design challenges and lessons?

## Scope

**Included:** Tools with a visual chat/agent interface — web apps, desktop apps, IDE
extensions with webview panels.
Covers both proprietary and open-source tools.

**Excluded:** Pure terminal/CLI-only tools (except where they also offer a GUI), autocomplete
-only tools without chat interfaces.

---

## Part 1: Tool-by-Tool Technical Deep-Dives

Each tool below was researched by examining source code (where open source), documentation,
and technical blog posts. For open-source projects, repos were cloned and the actual UI
implementation was inspected to document widgets, tech stacks, dependencies, and rendering
approaches.

### Claude Code

**Architecture overview.** Claude Code ships as three surfaces: a terminal CLI (`@anthropic-ai/claude-code` on npm, ~11 MB single-file bundle `cli.js`), a VS Code extension (webview panel backed by the same engine), and a web UI at `claude.ai/code` for cloud-delegated tasks. The CLI is the reference implementation; the VS Code extension embeds it via the Agent SDK and wraps it in a webview; the web UI is a wholly separate React app hosted by Anthropic.

---

#### Tech stack & key dependencies

| Layer | Framework | Layout / Rendering | Build |
|---|---|---|---|
| **CLI** | React 18 + Ink (terminal React renderer) | Yoga (flexbox-in-terminal via `yogaNode`) | Bun bundler -> single ESM `cli.js` |
| **VS Code ext** | VS Code Webview API; extension host speaks JSON messages to the Claude process | Native VS Code diff editor for file changes | esbuild (extension host) + separate webview build |
| **Web (claude.ai/code)** | Anthropic's internal React web app | Standard browser DOM | Not publicly documented |

The CLI bundle was analyzed by string-mining the minified 11 MB `cli.js` (v2.1.32). Key libraries detected by frequency and API surface:

- **Ink** (~1,299 mentions) -- the terminal React renderer. Components `Box`, `Text`, `Newline`, `Static`, `Transform`, `Spacer` are all present. Ink hooks `useApp`, lifecycle methods `waitUntilExit`, `patchConsole` confirm Ink 4.x+.
- **React 18** -- 546 `useState`, 285 `useEffect`, 235 `useCallback`, 168 `useRef`, 97 `useMemo`, 32 `useContext`. Compiled with **React Compiler** (729 instances of `react.memo_cache_sentinel`, 34 of `react.early_return_sentinel`, plus the `A1(N)` `useMemoCache` cache-slot pattern). Changelog v2.1.15 confirms: "Improved UI rendering performance with React Compiler."
- **Yoga** (51 `yogaNode` refs) -- Facebook's flexbox engine, bundled inside Ink to do terminal layout with `flexDirection`, `marginTop`, `paddingLeft`, `borderStyle`, etc.
- **Ora** (663 mentions) -- spinner library driving the animated "Thinking..." / "Working..." indicators.
- **`diff` (jsdiff)** -- `structuredPatch` (15 uses) for computing unified diffs in the Edit/Write tool result display.
- **Tree-sitter** (14 mentions + shipped `.wasm` files: `tree-sitter.wasm`, `tree-sitter-bash.wasm`) -- used for AST-aware syntax highlighting and code understanding.
- **`cardinal`** (14 mentions) -- terminal syntax highlighting with ANSI colors.
- **`marked`** (13) / **`unified`** (27) -- Markdown parsing for rendering assistant prose.
- **Zod** (368 mentions) -- runtime schema validation for every tool's `inputSchema` / `outputSchema` (`safeParse` 101x).
- **Sharp** (`@img/sharp-*`, optional platform binaries) -- image resizing/compression for pasted screenshots.
- **`ink-link`** (5), **`ink-box`** (3) -- Ink ecosystem utilities for clickable hyperlinks (OSC 8) and bordered boxes.
- **RxJS** (`Observable`, `subscribe`) -- used internally for event stream plumbing.
- **Bundled ripgrep** (`vendor/ripgrep/`) -- powers the Grep tool.

---

#### Widget inventory (CLI)

Every distinct UI element identified from the decompiled component tree:

| Widget | Description | Rendering details |
|---|---|---|
| **Chat message (assistant text)** | Markdown-rendered prose from Claude | Ink `Text`/`Box` tree; markdown parsed via `marked`/`unified`; code blocks get `cardinal` syntax highlighting |
| **Thinking block** | Collapsible extended-thinking display | Shows "Thinking (Ctrl+O to expand)" when collapsed; full thinking text in a `paddingLeft:2` indented dim italic block when in transcript mode. Toggle is global via `ctrl+o` (`toggleTranscript`), not per-block. |
| **Thinking shimmer** | Animated status while thinking is in-progress | Renders "Thinking..." with a shimmer animation. Controlled by `reducedMotion` setting. |
| **Tool use block** | Shows tool invocation name + args | Dispatches per-tool: renders a status indicator, bold tool name via `userFacingName()`, parenthesized args via `renderToolUseMessage()`, and optional tag via `renderToolUseTag()`. |
| **Tool result** | Inline result after tool completes | Dispatched through `renderToolResultMessage()` on each tool definition. |
| **Grouped read/search summary** | Collapsed group: "Read 3 files, Searched for 2 patterns..." | Aggregates `searchCount`, `readCount`, `replCount`, `memorySearchCount` etc. Shows present tense ("Reading...") while active, past tense ("Read") when done. |
| **Permission request dialog** | Allow/deny prompt for tool execution | Shows tool name, command, risk assessment. Buttons for allow-once, allow-always, deny. Clickable destination selector in VS Code for where to save the rule. |
| **Diff / file edit preview** | Unified diff of proposed file changes | Uses `structuredPatch` from jsdiff to compute hunks. Lines colored green (added) / red (removed) with ANSI escaping. File path shown as bold relative path. Tree-sitter for syntax-aware highlighting within diff context. |
| **Spinner / progress indicator** | Animated dots during API calls or tool execution | `Spinner` via Ora. Inline status dot: spinner when active, checkmark when resolved, X when errored. |
| **Status bar / prompt footer** | Bottom line: model, context usage, cost, task status | Shows context window percentage, token counts. Background task count. Turn duration ("Cooked for 1m 6s"). |
| **Context window indicator** | Percentage of context consumed | Displayed in prompt footer; auto-compact triggers when near limit; `/compact` available manually. Fields: `context_window.used_percentage`, `context_window.remaining_percentage`. |
| **Input field / prompt box** | Text input with history, Vim mode, multi-line | Supports Vim normal/insert mode, Shift+Enter for newline, Ctrl+R history search, Ctrl+G external editor, Ctrl+S stash/restore. Full CJK/Thai input. Arrow-key history navigation. |
| **@-mention autocomplete** | Fuzzy file/folder picker triggered by `@` | Shows icons for different suggestion types (files, folders, URLs). Single-line formatting. Fuzzy matching. Folders navigable by clicking. Removable attachment chips. |
| **Slash command menu** | `/`-triggered command picker | Commands and skills unified. Fuzzy matching prioritizes exact/prefix on name over description matches. Truncated to 2-line descriptions. |
| **Task list** | Structured todo/progress tracking | Dynamically adjusts visible items based on terminal height. Status: pending/in_progress/completed. Notification display capped at 3 lines. |
| **Conversation compaction notice** | Marker after auto-compact | "Conversation compacted (Ctrl+O for history)". |
| **User attachment display** | Shows attached files, images, PDFs | Per-type renderers: `file` shows "Read filename (N lines)", `pdf_reference` shows "Referenced PDF (N pages)", `selected_lines_in_ide` shows line range from VS Code, `image` rendered as `[Image #N]` with `ink-link` if supported. |
| **Teammate / agent message** | Multi-agent colored message bubbles | Colored display name with `@agentName` pointer glyph, summary line, expandable transcript content. Color mapped per-agent identity. |
| **Error / retry display** | API error with countdown | Shows error message in red, retry countdown in seconds, attempt N/M. Only visible after 4th retry attempt. |
| **Plan mode border** | Visual indicator for plan mode | Ink `Box` with `borderStyle:"dashed"` wrapping plan content. |
| **Background task indicator** | Status for `&`-delegated tasks | Shown in status bar; `/tasks` dialog for details. Task status notifications: "completed in background", "stopped". |
| **Diagnostic attachment** | LSP diagnostics from IDE | Grouped by file, shows severity symbol, line:col, message, code, source. Collapsed view shows count ("Found N new diagnostic issues in M files"). |
| **Bordered boxes** | Various dialogs/overlays | `borderStyle:"round"` (40 uses), `borderStyle:"dashed"` (7), `borderStyle:"single"` (3). Used for config dialogs, permission prompts, plan mode. |

---

#### VS Code extension specifics

The extension (`anthropic.claude-code` on the VS Code Marketplace) wraps the CLI engine in a **VS Code Webview** panel:

- **Architecture**: Two-process model. The extension host (Node.js) spawns the Claude Code process and communicates via typed JSON messages. The webview loads static resources from the extension directory using `vscode-file://` URIs.
- **Chat rendering**: The webview renders the conversation as a scrollable message list. Messages stream in real-time. Each message type (user, assistant, tool use, tool result, thinking, system) has its own visual treatment.
- **Diff display**: File edits open VS Code's native side-by-side diff editor (`vscode.diff` command), not a custom renderer. The setting `claudeCode.diffView: auto` controls this. Accept/reject buttons appear in the Claude panel alongside the diff.
- **Thinking expand/collapse**: All thinking blocks toggle together (global toggle, not per-block) -- same `ctrl+o` transcript-mode paradigm as the CLI. In the webview this manifests as a single toggle that expands or collapses all thinking items simultaneously.
- **Colored status dots**: Tab icons show colored dots -- **blue** for pending permission request, **orange** for completed-while-hidden. PR status gets green/red/yellow/purple dots in the footer.
- **@-mentions**: Fuzzy autocomplete with file/folder icons. `Option+K` / `Alt+K` inserts `@file.ts#5-10` from the current editor selection. Selected text is automatically visible to Claude (eye icon toggle).
- **Slash commands**: `/` opens a command menu. Items marked with a terminal icon open in the integrated terminal. Includes `/usage`, `/plugins`, `/model`, `/compact`, etc.
- **Permission UI**: Question dialogs with multiline "Other" input (Shift+Enter). Clickable destination selector for where to persist permission rules (project, user, team, session).
- **Multiple sessions**: Separate tabs/windows with independent history. Session picker with search by keyword, time grouping, git branch, and message count.
- **Checkpoints / rewind**: Hover over any message reveals rewind button with three options: fork, rewind code, or both.

---

#### Claude Code on the web (claude.ai/code)

A browser-based interface for asynchronous task delegation:

- **UI model**: Task-oriented rather than chat-oriented. User selects a GitHub repo, writes a task prompt, and submits. Claude works autonomously on Anthropic-managed VMs.
- **Diff viewer**: Built-in browser diff view showing file list on left, changes on right. A `+N -M` stats indicator opens the diff panel. Users can comment on specific changes to request modifications.
- **Session management**: Sessions persist server-side. Visible in `claude.ai/code`, the Claude iOS app, and in VS Code's "Remote" tab. Sessions can be shared (Team/Public visibility) with optional repository-access verification.
- **Teleport**: One-way handoff from web to terminal via `/teleport` or `claude --teleport`. Fetches the branch, checks out, loads conversation history locally.
- **Environment config**: Per-environment settings for network access (limited/full/none), environment variables, and dependency installation via SessionStart hooks.

---

#### Maturity assessment

**CLI (high maturity)**: The most polished surface. React Compiler optimization, extensive Vim keybinding support (including `f`/`F`/`t`/`T` repeats with `;`/`,`, yank/paste, text objects, indent/dedent, line joining), shimmer animations, reduced-motion accessibility, customizable spinners, full CJK/Thai input support, LSP integration for diagnostics, tree-sitter for syntax-aware operations, and a rich plugin/hook system. The single-bundle approach (Bun-built, 11 MB) keeps deployment simple. The component architecture is well-factored with clear separation between tool definitions (each tool provides `renderToolUseMessage`, `renderToolResultMessage`, `userFacingName`) and the message renderer. State management uses a React context + selector pattern (the `T6` selector function, 425 uses) that resembles Zustand's `useStore(selector)` API. The `A1(N)` React Compiler memoization is applied pervasively across all UI components. Major limitation: being Ink-based means no mouse interaction and terminal-width constraints on layout.

**VS Code extension (medium-high maturity)**: Leverages VS Code's native diff editor rather than reinventing it, which is a smart architectural choice. The webview communication layer has had stability issues (blank screen after auto-update from cached `vscode-file://` URIs, crashes during message processing). Multi-tab support, checkpoint/rewind, and the session picker with remote session browsing are polished features. Plugin management has a full graphical interface. The extension is actively gaining features each release.

**Web UI (medium maturity, research preview)**: Functional for its core use case (delegate-and-forget coding tasks) but explicitly labeled "research preview." The diff viewer is capable (file-level browsing, inline commenting) but simpler than VS Code's native diff. GitHub-only (no GitLab). Session sharing and teleport are well-designed handoff mechanisms. The environment configuration (network allowlists, SessionStart hooks, env vars) is production-grade. Mobile support via the Claude iOS app is a differentiator.

**Reusability**: The CLI's tool rendering interface (`renderToolUseMessage`, `renderToolResultMessage`, `renderGroupedToolUse`, `inputSchema`/`outputSchema` via Zod) is a clean extension point -- third-party tools (via MCP or plugins) plug into the same rendering pipeline. The Agent SDK enables embedding the engine in arbitrary hosts (the VS Code extension being the primary example). The component tree is tightly coupled to Ink, however, so the terminal UI components are not directly reusable in browser contexts.agentId: a4763d7 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 54273
tool_uses: 0
duration_ms: 30183</usage>

---

### OpenAI Codex: GUI Interfaces Technical Deep-Dive

OpenAI ships Codex across four GUI surfaces: a native **Rust TUI** (terminal), an **Electron desktop app**, the **ChatGPT web interface** (Codex cloud), and a **VS Code extension**. Each surface drives the same underlying agent loop (`codex-core`) but through radically different rendering stacks. Below is a detailed breakdown derived from the [open-source CLI repository](https://github.com/openai/codex) (cloned to `/tmp/codex`) and public documentation.

---

#### 1. CLI / Terminal UI (Rust + Ratatui)

**Tech stack.** The TUI is written in pure Rust (~69,000 lines in `codex-rs/tui/src/`). It was originally TypeScript + React + [Ink](https://github.com/vadimdemedes/ink) but has been fully rewritten into native Rust ([discussion #1174](https://github.com/openai/codex/discussions/1174)). The Node.js launcher (`codex-cli/bin/codex.js`) is now just a thin shim that resolves the platform triple and `spawn()`s the prebuilt Rust binary.

**Key dependencies** (from `/tmp/codex/codex-rs/tui/Cargo.toml`):

| Purpose | Crate |
|---|---|
| TUI framework | **`ratatui` 0.29** (patched fork at `nornagon/ratatui`) with `scrolling-regions`, `unstable-rendered-line-info`, `unstable-widget-ref` features |
| Terminal I/O | **`crossterm` 0.28** (patched fork) with `bracketed-paste`, `event-stream` |
| Diff computation | **`diffy` 0.4** |
| Markdown parsing | **`pulldown-cmark` 0.10** |
| Syntax highlighting | **`tree-sitter-highlight` + `tree-sitter-bash`** |
| Async runtime | **`tokio`** (multi-thread, signal, process) |
| Clipboard | **`arboard`** (excluded on Android) |
| Image decode | **`image`** (JPEG, PNG) for inline image attachments |
| Fuzzy search | **`nucleo`** (from the Helix editor) for file search |

**Widget inventory** (every distinct `struct` implementing rendering):

- **`ChatWidget`** (`chatwidget.rs`, 271KB) -- The root surface. Owns the conversation transcript (`Vec<Arc<dyn HistoryCell>>`), a mutable active cell for in-flight streaming, and delegates to the bottom pane. Handles protocol events (`AgentMessageDeltaEvent`, `ExecCommandBeginEvent`, `ApplyPatchApprovalRequestEvent`, etc.).
- **`HistoryCell` trait** (`history_cell.rs`) -- Unit of display. Concrete implementations include: `UserHistoryCell`, `PlainHistoryCell`, `ExecCell` (tool execution), `UpdateAvailableHistoryCell`, session-configured cells, MCP tool calls, web search results, image view, context compaction, plan items, and collaboration events.
- **`ExecCell`** (`exec_cell/`) -- Renders shell command execution. Shows syntax-highlighted bash via `highlight_bash_to_lines()`, a `spinner()` during execution, streamed `CommandOutput` (stdout/stderr with ANSI escape passthrough via `codex-ansi-escape`), truncated to `TOOL_CALL_MAX_LINES = 5` lines (50 for user-initiated shell).
- **`DiffSummary` / `DiffRender`** (`diff_render.rs`) -- Unified diff rendering. Uses `diffy::Hunk` to parse patches, renders green (`Insert`), red (`Delete`), and dim (`Context`) lines via ratatui `Style`. Per-file rows show path + `+N / -M` line-count badges. The renderable uses `InsetRenderable` for indentation and `ColumnRenderable` for vertical stacking.
- **`ApprovalOverlay`** (`bottom_pane/approval_overlay.rs`) -- Modal for command/patch/MCP-elicitation approvals. Wraps a `ListSelectionView` with accept/deny/always-approve options. Shows syntax-highlighted command or full diff preview inline.
- **`StatusIndicatorWidget`** (`status_indicator_widget.rs`) -- "Working..." indicator with elapsed timer (`fmt_elapsed_compact`), shimmer animation, optional detail sub-line, and interrupt hint (`Esc to interrupt`).
- **`BottomPane`** (`bottom_pane/mod.rs`) -- The interactive footer. Owns a `ChatComposer` (the editable text input) and a stack of `BottomPaneView`s that can overlay it. Sub-views include: `CommandPopup` (slash commands), `FileSearchPopup` (fuzzy file picker), `SkillPopup`, `CustomPromptView`, `ExperimentalFeaturesView`, `FeedbackNoteView`, `AppLinkView`, `SkillsToggleView`, `StatusLineSetupView`, `RequestUserInputOverlay`.
- **`ChatComposer` / `TextArea`** (`bottom_pane/chat_composer.rs`, `textarea.rs`) -- Multi-line text input with cursor tracking, word-wrap cache, kill buffer (Ctrl+K/Y), paste burst detection for non-bracketed-paste terminals, element ranges for mentions/attachments, and per-session + persistent cross-session history.
- **`TranscriptOverlay` / `StaticOverlay`** (`pager_overlay.rs`) -- Full-screen alternate-screen overlays. `TranscriptOverlay` (Ctrl+T) renders the complete conversation history with cached live-tail from the active cell. `StaticOverlay` for `/status` output and help text.
- **`WelcomeWidget` / `AsciiAnimation`** (`onboarding/welcome.rs`, `ascii_animation.rs`) -- Onboarding screen with frame-tick-driven ASCII art animation, random variant selection (Ctrl+.), and login gate.
- **`AuthModeWidget` / `TrustDirectoryWidget`** (`onboarding/auth.rs`, `onboarding/trust_directory.rs`) -- Onboarding sub-steps for authentication (API key, ChatGPT OAuth) and directory trust confirmation.
- **`OssSelectionWidget`** (`oss_selection.rs`) -- Model/provider picker for open-source model support (Ollama, LM Studio).
- **Shimmer effect** (`shimmer.rs`) -- Time-based cosine-wave RGB sweep across text spans. Uses `supports-color` to detect truecolor capability and falls back to `Modifier::BOLD` on 256-color terminals.
- **`ListSelectionView`** (`bottom_pane/list_selection_view.rs`) -- Reusable scrollable selection list used by approvals, commands, skills, and model pickers.
- **`ComposerInput`** (`public_widgets/composer_input.rs`) -- Public reusable wrapper around `ChatComposer` exported for other crates (e.g. `codex-cloud-tasks`).

**Rendering approach.** The app uses a custom `Renderable` trait (not ratatui's built-in `Widget`): `render(&self, area: Rect, buf: &mut Buffer)` + `desired_height(&self, width: u16) -> u16`. Composites via `ColumnRenderable` (vertical stack), `InsetRenderable` (margin/padding), and `FlexRenderable`. Streaming uses a `StreamState` with `MarkdownStreamCollector` that gates on newlines and a `VecDeque<QueuedLine>` FIFO with timestamp-based adaptive drain (`streaming/chunking.rs`, `streaming/commit_tick.rs`). Markdown is rendered to styled `ratatui::text::Line` spans via `pulldown-cmark` with full support for headings, code blocks, emphasis, strikethrough, lists, blockquotes, and links.

---

#### 2. Desktop App (Electron + Rust App Server)

**Tech stack.** The desktop app is built with **Electron** (Chromium + Node.js). OpenAI [chose Electron explicitly](https://www.devclass.com/development/2026/02/05/openai-codex-app-looks-beyond-the-ide-devs-ask-why-mac-only/4090132) for cross-platform portability (Windows support is imminent). The Electron frontend communicates with a **Rust `codex-app-server`** process via a **JSON-RPC-lite protocol over stdio** (JSONL framing, no `"jsonrpc":"2.0"` header). The Electron renderer is closed-source; the app-server is open-source at `codex-rs/app-server/`.

**App Server architecture** (from `/tmp/codex/codex-rs/app-server/` and the [official architecture post](https://openai.com/index/unlocking-the-codex-harness/)):
- **Four components**: stdio reader, Codex message processor, thread manager, core threads.
- **Thread manager** spins up one `codex-core` session per conversation thread. Each session is optionally backed by a **Git worktree** so multiple agents can work the same repo in isolation.
- **Protocol primitives**: `Thread` (conversation container) > `Turn` (user request + agent work) > `Item` (atomic unit: `userMessage`, `agentMessage`, `commandExecution`, `fileChange`, `mcpToolCall`, `collabToolCall`, `webSearch`, `imageView`, `plan`, `reasoning`, `contextCompaction`).
- **Key methods**: `thread/start`, `thread/resume`, `thread/fork`, `thread/rollback`, `turn/start`, `turn/interrupt`.
- **Approval flow**: `item/started` -> server sends `requestApproval` request -> client responds with `{decision, acceptSettings}` -> `item/completed`.
- **Streaming**: `item/agentMessage/delta`, `item/commandExecution/outputDelta`, `item/plan/delta`, `turn/diff/updated`.
- **Auth modes**: `apikey`, `chatgpt` (OAuth managed by server), `chatgptAuthTokens` (host-supplied tokens with refresh on 401).
- **Schema generation**: `codex app-server generate-ts` emits TypeScript types; `generate-json-schema` emits JSON Schema bundles via `ts-rs` and `schemars`. The protocol crate (`codex-rs/app-server-protocol/`) exports these.
- **Dependencies**: `tokio-tungstenite` for WebSocket tunneling, `serde_json` for protocol serialization, `uuid` v7 for thread/turn IDs, `sqlx` with SQLite for state persistence and automations.

**Desktop-specific features**: project sidebar, thread list organized by project, parallel agent execution, review pane with diff viewer, worktree management (each agent gets an isolated Git worktree), Skills system (bundled instructions + scripts), Automations (scheduled/triggered tasks backed by SQLite -- daily triage, CI failure summaries, release briefs), and first-party integrations with Figma, Linear, Cloudflare, Netlify, Render, and Vercel.

---

#### 3. Web Interface (Codex Cloud in ChatGPT)

**Tech stack.** The Codex web surface lives inside [chatgpt.com](https://chatgpt.com) and is part of the broader ChatGPT **Next.js / React** frontend (closed-source). Codex cloud tasks execute in isolated containers with a preloaded codebase. Container caching drops median start time from 48s to 5s. The agent communicates back to the frontend over the same streaming event protocol, tunneled over WebSocket-like connections to the container runtime's stdio.

**Key UI elements**: task list panel with parallel task execution, GitHub repo connector, image attachment support (design specs, screenshots), diff viewer for file changes, PR creation flow, embedded screenshots from the agent's headless browser, and follow-up conversations that preserve context from prior turns.

---

#### 4. IDE Extension (VS Code / Cursor / Windsurf)

**Tech stack.** The Codex VS Code extension is **closed-source** ([issue #5822](https://github.com/openai/codex/issues/5822) requests open-sourcing). It communicates with the same `codex-app-server` Rust binary via the JSON-RPC stdio protocol -- the same protocol the desktop app uses. It supports the same approval workflow, streaming, and agent modes (Chat, Agent, Agent Full Access). The extension shares configuration with the CLI (`codex.toml`). A JetBrains integration also exists (separate plugin). Both local execution and cloud-offload modes are supported from within the IDE. Available on macOS and Linux; Windows support is experimental (WSL recommended).

---

#### 5. Maturity Assessment

| Surface | Maturity | Reusability |
|---|---|---|
| **Rust TUI** | Very high. ~69K lines, extensive snapshot tests (`insta`), VT100-based integration tests, custom `Renderable` abstraction, accessibility of colors/animations, cross-platform (macOS, Linux, Windows via WSL, Android/Termux). Uses patched forks of `ratatui` and `crossterm` for features not yet upstream. | High. The `public_widgets::ComposerInput` is explicitly designed as a reusable text input for other crates. The `Renderable` trait and `ColumnRenderable`/`InsetRenderable` composites form a mini layout engine. The `codex-app-server-protocol` crate generates TypeScript and JSON Schema for any client to consume. |
| **Desktop app** | Medium-high. Shipped Feb 2026, macOS-only currently, polished UX for multi-agent workflows. Electron choice is pragmatic but draws criticism for memory overhead. Sandboxing on Windows remains incomplete. | Medium. The app-server protocol is well-documented and schema-generated, explicitly designed so JetBrains, Xcode, and third parties can embed the agent. The Electron frontend itself is not reusable (closed-source). |
| **Web interface** | High. Production-grade within ChatGPT, used by 1M+ developers/month. 90% faster container start (median 5s). | Low for external reuse (fully closed, tied to ChatGPT infrastructure). |
| **VS Code extension** | Medium-high. Works across VS Code, Cursor, Windsurf; supports local + cloud modes. | Low externally (closed-source). The underlying protocol is the reusable layer. |

The strongest reusable artifact across all surfaces is the **`codex-app-server-protocol`** crate (`/tmp/codex/codex-rs/app-server-protocol/`): it defines the complete agent interaction schema, generates TypeScript types, and serves as the canonical interface for any GUI surface -- terminal, desktop, IDE, or web -- to drive the Codex agent loop.

Sources:
- [GitHub - openai/codex](https://github.com/openai/codex)
- [Codex CLI is Going Native - Discussion #1174](https://github.com/openai/codex/discussions/1174)
- [Introducing the Codex app | OpenAI](https://openai.com/index/introducing-the-codex-app/)
- [Unlocking the Codex harness: how we built the App Server | OpenAI](https://openai.com/index/unlocking-the-codex-harness/)
- [Codex App Server documentation](https://developers.openai.com/codex/app-server/)
- [Codex app features](https://developers.openai.com/codex/app/features/)
- [Codex IDE extension](https://developers.openai.com/codex/ide/)
- [OpenAI Codex app: why Mac-only? | DevClass](https://www.devclass.com/development/2026/02/05/openai-codex-app-looks-beyond-the-ide-devs-ask-why-mac-only/4090132)
- [OpenAI launches Codex desktop app for macOS | VentureBeat](https://venturebeat.com/orchestration/openai-launches-a-codex-desktop-app-for-macos-to-run-multiple-ai-coding-agents-in-parallel)
- [Open-source the VS Code extension - Issue #5822](https://github.com/openai/codex/issues/5822)
- [Introducing upgrades to Codex | OpenAI](https://openai.com/index/introducing-upgrades-to-codex/)
- [Codex web documentation](https://developers.openai.com/codex/cloud/)agentId: abfaaf2 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 69995
tool_uses: 0
duration_ms: 38559</usage>

---

### Cursor IDE

**AI Interface Technical Deep-Dive (as of February 2026)**

#### Widget Inventory

Cursor's UI is composed of roughly a dozen distinct AI-related widgets layered on top of its VSCode/Electron shell:

| Widget | Trigger | Description |
|---|---|---|
| **Agent Sidebar (right panel)** | Cmd+I / default layout | Primary interaction surface post-2.0. Lists named agent sessions with status indicators (running/completed/waiting). Supports pinned chats and inline follow-up prompts. Replaces the old Composer modal. |
| **Chat Panel (Ask mode)** | Cmd+L | Read-only Q&A panel. Supports `@file`, `@folder`, `@codebase` context tags that inject full file contents into the prompt as `<attached-files>` blocks. Does not write code; answers questions. |
| **Inline Edit Overlay** | Cmd+K | A small prompt bar that appears at the cursor position in the editor. Generates a colored inline diff (green additions, red deletions) directly in the editor buffer. Accept/reject per-hunk or all-at-once. Also works inside the integrated terminal for command generation. |
| **Diff / Review View** | Automatic after agent edits | Side-by-side or inline diff for each modified file. A floating review bar (originally bottom-of-screen, later moved to top-right in a controversial UX change) provides file-by-file navigation and bulk accept/reject buttons. Files remain in a **virtual/pending state in editor buffers -- not written to disk** until explicitly accepted and saved. |
| **Checkpoint Timeline** | Composer/Agent panel | Each agent turn creates an automatic checkpoint. Users can roll back to any prior checkpoint, effectively undoing entire agent turns. This is the primary undo mechanism for agent workflows. |
| **Background Agent Tab** | Ctrl+E / sidebar tab | Lists all cloud/background agents. Each agent clones the repo into an isolated Ubuntu VM, works on a separate branch, and pushes a PR. Users can send follow-ups or "take over" at any point. Prepending `&` to a message sends it to a cloud agent. |
| **Browser Sidebar** | Browser layout | An embedded Chromium browser pane that agents use to navigate, interact with, and screenshot a running web app. Serves as both a testing tool and the host surface for Design Mode. |
| **Design Mode / Visual Editor** | Browser sidebar toggle | Overlays DevTools-style inspection on the embedded browser. Provides a property sidebar with sliders for margin/padding/border-radius, color pickers, typography controls, flexbox/grid editors, and React component prop dropdowns. "Point and prompt" lets users click an element and describe changes in natural language. All tweaks are **client-side overrides** until "Apply" triggers an agent run to write real code. |
| **Tab Completion Ghost Text** | Automatic while typing | Inline gray ghost-text suggestions, powered by a fast autocomplete model. Known bug: text sometimes extends beyond the visible editor viewport. |
| **Tool Use Indicators** | During agent streaming | Collapsible sections in the agent panel showing each tool call (codebase_search, read_file, grep_search, edit_file, run_terminal_command) with a one-sentence rationale the model is forced to emit before each call. Thinking/reasoning is shown in a collapsed gray block; some models truncate their visible reasoning. |

#### Tech Stack and Customizations

Cursor is a hard fork of VSCode (1.3M lines of TypeScript, ~900 npm dependencies, 2.6 GB after install). The fork was necessary because VSCode's extension API cannot render custom overlays into built-in views, cannot deeply customize the chat panel layout, and lacks hooks for inline diff rendering at the editor-buffer level. Key customizations include:

- **Custom diff renderer**: Injects colored diff decorations directly into the Monaco editor buffer, maintaining a virtual document state separate from the on-disk file. The pending-state system keeps all AI-proposed changes in memory until explicitly flushed.
- **Two-model architecture for file edits**: The main agent LLM produces a "semantic diff" -- partial code with language-appropriate comments marking unchanged regions (e.g., `// ... existing code ...`). A second, cheaper "apply model" takes this semantic diff and produces the actual full file contents. The result is linted, and lint errors are fed back to the main agent for self-correction. A `reapply` tool dynamically upgrades to a more expensive apply model if the cheap one fails.
- **Codebase indexing**: An encoder LLM embeds the entire repository into a vector store at index time, supporting semantic search queries. A re-ranker model filters results at query time. This powers the `@codebase` context tag and the `codebase_search` tool.
- **Agent isolation via git worktrees**: Parallel agents each get their own worktree (or remote VM), preventing file conflicts. Up to eight agents can run simultaneously on a single prompt. Changes are merged back selectively.
- **Layout system**: Four preset layouts (Agent, Editor, Zen, Browser) rearrange panels. Cmd+Opt+Tab cycles through them. The Agent layout puts the agent sidebar on the right and de-emphasizes the file tree; Editor layout restores the traditional left-side file tree.

#### Implementation Details

**Multi-file diffs**: When an agent edits multiple files, each file gets its own diff tab. Files are opened in a "pending review" state with green/red line decorations. The floating review bar provides forward/back navigation across pending files. Accepting a file writes it to the editor buffer and triggers auto-save (if enabled); rejecting reverts to the checkpoint. A known pain point: the diff view sometimes shows entire files as "new" rather than surgical changes, and phantom diff states can persist across reloads.

**Inline edit (Cmd+K)**: The prompt bar appears at the cursor or selection. The model streams a response, and the apply model renders it as an inline diff in real-time. For single-file, small-scope edits only. Multi-file work is redirected to the agent panel.

**Design Mode pipeline**: (1) User clicks an element in the embedded browser. (2) The visual editor sidebar exposes that element's computed CSS as interactive controls. (3) User adjusts sliders/pickers or types a natural language prompt. (4) All changes are temporary client-side overrides (lost on refresh). (5) Clicking "Apply" triggers an agent run that searches the filesystem for the corresponding source file, generates edits using the same semantic-diff pipeline, and applies them. (6) Hot reload updates the browser pane.

**Streaming UX**: The system prompt instructs the model to "explain before calling each tool" so the chat panel shows reasoning text before the tool-call indicator appears, avoiding the "stuck" feeling of silent tool execution. The model is explicitly instructed to never output raw code in chat -- all code goes through tool calls, which the UI renders as diff previews rather than markdown code blocks.

**Tool call display**: Each tool invocation is rendered as a collapsible section in the agent panel. Every tool includes a non-functional "explanation" parameter that forces the model to articulate its reasoning before supplying arguments -- a prompt engineering technique that improves tool-call accuracy. The tools available to the agent include `codebase_search` (semantic vector search), `read_file`, `grep_search` (regex), `file_search` (fuzzy filename match), `edit_file` (semantic diff), `run_terminal_command`, `web_search`, and `reapply` (upgrade the apply model for a failed edit).

#### UX Patterns: Strengths and Weaknesses

**What works well**: The checkpoint/rollback system is a genuine safety net for agent-driven workflows. The two-model semantic-diff architecture keeps costs low and latency tolerable (most turns under 30 seconds with the Composer model). The `@`-tag context system is intuitive. Parallel agents with worktree isolation is a powerful differentiator. The "explain before tool call" pattern makes streaming feel responsive. The four-layout system (Agent/Editor/Zen/Browser) accommodates both agent-first and traditional workflows. Background agents running on cloud VMs with GitHub PR integration extend the model beyond interactive use.

**What does not work well**: Design Mode has **no Cmd+Z undo** for visual slider changes -- users must revert the code change or manually reset properties. No multi-select of elements. Component-level selection is unreliable. The visual editor frequently falls back to raw CSS values instead of mapping to existing design tokens. The diff review bar's position change (bottom to top-right) caused significant user frustration. Phantom diff states (stuck review indicators that cannot be dismissed) remain a recurring bug. The pending/virtual file state breaks external tooling that watches the filesystem. The resource cost of many open diff tabs is noticeable. The agent-centric layout can feel forced for developers who prefer traditional file-tree navigation -- the community forum layout-feedback megathread reflects real friction on this point.

#### Maturity Assessment

Cursor is the most feature-complete AI-native IDE as of early 2026, but its surface area has grown faster than its polish. The core agent loop (semantic diff, apply model, lint feedback, checkpoint) is architecturally sound and well-optimized. Chat and inline edit are stable and mature. The parallel/background agent infrastructure (worktrees, cloud VMs, GitHub integration) is production-grade. However, the diff review UX remains rough -- phantom states, layout regressions, and the inability to view files without diff decorations are persistent complaints. Design Mode is best characterized as an impressive tech demo (launched December 2025) with significant gaps: no undo, no multi-select, inconsistent token mapping, and fragile element selection. The rapid release cadence (2.0 in October 2025, 2.2 in December, 2.3/2.4 in January 2026) has introduced UI instability. The underlying VSCode fork carries 1.3M lines of inherited complexity, and keeping up with upstream while diverging on core rendering is an ongoing engineering burden. Overall: the agent backend is strong and the two-model diff architecture is genuinely clever; the frontend review and design UX needs another cycle of stabilization before it matches the sophistication of the underlying AI pipeline.agentId: ae93901 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 24443
tool_uses: 0
duration_ms: 27424</usage>

---

### Windsurf (Codeium)

**Overview.** Windsurf (originally Codeium, acquired by Cognition/Devin in July 2025) is a VS Code fork marketed as the "first agentic IDE." Its central differentiator is **Cascade**, a sidebar-embedded agentic AI engine that combines real-time action awareness, multi-step planning, and autonomous code editing into what Windsurf calls "AI Flows." The editor shipped in November 2024 and has iterated rapidly through numbered "Wave" releases (Wave 3 through Wave 13+ as of early 2026).

---

#### Widget Inventory

| Widget / Element | Location | Description |
|---|---|---|
| **Cascade Sidebar Panel** | Right sidebar (default) | Primary AI interaction surface. Houses the conversation thread, mode switcher, context indicator, and input box. Supports side-by-side dual Cascade panes (Wave 13). |
| **Mode Switcher (Code / Chat)** | Top of Cascade panel | Toggle between **Code mode** (write access -- creates/modifies files, runs terminal commands) and **Chat mode** (read-only Q&A, proposes code you can manually insert). Keyboard-shortcut accessible. |
| **Turbo Mode Toggle** | Cascade settings | When enabled, terminal commands auto-execute without approval unless on a configurable deny-list. Four tiers: Manual, Auto, Turbo, plus per-command allow/deny lists. Enterprise admins can set org-wide lists. |
| **Diff Navigation Toolbar** | Top of editor pane (on Cascade action) | Appears when Cascade proposes edits. Buttons to navigate hunks, accept all, reject all. Diffs are *hidden by default* -- user clicks "Open Diff" to expand the full-pane diff view. Configurable scroll-to-next-hunk behavior. |
| **Inline AI Edit Box** | Editor gutter (Ctrl+I) | Scoped inline prompt targeting selected lines. Generates docstrings, refactors, etc. without touching surrounding code. |
| **Windsurf Tab (Supercomplete)** | Inline ghost text / floating window | Two sub-modes: traditional **Autocomplete** (single ghost-text line) and **Supercomplete** (floating mini-windows around cursor showing deletions + additions, multi-cursor predictions, Tab-to-Jump navigation). Powered by a custom in-house low-latency model. |
| **AI Terminal** | Integrated terminal (Ctrl+I in terminal) | Inline chat box inside the terminal for command generation and error resolution. Cascade also has a **Dedicated Terminal** -- a sandboxed zsh shell separate from the user's default shell, configured for reliability and interactive prompt support. |
| **Todo / Plan Panel** | Within Cascade conversation thread | Cascade auto-generates a live Markdown plan and todo checklist for multi-step tasks. The planning agent runs in background, continuously refining long-term plan while the action model executes short-term steps. User can edit the plan inline. |
| **Checkpoint / Revert Controls** | Hover state on each Cascade prompt step | Revert arrow icon on each conversation step. Click to roll back all file changes to that step's snapshot. Named checkpoints can be created explicitly. Reverts are currently **irreversible**. Checkpoints are cross-referenceable via @-mentions in other conversations. |
| **Image Upload Button** | Below Cascade input box | Click to upload, paste, or drag-and-drop images (screenshots, wireframes, Figma exports). Up to 1 MB. Used for image-to-code generation. SWE-1.5 added image understanding for visual content analysis. |
| **Voice Input** | Cascade input area | Added in Wave 11. Microphone button for voice-to-text prompting. |
| **Context Window Indicator** | Cascade panel | Visual bar showing how much of the model's context window is currently consumed. Cascade auto-summarizes and clears history to extend effective context. |
| **Memories & Rules Panel** | Cascade "Customizations" icon | Persistent user preferences (coding style, API choices, language) stored as Memories. Auto-generate toggle available. `.windsurfrules` file for project-scoped rules. |
| **MCP Server Toggles** | Settings / Cascade panel (@-mention) | Enable/disable Model Context Protocol servers. Supports Streamable HTTP transport, OAuth for GitHub/GitLab remote MCP, and the Windsurf Plugin store for discovery. |
| **Continue / Auto-Continue Button** | Bottom of Cascade response | When Cascade hits its 20-tool-call-per-prompt limit, a Continue button resumes execution. Auto-Continue setting removes the manual click. |

---

#### Tech Stack

**Base platform.** Electron-based VS Code fork (OSS Code). Uses the Open VSX Registry for extensions (not the Microsoft Marketplace -- Microsoft's proprietary extensions like C/C++ are blocked on forks as of 2025). Supports import of VS Code settings, keybindings, and extensions on first launch.

**Core runtime.** Reports indicate Rust is used for core logic and a trimmed Electron shell, claiming 20-30% lower memory footprint than stock VS Code. The **Cascade Engine** preprocesses the codebase into a dependency graph using static analysis and runtime heuristics -- effectively a lightweight semantic index.

**AI backend.** Hybrid local/cloud architecture. A routing layer selects models per task type (speed for completions, depth for refactors). Available models include Claude Opus 4.5, Sonnet 4.5 (1M context), GPT-5.2, GPT-5.1-Codex Max (three reasoning tiers), and Windsurf's own SWE-1.5. Windsurf Tab's autocomplete runs on a custom in-house model trained from scratch for low latency. **Fast Context** subagent uses SWE-grep for code retrieval at >2,800 tokens/sec.

**JetBrains plugin.** Cascade also ships as a JetBrains plugin with Memories, MCP, and core agentic features, though the standalone Electron IDE is the primary surface.

---

#### Implementation Details

**Cascade Flow Visualization.** Each Cascade turn renders as a vertical conversation thread in the sidebar. Tool calls (file reads, searches, terminal commands, web searches, MCP calls) appear as collapsible action cards within the thread, showing the tool name and a summary of the result. The planning agent's todo list renders inline as a Markdown checklist that updates in real-time as steps complete. This is conceptually similar to how ChatGPT renders tool-use steps, but embedded in an IDE sidebar with direct links to affected files.

**Diff Presentation.** Windsurf takes an unusual approach: edits are **written to disk before approval**. This means the running dev server reflects changes in real-time, letting the developer visually verify UI changes before formally accepting. Diffs are hidden behind an "Open Diff" click to reduce visual noise. The diff toolbar provides hunk navigation and bulk accept/reject. A known regression (GitHub issue #131) temporarily removed per-change accept/reject granularity, reverting to accept/reject-all only -- this has been partially addressed in subsequent waves. Diff decorations sync with Cascade's conversation step state, so reverting a step also reverts the diff view.

**Turbo Mode.** Implemented as a tiered command-execution policy. At the Turbo level, Cascade's tool-calling loop runs terminal commands immediately without pausing for approval, subject to a deny-list filter. The deny-list takes precedence over the allow-list. This is architecturally simple -- it is a boolean gate in the tool-execution pipeline -- but the UX impact is significant: complex multi-step tasks (install dependencies, run build, run tests, fix errors) can execute as an uninterrupted flow.

**Lint Auto-Fix Loop.** After each code-edit tool call, Cascade runs the project's configured linter. If lint errors are detected in Cascade's own edits, it automatically generates a follow-up edit to fix them. These auto-fix edits are credit-free (for Teams/Enterprise). The loop is bounded -- it does not recursively re-lint indefinitely, but handles the common case of formatting and import errors introduced by generation. Can be disabled in settings.

**Action Awareness ("Flow State").** Cascade subscribes to editor events: file opens/closes, cursor movements, text edits, terminal command execution, and (optionally) clipboard changes. These signals feed into a context-assembly layer that infers developer intent. The practical effect is that after a manual edit, prompting "continue my work" produces contextually appropriate next steps without re-explaining the task. Windsurf Tab completions also consume these signals, making autocomplete suggestions aware of recent terminal output and Cascade conversation history.

---

#### UX Patterns -- Comparison to Cursor

| Dimension | Windsurf | Cursor |
|---|---|---|
| **Default posture** | Agentic by default. Cascade auto-pulls context, defaults to Code mode with write access. | Developer-driven. Manual context curation via @ symbols. Composer defaults to non-agentic mode. |
| **Diff visibility** | Hidden by default; click to expand. Writes to disk pre-approval for live preview. | Always-visible inline diffs. Changes require explicit accept before hitting disk. |
| **Autocomplete feel** | Supercomplete shows floating multi-edit windows. Lower latency on large projects per user reports. | Inline ghost text with minimal latency. Feels faster on small-to-medium files. |
| **Visual design** | Cleaner, more minimalist. Frequently compared to Apple-like design sensibility. Fewer buttons and modes. | Feature-dense. "Fix with AI" buttons on errors, multiple AI entry points throughout UI. More powerful but more cluttered. |
| **Learning curve** | Low. Single sidebar, two modes. "Just start typing what you want." | Higher. Many features (Composer, inline edit, chat, @ references, .cursorrules, Notepad) require discovery. |
| **Planning transparency** | Inline todo list and plan visible in conversation. Steps rendered explicitly. | Composer's planning is more implicit. Multi-file edit proposals shown as grouped diffs. |
| **Pricing** | $15/month Pro (credit-based, per-prompt). | $20/month Pro (request-based). |
| **Write-to-disk** | Before approval (unique). Enables real-time dev-server preview. | After approval only. Safer but slower feedback loop. |

---

#### Maturity Assessment

**Strengths.** Windsurf's write-to-disk-before-approval pattern is a genuinely novel UX insight that tightens the feedback loop for frontend work. The tiered Turbo mode with allow/deny lists is a pragmatic security model for autonomous execution. The lint auto-fix loop with credit discounting shows thoughtful productization of agentic error recovery. Memories and `.windsurfrules` provide meaningful personalization. The planning agent with inline todo lists makes multi-step agentic work more legible than competitors. The $15/month price point undercuts Cursor by 25%.

**Weaknesses.** Checkpoint/revert is coarse-grained (per-step, not per-file) and irreversible -- still inferior to Git-native workflows. The diff UX has had regressions (loss of per-change accept/reject). Users report Cascade can get stuck in loops on complex tasks, requiring manual Continue clicks. Context window management (auto-summarization, history clearing) can silently drop important context. The 20-tool-call-per-prompt limit forces artificial breaks in long workflows. As a VS Code fork, Windsurf inherits the rebasing burden and is excluded from Microsoft's proprietary extensions.

**Overall.** Windsurf is a **mid-to-high maturity** agentic IDE as of early 2026. It has shipped more agentic features faster than Cursor (planning mode, memories, turbo mode, lint loops, image-to-code), but with rougher edges in diff handling and rollback granularity. The Cognition/Devin acquisition (July 2025) signals a trajectory toward deeper autonomous agent integration. The rapid Wave cadence (13+ releases in ~14 months) demonstrates aggressive iteration, though some features (voice input, image understanding) remain early-stage. For teams prioritizing autonomous workflow over manual control, Windsurf currently offers the most complete agentic surface in the VS Code fork ecosystem.agentId: aebfd0b (for resuming to continue this agent's work if needed)
<usage>total_tokens: 24984
tool_uses: 0
duration_ms: 28251</usage>

---

### GitHub Copilot Chat

**Architecture overview.** The entire Copilot Chat UI is built inside the core VSCode workbench as a first-party workbench contribution -- **not** as a webview-based extension. The source lives at `src/vs/workbench/contrib/chat/`, split across `common/` (models, services, tool abstractions), `browser/` (DOM-based UI widgets, content parts, actions), and `electron-browser/` (desktop-only features like voice input and the fetch-page tool). The chat panel is registered as a standard view pane (`ChatViewPane`) in the Auxiliary Bar container, with the view id `workbench.panel.chat`. It can also open as a full editor (`ChatEditor` / `ChatEditorInput`) or as a quick-pick overlay (`chatQuick.ts`).

**Widget inventory.**

| Widget | Source location | Notes |
|---|---|---|
| **Chat panel** | `browser/widget/chatWidget.ts` (`ChatWidget`) | Central compositor. Contains a `ChatListWidget` (virtual tree list for messages) and a `ChatInputPart` (rich text input with attachment model). Renders via `ChatListRenderer`. |
| **Tool invocation display** | `browser/widget/chatContentParts/toolInvocationParts/chatToolInvocationPart.ts` | A `ChatToolInvocationPart` delegates to sub-parts based on state: `ChatToolProgressSubPart` (spinner + message while running), `ChatToolStreamingSubPart` (partial input from LM), `ChatSimpleToolProgressPart`, `ChatTerminalToolProgressPart` (terminal command runs), `ChatToolOutputSubPart` (rendered output), and `ChatInputOutputMarkdownProgressPart` (shows both input JSON and output). |
| **Confirmation dialogs** | `toolInvocationParts/abstractToolConfirmationSubPart.ts`, `chatToolConfirmationSubPart.ts`, `chatTerminalToolConfirmationSubPart.ts` | Rendered via `ChatCustomConfirmationWidget`, which creates a title, markdown body, and a `ButtonWithDropdown`. Primary button is "Allow" (or "Allow and Review" when `confirmResults` is set); secondary is "Skip". The dropdown menu is populated by `ILanguageModelToolsConfirmationService.getPreConfirmActions()`, which returns scoped options: "Allow in this Session", "Always Allow in Workspace", "Always Allow in Profile" -- corresponding to `ToolConfirmKind.LmServicePerTool` with scope `session | workspace | profile`. Custom buttons can also be injected via `IToolConfirmationMessages.customButtons`. A post-execution confirmation path (`ChatToolPostExecuteConfirmationPart`) exists for tools requesting review after execution. |
| **MCP App inline rendering** | `toolInvocationParts/chatMcpAppSubPart.ts`, `chatMcpAppModel.ts` | After a tool is confirmed, an MCP "App" can render a webview inside the chat stream. The `ChatMcpAppModel` fetches a `resourceUri` from the MCP server and displays it in a height-constrained webview (max 75% of viewport). |
| **MCP server start interaction** | `chatContentParts/chatMcpServersInteractionContentPart.ts` | Shows progress/checkboxes when MCP servers need to start or require user interaction (authentication, OAuth). Observes `IAutostartResult` from `IMcpService`. |
| **Subagent / multi-agent** | `chatContentParts/chatSubagentContentPart.ts` | Renders sub-agent invocations as collapsible "thinking boxes". Each subagent gets a `ChatSubagentContentPart` that lazily materializes child `ChatToolInvocationPart`s. Auto-expands when a child tool needs confirmation, auto-collapses when resolved. Tracks a `subAgentInvocationId` to route tool calls and `codeblockUri` edits into the correct collapsible group. |
| **Undo / checkpoint timeline** | `chatEditing/chatEditingCheckpointTimeline.ts`, `chatEditingActions.ts` | A `IChatEditingCheckpointTimeline` creates named checkpoints per request (and per undo-stop within a request). `undoToLastCheckpoint()` / `redoToNextCheckpoint()` navigate the timeline. Each checkpoint records `FileOperation` diffs against baseline snapshots, enabling per-file or whole-session undo. The "Undo Last Edit" button in the UI triggers `undoToLastCheckpoint()`. |
| **Agent HQ / sessions viewer** | `browser/agentSessions/` | The `AgentSessionsModel` aggregates sessions from multiple providers: `Local` (foreground VSCode chat), `Background` (Copilot CLI in a worktree), `Cloud` (GitHub cloud agent), `Claude` (Claude Agent SDK), and `Codex` (OpenAI Codex). Each session has a status, file-change diffs, and timing. The viewer renders them in a list/tree. Experimental features in `agentSessions/experiments/` include `agentSessionProjection` (a mode where the editor workspace overlays an agent session for review). |
| **Background agent sessions** | Provider id `copilotcli` | The `Background` provider runs tasks in a separate Git worktree using the GitHub Copilot CLI. Sessions are isolated from the main workspace and can be "continued in" foreground chat. |
| **Todo list widget** | `chatContentParts/chatTodoListWidget.ts`, `common/tools/chatTodoListService.ts` | The `ManageTodoListTool` is a built-in tool that models expose. `ChatTodoListService` maintains a per-session list surfaced via a dedicated widget. |

**Tech stack.**

The entire chat UI uses VSCode's native DOM-based rendering -- **no webviews for the chat panel itself**. Key primitives: `ITreeRenderer` (virtual list for messages), `MarkdownRenderer` (renders assistant markdown with code blocks), `EditorPool` / `DiffEditorPool` (pooled Monaco editors for code blocks and diffs), `Button` / `ButtonWithDropdown` (confirmation UIs), and `autorun` / `IObservable` from the VSCode observable library for reactive state. Webviews are only used for MCP App output (`ChatMcpAppSubPart`). The extension API surface is exposed under two namespaces: `vscode.chat` (participant registration via `createChatParticipant`, session providers, context providers, hooks, custom agent providers, instruction providers) and `vscode.lm` (model selection via `selectChatModels`, tool registration via `registerTool` / `registerToolDefinition`, `invokeTool`, MCP server definition providers via `registerMcpServerDefinitionProvider`, embeddings).

**Key dependencies.**

- `ILanguageModelToolsService` -- the central tool registry. Manages tool data (`IToolData`), tool implementations (`IToolImpl`), tool sets (groupings like `executeToolSet`, `readToolSet`, `agentToolSet`, `vscodeToolSet`), and tool invocation lifecycle including the `beginToolCall` -> `updateToolStream` -> `invokeTool` pipeline. Tools have a `ToolDataSource` discriminated union: `extension`, `mcp` (with `collectionId`/`definitionId`), `user` (prompt-file-defined), or `internal` (built-in).
- `ILanguageModelToolsConfirmationService` -- handles confirmation policy storage (per-session, per-workspace, per-profile) and produces the "Allow always" dropdown actions. Extensions can register `ILanguageModelToolConfirmationContribution` for tool-specific confirmation logic. Exposes `manageConfirmationPreferences()` which opens a `IQuickTree` for bulk preference management with checkboxes.
- `IChatAgentService` -- dispatches requests to chat participants (agents). The default agent in `ChatModeKind.Agent` mode handles agentic tool-use loops. `RunSubagentTool` creates nested agent invocations via `chatAgentService.invokeAgent()`.
- `IChatEditingService` / `IChatEditingCheckpointTimeline` -- tracks file modifications as a timeline of checkpoints, enabling undo/redo across multi-turn editing sessions. Supports per-file diffs between any two checkpoints via `getEntryDiffBetweenStops()`.
- `IMcpService` -- manages MCP server lifecycle, tool discovery, and the autostart flow.

**Implementation details: message rendering.** `ChatListRenderer` (a `ITreeRenderer<ChatTreeItem>`) renders each response by iterating over `IChatRendererContent[]` -- a discriminated union of content kinds (`markdownContent`, `toolInvocation`, `toolInvocationSerialized`, `treeData`, `confirmation`, `thinkingPart`, `mcpServersStarting`, `changesSummary`, `codeCitations`, `multiDiffData`, `pullRequest`, `subagent`, `hookPart`, `questionCarousel`, `extensionsContent`, etc.). For each kind, a specific `IChatContentPart` is instantiated. The renderer uses `hasSameContent()` to diff previous and current parts, reusing DOM nodes where possible and only re-rendering changed segments. Code blocks are rendered into pooled Monaco `ICodeEditor` instances via `EditorPool`. The `ChatContentMarkdownRenderer` handles the conversion of markdown to rendered DOM elements with special handling for inline file anchors, code block URI tags, and theme icons.

**Implementation details: tool call display and approval.** When a tool requires confirmation, the `ILanguageModelToolsService.invokeTool()` path calls `prepareToolInvocation()` on the `IToolImpl`, which returns `IToolConfirmationMessages` (with `title`, `message`, `disclaimer`, `allowAutoConfirm`, `customButtons`, and `confirmResults` fields). The tool invocation enters `StateKind.WaitingForConfirmation`, causing `ChatToolInvocationPart.createToolInvocationSubPart()` to instantiate a `ToolConfirmationSubPart` (or `ChatTerminalToolConfirmationSubPart` for terminal tools, or `ExtensionsInstallConfirmationWidgetSubPart` for extension installs). The confirmation widget's "Allow" button dropdown is populated by calling `confirmationService.getPreConfirmActions()`, which produces scoped items ("Allow for Session", "Always Allow (Workspace)", "Always Allow (Profile)"). When the user clicks, `IChatToolInvocation.confirmWith(reason)` resolves the confirmation promise, advancing the state to `Executing`. If `allowAutoConfirm` is false on the confirmation messages, the scoped "Always" options are suppressed. The `AutoApproveMessageWidget` can display an explanatory message when a tool was auto-approved by a prior setting. For tools with `confirmResults: true`, after execution the state transitions to `WaitingForPostApproval` and a `ChatToolPostExecuteConfirmationPart` is shown, letting the user review results before they are sent back to the model. The tool state machine is: `Streaming -> WaitingForConfirmation -> Executing -> WaitingForPostApproval -> Completed | Cancelled`.

For tool input editing, the confirmation dialog can embed a live Monaco editor pre-filled with the tool's JSON input (`createToolInputUri`), validated against a JSON schema (`createToolSchemaUri`) via the built-in JSON language service. Users can edit parameters before confirming.

**Implementation details: multi-agent orchestration.** The `RunSubagentTool` (tool id `runSubagent`, reference name `runSubagent`) is a built-in tool registered in `BuiltinToolsContribution`. When the LM calls it with `{prompt, description, agentName?}`, `invoke()` creates a nested `IChatAgentRequest` and calls `chatAgentService.invokeAgent()` with a dedicated `subAgentInvocationId`. Progress callbacks route `textEdit`, `notebookEdit`, `codeblockUri`, and `markdownContent` parts back to the parent chat model. The `ChatSubagentContentPart` groups all tool invocations sharing the same `subAgentInvocationId` into a collapsible container. Subagents can reference custom agents defined in prompt files (`.github/agents/`), each with their own model selection, tool set, and system instructions. The subagent tool disables recursive subagent calls (`modeTools[RunSubagentTool.Id] = false`) and the todo list tool to prevent infinite nesting. Model cost is controlled: if a subagent's requested model has a higher `multiplierNumeric` than the parent agent's model, it falls back to the parent's model.

The broader `agentSessions/` infrastructure extends this further: `AgentSessionProviders` enumerates five providers -- `Local` (foreground, interactive), `Background` (Copilot CLI in a local Git worktree, asynchronous), `Cloud` (GitHub cloud coding agent, asynchronous with PR creation), `Claude` (Claude Agent SDK, interactive), and `Codex` (OpenAI Codex, editor-based). Each provider has its own icon, description, and capabilities (e.g., `getAgentCanContinueIn` returns false for Claude and Codex, meaning sessions cannot be "handed off" between providers). The `AgentSessionsModel` resolves sessions from all providers and surfaces them in a unified list with status badges, timing, and file-change summaries.

**Implementation details: MCP server tools with checkboxes.** MCP tools are registered with `ToolDataSource.type === 'mcp'` carrying a `collectionId` and `definitionId`. The `chatMcpServersInteractionContentPart.ts` renders a progress indicator with per-server status when MCP servers are auto-starting at the beginning of a request. Servers requiring user interaction (e.g., OAuth) are shown with interactive markdown links. The `manageConfirmationPreferences()` method on `ILanguageModelToolsConfirmationService` opens a `IQuickTree` (quick pick with tree structure) where tools are grouped by source/server, and each tool or server-level entry can be toggled with checkboxes to set auto-approval preferences. The `ILanguageModelToolConfirmationContribution` interface allows individual tools to provide custom `getManageActions()` items shown under their category in this tree, with optional `canUseDefaultApprovals: false` to suppress the standard "Always Allow" options entirely.

**Maturity assessment.** The chat infrastructure in VSCode is **production-grade and rapidly evolving**. The core message rendering, tool invocation lifecycle, and confirmation policy system are well-structured with clean separation between model (`common/`), view (`browser/widget/`), and service layers. The tool state machine is thorough, covering streaming tool inputs, pre- and post-execution confirmation, and cancellation with reason tracking. The multi-agent system is functional but early-stage -- subagent invocations are stateless, one-shot, and cannot communicate bidirectionally with the parent. The five-provider agent session system (Local/Background/Cloud/Claude/Codex) indicates aggressive expansion of execution environments. The MCP integration is first-class, with dedicated source types, server autostart UI, and app-level webview rendering. The codebase shows signs of active heavy development: experimental directories, feature-flagged prototypes for session projection, and comments like "We are still experimenting with both UIs so I'm not trying to refactor to share code." The extension API surface is broad (40+ methods across `vscode.chat` and `vscode.lm`), with many features gated behind `checkProposedApiEnabled`. Overall, this is the most sophisticated agentic IDE chat system in any open-source editor codebase, though the pace of change suggests the surface area is still consolidating toward a stable long-term architecture.agentId: a949e13 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 86552
tool_uses: 0
duration_ms: 53964</usage>

---

### OpenCode

**Architecture overview.** OpenCode is *not* a Go/Bubble Tea project -- it is a TypeScript/Bun monorepo with three distinct GUI surfaces: a terminal UI (TUI) built on SolidJS + a custom terminal rendering engine called OpenTUI, a Tauri v2 desktop application, and an Astro-based marketing/docs website. The core CLI agent and HTTP API server live in `packages/opencode` (264 TypeScript source files); the desktop app lives in `packages/desktop`; the shared web component library lives in `packages/ui` (~14,800 LOC); and the full web/desktop application shell lives in `packages/app` (~43,800 LOC).

---

**Tech stack.**

| Surface | Framework | Rendering | Language |
|---------|-----------|-----------|----------|
| TUI | SolidJS + `@opentui/solid` + `@opentui/core` | Custom GPU-like terminal renderer (ANSI escape codes, 60fps target, Kitty keyboard protocol, mouse events, scrollbox, `<code>` / `<diff>` / `<markdown>` intrinsic elements) | TypeScript/TSX on Bun |
| Desktop app | SolidJS + `@solidjs/router` + Tailwind CSS v4 + Kobalte | Tauri v2 webview (Rust shell, webkit2gtk on Linux, WKWebView on macOS, WebView2 on Windows) | TypeScript + Rust |
| Shared UI library | SolidJS + Tailwind CSS + Kobalte + Shiki + marked + KaTeX + virtua (virtual scroll) + `@pierre/diffs` | Browser DOM | TypeScript/TSX |
| Docs/marketing site | Astro + Starlight + SolidJS | SSR + Cloudflare | TypeScript |

---

**Widget inventory -- TUI** (66 TSX/TS files, ~12,200 LOC across `/packages/opencode/src/cli/cmd/tui/`):

- **Routes:** `Home` (logo, prompt, tips, MCP status bar, version), `Session` (scrollbox message thread, header, footer, sidebar, prompt).
- **Message rendering:** `UserMessage` (bordered panel with left-accent border, file attachment badges by MIME type, timestamps, QUEUED badge), `AssistantMessage` (iterates `Part[]` via `PART_MAPPING`), `TextPart` (renders markdown via `<code filetype="markdown">` or experimental `<markdown>` intrinsic element with Shiki syntax theming), `ReasoningPart` (collapsible thinking blocks with subtle syntax style).
- **Tool renderers** (each tool has a dedicated component): `Bash` (command + expandable output with `stripAnsi`), `Read`, `Write` (line-numbered code view), `Edit` (inline `<diff>` with split/unified auto-selection at 120 cols), `ApplyPatch` (multi-file diffs), `Glob`, `Grep`, `List`, `WebFetch`, `CodeSearch`, `WebSearch`, `Task` (sub-agent with child session navigation), `TodoWrite` (checkbox list), `Question`, `Skill`, plus `GenericTool` fallback. Tools use two layout primitives: `InlineTool` (single-line compact) and `BlockTool` (bordered expandable panel with hover, spinner, error display).
- **Diff rendering:** The `<diff>` intrinsic element from `@opentui/core` accepts a unified diff string and renders split-view or unified-view with syntax highlighting, line numbers, added/removed background colors, and configurable word-wrap mode. Auto-selects split vs. unified based on terminal width (>120 cols = split), overridable via config `tui.diff_style: "stacked"`.
- **Dialogs:** `DialogCommand` (fuzzy command palette with slash-command support), `DialogSessionList` (session picker with debounced server-side search, delete, rename), `DialogModel` / `DialogAgent` / `DialogMcp` / `DialogProvider` / `DialogThemeList` / `DialogStatus` / `DialogHelp` / `DialogStash` / `DialogTag` / `DialogSkill` / `DialogTimeline` / `DialogForkFromTimeline` / `DialogSessionRename` / `DialogMessage` / `DialogSubagent` / `DialogAlert` / `DialogConfirm` / `DialogPrompt` / `DialogSelect` / `DialogExportOptions`. All built on a generic `DialogSelect` with fuzzy filter.
- **Prompt:** Multi-line `<textarea>` with autocomplete (file paths, slash commands), prompt history, prompt stash, file attachment support (drag-and-drop in desktop), external `$EDITOR` integration, Vim/Emacs-style keybindings.
- **Sidebar:** Shows session title, cost, context window usage (tokens + percentage), changed files (diff summary with +/- counts), todo items, MCP server status, LSP status.
- **Header/Footer:** Session title, token count, cost, context percentage, version, working directory, MCP indicator.
- **Infrastructure:** `SyncProvider` (real-time SSE event sync from server), `SDKProvider` (HTTP client), `ThemeProvider` (100+ themes, dark/light auto-detection via terminal background color query `\x1b]11;?\x07`), `KeybindProvider` (configurable keybindings), `RouteProvider` (home/session routing), `KVProvider` (persistent key-value settings), `ToastProvider`, `ExitProvider`, `PromptHistoryProvider`, `FrecencyProvider`, `PromptStashProvider`.
- **Permission prompt:** Inline diff review for edit/write operations with approve/reject/always-allow workflow.

---

**Widget inventory -- Desktop/Web app** (`packages/app`, ~198 source files):

- **Pages:** `Home` (server picker, project list), `Session` (message timeline, file tabs, terminal panel, side panel, review tab), `Layout` (sidebar with project tree, workspace management, shell sessions), `DirectoryLayout`, `Error`.
- **Session view components:** `MessageTimeline` (virtual-scrolled chat), `SessionHeader`, `SessionPromptDock` (rich prompt input), `SessionSidePanel` (file tree, context tabs), `SessionReviewTab` (diff review with split/unified/stacked views), `TerminalPanel` (integrated terminal via `ghostty-web`), `FileTabContent` (code viewer tabs with Shiki highlighting), `SessionMobileTabs`, `SessionContextTab`, `SessionContextUsage` (token bars).
- **Prompt input:** `PromptInput` with `PromptDragOverlay` (image drag-and-drop shows overlay with icon), `PromptImageAttachments` (thumbnail grid with remove buttons), slash-command popover, `@mention` context items, history navigation, `build-request-parts` for constructing multi-part messages.
- **Shared UI components** (`packages/ui`, ~50 components): `Accordion`, `Avatar`, `Button`, `Card`, `Checkbox`, `Code` (Shiki-highlighted), `Collapsible`, `ContextMenu`, `Dialog`, `Diff` / `DiffChanges` / `DiffSSR`, `DropdownMenu`, `HoverCard`, `Icon` / `IconButton`, `ImagePreview`, `InlineInput`, `Keybind`, `LineComment`, `List`, `Logo`, `Markdown` (marked + Shiki + KaTeX for math), `MessageNav`, `MessagePart` (tool/text/reasoning renderers), `Popover`, `ProgressCircle`, `ProviderIcon`, `FileIcon`, `RadioGroup`, `ResizeHandle`, `Select`, `SessionReview`, `SessionTurn`, `Spinner`, `StickyAccordionHeader`, `Switch`, `Tabs`, `Tag`, `TextField`, `Toast`, `Tooltip`, `Typewriter`.
- **Settings panels:** Providers, Models (visibility/favorites), Agents, MCP servers, Keybinds, Permissions, Commands, General.
- **Dialogs:** Connect Provider, Custom Provider, Edit Project, Fork, Manage Models, Release Notes, Select Directory/File/MCP/Model/Provider/Server, Settings.

---

**Key dependencies.**

*TUI:* `@opentui/core` + `@opentui/solid` v0.1.77 (custom terminal rendering engine with `<box>`, `<text>`, `<scrollbox>`, `<code>`, `<diff>`, `<markdown>`, `<line_number>`, `<textarea>` primitives and mouse/keyboard support), `solid-js`, `@pierre/diffs`, `diff` (for `parsePatch`), `web-tree-sitter` + `tree-sitter-bash`, `fuzzysort`, `stripAnsi`, `clipboardy`, `@ai-sdk/*` (15+ provider SDKs), `hono` (HTTP server), `@modelcontextprotocol/sdk`, `bun-pty`.

*Desktop:* Tauri v2.9.5 with plugins (deep-link, dialog, shell, updater, process, store, window-state, clipboard-manager, http, notification, os, single-instance, decorum for window decorations), `tauri-specta` for type-safe Rust-to-TS bindings, `comrak` (Rust markdown parser). The Rust shell spawns `opencode serve` as a sidecar child process and proxies the HTTP/SSE API.

*Web app:* `@solidjs/router`, `@kobalte/core` (accessible component primitives), `shiki` + `@shikijs/transformers`, `marked` + `marked-katex-extension`, `virtua` (virtual list for message scrolling), `ghostty-web` v0.4.0 (terminal emulator), `@thisbeyond/solid-dnd` (drag-and-drop for tab reordering), `morphdom` (DOM diffing for markdown), `dompurify`.

---

**Implementation details.**

*How chat renders:* The TUI iterates `messages()` with SolidJS `<For>`, dispatching on `message.role`. User messages render in a `<box>` with a colored left border (agent-specific color). Assistant messages iterate their `parts[]` array via `PART_MAPPING`, dispatching to `TextPart` (markdown via tree-sitter), `ToolPart` (15+ specialized renderers), or `ReasoningPart`. The web app uses `MessageTimeline` with `virtua` virtual scrolling and `MessagePart` / `SessionTurn` components rendering markdown via `marked` + Shiki.

*How diffs are shown:* Both TUI and web use the `@pierre/diffs` library. The TUI has a `<diff>` intrinsic element in OpenTUI that accepts a unified diff string and renders it with syntax-highlighted split or unified view, configurable colors for added/removed/context backgrounds, and line numbers. The web app uses `Diff` / `DiffChanges` / `DiffSSR` components with Shiki-based highlighting. Permission prompts show inline diffs for approve/reject workflows.

*How multi-session works:* Sessions support parent/child relationships (sub-agents via `Task` tool). The sidebar shows child session navigation with `session_child_cycle` keybinding. `DialogSessionList` provides fuzzy-searchable session switching. Sessions can be forked from any message via `DialogForkFromTimeline`. The desktop app supports multiple simultaneous servers/projects via workspace management.

*How image drag-and-drop works:* In the desktop/web app, `PromptDragOverlay` shows a full-screen overlay with an icon indicator (image vs. @mention) when dragging files. `PromptImageAttachments` renders a thumbnail grid with MIME-type badges. `attachments.ts` handles file reading and base64 encoding. In the TUI, file parts are rendered as MIME-type badges (`img`, `pdf`, `txt`, `dir`) with colored backgrounds.

*How the desktop app wraps the TUI:* It does not wrap the TUI. The desktop app is an entirely separate web-based GUI built with SolidJS + Tailwind running in a Tauri webview. The Tauri Rust shell (`lib.rs`) spawns `opencode serve` as a sidecar process, waits for its HTTP server to become ready, then passes the server URL to the SolidJS frontend via `commands.awaitInitialization()`. The frontend connects to the same HTTP/SSE API that the TUI uses, so both interfaces share the same backend.

---

**Community web UIs.**

| Project | Tech stack | Notes |
|---------|-----------|-------|
| opencode-web (chris-tse) | React 19 + Vite + CSS Modules + EventSource SSE | Chat-style UI, mobile responsive, tool execution display |
| opencode-web (bjesus) | SolidJS + Vite + Tailwind + DaisyUI | 32 themes, virtual scrolling, proxied mode auto-starts `opencode serve`, deployed at opencode-web.pages.dev |
| OpenChamber (btriapitsyn) | React 19 + Zustand + Radix UI + Tailwind v4 + Express + Tauri v2 | Full-featured: desktop app (macOS), VS Code extension, integrated terminal, git operations, smart diffs, permission cards, GitHub Actions remote mode, Cloudflare tunnels. Actively maintained (npm v1.5.2) |

---

**Maturity assessment.** OpenCode's GUI layer is remarkably mature for an open-source AI coding agent. The TUI alone is ~12,200 lines of TSX across 66 files with dedicated renderers for every tool type, a full command palette, fuzzy session search, configurable keybindings, 100+ themes, split/unified diff views, sidebar with cost/token tracking, and sub-agent navigation. The desktop app adds another ~43,800 LOC with a complete IDE-like experience: virtual-scrolled chat, integrated Ghostty terminal, file tree, code tabs with Shiki highlighting, drag-and-drop image attachments, diff review tabs, settings panels, i18n (18 languages), and native OS integration via Tauri. The shared UI library provides 50+ polished components. The architecture cleanly separates the backend (Hono HTTP + SSE API), TUI (OpenTUI renderer), and desktop/web (SolidJS + Tailwind in a webview), all sharing the same `@opencode-ai/sdk`. The community ecosystem is active with three independent web UIs, the most mature being OpenChamber which adds a VS Code extension and GitHub Actions remote execution. The main gap is that OpenTUI (`@opentui/core`) is a proprietary/first-party rendering engine rather than an established library like Ink or Bubble Tea, which may pose a maintenance risk but also enables features (native `<diff>`, `<code>`, `<markdown>` elements, 60fps rendering, mouse selection) that generic terminal UI libraries do not support.agentId: aa86b23 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 68559
tool_uses: 0
duration_ms: 48280</usage>

---

### Manus AI: Web Interface and Agent Visualization -- Technical Deep-Dive

**Overview.** Manus (manus.im, acquired by Meta in December 2025 for ~$2B) is a closed-source autonomous AI agent built on Claude Sonnet and fine-tuned Qwen models, equipped with 29 tools and the open-source `browser_use` library for web automation. Its web interface is the primary differentiator: rather than a chat-only experience, it exposes a real-time "computer view" showing the agent operating a sandboxed Linux desktop. The architecture was partially revealed through a March 2025 sandbox leak and later confirmed by co-founder Ji Yichao in a widely-cited context engineering blog post.

---

**Widget Inventory.**

| Widget | Description |
|---|---|
| **Chat Panel** | Left-aligned conversational interface (ChatGPT-style) where users submit prompts and receive final deliverables. Messages are typed as either "notification" (non-blocking status updates) or "question" (blocks execution awaiting user input). |
| **Manus's Computer (Live View)** | A right-side panel that streams the agent's sandboxed desktop in real time. Users click a thumbnail to expand and watch the agent navigate browsers, edit files, and run terminal commands. The view persists even when the user closes their browser -- Manus continues working asynchronously and sends a notification on completion. Session replays are also available so users can scrub through a timeline of completed tasks. |
| **Task Progress / Plan Steps** | The agent maintains a `todo.md` file as a live checklist. Each plan step is generated by a Planner module and injected as a special "Plan" event into the context. Steps are shown with status indicators (pending, in-progress, complete) and are ticked off as the agent proceeds. This file also serves as a recovery mechanism if context is lost mid-session. |
| **Wide Research Tree** | For parallel workloads (up to 250+ items), the UI shows a task decomposition tree: a primary agent fans out to 100+ independent sub-agents, each with its own sandbox and fresh context window. Progress for each sub-agent is tracked independently and synthesized by the coordinator. Activates automatically when the task involves large-scale analysis. |
| **Design View (v1.6)** | An interactive image editing panel powered by Google's Nano Banana Pro model. Includes a Mark Tool for selecting image regions, batch edit queuing, and inline text extraction/editing. This is not a standalone tool but an integrated agent capability triggered when the task involves visual creation. |

---

**Tech Stack (Known and Inferred).**

Manus does not publicly document its frontend. However, the sandbox leak, the official context engineering blog post, and open-source clones (particularly `Simpleyyt/ai-manus`) reveal the likely stack:

- **Sandbox environment:** Ubuntu 22.04 Docker containers with Python 3.10, Node.js 20.18, Chrome (headless, CDP on port 9222), sudo-enabled `ubuntu` user, internet access, and a 30-minute default TTL.
- **Live view pipeline:** `xvfb` (virtual framebuffer) + `x11vnc` (VNC server on port 5900) + `websockify` (VNC-to-WebSocket bridge) + `NoVNC` (browser-based VNC client). The backend WebSocket-forwards VNC frames from isolated sandbox containers to the web client, creating a secure abstraction layer.
- **Backend:** Python (likely FastAPI) serving an API on port 8000, with Docker socket mounted for dynamic sandbox creation. MongoDB for session persistence, Redis for caching.
- **Frontend:** Open-source replicas use React/Next.js (port 3000 or Vite on port 5173). The official Manus app at `manus.im/app` is a modern SPA; exact framework is unconfirmed but the pattern strongly suggests React + Next.js given the ecosystem evidence.
- **LLM orchestration:** Claude Sonnet (primary) + Qwen variants, invoked via a CodeAct paradigm where tool actions are executable Python scripts rather than rigid function calls. Token ratio is ~100:1 input-to-output, with KV-cache hit rate as the critical production metric ($0.30 vs $3.00 per MTok on Claude cached vs uncached).

---

**Implementation Details.**

*How the live computer view works:* Each user task spawns an isolated Docker container running a headless Chrome browser and a full X11 display stack. The VNC server captures the virtual display at the framebuffer level. `websockify` translates the VNC protocol to WebSocket frames, which the Manus backend forwards to the browser client. The client renders these frames using NoVNC, a JavaScript VNC viewer. This gives pixel-accurate, low-latency streaming of the agent's desktop -- users see every click, scroll, and terminal command as it happens. The Manus Browser Operator extension (shipped November 2025) adds an alternative mode where the agent operates directly within the user's local Chrome/Edge browser, using debugger and `<all_urls>` permissions -- though security researchers at Mindgard flagged this as functionally equivalent to a full browser remote-control backdoor.

*How multi-agent steps are visualized:* The Planner agent generates an ordered step list that is injected into the context as a "Plan" event and persisted as `todo.md`. The execution agent processes one tool call per iteration in a strict observe-decide-act loop. After each action, the result is appended to an append-only event stream (critical for KV-cache stability -- even a single-token prefix change invalidates the cache from that point onward). The UI renders this as a step-by-step progress view. A typical Manus task involves ~50 tool calls. When context exceeds 128k tokens, the oldest turns are summarized into a JSON structure while the last 3 turns are kept raw to preserve the model's formatting "rhythm."

*Wide Research parallelism:* The coordinator agent decomposes the task into N independent sub-tasks, each assigned to a full Manus instance (not a specialized sub-agent) with its own context window and sandbox. Sub-agents never communicate with each other -- following a Go-concurrency-inspired principle of "share memory by communicating, don't communicate by sharing memory." The UI shows parallel progress tracks that converge into a synthesis step. Item 250 receives identical analysis depth to item 1 because each gets a dedicated, unpolluted context.

*Tool availability management:* Rather than dynamically adding/removing tools (which would invalidate the KV-cache), Manus uses a context-aware state machine with logit masking. All 29 tools remain defined in the prompt, but token-level logit masks constrain which tools the model can select at each state. Tool names use consistent prefixes (`browser_*`, `shell_*`, `file_*`) enabling efficient group-level masking without stateful logit processors. The file system itself serves as extended context -- a persistent, unlimited scratchpad that outlives any single context window.

---

**Open-Source Alternatives.**

| Project | UI Approach | Notes |
|---|---|---|
| **FoundationAgents/OpenManus** | CLI-first (no built-in web UI); relies on community frontends | Core framework: modular agent with Planner, browser automation, multi-model support. 3,300+ GitHub stars within 48 hours of launch. Includes OpenManus-RL for GRPO-based agent tuning. |
| **OpenManus-GUI** (Hank-Chromela) | Gradio-based chat interface | Adds conversation history, multi-turn support, OpenAI SDK compatibility. Quick to deploy but no live computer view. |
| **OpenManusWeb** (YunQiAI) | Web app on localhost:8000 | Chat-like interface for interacting with OpenManus agents. Basic but functional. |
| **ai-manus** (Simpleyyt) | Full Manus replica with NoVNC live view | Most architecturally faithful clone. Docker Compose deployment with frontend (port 5173), backend (port 8000), dynamically-spawned sandbox containers with xvfb + x11vnc + websockify VNC streaming, Chrome CDP on port 9222, and MCP tool integration. Closest to the real Manus experience available as open source. |

None of the open-source alternatives replicate Manus's Wide Research (100+ parallel agents), Design View, or the polished production UI. They do validate the core architecture: the VNC-to-WebSocket-to-NoVNC pipeline is the standard pattern for agent computer-use visualization.

---

**Maturity Assessment.**

Manus is the most polished agent-computer-use product shipping today. Its strengths are the transparent live view (users see exactly what the agent does), the append-only event stream architecture (enabling reliable KV-cache optimization at 10x cost reduction), and the Wide Research parallel scaling to 100+ concurrent agents. The Design View adds a creative dimension absent from competitors. However, the system has known reliability gaps: early testers reported crashes on transactional tasks (food ordering, flight booking), occasional hallucinated data in research reports, and infinite loops on certain error states. The `browser_use` foundation is open-source and well-understood, meaning the core browsing capability is reproducible. What is not easily reproducible is the context engineering layer (logit masking, KV-cache-aware prompt design, `todo.md` attention manipulation, context compaction with raw-tail preservation) and the infrastructure for 100+ parallel sandboxed agents. The Meta acquisition suggests this will become a platform-level capability rather than a standalone product. For teams building similar UIs, the `Simpleyyt/ai-manus` open-source clone provides the most complete reference implementation of the VNC-streaming architecture pattern, and the official Manus context engineering blog post remains the single best public document on production agent-loop design.agentId: a2ec7dc (for resuming to continue this agent's work if needed)
<usage>total_tokens: 25431
tool_uses: 0
duration_ms: 32819</usage>

---

### Aider

**Widget Inventory.**
Aider ships two distinct interfaces: a terminal CLI (the primary, production-grade interface) and an experimental browser GUI (`--browser` flag).

*Terminal UI widgets:*
- **Chat input prompt** -- Built on `prompt_toolkit.PromptSession` (`/tmp/aider/aider/io.py`, class `InputOutput`). Supports Emacs and Vi editing modes, `FileHistory` persistence, Markdown syntax highlighting via `PygmentsLexer(MarkdownLexer)`, multiline input (Enter vs Alt-Enter toggle), multi-column tab completion (`CompleteStyle.MULTI_COLUMN`), and custom keybindings (Ctrl-Z suspend, Ctrl-Up/Down history, Ctrl-X Ctrl-E to open `$EDITOR`).
- **AutoCompleter** -- Custom `prompt_toolkit.Completer` subclass that tokenizes all in-chat source files with Pygments and offers completions on filenames, code identifiers, and `/slash` commands.
- **Streaming markdown renderer** -- `MarkdownStream` (`/tmp/aider/aider/mdstream.py`) uses `rich.live.Live` with a sliding window of 6 lines. It renders partial markdown through a custom `NoInsetMarkdown` class (overrides `CodeBlock` to remove left padding, overrides `Heading` to left-justify). Updates are throttled at ~20 FPS with adaptive delay based on measured render time.
- **Diff display** -- Two systems: (1) `diffs.py` uses `difflib.unified_diff` and `difflib.ndiff` to compute partial-update diffs with a progress bar (`create_progress_bar`) showing how much of the file has been processed during streaming. (2) The `wholefile_coder.py` renders live diffs inline during streaming via `do_live_diff`. Git-level diffs are produced by shelling out to `git diff` via GitPython (`repo.git.diff`).
- **File listing** -- The input prompt header renders files using `rich.columns.Columns`, separating "Readonly:" and "Editable:" groups with `rich.text.Text` objects.
- **Waiting spinner** -- `WaitingSpinner` (`/tmp/aider/aider/waiting.py`) is a thread-based ASCII/Unicode bouncing-bar animation that appears after 500ms of LLM latency, running at ~6.7 FPS.
- **Voice input** -- `Voice` class (`/tmp/aider/aider/voice.py`) records audio via `sounddevice`/`soundfile`, converts with `pydub`, and transcribes via the OpenAI Whisper API.
- **Clipboard watcher** -- `ClipboardWatcher` (`/tmp/aider/aider/copypaste.py`) polls `pyperclip` every 500ms and injects clipboard content as a placeholder into the prompt.

*Browser UI widgets:*
- **Chat message container** -- `st.chat_message` with role-based rendering (user, assistant, edit, info, text). Messages are stored in a `State` object cached via `@st.cache_resource`.
- **Sidebar** -- File multi-select (`st.multiselect`), recent message selector (`st.selectbox`), web page scraping popover, clear chat history button.
- **Edit info display** -- Commit hash/message with expandable `st.code(diff, language="diff")` blocks and an "Undo commit" button.
- **Streaming responses** -- Uses `st.write_stream(coder.run_stream(prompt))` which consumes a Python generator yielding text chunks from the LLM.

**Tech Stack.**
- **Terminal rendering**: `rich` (v14.x) for all styled output -- `Console`, `Markdown`, `Live`, `Panel`, `Syntax`, `Columns`, `Text`. `prompt_toolkit` (v3.0.x) for the interactive input line with completions, history, and keybindings. `Pygments` for syntax highlighting within both libraries.
- **Browser UI**: **Streamlit** (v1.52.x). The `--browser` flag launches Streamlit's CLI runner (`streamlit.web.cli.main`) pointed at `gui.py`. No Flask, FastAPI, or Gradio. Streamlit's built-in components (`st.chat_input`, `st.chat_message`, `st.write_stream`, `st.sidebar`, `st.multiselect`, `st.expander`, `st.code`, `st.popover`) provide the entire browser UI.
- **LLM layer**: `litellm` (v1.80.x) as the universal LLM gateway, with `openai` as a direct dependency. `tiktoken` and `tokenizers` for token counting.
- **Git integration**: `GitPython` wrapping the system `git` binary. `pathspec` for `.gitignore` parsing. `watchfiles` (Rust-backed) for file-system monitoring.
- **Code intelligence**: `grep-ast` + `tree-sitter-language-pack` for repo-map generation (AST-based code indexing across 30+ languages). `networkx` + `scipy` for the PageRank-style relevance ranking in the repo map.

**Key Dependencies** (from `/tmp/aider/requirements/requirements.in`):
`rich`, `prompt_toolkit`, `GitPython`, `litellm`, `grep_ast`, `tree-sitter-language-pack`, `networkx`, `scipy`, `beautifulsoup4`, `pyperclip`, `pydub`, `sounddevice`, `soundfile`, `pillow`, `watchfiles`, `pexpect`, `diff-match-patch`, `flake8`, `configargparse`, `diskcache`, `posthog`, `mixpanel`, `pathspec`, `psutil`, `pypandoc`, `json5`, `jsonschema`, `backoff`. Browser extra: `streamlit`.

**Implementation Details.**
- **Diff rendering**: Aider supports multiple edit formats. The `EditBlockCoder` (`/tmp/aider/aider/coders/editblock_coder.py`) uses a SEARCH/REPLACE block format (not standard unified diff) -- the LLM outputs original and updated text, and `do_replace` applies fuzzy matching via `difflib.SequenceMatcher`. The `UnifiedDiffCoder` (`/tmp/aider/aider/coders/udiff_coder.py`) parses actual unified-diff hunks from LLM output and applies them with `search_and_replace`. For *display*, diffs shown to the user come from `difflib.unified_diff` (standard unified format, not side-by-side) or from raw `git diff` output (which is also unified format, optionally with `--color`). During streaming, `diff_partial_update` in `/tmp/aider/aider/diffs.py` computes a partial diff with a progress bar showing lines processed.
- **Chat loop**: `Coder.run()` in `/tmp/aider/aider/coders/base_coder.py` loops calling `get_input()` (prompt_toolkit) then `run_one()`. `run_one()` calls `send_message()` which is a generator. In streaming mode, `show_send_output_stream()` iterates over LLM chunks, appending to `partial_response_content` and calling `live_incremental_response()` which feeds text into `MarkdownStream.update()`. The `WaitingSpinner` starts before the LLM call and stops on first received chunk. Reflection loops allow up to 3 automatic retries when lint/test failures occur.
- **Browser streaming**: The `GUI` class in `/tmp/aider/aider/gui.py` calls `st.write_stream(self.coder.run_stream(prompt))` where `run_stream` is a generator that yields text chunks. Streamlit handles the progressive rendering. After completion, edit info (commit hash, diff) is displayed in expandable containers. The `process_chat` method runs the reflection loop (up to 3 rounds) and triggers `st.rerun()` to refresh the UI.
- **Git integration display**: `GitRepo.commit()` in `/tmp/aider/aider/repo.py` generates diffs via `repo.git.diff("HEAD", "--", *fnames)`, optionally generates commit messages via the LLM, and handles attribution (author/committer name modification, co-authored-by trailers). The `diff_commits` method produces colored or plain unified diffs between two commits. In the browser UI, diffs are displayed inside `st.code(diff, language="diff")` blocks within expandable containers alongside undo buttons.

**Maturity Assessment.**
Aider is a highly mature project (22k+ GitHub stars, frequent releases, comprehensive test suite). The **terminal UI is production-quality** -- the prompt_toolkit integration provides readline-grade editing with tab completion, history, vi/emacs modes, and clipboard integration. The Rich-based markdown streaming at 20 FPS with adaptive throttling is polished. The **browser UI is explicitly marked as experimental** ("This browser version of aider is experimental" warning in the sidebar). It uses Streamlit's built-in chat components and works but lacks the polish of the terminal: no real-time markdown rendering during streaming (relies on `st.write_stream`), limited cost/token display, and some unfinished features (commented-out settings tab, hardcoded random cost display in the `cost()` method). The core value is firmly in the terminal experience, which is where all the engineering effort is concentrated -- custom spinner animations, adaptive render timing, multiple diff format engines, voice input, file watching, and clipboard monitoring.agentId: a8082ca (for resuming to continue this agent's work if needed)
<usage>total_tokens: 60033
tool_uses: 0
duration_ms: 24934</usage>

---

### OpenHands

**(formerly OpenDevin) -- Web UI Technical Deep-Dive**

**Tech Stack.** The frontend is a React 19 SPA built with Vite 7 and React Router 7 (file-based routing via `@react-router/dev`). State management uses **Zustand** (v5) for local/global stores and **TanStack React Query** (v5) for server state and caching. Styling is **Tailwind CSS v4** with utility helpers `clsx`, `tailwind-merge`, and `class-variance-authority` -- no component library like MUI or shadcn is used. The design-system primitives come from **HeroUI** (`@heroui/react` 2.8.7), and motion is handled by **Framer Motion**. The `openhands-ui/` directory contains a separate shared design-token/component package. Internationalization uses `i18next` with browser language detection. Analytics are wired through **PostHog**.

**Widget Inventory -- Six Workspace Panels.** The conversation view (`/conversations/:conversationId`) renders a resizable two-panel layout (`DesktopLayout` / `MobileLayout` in `/tmp/openhands/frontend/src/components/features/conversation/conversation-main/`). The left panel is always the **Chat Interface** (`ChatInterface` in `chat-interface.tsx`). The right panel is a tabbed area governed by `ConversationTabs` (`conversation-tabs.tsx`) with the following tabs:

| Tab | Route / Component | Implementation |
|---|---|---|
| **Changes** (git diff viewer) | `changes-tab.tsx` -> `FileDiffViewer` | Uses `@monaco-editor/react` `DiffEditor` with a custom dark theme to render side-by-side original/modified diffs. Git changes are fetched via React Query. |
| **Code** (VS Code web) | `vscode-tab.tsx` -> `VSCodeTab` | Embeds a remote VS Code Web instance via `<iframe>`. The URL is fetched from the backend (`useUnifiedVSCodeUrl`). Cross-protocol detection triggers a "Open in New Tab" fallback. There is no local Monaco editor for code editing -- all code editing is delegated to the iframe'd VS Code. |
| **Terminal** | `terminal.tsx` -> `Terminal` | Uses **xterm.js v6** (`@xterm/xterm`) with the `FitAddon`. The terminal is **read-only** (`disableStdin: true`) -- it is a log viewer for agent commands, not an interactive shell. The `useTerminal` hook manages a persistent `Terminal` instance, replaying commands from the Zustand `commandStore`. |
| **App** (served host preview) | `served-tab.tsx` -> `ServedApp` | Embeds the agent's served application (e.g., a local web server) in an `<iframe>` with a mini URL bar, refresh, and home buttons. |
| **Browser** (agent browser view) | `browser-tab.tsx` -> `BrowserPanel` | Displays **server-side screenshots** as base64 PNG images, not a live browser. The `browserStore` holds a URL string and a `screenshotSrc` string, updated by `BrowseObservation` events. This is effectively a screenshot viewer of the agent's headless Chromium. |
| **Planner** | `planner-tab.tsx` -> `PlannerTab` | Renders plan markdown content via `MarkdownRenderer` with custom plan components. Gated behind a `USE_PLANNING_AGENT` feature flag. |

There is **no VNC desktop widget** in the frontend. The "browser view" is screenshot-based, not a live VNC stream.

**Chat Panel and Agent Event Rendering.** The chat interface (`ChatInterface`) is the core UI. It renders events from the Zustand `useEventStore`, which maintains two parallel arrays: `events` (all raw events, deduplicated by ID and sorted by timestamp) and `uiEvents` (a display-optimized version where observation events replace their corresponding action events via `handleEventForUI` in `/tmp/openhands/frontend/src/utils/handle-event-for-ui.ts`). The codebase supports two event protocol versions: **V0** (Socket.IO-based, legacy) and **V1** (native WebSocket, current). V0 events are rendered by `Messages` (aliased as `V0Messages`), V1 events by `V1Messages` from `components/v1/chat/`. The `EventMessage` component (`/tmp/openhands/frontend/src/components/features/chat/event-message.tsx`) dispatches to specialized sub-components: `UserAssistantEventMessage`, `ObservationPairEventMessage`, `FinishEventMessage`, `ErrorEventMessage`, `McpEventMessage`, `TaskTrackingEventMessage`, and `GenericEventMessageWrapper`. Action content is formatted by `getActionContent()` (`/tmp/openhands/frontend/src/components/features/chat/event-content-helpers/get-action-content.ts`) which handles `run` (shell commands), `run_ipython`, `browse`, `browse_interactive`, `write`, `edit`, `think`, `finish`, `call_tool_mcp`, and `task_tracking` action types.

**WebSocket Architecture.** The system maintains two distinct WebSocket pathways. For V0 conversations, `WsClientProvider` (`/tmp/openhands/frontend/src/context/ws-client-provider.tsx`) uses **Socket.IO** (`socket.io-client`), emitting on `oh_user_action` and listening on `oh_event`. For V1 conversations, `ConversationWebSocketProvider` (`/tmp/openhands/frontend/src/contexts/conversation-websocket-context.tsx`) uses **native WebSocket** via a custom `useWebSocket` hook (`/tmp/openhands/frontend/src/hooks/use-websocket.ts`) with reconnection logic (3-second backoff, configurable max attempts, WeakSet-based instance tracking to prevent stale reconnections). The V1 provider manages two simultaneous WebSocket connections -- one for the main agent and one for the planning agent (sub-conversation). Incoming messages are parsed as JSON, validated with type guards (`isV1Event`, `isExecuteBashActionEvent`, `isBrowserObservationEvent`, etc.), and dispatched to the appropriate Zustand stores: `useEventStore.addEvent()` for chat events, `useCommandStore.appendInput/appendOutput()` for terminal commands, `useBrowserStore.setScreenshotSrc()` for browser screenshots, and `useAgentStore.setCurrentAgentState()` for agent lifecycle. History replay on connect uses a `resend_all` query parameter, with an event-count based mechanism (fetched via `EventService.getEventCount`) to detect when history loading is complete. A wrapper component `EventHandler` (`/tmp/openhands/frontend/src/wrapper/event-handler.tsx`) sits above the conversation UI and runs `useHandleWSEvents` and `useHandleRuntimeActive` hooks to process error states and agent-max-iteration pausing.

**Event-Sourced State Model.** The `useEventStore` (`/tmp/openhands/frontend/src/stores/use-event-store.ts`) is the central event log. Every WebSocket message becomes an `OHEvent` (union of `OpenHandsEvent` V1 and `OpenHandsParsedEvent` V0 types). Events are deduplicated by ID using an `O(1)` `Set` lookup, chronologically sorted when out-of-order events arrive, and split into two derived views: `events` (full history) and `uiEvents` (display-optimized, where observations replace their parent actions except for `ThinkObservation` and `FinishObservation`). Side-effect dispatch happens in the WebSocket providers: `handleAssistantMessage` (`/tmp/openhands/frontend/src/services/actions.ts`) routes V0 action/observation/status messages to their respective stores. For V0, `handleObservationMessage` (`/tmp/openhands/frontend/src/services/observations.ts`) updates the `commandStore` for `RUN` observations and the `browserStore` for `BROWSE`/`BROWSE_INTERACTIVE` observations (storing base64 screenshots and URLs). Cache invalidation is handled inline: file edit/write actions trigger `queryClient.invalidateQueries` for `file_changes` and `file_diff` query keys.

**Key Dependencies Summary:**

- **React 19** + **React Router 7** (framework/routing)
- **Zustand 5** (state management -- 15+ stores: agent, browser, command, conversation, error-message, event, initial-query, metrics, optimistic-user-message, security-analyzer, status, v1-conversation-state, home, microagent-management)
- **TanStack React Query 5** (server state / caching)
- **@xterm/xterm 6** + **@xterm/addon-fit** (terminal rendering)
- **@monaco-editor/react** + **monaco-editor 0.55** (diff viewer only, not primary editor)
- **socket.io-client** (V0 WebSocket transport)
- **Native WebSocket** (V1 transport via custom `useWebSocket` hook)
- **Tailwind CSS 4** + **HeroUI** (styling / component primitives)
- **Framer Motion** (animations)
- **react-markdown** + **remark-gfm** + **remark-breaks** + **react-syntax-highlighter** (chat message rendering)
- **@microlink/react-json-view** (JSON display)
- **lucide-react** + **react-icons** (iconography)
- **i18next** + **i18next-browser-languagedetector** (internationalization)
- **PostHog** (analytics)
- **Axios** (HTTP client)
- **downshift** (combobox/autocomplete primitives)
- **MSW** (mock service worker for testing)
- **Vitest** + **Playwright** (unit and E2E testing)

**Component Structure.** The source is organized under `src/components/features/` with domain-specific directories (chat, terminal, browser, diff-viewer, conversation, sidebar, files, trajectory, settings, feedback, markdown, served-host, tips), `src/stores/` for Zustand stores, `src/hooks/` for custom hooks (50+ hooks including WebSocket, agent state, terminal, scroll management, drag-resize, auth, tracking), `src/services/` for event handling logic, `src/types/` for TypeScript type definitions (with a `v1/` subdirectory for the new event protocol with its own type-guards and core event types), `src/routes/` for page-level components, `src/context/` and `src/contexts/` for React context providers, and `src/utils/` for pure utility functions. The routing structure (`/tmp/openhands/frontend/src/routes.ts`) defines: login, a root layout wrapping home, accept-tos, settings (with nested LLM/MCP/user/integrations/app/billing/secrets/api-keys sub-routes), conversation detail, microagent management, device verification, and a public shared-conversation route.

**Maturity Assessment.** With 65k+ GitHub stars, OpenHands is one of the most popular open-source AI coding agent projects. The frontend demonstrates significant engineering investment: dual protocol support (V0/V1) with graceful migration, comprehensive i18n, PostHog analytics integration, MSW-based mock infrastructure for testing (Vitest + Playwright), strict TypeScript with airbnb-typescript ESLint config, lint-staged + Husky pre-commit hooks, and responsive mobile/desktop layouts with resizable panels. The architecture is well-decomposed with clean separation between event handling, state management, and presentation. The terminal is intentionally read-only (a log viewer, not interactive), which is a deliberate design choice since the agent operates the terminal. The browser panel being screenshot-based rather than VNC reflects a pragmatic tradeoff -- the agent's browser runs server-side in a sandbox, and screenshots are streamed back as observation events. The diff viewer using Monaco's DiffEditor with auto-height calculation and collapsible file sections is polished. The dual-WebSocket architecture for main + planning agent sub-conversations is sophisticated. The `handleEventForUI` function that replaces actions with their corresponding observations (while preserving Think and Finish actions) demonstrates a well-thought-out event-sourced rendering pipeline. Overall: a production-grade, well-maintained frontend with clear architectural patterns, though the V0/V1 transition code adds complexity that will presumably be cleaned up as V0 is fully deprecated.agentId: af9abbc (for resuming to continue this agent's work if needed)
<usage>total_tokens: 79478
tool_uses: 0
duration_ms: 60242</usage>

---

### bolt.diy

**bolt.diy** is the community fork of StackBlitz's **bolt.new**, an AI-powered full-stack web IDE that runs entirely in the browser. It pairs an LLM chat panel with a live coding workbench backed by StackBlitz WebContainers, so the AI can write files, execute shell commands, and show a running preview -- all without a backend server.

---

#### Tech Stack & Bundler

| Layer | Choice |
|---|---|
| **Framework** | Remix v2 (Vite plugin) on Cloudflare Pages / optional Electron shell |
| **Bundler** | Vite 5, `remix vite:build`, deployed via Wrangler |
| **Styling** | **UnoCSS** (Tailwind-compatible atomic utility preset) + SCSS modules (`BaseChat.module.scss`, `Markdown.module.scss`, etc.). A comprehensive design-token system in `uno.config.ts` maps CSS custom properties (`--bolt-elements-*`) to utility classes, enabling light/dark theme switching via `[data-theme]` selectors. |
| **State management** | **nanostores** (`atom`, `map`) with `@nanostores/react` bindings for global stores; **Zustand** for the MCP settings store. |
| **UI primitives** | Radix UI (dialog, dropdown, tabs, context-menu, tooltip, checkbox, popover, etc.), Headless UI, Framer Motion for panel/view transitions. |

---

#### Key Dependencies

| Purpose | Package |
|---|---|
| AI chat SDK | `ai` 4.3.16 (Vercel AI SDK core), `@ai-sdk/react` (the `useChat` hook), plus provider adapters for Anthropic, OpenAI, Google, Mistral, Bedrock, Cohere, DeepSeek, Fireworks, Cerebras, OpenRouter, Ollama |
| Code editor | **CodeMirror 6** -- `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, language grammars for JS/TS/HTML/CSS/JSON/Python/C++/Markdown/Vue/WAST, `@uiw/codemirror-theme-vscode` |
| Terminal | **xterm.js 5** (`@xterm/xterm`), `@xterm/addon-fit`, `@xterm/addon-web-links` |
| In-browser runtime | `@webcontainer/api` 1.6.1 (StackBlitz WebContainers SDK) |
| Markdown rendering | `react-markdown`, `remark-gfm`, `rehype-raw`, `rehype-sanitize`, `shiki` for syntax highlighting |
| Git/deploy | `isomorphic-git`, `@octokit/rest` (GitHub), custom GitLab API service, Netlify/Vercel deploy APIs |
| Other notable | `diff` (file diff computations), `react-resizable-panels`, `react-beautiful-dnd`, `jszip`/`file-saver` (zip download), `@modelcontextprotocol/sdk` (MCP tool use), `chart.js`/`react-chartjs-2`, `jose` (JWT), `js-cookie` |

---

#### Widget Inventory & Component Structure

The top-level layout lives in `BaseChat.tsx` (`/tmp/bolt-diy/app/components/chat/BaseChat.tsx`). It renders a horizontal split: the **chat column** on the left and the **Workbench** on the right (wrapped in `ClientOnly` for SSR safety).

**Chat panel** (`/tmp/bolt-diy/app/components/chat/`):
- `Chat.client.tsx` -- the top-level client component. Calls the Vercel AI SDK `useChat` hook against `/api/chat`. Manages model/provider selection (persisted in cookies), image/file attachments, auto-template selection for first messages, and error handling with typed alert categories (auth, rate-limit, quota, network).
- `BaseChat.tsx` -- the presentational shell. Renders the sidebar menu, the `Messages` list, `ChatBox` (textarea + model selector + speech recognition), progress annotations, alert banners (action, Supabase, deploy, LLM error), and starter templates / example prompts before the first message.
- `Messages.client.tsx` -- streams parsed assistant messages alongside `UserMessage` / `AssistantMessage` components.
- `Artifact.tsx` -- inline widget that appears in the message stream for each `<boltArtifact>` block. Shows action list (file creates, shell commands, start commands) with live status (pending/running/complete/failed). Clicking opens the Workbench.
- `Markdown.tsx` -- renders assistant markdown via `react-markdown` with `shiki` code highlighting.

**Workbench** (`/tmp/bolt-diy/app/components/workbench/Workbench.client.tsx`):
- A `framer-motion` animated panel with three sub-views switchable via a `Slider` toggle: **Code**, **Diff**, and **Preview**.
- **Code view**: `EditorPanel.tsx` -- a `PanelGroup` (react-resizable-panels) containing:
  - `FileTree.tsx` -- recursive file tree built from the `FilesStore.files` nanostore map. Supports context-menu actions (create/delete/rename file/folder, lock/unlock), inline rename input, diff stats per file, unsaved-file indicators.
  - `FileBreadcrumb.tsx` -- path breadcrumb above the editor.
  - `CodeMirrorEditor.tsx` (`/tmp/bolt-diy/app/components/editor/codemirror/CodeMirrorEditor.tsx`) -- CodeMirror 6 instance. Creates a fresh `EditorState` per file path (cached in a `Map<string, EditorState>`). Supports language detection by extension, the VSCode dark theme, read-only tooltip when the AI is streaming, env-variable masking, and a file-lock system.
  - `TerminalTabs.tsx` / `Terminal.tsx` (`/tmp/bolt-diy/app/components/workbench/terminal/`) -- collapsible bottom panel with an xterm.js terminal (plus a dedicated "bolt" output terminal).
  - `Search.tsx` -- file content search panel.
  - `LockManager.tsx` -- UI for file/folder locking.
- **Diff view**: `DiffView.tsx` -- side-by-side diff of file history using the `diff` library.
- **Preview view**: `Preview.tsx` -- renders the running app in an `<iframe>` pointing at the WebContainer's `*.local-credentialless.webcontainer-api.io` URL. Features: address bar with port dropdown, reload, device-mode responsive sizing with resize handles and device frames, element inspector mode, screenshot selector, open-in-new-window, Expo QR code display.

**Settings** (`/tmp/bolt-diy/app/components/@settings/`): a full control panel with tabs for profile, cloud/local providers, GitHub/GitLab/Netlify/Vercel/Supabase integrations, MCP server configuration, feature flags, event logs, and data management.

**Deploy** (`/tmp/bolt-diy/app/components/deploy/`): GitHub/GitLab push dialogs, Netlify/Vercel one-click deploy.

---

#### How AI Responses Stream into the Editor

1. `Chat.client.tsx` calls `useChat({ api: '/api/chat', ... })` from `@ai-sdk/react`. The response streams server-sent events from a Remix action route.
2. On each message update, `useMessageParser` (`/tmp/bolt-diy/app/lib/hooks/useMessageParser.ts`) feeds the raw assistant text into `EnhancedStreamingMessageParser`, which extends `StreamingMessageParser` (`/tmp/bolt-diy/app/lib/runtime/message-parser.ts`).
3. The parser scans for custom XML tags: `<boltArtifact title="..." type="...">` and nested `<boltAction type="file|shell|start" filePath="...">`. As it encounters these:
   - **`onArtifactOpen`**: sets `workbenchStore.showWorkbench = true`, creates an `ArtifactState` with a new `ActionRunner`.
   - **`onActionOpen` (for file actions)**: calls `workbenchStore.addAction()` immediately so progress is visible.
   - **`onActionStream`**: called repeatedly as file content streams in. Invokes `workbenchStore.runAction(data, true)` which calls `_runAction` through a sampled (100ms debounce) queue. Inside, it calls `editorStore.updateFile(fullPath, content)` -- this updates the nanostore document, which triggers the CodeMirror editor to `dispatch` a content replacement, giving a live "typing" effect.
   - **`onActionClose`**: for file actions, saves the file to WebContainer's filesystem via `filesStore.saveFile()`. For shell/start actions, enqueues them in the `ActionRunner` which executes commands through the bolt shell process.
4. The editor is set to **read-only** while streaming (`editable` prop driven by `isStreaming`), with a tooltip explaining this.

---

#### File Tree and Editor Sync

- `FilesStore` (`/tmp/bolt-diy/app/lib/stores/files.ts`) holds a `MapStore<FileMap>` that mirrors the WebContainer filesystem. On init, it attaches a watcher on the working directory. File-system events (`add_file`, `change`, `remove_file`, `add_dir`, `remove_dir`) update the nanostore map.
- `EditorStore` (referenced as `#editorStore` inside `WorkbenchStore` at `/tmp/bolt-diy/app/lib/stores/workbench.ts`) maintains `documents: MapStore<Record<string, EditorDocument>>` and `selectedFile: WritableAtom<string>`. When `workbenchStore.setDocuments(files)` is called (triggered by `useEffect` watching `files`), it syncs the editor document map.
- Selecting a file in `FileTree` calls `workbenchStore.setSelectedFile(filePath)`, which updates `editorStore.selectedFile`. The `currentDocument` computed atom resolves the selected file's content, and the `CodeMirrorEditor` reactively replaces its state.
- Manual edits in the editor call `workbenchStore.setCurrentDocumentContent(content)`, which tracks unsaved changes. Cmd+S triggers `saveCurrentDocument()`, writing back to WebContainer's filesystem and refreshing previews via `BroadcastChannel`.
- A file-locking system persists lock state per chat ID in `localStorage`, preventing edits to files the AI is actively modifying or that the user explicitly locks.

---

#### WebContainers: Preview and Terminal

- **Boot**: `/tmp/bolt-diy/app/lib/webcontainer/index.ts` calls `WebContainer.boot({ coep: 'credentialless', workdirName: 'project' })` on the client side (skipped during SSR). The resulting promise is shared as a module-level singleton. An inspector script is injected via `webcontainer.setPreviewScript()` to enable element inspection in the preview iframe, and a `preview-message` listener surfaces uncaught exceptions from the preview as action alerts.
- **Preview**: `PreviewsStore` (`/tmp/bolt-diy/app/lib/stores/previews.ts`) listens on `webcontainer.on('server-ready')` and `webcontainer.on('port')` events. When a dev server starts (e.g., `npm run dev`), the port event provides a `baseUrl` like `https://<id>.local-credentialless.webcontainer-api.io`. The `Preview` component renders an `<iframe src={baseUrl}>`. A `BroadcastChannel` syncs preview refreshes and `localStorage` state across browser tabs.
- **Terminal**: `TerminalStore` (`/tmp/bolt-diy/app/lib/stores/terminal.ts`) spawns shell processes via `newShellProcess(webcontainer, terminal)` which creates a `WebContainerProcess` connected to the xterm.js instance. Input from xterm is piped to the process stdin; output is written back to xterm. A dedicated "bolt terminal" (`BoltShell`) is used by the `ActionRunner` (`/tmp/bolt-diy/app/lib/runtime/action-runner.ts`) to execute AI-generated shell commands. Resize events from the `FitAddon` are forwarded via `process.resize()`.

---

#### Maturity Assessment

bolt.diy is a large, actively maintained community fork (MIT-licensed). The codebase is substantial -- hundreds of components, a multi-store architecture, and deep integration with WebContainers, multiple AI providers, and several deployment targets (Cloudflare, Electron, Docker). It includes features well beyond the original bolt.new: multi-provider support (20+ LLM providers including Ollama for local models), MCP tool integration, GitHub/GitLab/Netlify/Vercel/Supabase integrations, file locking, diff view, element inspector, device-frame preview, speech recognition, chat import/export, and an Electron desktop build. The styling uses a well-structured design-token system through UnoCSS. Code quality is reasonable -- TypeScript throughout, memoized components, scoped loggers -- though there are signs of rapid community development: a `@ts-nocheck` at the top of `BaseChat.tsx`, scattered TODO comments, some duplicated patterns, and inconsistent naming (e.g., `updateChatMestaData`). The Electron support and Docker builds suggest it is targeting production use. Overall, it is a feature-rich but somewhat rough community project -- functional and ambitious, with broad provider coverage and a solid architectural foundation, but without the polish of a commercially maintained product.agentId: a7709a1 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 96788
tool_uses: 0
duration_ms: 30498</usage>

---

### Goose (Block)

**Repository:** `github.com/block/goose` -- v1.23.0, Apache-2.0 license. A Rust workspace (370 `.rs` files across 7 crates) paired with an Electron/React desktop app (382 `.ts`/`.tsx` files). The architecture is a three-layer stack: a core `goose` agent crate, a `goose-server` HTTP/WebSocket backend (Axum), and two frontends -- a Rust CLI (`goose-cli`) and an Electron desktop app (`ui/desktop`).

---

**CLI Tech Stack & Rendering.** The CLI does **not** use a full TUI framework like Ratatui or Crossterm. Instead, it uses a collection of focused terminal crates for a "rich REPL" approach:

- **`rustyline` (v15)** -- GNU Readline-style line editor providing input history, Emacs/Vi keybindings, tab completion (`GooseCompleter`), and customizable key handlers (Ctrl+C to clear line or exit, Ctrl+J for newlines).
- **`console` (v0.16)** -- ANSI color/style library. All output styling (`.cyan()`, `.green().bold()`, `.dim()`) flows through this crate. The prompt face `( O)>` is rendered with `console::style`.
- **`bat` (v0.26)** -- The `bat::PrettyPrinter` renders all Markdown/text output with syntax-highlighting themes (`GitHub`, `zenburn`, `base16`) and wrapping control. This gives the CLI its polished code-block display.
- **`cliclack` (v0.3)** -- Provides interactive UI primitives: spinners for the "thinking" indicator, `confirm()` dialogs for plan-mode and compaction, and `select()` menus for tool approval (Allow Once / Always Allow / Deny / Cancel).
- **`indicatif` (v0.18)** -- `MultiProgress` + `ProgressBar` for MCP extension progress notifications. Spinners use custom tick chars.

**CLI Widget Inventory:**

| Widget | Implementation |
|---|---|
| Chat input | `rustyline::Editor` with custom completer, history file, Ctrl+C handler |
| Streaming text | `bat::PrettyPrinter` rendering Markdown with configurable themes (light/dark/ansi) |
| Thinking spinner | `cliclack::spinner()` with randomized "thinking" messages |
| Tool call display | Custom `render_tool_request()` with per-tool formatting: `developer__text_editor` shows shortened paths, `developer__shell` shows params, `code_execution__execute` renders a numbered tool-graph DAG |
| Tool approval prompt | `cliclack::select()` with Allow Once / Always Allow / Deny / Cancel options |
| Elicitation forms | Schema-driven interactive input: `cliclack::confirm()` for booleans, raw stdin for strings/numbers/enums |
| MCP progress bars | `indicatif::MultiProgress` with progress bars and log spinners |
| Context usage meter | Custom `display_context_usage()` rendering a dot-bar colored green/yellow/red by percentage |
| Cost display | Inline `$X.XXXX USD` formatted with `console::style().cyan()` |
| Slash commands | 15+ commands (`/plan`, `/compact`, `/recipe`, `/mode`, `/extension`, `/builtin`, `/prompts`, `/t`, `/r`, `/clear`, etc.) parsed in `handle_slash_command()` |

**Streaming Architecture (CLI).** The `process_agent_response()` method in `session/mod.rs` consumes an async `Stream<AgentEvent>` via `tokio::select!` in a loop. Events include `AgentEvent::Message` (rendered immediately via `output::render_message`), `AgentEvent::McpNotification` (routed to progress bars or thinking spinner updates), `AgentEvent::HistoryReplaced` (conversation compaction), and `AgentEvent::ModelChange`. Cancellation is via `CancellationToken`; Ctrl+C in a background `tokio::spawn` triggers it. Interrupted tool calls get synthetic error `ToolResponse` messages injected. Three output formats are supported: interactive (default), `json` (single JSON blob at end), and `stream-json` (NDJSON events).

---

**Desktop App Tech Stack.** Electron 40 + React 19 + TypeScript 5.9, built with Electron Forge + Vite 7. Styling is **Tailwind CSS v4** with `tailwindcss-animate`. Component library is **Radix UI** (accordion, avatar, dialog, popover, radio-group, scroll-area, select, tabs, themes) plus **Lucide React** icons and `class-variance-authority`/`clsx`/`tailwind-merge` for variant styling -- essentially a **shadcn/ui** pattern. State management uses **SWR** for data fetching and React `useReducer` for chat stream state (`streamReducer`). Routing via **React Router DOM v7**.

**Desktop Widget Inventory:**

| Component | File | Purpose |
|---|---|---|
| `BaseChat` | `BaseChat.tsx` | Main chat container: message list, input, scroll area, recipe headers |
| `GooseMessage` | `GooseMessage.tsx` | Assistant message renderer: markdown, tool calls, chain-of-thought (`<think>` tags) |
| `UserMessage` | `UserMessage.tsx` | User message bubble with image previews |
| `MarkdownContent` | `MarkdownContent.tsx` | `react-markdown` with `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter` (Prism, oneDark theme) |
| `ToolCallWithResponse` | `ToolCallWithResponse.tsx` | Collapsible tool call display with status icons, arguments, response content, MCP-UI rendering |
| `ToolCallConfirmation` | `ToolCallConfirmation.tsx` | Inline permission prompt card |
| `ToolApprovalButtons` | `ToolApprovalButtons.tsx` | Allow Once / Always Allow / Deny buttons calling `confirmToolAction()` API |
| `ElicitationRequest` | `ElicitationRequest.tsx` | Schema-driven form (`JsonSchemaForm`) with 5-minute countdown timer |
| `MCPUIResourceRenderer` | `MCPUIResourceRenderer.tsx` | `@mcp-ui/client` `UIResourceRenderer` for rich HTML/iframe MCP tool outputs with proxy support |
| `McpAppRenderer` | `McpApps/McpAppRenderer.tsx` | Sandboxed iframe renderer for MCP Apps (SEP-1865 draft spec) with CSP, permissions, and postMessage bridge |
| `ChatInput` | `ChatInput.tsx` | Multi-line input with file drop, mentions, image preview |
| `SettingsView` | `settings/SettingsView.tsx` | Full settings panel: providers, models, extensions, permissions, mode, dictation, keyboard shortcuts, sessions, tunnel |
| `ExtensionsView` | `extensions/ExtensionsView.tsx` | Extension management panel |
| `GooseSidebar` | `GooseSidebar/` | Session list, environment badge, sidebar navigation |
| `SearchView` | `conversation/SearchView.tsx` | In-conversation search |
| `ProgressiveMessageList` | `ProgressiveMessageList.tsx` | Virtualized progressive message rendering |

**Desktop-Server Communication.** The Electron app spawns `goosed` (the Rust binary from `goose-server`) as a child process on a random local port (`goosed.ts: findAvailablePort()`). The renderer communicates via an OpenAPI-generated TypeScript client (`@hey-api/openapi-ts`). Chat streaming uses `reply()` which returns `MessageEvent` objects over an HTTP streaming connection. The `useChatStream` hook manages all state via a `useReducer` dispatcher with actions like `START_STREAMING`, `SET_MESSAGES`, `STREAM_FINISH`, and `ADD_NOTIFICATION`. The `pushMessage()` helper handles incremental text appending -- when consecutive events share the same message ID and end with a `text` content block, the text is concatenated in place rather than creating new messages. The app polls for status, manages sessions, and sends tool confirmations via REST endpoints (`/reply`, `/session`, `/action_required/confirm`, etc.).

**MCP Integration in the UI.** MCP extensions surface in three ways: (1) tool call/response pairs rendered as collapsible `ToolCallWithResponse` cards with status indicator icons (loading dot, success check, error X); (2) MCP notifications displayed as progress events or log messages via `indicatif` on CLI / toast notifications on desktop; (3) rich UI via `@mcp-ui/client` (v5.17) which renders MCP server-provided HTML/URLs in sandboxed iframes with `UIResourceRenderer`, supporting `rawHtml` and `externalUrl` content types with a goosed proxy for CORS. The new MCP Apps draft spec (`McpAppRenderer`) adds a `postMessage` bridge (`useSandboxBridge`) for bidirectional tool calls, resource reads, and permission-gated actions. Action types handled include `tool`, `prompt`, `link`, `notify`, and `intent`, each with typed result discriminated unions.

**Permission System.** Both CLI and desktop implement the same permission model with options: `allow_once`, `always_allow`, `deny_once`, `always_deny`, and `cancel`. In the CLI, this is a `cliclack::select()` menu rendered inline during tool execution. In the desktop, it is an inline card (`ToolCallConfirmation`) with styled `Button` components that POST to the `/action_required/confirm` endpoint. The desktop also has a dedicated settings panel (`PermissionSetting.tsx` / `PermissionModal.tsx` / `PermissionRulesModal.tsx`) for managing persistent permission rules. Modes include `auto` (no prompts), `approve` (prompt for every tool), `chat` (no tool execution), and `smart_approve` (selective prompting), configurable via `/mode` in CLI or `ModeSection.tsx` in the desktop settings.

---

**Key Rust Crate Dependencies:**
`rmcp` (v0.14, official Rust MCP SDK -- client/server/transport-io), `clap` (CLI argument parsing), `rustyline` (line editing), `bat` (syntax-highlighted output), `cliclack` (interactive prompts/spinners), `console` (ANSI styling), `indicatif` (progress bars), `axum` (HTTP/WebSocket server), `tower-http` (CORS/auth/static file serving), `reqwest` (HTTP client with rustls), `tokio` (async runtime), `serde`/`serde_json`/`serde_yaml` (serialization), `tree-sitter` + 8 language grammars for Python, Rust, JavaScript, Go, Java, Kotlin, Swift, Ruby (code analysis), `lopdf`/`docx-rs`/`umya-spreadsheet` (document parsing), `mpatch` (fuzzy diff/patch application), `xcap` (screen capture), `chrono`, `uuid`, `regex`.

**Key npm Dependencies:**
`react` 19, `electron` 40, `@mcp-ui/client` (MCP UI rendering), `@radix-ui/*` (8 primitives -- accordion, avatar, dialog, popover, radio-group, scroll-area, select, tabs), `@radix-ui/themes`, `react-markdown` + `remark-gfm` + `remark-math` + `remark-breaks` + `rehype-katex` (rich markdown rendering), `react-syntax-highlighter` (code blocks), `lucide-react` + `react-icons` (icons), `tailwindcss` v4, `swr` (data fetching), `zod` (schema validation), `react-router-dom` v7, `electron-updater` (auto-updates), `katex` (math typesetting), `@tanstack/react-form` (form management), `@hey-api/openapi-ts` (API client generation from OpenAPI spec), `@modelcontextprotocol/sdk` (dev dependency for MCP types), `qrcode.react` (QR codes for sharing/tunnel), `react-toastify` (notifications).

**Maturity Assessment.** Goose is a highly polished, production-grade tool at v1.23.0 with Apache 2.0 licensing from Block (formerly Square). The codebase is substantial (~370 Rust files, ~382 TypeScript files) with comprehensive test infrastructure: Vitest unit tests, Playwright E2E tests, Rust integration tests, and scenario-based tests. The CLI has thoughtful UX details: themed syntax highlighting via `bat`, path shortening in tool output, context-window dot meters with color gradients, cost tracking per response, streaming JSON output modes, session persistence, command history, and external editor integration (configurable `goose_prompt_editor`). The desktop app is equally mature with full settings management, auto-updates via `electron-updater`, custom protocol handlers (`goose://`), drag-and-drop file support, system tray integration, configurable keyboard shortcuts, recipe management (shareable YAML task definitions with security scanning), dictation support, and the emerging MCP Apps/MCP-UI rendering layer. The `rmcp` crate provides first-class MCP protocol support including the newer elicitation and tool confirmation flows. Code quality is enforced via Clippy lints, ESLint with TypeScript strict mode, Prettier formatting, Husky pre-commit hooks, and lint-staged. The main areas still evolving are MCP Apps (implementation marked "temporary" pending official SDK components per SEP-1865), and the tool-call action type in `@mcp-ui/client` handlers is noted as "not yet implemented." Overall, this is one of the most feature-complete open-source AI coding assistants available, with a clear separation between the agent core, server API, and dual frontend surfaces.agentId: a4fae14 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 59777
tool_uses: 0
duration_ms: 37470</usage>

---

### Cline

**Repository**: github.com/cline/cline -- 30k+ stars, Apache-2.0, v3.57.1. The most popular open-source AI coding agent VSCode extension. The webview UI lives entirely in `webview-ui/` as a standalone Vite + React 18 application that is built and bundled into the extension.

---

#### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18.3 (SWC compiler via `@vitejs/plugin-react-swc`) |
| **Build** | Vite 7, TypeScript 5.7 |
| **Styling** | **Tailwind CSS v4** as the primary styling system, augmented by **styled-components v6** for complex stateful styled elements (checkpoint controls, chat textarea chrome). The Tailwind config (`tailwind.config.mjs`) maps all color tokens to VSCode CSS custom properties (`var(--vscode-*)`) so the UI inherits the active editor theme. |
| **Component library** | **Radix UI primitives** (dialog, popover, tooltip, select, switch, slider, hover-card, separator, label, progress) wrapped in local `components/ui/` files following the shadcn/ui pattern. **HeroUI** (NextUI fork) for additional components. **@vscode/webview-ui-toolkit** for native-looking VSCode buttons. |
| **Icons** | `lucide-react` for all custom icons, plus VSCode `codicon` icon font for platform-native glyphs. |
| **State management** | React Context (`ExtensionStateContext`) holds the entire extension state tree. No Redux or Zustand. A single `setState` hook in `ExtensionStateContextProvider` receives state snapshots from the extension host via **gRPC streaming** subscriptions (`StateServiceClient.subscribeToState`). Partial message updates arrive through a separate `subscribeToPartialMessage` stream and are merged by timestamp. Navigation between views (settings, history, MCP, account, worktrees) is driven by boolean state flags toggled through callback functions on the context. An `onRelinquishControl` event-callback system lets individual components register cleanup functions that fire when the extension reclaims control. |
| **Extension <-> Webview communication** | **gRPC over protobuf** (not the older `postMessage` pattern). Service clients (`UiServiceClient`, `FileServiceClient`, `StateServiceClient`, `CheckpointsServiceClient`, `McpServiceClient`, `ModelsServiceClient`) are generated from `.proto` definitions and communicate through bidirectional streaming. |
| **Virtualization** | `react-virtuoso` for the message list. The `MessagesArea` component renders a `<Virtuoso>` with `increaseViewportBy={{ top: 3000, bottom: Number.MAX_SAFE_INTEGER }}` to prevent content jumping and guarantee smooth scroll-to-bottom behavior. |

---

#### Key Dependencies

| Package | Purpose |
|---|---|
| `react-markdown` + `remark-gfm` + `rehype-highlight` | Markdown rendering with GFM tables/checkboxes and server-side syntax highlighting of fenced code blocks |
| `mermaid` | Mermaid diagram rendering inside markdown code blocks (via `MermaidBlock` component) |
| `diff` (v5.2) | Diff computation in the extension host (in root `package.json`); the webview has its own custom SEARCH/REPLACE and patch-format parsers in `DiffEditRow.tsx` |
| `react-virtuoso` | Virtualized scrolling for the chat message list |
| `styled-components` | CSS-in-JS for checkpoint controls, chat text area, and other stateful styled elements |
| `fuse.js` + `fzf` | Fuzzy file/folder search for the `@`-mention autocomplete context menu |
| `@floating-ui/react` | Positioning for checkpoint restore popover tooltips |
| `react-textarea-autosize` | Auto-growing multi-line chat input |
| `dompurify` | HTML sanitization |
| `framer-motion` | Animation library for transitions |
| `firebase` + `posthog-js` | Analytics and authentication |
| `react-use` | Utility hooks (`useSize`, `useClickAway`, `useMount`) |
| `fast-deep-equal` | Deep comparison for `React.memo` on `ChatRow` |

---

#### Widget Inventory & Component Tree

```
App
  Providers (PlatformProvider > ExtensionStateContextProvider > PostHogProvider > ClineAuthProvider > HeroUIProvider)
    AppContent
      WelcomeView / OnboardingView              -- first-run experience
      SettingsView                               -- model/API configuration
      HistoryView                                -- past task sessions (also virtuoso-based)
      McpConfigurationView                       -- MCP server management
      AccountView                                -- user account
      WorktreesView                              -- git worktree management
      ChatView (always mounted, hidden via isHidden prop)
        Navbar                                   -- top navigation bar
        TaskSection | WelcomeSection             -- task header or welcome screen
          TaskHeader                             -- collapsible header showing task description, token metrics, focus chain checklist
            ContextWindow / ContextWindowSummary  -- token usage visualization
            FocusChain                           -- checklist of current focus items
        MessagesArea                             -- virtualized message list
          Virtuoso
            MessageRenderer                      -- routes each message to the right component
              ChatRow                            -- the central message renderer (~1282 lines)
              BrowserSessionRow                  -- browser automation session display
              ToolGroupRenderer                  -- collapsed group of low-stakes tools
        ActionButtons                            -- approve/reject/retry/cancel buttons
        AutoApproveBar                           -- auto-approval toggle bar
        InputSection
          ChatTextArea                           -- input with @-mention, slash commands, Plan/Act toggle
            ContextMenu                          -- @-mention file/folder/terminal/git autocomplete dropdown
            SlashCommandMenu                     -- /command autocomplete dropdown
            VoiceRecorder                        -- dictation support
```

---

#### How ChatRow Renders Different Message Types

`ChatRow` (`ChatRow.tsx`, ~1282 lines) is wrapped in `React.memo` with `fast-deep-equal` as the comparator. It delegates to `ChatRowContent`, which uses a two-level `switch`:

1. **Tool messages** (`message.ask === "tool"` or `message.say === "tool"`): Parsed from JSON into `ClineSayTool`, then switched on `tool.tool`:
   - `editedExistingFile` / `newFileCreated` -- renders `DiffEditRow` (when background editing is enabled) or `CodeAccordian` with the file path as a collapsible header
   - `readFile` -- file path link with open-in-editor icon
   - `listFilesTopLevel` / `listFilesRecursive` / `listCodeDefinitionNames` -- `CodeAccordian` with shell-session syntax
   - `searchFiles` -- `SearchResultsDisplay` component
   - `summarizeTask` -- expandable summary accordion
   - `webFetch` / `webSearch` / `useSkill` -- URL/query display blocks
   - `fileDeleted` -- deletion display with `CodeAccordian`

2. **Say messages** (`message.type === "say"`): `api_req_started` -> `RequestStartRow`; `text` -> `MarkdownRow` with copy button and quote selection; `reasoning` -> `ThinkingRow`; `user_feedback` -> `UserMessage`; `checkpoint_created` -> `CheckmarkControl`; `error` / `diff_error` -> `ErrorRow`; `completion_result` -> `CompletionOutputRow`; `hook_status` -> `HookMessage`; `command` -> `CommandOutputRow`; `mcp_server_response` -> `McpResponseDisplay`.

3. **Ask messages** (`message.type === "ask"`): `completion_result` -> `CompletionOutputRow`; `followup` -> markdown with `OptionsButtons`; `plan_mode_respond` -> `PlanCompletionOutputRow` with `OptionsButtons`; `command` -> `CommandOutputRow`; `use_mcp_server` -> MCP tool/resource display.

Low-stakes read-only tools (`readFile`, `listFiles*`, `searchFiles`, `listCodeDefinitionNames`) are grouped by `groupLowStakesTools()` into arrays and rendered by `ToolGroupRenderer` as a compact collapsible list with file icons, click-to-open behavior, and typewriter-animated "Reading..." activity text for in-progress items.

---

#### Tool Use Collapse/Expand

Each tool output block uses an `expandedRows` record keyed by message timestamp, managed by `useChatState`. `CodeAccordian` renders a clickable header bar (file path with RTL ellipsis trick for long paths) and a chevron icon; clicking toggles `isExpanded`. Command outputs (`CommandOutputRow`) auto-expand after 500ms of execution and auto-collapse when complete. `DiffEditRow` has its own per-file `isExpanded` state. The `ToolGroupRenderer` for low-stakes tools maintains separate `expandedItems` state for individual tool content within the group.

---

#### Diff Display

Two diff rendering paths exist:

1. **`DiffEditRow`** (used when `backgroundEditEnabled` is true): A custom inline diff viewer that parses two formats:
   - **SEARCH/REPLACE format**: `------- SEARCH` / `=======` / `+++++++ REPLACE` markers. Parsed into deletion (-) and addition (+) lines.
   - **Patch format**: `*** Begin Patch` / `*** Add|Update|Delete File: path` / `@@` chunk markers / `*** End Patch`. Each `@@` chunk becomes a separate expandable `FileBlock`.
   Each `DiffLine` renders with a colored left border stripe (green for additions, red for deletions), line numbers, `+`/`-` prefix characters, and syntax-colored code content. The component auto-scrolls during streaming. Stats show `+N` / `-N` counts.

2. **`CodeAccordian`** (legacy path): Wraps content in a fenced code block with `diff` language and renders via `CodeBlock` -> `ReactMarkdown` with `rehype-highlight`.

---

#### Thinking/Reasoning Blocks

`ThinkingRow` renders a collapsible "Thoughts" section with a chevron toggle. The content is shown in a scrollable container (`max-h-[150px]`) with a gradient fade overlay when more content is available below. During streaming, it auto-scrolls to the bottom. The reasoning content also appears inline within `RequestStartRow` for active API requests, where the `ThinkingRow` is embedded to show reasoning as it streams.

---

#### Checkpoint System

Checkpoints are rendered by `CheckmarkControl` (`CheckmarkControl.tsx`). Each checkpoint appears as a horizontal dotted line with a bookmark icon, "Checkpoint" label, and two action buttons: **Compare** and **Restore**. The dotted line uses a CSS `linear-gradient` repeating pattern. On hover, the label, dotted line, and buttons become visible (default opacity is 0.5).

Clicking **Restore** opens a floating tooltip (positioned with `@floating-ui/react`, portaled to `document.body`) offering three options:
- **Restore Files & Task** (primary) -- reverts both workspace files and conversation history
- **Restore Files Only** -- reverts workspace via git snapshot
- **Restore Task Only** -- truncates conversation messages after this point

Each restore action calls `CheckpointsServiceClient.checkpointRestore()` via gRPC with the message timestamp and restore type (`task`, `workspace`, or `taskAndWorkspace`). **Compare** calls `CheckpointsServiceClient.checkpointDiff()` to open a diff view in the editor. When a checkpoint is restored, `isCheckpointCheckedOut` turns the dotted line and bookmark icon blue (`var(--vscode-textLink-foreground)`) and shows "(restored)".

---

#### Plan vs Act Mode Toggle

The mode state (`"plan"` | `"act"`) lives in `ExtensionStateContext.mode`. The toggle is a button in `ChatTextArea` that calls `StateServiceClient.togglePlanActModeProto()` via gRPC, sending the new mode and any current input content. A keyboard shortcut (`Cmd+Shift+A` on Mac) is bound via `useShortcut`. When in Plan mode, the model's responses are rendered through `plan_mode_respond` ask messages which display via `PlanCompletionOutputRow` with `OptionsButtons` for suggested actions. The `MarkdownBlock` component has a custom remark plugin (`remarkHighlightActMode`) that detects "to Act Mode" text in model responses and renders it as a clickable inline toggle with a visual switch indicator.

---

#### File Mention Autocomplete (`@`-mentions)

Typing `@` in the `ChatTextArea` triggers `shouldShowContextMenu()` which opens the `ContextMenu` dropdown. The menu supports multiple context types:
- **File** -- fuzzy-searched via `fzf`/`fuse.js` against workspace files, with results also fetched from `FileServiceClient.searchFiles()` for dynamic ripgrep-powered search
- **Folder** -- same search mechanism for directories
- **Git** -- recent git commits with hash and message
- **Problems** -- workspace diagnostic problems
- **Terminal** -- terminal output
- **URL** -- paste a URL to fetch its contents

Results are displayed in a dropdown positioned absolutely above the input. Selected mentions are inserted with a `@path` syntax and highlighted in the textarea via an overlay div. The `ContextMenu` component supports keyboard navigation with screen reader announcements (`ScreenReaderAnnounce`).

Separately, typing `/` triggers `SlashCommandMenu` for slash commands.

---

#### Markdown Rendering

`MarkdownBlock` uses `react-markdown` with `remark-gfm` (GFM tables, strikethrough) and `rehype-highlight` (syntax highlighting). Custom remark plugins handle: URL auto-linking (`remarkUrlToLink`), preventing `__init__.py` from rendering as bold (`remarkPreventBoldFilenames`), Act Mode highlighting (`remarkHighlightActMode`), and marking potential file paths in inline code (`remarkMarkPotentialFilePaths`). The `InlineCodeWithFileCheck` component asynchronously checks if inline code matches a real file path and, if so, renders it as a clickable link that opens the file in the editor. Mermaid code blocks are detected and rendered via the `MermaidBlock` component using the `mermaid` library.

---

#### Maturity Assessment

Cline is a highly mature, production-grade project: 30k+ GitHub stars, active development (v3.57.1), extensive Storybook component library, Vitest unit tests with coverage, Playwright E2E tests, proper CI with linting (Biome), protobuf-based gRPC communication (replacing the older `postMessage` API), and a well-organized component architecture. The codebase shows multiple architectural generations -- older styled-components patterns coexist with newer Tailwind v4 classes, and the `postMessage` bridge has been fully migrated to gRPC streaming. The extension supports a wide ecosystem of LLM providers (Anthropic, OpenAI, Google, Ollama, OpenRouter, AWS Bedrock, Azure, Mistral, Cerebras, and more) and MCP server integrations.agentId: a702b27 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 103845
tool_uses: 0
duration_ms: 42928</usage>

---

### Roo Code

**Fork lineage:** Roo Code (formerly Roo Cline) is a heavily diverged fork of Cline. The webview UI is located at `webview-ui/` and contains a large React SPA. The codebase has been restructured into a pnpm/Turborepo monorepo (`packages/types`, `packages/core`, `packages/telemetry`, `apps/vscode-nightly`, etc.) -- a significant architectural departure from upstream Cline's single-package layout.

**Widget Inventory (Cline baseline + Roo Code additions)**

| Category | Cline Baseline | Roo Code Addition/Change |
|---|---|---|
| Chat timeline | `ChatView` with basic message list | `react-virtuoso` (`Virtuoso`) for virtualized rendering; `ChatRow` (1750 lines) with `useSize` height-change detection, `onHeightChange` callback for scroll maintenance, deep-equality memo via `fast-deep-equal` |
| Thinking blocks | Raw text toggle | **`ReasoningBlock`** -- collapsible panel with Lightbulb icon (lucide), live elapsed-seconds timer during streaming, collapse state synced to global `reasoningBlockCollapsed` setting, content rendered through `MarkdownBlock` with a left border accent (`border-l border-vscode-descriptionForeground/20`) |
| Mode system | None (single mode) | **5 built-in modes**: Architect, Code, Ask, Debug, Orchestrator -- defined as `DEFAULT_MODES` in `packages/types/src/mode.ts`. Each has `roleDefinition`, `whenToUse`, `description`, tool group permissions. `ModeSelector` popover with fuzzy search (fzf library), keyboard shortcut cycling (Cmd+. / Ctrl+.), marketplace link to install community modes |
| Profile/API config | Basic provider picker | **`ApiConfigSelector`** -- fuzzy-searchable popover of named provider profiles; pin/unpin configs; `lockApiConfigAcrossModes` toggle; per-profile organization allowlist validation (`ProfileValidator`). Full CRUD via `ApiConfigManager` with rename/delete/create dialogs |
| Subtask/orchestration | None | **`newTask`/`finishTask` tool blocks** in ChatRow; parent-child task linking (`currentTaskItem.childIds`); "Back to parent task" navigation in `TaskHeader`; `subtask_result` display with border-left indentation; aggregated cost tracking across subtask trees |
| Todo list | None | **`TodoListDisplay`** -- collapsible todo panel embedded in `TaskHeader`; status icons (completed/in-progress/pending); auto-scroll to current item; `TodoChangeDisplay` for diffing previous vs new todos; `UpdateTodoListToolBlock` for user edits; extracted via `getLatestTodo()` |
| Context management | None | **`CondensationResultRow`**, **`TruncationResultRow`**, **`InProgressRow`** -- visual indicators for context window condensation and sliding-window truncation; `ContextWindowProgress` with circular progress indicator and token/cost tooltips |
| Checkpoint system | None | **`CheckpointSaved`**, **`CheckpointMenu`**, **`CheckpointRestoreDialog`** -- git-commit-based checkpoint save/restore with dialog for delete-with-restore-checkpoint vs. delete-without |
| Markdown | react-markdown | Two renderers: `MarkdownBlock` (styled-components, `ReactMarkdown` + `remarkGfm` + `remarkMath` + `rehypeKatex`, Mermaid diagram support via `MermaidBlock`) and a wrapper `Markdown` component adding hover-to-copy |
| Code blocks | Basic syntax highlight | **Shiki-based `CodeBlock`** with window-shade collapse/expand at configurable height (500px default), word-wrap toggle, copy button, language auto-detection; `DiffView` with side-by-side line numbers and shiki highlighting |
| Message editing | None | Inline edit/delete on `user_feedback` messages; `ChatTextArea` rendered in-place for editing; confirmation dialogs with checkpoint-aware restore flow |
| Browser session | None | `BrowserActionRow`, `BrowserSessionRow`, `BrowserSessionStatusRow`; browser globe indicator in `TaskHeader` (green when active) |
| Marketplace | None | **`MarketplaceView`** -- tabbed (MCP servers / Modes) marketplace browser with state machine (`MarketplaceViewStateManager`) |
| Cloud/Account | None | **`CloudView`**, `CloudAccountSwitcher`, `OrganizationSwitcher`, `CloudUpsellDialog` |
| Worktrees | None | **`WorktreeSelector`**, `WorktreesView` with create/delete modals |
| i18n | None | Full i18next integration with 17 locales (ca, de, es, fr, hi, id, it, ja, ko, nl, pl, pt-BR, ru, tr, vi, zh-CN, zh-TW) |
| Misc UI | -- | `FollowUpSuggest` (auto-approvable follow-up suggestions), `QueuedMessages`, `ProgressIndicator`, `TooManyToolsWarning`, `SystemPromptWarning`, `ProfileViolationWarning`, `IndexingStatusBadge`, sound effects (`use-sound` with notification/celebration/progress_loop audio), prompt history (`usePromptHistory`) |

**Tech Stack**

The webview is a React 18 SPA built with Vite 6, bundled into the extension's `src/webview-ui/` output. Key architectural choices:

- **Styling**: Hybrid approach -- Tailwind CSS v4 (via `@tailwindcss/vite`) with `tailwind-merge` and `clsx`/`cn()` utility, PLUS `styled-components` v6 for the `MarkdownBlock` and `CodeBlock` legacy styling. Cline used only styled-components; Roo is migrating toward Tailwind.
- **Component library**: Radix UI primitives (dialog, popover, select, dropdown-menu, checkbox, slider, tooltip, collapsible, progress, radio-group, alert-dialog, separator, portal) with `class-variance-authority` for variant composition -- essentially a shadcn/ui pattern. The `components/ui/` directory has 27 atomic components. Cline relied purely on `@vscode/webview-ui-toolkit`; Roo still imports some VSCode toolkit components (`VSCodeBadge`, `VSCodeButton`, `VSCodeLink`, `VSCodeTextField`) but is transitioning to Radix.
- **Virtualization**: `react-virtuoso` v4.7 for the chat message list (Cline used simple div overflow).
- **Syntax highlighting**: Shiki v3 (replacing Cline's highlight.js/rehype-highlight approach).
- **Markdown**: `react-markdown` v9 + `remark-gfm` + `remark-math` + `rehype-katex` + custom Mermaid renderer.
- **State management**: React Context (`ExtensionStateContext`) with VSCode message passing; `@tanstack/react-query` v5 for async data; no Redux/Zustand.
- **Build**: React Compiler (`babel-plugin-react-compiler` + `react-compiler-runtime`) for automatic memoization. Turborepo for monorepo orchestration.

**Key Dependencies (new vs Cline)**

| Package | Purpose | In Cline? |
|---|---|---|
| `react-virtuoso` | Virtualized chat list | No |
| `shiki` | Syntax highlighting | No (used highlight.js) |
| `mermaid` | Diagram rendering | No |
| `tailwindcss` + `@tailwindcss/vite` | Utility CSS | No |
| `@radix-ui/*` (12 packages) | Headless UI primitives | No |
| `class-variance-authority` + `tailwind-merge` | Variant styling (shadcn pattern) | No |
| `fzf` | Fuzzy search in selectors | No |
| `i18next` + `react-i18next` | Internationalization | No |
| `posthog-js` | Telemetry | No |
| `katex` + `rehype-katex` + `remark-math` | LaTeX math rendering | No |
| `date-fns` | Date formatting | No |
| `use-sound` | Audio feedback | No |
| `lru-cache` | Visible messages caching | No |
| `react-compiler-runtime` | React Compiler | No |
| `zod` | Schema validation (modes, types) | No |
| `cmdk` | Command palette pattern | No |
| `axios` | HTTP client (cloud API) | No |
| `vscode-material-icons` | File icons | No |

**Implementation Details**

*Prettier thinking blocks*: The `ReasoningBlock` component (`webview-ui/src/components/chat/ReasoningBlock.tsx`, 77 lines) renders `say: "reasoning"` messages. It shows a Lightbulb icon, bold "Thinking" label, and a live elapsed-seconds counter during streaming (via `setInterval` ticking against `Date.now() - startTimeRef`). Content is rendered through `MarkdownBlock` with a left-border accent. The block is collapsible (ChevronUp icon with rotation animation via `cn()` and Tailwind `transition-all`), and collapse state defaults to the global `reasoningBlockCollapsed` preference from `ExtensionStateContext`.

*Scroll position during streaming*: The `ChatView` uses `react-virtuoso`'s `followOutput` callback that returns `true` when `isAtBottom || stickyFollowRef.current`. A `stickyFollowRef` boolean is set to `true` when the user clicks the scroll-to-bottom button and cleared on upward wheel events or when scroll position moves away from bottom (detected via a passive scroll listener checking `el.scrollHeight - el.scrollTop - el.clientHeight < 10`). `handleRowHeightChange` is called when the last `ChatRow` changes height (detected by `useSize` hook comparing `prevHeightRef`): if the user is at bottom and content grew, it smooth-scrolls; if content shrank, it instant-scrolls. Debounced `scrollToBottomSmooth` (10ms) prevents jitter. This is substantially more sophisticated than Cline's basic `scrollIntoView`.

*Multi-agent mode rendering*: The `ModeSelector` (`webview-ui/src/components/chat/ModeSelector.tsx`) is a Radix `Popover` showing all modes from `getAllModes(customModes)`. Each mode shows name, description, and a check icon for the active selection. Modes with >6 items show a fuzzy search bar (fzf). Bottom bar has marketplace and settings links. Mode switching in the chat timeline renders as `switchMode` tool blocks with `PocketKnife` icon and i18n-translated labels. The `ChatTextArea` embeds both `ModeSelector` and `ApiConfigSelector` in a toolbar row below the text input.

*TaskHeader enhancements*: The `TaskHeader` (`webview-ui/src/components/chat/TaskHeader.tsx`, 527 lines) is a collapsible card showing: circular context-window progress, cost with subtask aggregation, token I/O stats, cache reads/writes, task size (via `pretty-bytes`), browser session globe, condense-context button, todo list display, and a "Back to parent task" button for subtasks. The collapsed view shows a single-line task summary with `Mention` component, context percentage, and cost.

*Profile system*: `ApiConfigManager` provides full CRUD for named API provider profiles with organization allowlist validation. `ApiConfigSelector` in the chat area allows quick profile switching with fuzzy search and pin support. Profiles can be locked across modes (`lockApiConfigAcrossModes`).

**Maturity Assessment**

Roo Code has diverged substantially from Cline -- this is no longer a thin patch fork. Key maturity indicators:

- **Positive**: Full i18n (17 locales), comprehensive test files alongside most components (`__tests__/` directories), Zod schema validation for mode configs, React Compiler integration, Turborepo monorepo structure, PostHog telemetry, error boundary wrapping, source map initialization for production debugging, TypeScript strict mode, ESLint + Prettier + lint-staged, pnpm workspace with dependency overrides.
- **Transitional**: Mixed styling (styled-components and Tailwind coexisting), mixed component libraries (Radix UI and VSCode toolkit used side-by-side), some Cline naming remnants (`ClineMessage`, `ClineAsk`, `ClineSayTool` types still used throughout).
- **Complexity concerns**: `ChatRow.tsx` is 1750 lines with a monolithic switch statement; `ChatView.tsx` is 1796 lines; `ChatTextArea.tsx` is 1368 lines. These are large single-component files that could benefit from further decomposition.

Overall: a production-grade fork with significant original features (multi-mode system, orchestrator subtasks, marketplace, cloud integration, worktrees), actively maintained with a modern stack, but carrying some technical debt from the ongoing migration away from Cline's original patterns.agentId: a768412 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 69073
tool_uses: 0
duration_ms: 63905</usage>

---

### Amp (Sourcegraph)

**Overview.** Amp is Sourcegraph's agentic coding tool, the successor to the open-source Cody project. It shipped in mid-2025 and is now spinning out of Sourcegraph as an independent company. It is distributed as both a CLI (`@sourcegraph/amp` on npm) and a VSCode extension (`sourcegraph.amp`), with additional support for Cursor, Windsurf, JetBrains, and Neovim. The Cody codebase was open source under Apache 2.0 until the transition; a public snapshot remains at `sourcegraph/cody-public-snapshot` on GitHub, but the Amp CLI and extension source are closed. A community reverse-engineering repository (`ben-vargas/ai-amp-cli`) contains detailed extractions from the minified `main.js` bundle, including complete system prompts, tool definitions, and model configurations for all agent modes and sub-agents.

---

**Widget Inventory**

| Surface | Key Widgets / Display Elements |
|---|---|
| **CLI (TUI)** | Custom double-buffered terminal UI ported from Tim Culverhouse's Zig `libvaxis` library into TypeScript. Uses a Flutter-inspired widget architecture (Widgets, StatefulWidgets, Intents, Bindings). Maintains front and back buffers that are diffed, updated, and swapped for efficient screen rendering. Renders diffs with ANSI-colorized green `+` / red `-` markers. Supports command palette (`Ctrl+O`) for mode switching. Shell commands run inline by prefixing with `$`. Approximately 90% of the TUI framework code was written by Amp itself. |
| **VSCode Chat Panel** | Right-hand side panel with a cell-based transcript. Five distinct cell types for tool output: `DiffCell` (inline unified diff with line numbers, green/red/orange badges for added/modified/removed counts), `TerminalOutputCell` (command output), `FileCell` (file contents), `SearchResultsCell` (grep/search results), `OutputStatusCell` (generic status). All cells use a collapsible `BaseCell` wrapper with Lucide icons, dark zinc-900 backgrounds, and Tailwind CSS styling via shadcn/ui primitives (`Collapsible`, `ScrollArea`, `Badge`, `Button`). Loading states display pulsing skeleton placeholders. |
| **Review Panel** | Separate panel toggled via `Cmd+;` or a navbar button. Displays a draggable diff-range selector (individual commits or full branch diff), file ordering recommendations, per-file summaries, and a review agent output section below an editable diff view. Review comments feed back into the main agent thread to close the feedback loop. |
| **Sub-agent Display** | Sub-agents (Oracle, Librarian, Finder, Task) run as named tool invocations inside the chat. Each shows a tool-status skeleton while loading, then collapses into a result cell. `AgenticContextCell` and `ApprovalCell` components handle permission prompts for agentic operations. Mermaid diagrams render inline with clickable nodes linked to source files. |
| **Deep Mode** | Visually similar to standard mode but the agent "disappears" for extended periods of autonomous research and planning before writing any code. Uses a minimal tool set and a patch-based edit tool (`apply_patch` in Codex format) instead of the standard `edit_file`. No interactivity during execution -- trades latency for reduced babysitting. |

---

**Tech Stack**

| Component | Technology |
|---|---|
| CLI runtime | TypeScript, distributed via npm (`@sourcegraph/amp`), fast-launched via Bun. Single ~8.6MB minified `main.js` bundle. Install script supports macOS, Linux, WSL with auto-updating. |
| CLI TUI framework | Custom double-buffered renderer ported from Zig (`libvaxis`) to TypeScript. Flutter-inspired OOP widget architecture with unfamiliar TypeScript generic patterns and agent-ergonomic naming conventions (e.g., function names chosen to align with LLM token prediction patterns for faster agent iteration). |
| VSCode extension | TypeScript + React webviews. Tailwind CSS via shadcn/ui component library. Lucide icons. Vite bundler. PostCSS. Storybook for component development. |
| Agent protocol | JSON-RPC between extension host and webview (inherited from Cody architecture). MCP (Model Context Protocol) for external tool servers. |
| Models (current) | **Smart mode:** Claude Opus 4.6 (1M context). **Rush mode:** Claude Haiku 4.5. **Deep mode:** GPT-5.2 Codex (400K context, 128K output). **Oracle sub-agent:** GPT-5.2 (configurable reasoning effort, default medium). **Librarian:** Claude Haiku 4.5. **Code review:** Claude Sonnet 4.5. **Free mode:** Gemini 3 Pro Preview. **Walkthrough Planner:** Sonnet 4.5. Additional supported providers: xAI, Kimi K2 via Fireworks. |

---

**Implementation Details: Multi-Agent Architecture**

Amp has the most elaborate sub-agent decomposition of any shipping coding tool. Six specialized sub-agents are defined in a `D5` registry, each with constrained tool sets, specific model assignments, and no MCP or toolbox access (except Task):

1. **Finder** -- Lightweight search agent (Haiku 4.5). Tools: `Grep`, `glob`, `Read` only. Invoked automatically for semantic codebase searches. Designed to be fast and cheap.

2. **Oracle** -- "Senior engineering advisor" powered by GPT-5.2 with configurable reasoning effort via `internal.oracleReasoningEffort` setting (default: `"medium"`). Read-only tools: `Read`, `Grep`, `glob`, `web_search`, `read_web_page`, `read_thread`, `find_thread`. Uses the OpenAI Responses API with `reasoning.encrypted_content`, `reasoning.summary: "detailed"`, and `prompt_cache_key`. Runs through a generic scaffold runner class (`K7`) that manages tool execution loops with retry logic (max 3 repeated tool errors) and `UserRejectedError` handling. The system prompt enforces a simplicity-first philosophy with effort/scope signals (S/M/L/XL) and YAGNI principles. Only the Oracle's last message is returned to the main agent.

3. **Librarian** -- Multi-repository codebase understanding agent (Haiku 4.5). GitHub tools: `read_github`, `search_github`, `commit_search`, `diff`, `list_directory_github`, `list_repositories`, `glob_github`. Equivalent Bitbucket Enterprise tool set available. Provider selection is dynamic: the `_18()` function checks `bitbucket.enterprise.connections` in settings. The system prompt is composed by `g18()` concatenating a base prompt with a provider-specific suffix containing linking URL templates. Outputs use "fluent" Markdown linking style (inline hyperlinks to GitHub/Bitbucket file URLs with line ranges).

4. **Task** -- General-purpose sub-agent inheriting the parent model. Full tool access including file editing, bash, MCP, and toolbox. Used for parallelizable multi-step work. The main agent can spawn mini-me sub-agents for background work, though this is being phased out in favor of the `/handoff` command.

5. **Code Review** -- Uses Claude Sonnet 4.5 with `Read`, `Grep`, `glob`, `web_search`, `read_web_page`, `Bash`. A secondary "Codereview Check" sub-agent (Haiku 4.5) handles specific check evaluations. The review panel pre-scans diffs and recommends file review ordering, a significant improvement over the earlier single-shot LLM review approach.

6. **Walkthrough Planner** -- Uses Sonnet 4.5 with `Read`, `Grep`, `glob`, `finder`. Generates interactive Mermaid diagrams with clickable nodes that expose deep-dive content, code snippets, and thread links.

**Prompt Selection Logic.** The main agent has nine distinct system prompt variants, selected by a cascading conditional: free mode, rush mode, deep mode, GPT-5 Codex, Kimi K2, OpenAI GPT, xAI, Vertex AI (Gemini), or default (Anthropic/Claude). Each variant is tuned to the model's strengths and API conventions.

**Recommended Workflow.** The main agent system prompt encodes a specific orchestration pattern: `Oracle (plan) -> Codebase Search (validate scope) -> Task Tool (execute)`.

**How Diffs Are Displayed.** In VSCode, the `DiffCell` component (at `/tmp/cody-snapshot/vscode/webviews/chat/cells/toolCell/DiffCell.tsx` in the Cody snapshot) renders unified diffs in a monospace `<table>`. Added lines receive `tw-bg-emerald-950/30` backgrounds with green `+` markers; removed lines receive `tw-bg-rose-950/30` backgrounds with red `-` markers. Line numbers appear in a left gutter column with zinc-700 borders. Summary badges in the header show counts of added (emerald-500), modified (orange-500), and removed (rose-500) hunks using Lucide `Plus`, `DiffIcon`, and `Minus` icons.

**How Tool Use Is Displayed.** The `ToolStatusCell` component routes tool output to specialized renderers based on `outputType`: `file-view` -> `FileCell`, `search-result` -> `SearchResultsCell`, `file-diff` -> `DiffCell`, `terminal-output` -> `TerminalOutputCell`, everything else -> `OutputStatusCell`. All cells are collapsible via the `BaseCell` wrapper. Loading states show animated `Skeleton` components.

**Thread and Handoff System.** The `/handoff` command and `handoff` tool create new threads with relevant context extracted via `create_handoff_context`. Thread state syncs to `ampcode.com/threads` for cross-device access. Threads can be resumed via `read_thread` and `find_thread` tools, which are available to both the Oracle and the main agent.

---

**Open-Source Status**

The `sourcegraph/cody-public-snapshot` repository on GitHub preserves the last Apache 2.0 licensed commit of the Cody codebase. This includes the complete VSCode extension source: React webviews, all chat cell components (`DiffCell`, `TerminalOutputCell`, `FileCell`, `SearchResultsCell`, `OutputStatusCell`, `AgenticContextCell`, `ApprovalCell`), the shadcn/ui component library integration, Storybook stories, and the agent JSON-RPC protocol. The Cody CLI was documented but minimal (a README pointing to docs). The Amp CLI itself is closed source, distributed only as a minified npm bundle. The community `ben-vargas/ai-amp-cli` repository contains extracted system prompts, agent tool schemas, model pricing configurations, and architectural documentation reverse-engineered from the minified bundle, providing the most detailed public view into Amp's internals.

---

**Maturity Assessment**

Amp is the most architecturally ambitious multi-agent coding tool currently shipping. Its six specialized sub-agents with distinct model assignments (spanning four providers), the custom Zig-ported TUI framework, the Oracle/Librarian/Finder/Task decomposition pattern, the thread handoff system, and the code review agent represent production-grade infrastructure with no close equivalent in competing tools. The CLI TUI framework -- built mostly by the agent itself -- demonstrates a novel "agent-ergonomic" design philosophy where naming and file structure are optimized for LLM token prediction patterns rather than human conventions. The product iterates extremely rapidly (multiple npm releases per week, evidenced by monotonically increasing version timestamps), supports an unusually wide model portfolio (Anthropic, OpenAI, Google, xAI, Fireworks/Kimi), and has a well-defined mode taxonomy (standard, rush, deep, free) that maps cleanly to different speed/cost/autonomy tradeoffs. Key areas still evolving include the review-to-memory feedback loop, the transition from mini-me sub-agents to explicit handoffs, and the experimental features visible in the bundle (REPL tool, `save_memory`, `restore_snapshot`). **Maturity: High** -- this is a well-resourced, deeply engineered product with the most sophisticated multi-agent orchestration of any shipping coding assistant.agentId: ae4a873 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 46066
tool_uses: 0
duration_ms: 52248</usage>

---

### Devon
**(Entropy Research) -- Electron Desktop App for an AI Coding Agent**

**Tech Stack.** Devon's UI is **not** a web app or a Next.js site; it is a **desktop Electron application** (v31) built with **React 18** and bundled by **Vite** via `@electron-forge/plugin-vite`. Styling is done entirely with **Tailwind CSS v3.4** augmented by `tailwindcss-animate`, `tailwind-merge`, and `class-variance-authority` (the standard shadcn/ui pattern). The primitive UI layer is **Radix UI** (accordion, checkbox, dialog, dropdown-menu, popover, scroll-area, switch, tabs, toast, tooltip, visually-hidden), and icons come from both `lucide-react` and `@iconify/react`. State management uses two systems in tandem: **XState v5** (via `@xstate/react`'s `createActorContext`) for the session lifecycle state machine, and **Jotai** for cross-component atomic state (checkpoint tracking, code snippet selections). The Electron main process spawns the Devon Python backend as a child process, finds a free port via `portfinder`, and communicates errors/logs through IPC (`window.api.send` / `window.api.receive` / `window.api.invoke`).

**Widget Inventory.** The layout (`landing.tsx`) is a horizontal `ResizablePanelGroup` (from `react-resizable-panels`) with three zones:

| Widget | Component Path | Implementation |
|---|---|---|
| **Sidebar / Timeline** | `panels/timeline/timeline-panel.tsx`, `components/sidebar/sidebar.tsx` | Collapsible left rail. Contains the git commit timeline -- each checkpoint is rendered as a `Step` component with revert-to-checkpoint support. Shows source branch vs. `devon_agent` branch. Merge-branch modal for syncing back. |
| **Chat Panel** | `panels/chat/chat-panel.tsx` | Center column. Message list rendered by `ChatMessages` with memoized per-message components. Input via `HighlightKeywordInputField` supporting `@snippet` references. Status bar shows pause/play controls and status text ("Devon is working...", "Devon is waiting for your response", etc.). |
| **Code Editor** | `panels/editor/editor-panel.tsx` | Right column. Top: `FileTree` (custom recursive tree built from flat file list, rendered with a `TreeView` component). Middle: **Monaco Editor** (`@monaco-editor/react` v4.6) in read-only mode with file tabs. Supports inline diff view via Monaco's `DiffEditor` with custom green/red theme colors. Bottom: embedded shell panel. |
| **Shell / Terminal** | `panels/shell/shell-panel.tsx` | Embedded at bottom of editor panel. Uses **xterm.js** (`@xterm/xterm` v5.5) with `FitAddon`. Read-only replay of shell commands/responses extracted from the message stream. |
| **Browser Panel** | `panels/browser/browser-panel.tsx` | Stub -- displays "Coming soon!" with a fake browser chrome (red/yellow/green dots). Sourced from OpenDevin. |
| **Planner Panel** | `panels/planner/planner-panel.tsx` | Minimal -- a heading and a `PlannerTextarea`. Not wired into the main layout. |

**How Agent Actions Stream to the UI.** The central orchestration is an XState state machine (`newSessionMachine` in `stateMachine.ts`) with states: `setup` (healthcheck -> checkSession -> creating) -> `sessionReady` -> `initializing` -> `starting` -> `running` -> `paused` / `reverting` / `resetting` / `deleting`. Three actors run concurrently on the machine:

1. **`eventSourceActor`** -- opens a browser-native `EventSource` (SSE) connection to `GET /sessions/{name}/events/stream` on the Python backend. Each SSE message is parsed and forwarded as a `serverEvent` to the machine.
2. **`eventHandlingLogic`** -- an XState `fromTransition` reducer that processes approximately 20 event types (`ModelRequest`, `ModelResponse`, `ToolRequest`, `ToolResponse`, `ShellRequest`, `ShellResponse`, `Task`, `Interrupt`, `UserRequest`, `UserResponse`, `Checkpoint`, `GitEvent`, `GitError`, `RateLimit`, `Error`, etc.) and maintains a `ServerEventContext` containing the message array, loading flags, git data, and status string (`idle` / `thinking` / `executing` / `waiting_for_user`).
3. **`fetchSessionCallbackActor`** -- polls `GET /sessions/{name}/config` every 1 second to pull session state (open files, checkpoints, versioning metadata).

Components subscribe to machine state via `SessionMachineContext.useSelector()`. Chat messages are typed discriminated unions (`Message.type`: `user`, `agent`, `thought`, `tool`, `command`, `error`, `shellCommand`, `shellResponse`, `rateLimit`, `checkpoint`) and rendered to different visual components: `UserMessage`, `BotMessage`, `ThoughtMessage` (with a thinking-bubble icon), `ToolResponseMessage`, `ErrorMessage`, `RateLimitWarning`, and `SpinnerMessage` (animated dots).

**How Code Edits Are Shown.** When the agent runs an `edit` command, `ToolResponseMessage` detects `"Running command: edit"` in the tool message content, parses the search/replace content with `parseFileDiff()`, computes a unified diff using the `unidiff` npm package (`unidiff.diffLines` / `unidiff.formatLines`), then parses it via `react-diff-view`'s `parseDiff()` and renders it with `<Diff viewType="unified">` / `<Hunk>` components. For the editor panel itself, Monaco's built-in `DiffEditor` is used when viewing checkpoint diffs, fetched from `GET /sessions/{name}/checkpoints/{src}/{dest}/diff` and displayed inline with custom theme colors (`diffEditor.insertedLineBackground: #2d592b`, `diffEditor.removedLineBackground: #FF000030`).

**Key Dependencies (non-obvious):**

| Package | Purpose |
|---|---|
| `xstate` v5 + `@xstate/react` v4 | Session lifecycle state machine, SSE event reducer |
| `jotai` v2 | Atomic cross-component state (checkpoints, code snippets) |
| `@monaco-editor/react` + `monaco-editor` | Read-only code editor, inline diff viewer |
| `@xterm/xterm` + `@xterm/addon-fit` | Terminal emulation for shell output |
| `react-diff-view` + `unidiff` | Unified diff rendering in chat messages |
| `react-markdown` + `remark-gfm` + `remark-math` | Markdown rendering in agent/thought messages |
| `react-syntax-highlighter` | Code block syntax highlighting in chat |
| `react-resizable-panels` | Resizable split pane layout |
| `axios` | All HTTP calls to the Python backend |
| `@parcel/watcher` | Native file system watching for the file tree |
| `electron-settings` + `electron-log` + `electron-updater` | Persistence, logging, auto-update |

**Maturity Assessment.** Devon's UI is an alpha-quality desktop application (self-labeled `v0.0.24`, product name "Devon(Alpha)"). The component architecture is reasonable -- panel-based layout, typed message variants, XState for complex session lifecycle -- but there are clear signs of rapid, early-stage development:

- **Commented-out code and TODOs** are pervasive (e.g., commented-out scrolling delay logic in `chat-panel.tsx`, `console.log` debugging statements left in, workaround comments in `code-editor.tsx`).
- **Incomplete features**: the browser panel is a stub ("Coming soon!"), the planner panel is a bare textarea, the sessions sidebar item is marked `comingSoon: true`, and the settings sidebar is also `comingSoon: true`.
- **Hardcoded values and workarounds**: the terminal simulates a scroll to force syntax highlighting (`setScrollTop(1); setScrollTop(0)` with a `setTimeout`), diff detection relies on string-splitting on `|START_RESPONSE|` delimiters, and the `ShellPanel` clears and re-renders the entire terminal on every message change.
- **No routing** -- the entire app is a single page with modal-driven navigation (onboarding modal, project directory modal, git modals).
- **No tests** in the frontend directory.
- **TypeScript looseness**: several `any` types (e.g., `DiffViewerProps.files: any[]`, `sessionConfig: any`, `agentConfig: any`), and the Electron IPC bridge is untyped.

Overall, Devon's UI is functional but rough. It has the right structural bones -- a proper state machine for session management, SSE streaming, Monaco for code display, xterm for terminal -- but it reads as a prototype built by a small team (approximately 3 contributors listed in `package.json`) that prioritized getting the agent workflow visible over polish. The approximately 6k GitHub stars likely reflect interest in the agent backend rather than frontend maturity.agentId: a49b9b2 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 59878
tool_uses: 0
duration_ms: 23692</usage>

---

## Part 2: Constituent UI Widgets & Elements (Cross-Cutting Summary)

### Output Elements

| Element | Description | Used By |
|---------|-------------|---------|
| **Chat messages** | User and agent messages with markdown rendering, code blocks, syntax highlighting | All tools |
| **Thinking/reasoning blocks** | Collapsible sections showing agent's reasoning process; often collapsed by default | Claude Code, Cursor, Windsurf, Roo Code, Cline |
| **Tool use display** | Shows tool name, inputs, outputs; typically collapsible | Claude Code, Copilot, Cline, Roo Code, OpenHands |
| **Code diff view** | Unified or side-by-side diff for proposed changes; accept/reject controls | Claude Code, Cursor, Codex, Windsurf, Copilot, Cline |
| **Activity timeline/line** | Visual indicator showing sequence of events (messages, tool calls, thinking) with color-coded markers | Claude Code (status dots), Roo Code (timeline), Claudia (visual timeline) |
| **File tree/explorer** | Filesystem navigation panel | bolt.diy, OpenHands, CloudCLI, Codex app |
| **Terminal output** | Embedded terminal for command execution display | bolt.diy, OpenHands, CloudCLI, Goose |
| **Live preview** | Browser preview of running application | bolt.diy, Cursor (Design Mode), Windsurf |
| **Progress indicators** | Spinners, loading states for long-running operations | All tools |
| **Checkpoint markers** | Points in conversation you can rollback to, with diff view | Cline, Roo Code, Claudia |
| **Context window indicator** | Shows how much of the context window is used | Claude Code (CLI + VSCode) |
| **PR/git status indicators** | Colored dots or badges for PR state | Claude Code VSCode |

### Input Elements

| Element | Description | Used By |
|---------|-------------|---------|
| **Chat text input** | Primary text input for prompting the agent | All tools |
| **@-mentions** with fuzzy auto-complete | Reference files/folders with type-ahead search | Claude Code, Copilot (`#file`), Cursor, Windsurf |
| **/ command completion** | Slash commands with fuzzy auto-complete for actions/settings | Claude Code, Cursor, Copilot |
| **Tool use confirmations** | Approve/deny buttons for agent tool invocations; sometimes with granular "allow" options (once, session, always) | Claude Code, Copilot, Cline, Roo Code, Windsurf |
| **Multi-select choice dialogs** | Agent asks user to choose from multiple options | Newer pattern in Claude Code, Copilot |
| **Diff accept/reject** | Buttons to accept or reject proposed code changes | Cursor, Codex, Copilot, Windsurf, Cline |
| **Image/screenshot input** | Drag-and-drop images for visual context | Claude Code, Windsurf, OpenCode |
| **File drag-and-drop** | Drag files from explorer into chat for context | Windsurf, Copilot |
| **Voice input** | Speech-to-text for prompting | Windsurf (Cascade) |
| **Model selector** | Dropdown to choose AI model | Cursor, OpenCode, Cline, Roo Code |

---

## Part 3: Open-Source UI Component Libraries (Technical Deep-Dives)

### Vercel AI SDK + AI Elements

**Architecture overview.** The Vercel AI ecosystem is split across two repositories. The core **AI SDK** lives in `github.com/vercel/ai` (monorepo, 50+ packages). The **AI Elements** component library lives in `github.com/vercel/ai-elements` (separate repo). The SDK provides the headless hooks and streaming protocol; Elements provides the UI layer.

---

#### Widget Inventory (AI Elements)

The `packages/elements/src/` directory contains **47 component files**. Every component is a `"use client"` React component built on the shadcn/ui compound-component pattern (Radix primitives + Tailwind CSS). Complete inventory:

| Component File | Key Exports | Purpose |
|---|---|---|
| `conversation.tsx` | `Conversation`, `ConversationContent`, `ConversationEmptyState`, `ConversationScrollButton`, `ConversationDownload` | Auto-scroll chat container (wraps `use-stick-to-bottom`), empty state, download-to-markdown |
| `message.tsx` | `Message`, `MessageContent`, `MessageResponse`, `MessageActions`, `MessageAction`, `MessageToolbar`, `MessageBranch*` (Branch, BranchContent, BranchSelector, BranchPrevious, BranchNext, BranchPage) | Message bubble with role-based styling, streaming markdown via `Streamdown`, full branch/regenerate navigation |
| `prompt-input.tsx` | `PromptInput`, `PromptInputProvider`, `PromptInputTextarea`, `PromptInputSubmit`, `PromptInputFooter`, `PromptInputHeader`, `PromptInputButton`, `PromptInputActionMenu*`, `PromptInputSelect*`, `PromptInputCommand*`, `PromptInputHoverCard*` | Full prompt composer: auto-resizing textarea, file/paste/drop attachments, submit/stop button with status awareness, command palette integration, model selector |
| `tool.tsx` | `Tool`, `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput` | Collapsible tool invocation display with state badges (Running/Completed/Error/Awaiting Approval/Denied), JSON parameter and result rendering via `CodeBlock` |
| `reasoning.tsx` | `Reasoning`, `ReasoningTrigger`, `ReasoningContent` | Collapsible thinking/reasoning display with auto-open on stream start, auto-close after 1s delay, duration timer ("Thought for N seconds"), shimmer animation |
| `chain-of-thought.tsx` | `ChainOfThought`, `ChainOfThoughtHeader`, `ChainOfThoughtStep`, `ChainOfThoughtContent`, `ChainOfThoughtSearchResults`, `ChainOfThoughtImage` | Multi-step reasoning visualization with timeline connectors, per-step status icons, search result badges |
| `code-block.tsx` | `CodeBlock`, `CodeBlockContainer`, `CodeBlockHeader`, `CodeBlockContent`, `CodeBlockCopyButton`, `CodeBlockLanguageSelector*` | Syntax-highlighted code with shiki (async singleton highlighter per language, github-light/dark themes, token cache), copy-to-clipboard, language selector |
| `attachments.tsx` | `Attachments`, `Attachment`, `AttachmentPreview`, `AttachmentInfo`, `AttachmentRemove`, `AttachmentHoverCard*` | File attachment display in grid/inline/list variants with media type detection and hover preview |
| `confirmation.tsx` | `Confirmation`, `ConfirmationTitle`, `ConfirmationRequest`, `ConfirmationAccepted`, `ConfirmationRejected`, `ConfirmationActions`, `ConfirmationAction` | Tool approval UI gated on `approval-requested`/`approval-responded` state |
| `sources.tsx` | `Sources`, `SourcesTrigger`, `SourcesContent`, `Source` | Collapsible citation list ("Used N sources") |
| `suggestion.tsx` | `Suggestions`, `Suggestion` | Horizontally scrollable prompt suggestions as pill buttons |
| `agent.tsx` | `Agent`, `AgentHeader`, `AgentTools`, `AgentTool` | Agent identity card showing name, model badge, and tool definitions |
| `sandbox.tsx` | `Sandbox`, `SandboxHeader`, etc. | Code execution sandbox display with tabs for code/output |
| `terminal.tsx` | `Terminal`, `TerminalHeader`, `TerminalOutput`, `TerminalCopyButton` | ANSI terminal output renderer (uses `ansi-to-react`), auto-scroll, streaming-aware |
| `image.tsx` | `Image` | Renders `Experimental_GeneratedImage` from base64/mediaType |
| `persona.tsx` | `Persona` | Rive-animated avatar with states: idle, listening, thinking, speaking, asleep |
| `context.tsx` | `Context`, `ContextHeader`, `ContextUsage` | Token context window visualization with progress bar (uses `tokenlens`) |
| `shimmer.tsx` | `Shimmer` | Animated text shimmer effect (uses `motion/react`) |
| `speech-input.tsx` | `SpeechInput` | Browser Speech Recognition API integration |
| `model-selector.tsx` | `ModelSelector*` | Model picker dropdown |
| `canvas.tsx` | `Canvas` | ReactFlow-based visual canvas |
| Others | `inline-citation`, `jsx-preview`, `web-preview`, `file-tree`, `plan`, `task`, `controls`, `toolbar`, `panel`, `snippet`, `schema-display`, `audio-player`, `mic-selector`, `voice-selector`, `transcription`, `stack-trace`, `test-results`, `checkpoint`, `commit`, `connection`, `edge`, `node`, `environment-variables`, `open-in-chat`, `package-info`, `queue` | Specialized components for IDE-like, agentic, and voice interfaces |

---

#### Tech Stack

- **React 19.2** with `"use client"` directives throughout
- **shadcn/ui pattern**: 55 Radix-based primitives are vendored into the repo at `packages/shadcn-ui/components/ui/`. Components are installed into your codebase via the `ai-elements` CLI (published as `ai-elements` on npm), following the same copy-source-code model as shadcn/ui
- **Tailwind CSS v4** with `cn()` (clsx + tailwind-merge) for class composition
- **Streamdown** (`streamdown` + `@streamdown/code`, `@streamdown/math`, `@streamdown/cjk`, `@streamdown/mermaid`): The streaming markdown renderer used by `MessageResponse` and `ReasoningContent` -- handles incremental token-by-token rendering with plugins for code, LaTeX, CJK, and Mermaid diagrams

---

#### Key Dependencies

| Package | Version | Used For |
|---|---|---|
| `ai` | `^6.0.68` | Core SDK types (`UIMessage`, `UIMessagePart`, `ChatStatus`, `ToolUIPart`, etc.) |
| `shiki` | `3.22.0` | Syntax highlighting in `CodeBlock` (async, cached, github-light/dark dual themes) |
| `streamdown` + plugins | `^2.1.0` | Streaming markdown rendering |
| `motion` | `^12.26.2` | Animation (Shimmer component) |
| `@xyflow/react` | `^12.10.0` | Visual canvas/flowchart |
| `@rive-app/react-webgl2` | `^4.26.1` | Animated persona avatars |
| `katex` | `^0.16.28` | LaTeX math rendering |
| `lucide-react` | `^0.562.0` | Icons throughout |
| `nanoid` | `^5.1.6` | Unique IDs for attachments |
| `use-stick-to-bottom` | `^1.1.1` | Auto-scroll in Conversation |
| `ansi-to-react` | `^6.2.6` | Terminal ANSI rendering |
| `tokenlens` | `^1.3.1` | Token counting for context window |
| `@radix-ui/react-use-controllable-state` | `^1.2.2` | Controlled/uncontrolled state pattern |
| `class-variance-authority` | `^0.7.1` | Variant-based styling |
| `swr` | `^2.2.5` | State management in `useCompletion` and `useObject` |
| `zod` | `^3.25 / ^4.1` | Schema validation (peer dep of `ai`) |

---

#### Implementation Details

**How `useChat` manages streaming state.** The hook (source: `/tmp/vercel-ai/packages/react/src/use-chat.ts`) wraps an `AbstractChat` class instance stored in a `useRef`. It uses React 18's `useSyncExternalStore` to subscribe to three separate stores: `messages`, `status`, and `error`. The `AbstractChat` class (source: `/tmp/vercel-ai/packages/ai/src/ui/chat.ts`) uses a `SerialJobExecutor` to serialize all message mutations, preventing race conditions. Status flows through four states: `submitted` -> `streaming` -> `ready` (or `error`). The transition from `submitted` to `streaming` happens on the first `write()` call from `processUIMessageStream`. An optional `experimental_throttle` parameter gates UI updates to reduce re-renders during fast streaming. Callback refs are used to avoid stale closures -- all callbacks (`onToolCall`, `onData`, `onFinish`, `onError`, `sendAutomaticallyWhen`) are stored in a `callbacksRef` that is updated every render.

**How `message.parts` work.** Every `UIMessage` (source: `/tmp/vercel-ai/packages/ai/src/ui/ui-messages.ts`) has a `parts: UIMessagePart[]` array. The discriminated union includes: `text` (with `state: 'streaming' | 'done'`), `reasoning` (same streaming state), `tool-{name}` (static, typed tools) or `dynamic-tool` (runtime-discovered tools), `source-url`, `source-document`, `file`, `data-{name}` (custom typed data), and `step-start` (step boundaries). Tool parts have a 7-state lifecycle: `input-streaming` -> `input-available` -> optionally `approval-requested` -> `approval-responded` -> `output-available` / `output-error` / `output-denied`. Each tool part carries `toolCallId`, `input` (partial during streaming), `output`, `errorText`, and `approval` metadata.

**How the Tool component renders.** `Tool` (source: `/tmp/ai-elements/packages/elements/src/tool.tsx`) wraps a Radix `Collapsible`. `ToolHeader` derives the tool name from the part type string (splitting `tool-{name}`), displays a status badge with color-coded icons (green `CheckCircleIcon` for completed, animated pulse `ClockIcon` for running, red `XCircleIcon` for error, yellow `ClockIcon` for awaiting approval), and a chevron toggle. `ToolContent` animates open/close. `ToolInput` renders JSON-formatted parameters via `CodeBlock`. `ToolOutput` handles three render paths: if output is a valid React element it renders directly (generative UI), if it is a plain object it JSON-stringifies into a `CodeBlock`, if it is a string it renders as-is. Errors get destructive red styling.

**How streaming partial content is handled.** The core `processUIMessageStream` function (source: `/tmp/vercel-ai/packages/ai/src/ui/process-ui-message-stream.ts`) maintains a `StreamingUIMessageState` with `activeTextParts`, `activeReasoningParts`, and `partialToolCalls` indexed by part ID. Text and reasoning chunks are appended to their active parts and written to the message array. Tool call inputs arrive as incremental JSON text which is parsed via `parsePartialJson` to produce typed `DeepPartial` objects displayed as the input streams in. The `Streamdown` component in `MessageResponse` handles incremental markdown rendering -- it processes token-by-token input, maintaining parser state across renders so partial markdown (incomplete code fences, half-formed tables) renders correctly during streaming. The `MessageResponse` component is wrapped in `React.memo` with a custom comparator (`prevProps.children === nextProps.children`) to prevent unnecessary re-renders.

**How `useObject` works.** The hook (source: `/tmp/vercel-ai/packages/react/src/use-object.ts`) streams raw JSON from an endpoint, accumulates text chunks via `TextDecoderStream` piped to a `WritableStream`, runs `parsePartialJson` on each chunk to produce a `DeepPartial<T>` typed object, and uses SWR's `mutate` to push updates to the UI. A `isDeepEqualData` check prevents unnecessary re-renders when the partial parse result has not changed. On finish, it validates the final object against the provided Zod schema via `safeValidateTypes`.

**Generative UI / custom data parts.** The `DataUIPart<DATA_TYPES>` type allows apps to define custom typed data parts (e.g., `data-weather`, `data-chart`) that flow through the same streaming pipeline. The `dataPartSchemas` option in `ChatInit` provides Zod schemas for validation. Components consume these via `message.parts.filter(p => p.type === 'data-weather')` and render custom UI. This is the SDK's approach to generative UI -- rather than streaming React components, it streams typed data that maps to registered component renderers.

---

#### API Surface

**Hooks** (from `@ai-sdk/react`, exported at `/tmp/vercel-ai/packages/react/src/index.ts`):
- `useChat` -- full chat management: `messages`, `sendMessage`, `regenerate`, `stop`, `resumeStream`, `addToolOutput`, `addToolApprovalResponse`, `setMessages`, `status` (submitted/streaming/ready/error), `error`, `clearError`
- `useCompletion` -- single-turn text completion: `completion`, `complete`, `stop`, `input`, `setInput`, `handleInputChange`, `handleSubmit`, `isLoading`, `error`
- `experimental_useObject` -- structured object generation with streaming partial JSON: `submit`, `object` (DeepPartial), `isLoading`, `stop`, `clear`, `error`
- `Chat` class -- framework-agnostic chat state machine, usable outside React (e.g., in Vue, Svelte, or vanilla JS)

**Elements** (from `ai-elements` CLI, v1.8.4):
- All 47 component files export named components with full TypeScript props types
- Every component accepts standard `className` and HTML attributes for customization
- Context hooks: `useReasoning()`, `usePromptInputController()`, `usePromptInputAttachments()`, `useAttachmentContext()`, `useMessageBranch()`, `useChainOfThought()`
- The `PromptInputProvider` lifts input state outside the form for programmatic control

**Customization points**: Every component is source-copied into your project (shadcn pattern), so you own the code. Tailwind classes are composed via `cn()` and can be overridden. Component internals use Radix primitives for accessibility. The `Streamdown` component accepts a `plugins` object for extending markdown rendering (code highlighting, math, mermaid, CJK).

---

#### Maturity Assessment

- **`ai` package**: ~28M monthly npm downloads. Version 6.0.77. Production-grade, heavily used, Apache-2.0 licensed. Stable API with typed message parts, multi-provider support (50+ provider packages), OpenTelemetry tracing built in.
- **`@ai-sdk/react`**: ~14M monthly downloads. Version 3.0.79. The `useChat` hook has been significantly rearchitected in the v5/v6 era -- it now wraps a framework-agnostic `AbstractChat` class with `useSyncExternalStore` (replacing the older SWR-based approach still used by `useCompletion`/`useObject`). This is a mature, stable API.
- **`ai-elements`** (CLI): ~102K monthly npm downloads. Version 1.8.4. This is **early-stage relative to the SDK**. The component library is functional and well-structured (47 components, comprehensive TypeScript types, proper context patterns, Radix primitives for accessibility), but it is a private workspace package (`"private": true` in the elements package.json) distributed via a CLI that copies source files -- there is no published npm package for the components themselves. The shadcn-style distribution model means no semver guarantees on individual component APIs. The dependency on bleeding-edge packages (React 19.2, Streamdown v2, Shiki 3.22, Motion 12) signals active development. The repo is Apache-2.0 licensed and maintained by Vercel (authored by Hayden Bleasel). It is usable in production but expect API churn and a smaller community compared to the core SDK. The ~100:1 download ratio between the core SDK and Elements reflects this gap in adoption maturity.agentId: af13aca (for resuming to continue this agent's work if needed)
<usage>total_tokens: 86288
tool_uses: 0
duration_ms: 85594</usage>

---

### CopilotKit + AG-UI Protocol

**Technical Deep-Dive (Source: code examination of both repositories)**

---

**Widget Inventory (CopilotKit v2.x React Package)**

CopilotKit ships five user-facing component families, all exported from `@copilotkitnext/react`:

| Component | File | Purpose |
|---|---|---|
| `CopilotChat` | `components/chat/CopilotChat.tsx` | Full embedded chat panel. Wraps `CopilotChatView`; manages agent lifecycle (`useAgent`), message submission via `copilotkit.runAgent()`, suggestions, audio transcription, and stop/abort. |
| `CopilotPopup` | `components/chat/CopilotPopup.tsx` | Floating popup variant. Delegates to `CopilotChat` with a `CopilotPopupView` overlay that adds a toggle button, configurable width/height, and click-outside-to-close. |
| `CopilotSidebar` | `components/chat/CopilotSidebar.tsx` | Sidebar variant. Same delegation pattern: `CopilotChat` with `CopilotSidebarView`, adding a slide-out sidebar with toggle button and configurable width. |
| `CopilotTextarea` | Documented in reference docs; v2.x code lives in `@copilotkit/react-textarea` (v1.x package) | AI-assisted textarea with autocompletions and inline suggestions. Not yet ported to v2.x; still ships under the classic `@copilotkit` namespace. |
| Tool Call Renderers | `components/chat/CopilotChatToolCallsView.tsx`, `components/WildcardToolCallRender.tsx` | Renders tool calls inline in chat. `CopilotChatToolCallsView` iterates `message.toolCalls` and delegates to the registered render function via `useRenderToolCall()`. `WildcardToolCallRender` is a catch-all (`name: "*"`) that shows tool name, status badge, expandable args/result. |

Supporting components: `CopilotChatAssistantMessage`, `CopilotChatUserMessage`, `CopilotChatInput` (with audio recording modes), `CopilotChatSuggestionPill`, `CopilotChatSuggestionView`, `CopilotChatToggleButton`, `CopilotModalHeader`, `CopilotKitInspector` (dev tools overlay), `MCPAppsActivityRenderer`.

Key hooks: `useAgent`, `useFrontendTool`, `useHumanInTheLoop`, `useRenderToolCall`, `useAgentContext`, `useRenderActivityMessage`, `useRenderCustomMessages`, `useConfigureSuggestions`.

---

**AG-UI Event Types (26 events in the `EventType` enum)**

The protocol spec originally described 17 semantic event types, but the actual `EventType` enum in `@ag-ui/core` (`sdks/typescript/packages/core/src/events.ts`) defines **26 events**:

| # | Event | Purpose |
|---|---|---|
| 1 | `RUN_STARTED` | Signals agent run begin; carries `threadId`, `runId`, optional `input` with seed messages |
| 2 | `RUN_FINISHED` | Run completed successfully; carries optional `result` |
| 3 | `RUN_ERROR` | Run failed; carries error `message` and optional `code` |
| 4 | `STEP_STARTED` | Named step/stage began within a run |
| 5 | `STEP_FINISHED` | Named step/stage completed |
| 6 | `TEXT_MESSAGE_START` | Opens a new text message with `messageId` and `role` |
| 7 | `TEXT_MESSAGE_CONTENT` | Streams a text `delta` chunk into a message |
| 8 | `TEXT_MESSAGE_END` | Closes a text message |
| 9 | `TEXT_MESSAGE_CHUNK` | Compact single-event variant (optional `messageId`, `role`, `delta`); gets expanded into START/CONTENT/END by the `transformChunks` pipeline stage |
| 10 | `TOOL_CALL_START` | Opens a tool call with `toolCallId`, `toolCallName`, optional `parentMessageId` |
| 11 | `TOOL_CALL_ARGS` | Streams JSON argument `delta` for a tool call |
| 12 | `TOOL_CALL_END` | Closes a tool call |
| 13 | `TOOL_CALL_CHUNK` | Compact single-event variant for tool calls; transformed like `TEXT_MESSAGE_CHUNK` |
| 14 | `TOOL_CALL_RESULT` | Returns tool execution result as a new `tool`-role message |
| 15 | `THINKING_START` | Agent enters thinking/reasoning mode (optional `title`) |
| 16 | `THINKING_END` | Agent exits thinking mode |
| 17 | `THINKING_TEXT_MESSAGE_START` | Opens a "thinking" text stream (internal reasoning) |
| 18 | `THINKING_TEXT_MESSAGE_CONTENT` | Streams thinking text deltas |
| 19 | `THINKING_TEXT_MESSAGE_END` | Closes thinking text |
| 20 | `STATE_SNAPSHOT` | Full state replacement; agent sends its entire state object |
| 21 | `STATE_DELTA` | Incremental state update via JSON Patch (RFC 6902) |
| 22 | `MESSAGES_SNAPSHOT` | Full messages array replacement |
| 23 | `ACTIVITY_SNAPSHOT` | Structured activity message (progress bars, status indicators, etc.) |
| 24 | `ACTIVITY_DELTA` | JSON Patch update to an existing activity message |
| 25 | `RAW` | Pass-through for vendor-specific events |
| 26 | `CUSTOM` | Named custom event with arbitrary `value` |

All events share a `BaseEvent` with `type`, optional `timestamp`, and optional `rawEvent`. Every schema is defined with Zod and assembled into a discriminated union (`EventSchemas`).

---

**Tech Stack**

- **UI Framework**: React >=16.8 (peer dep), internally developed against React 19.1.0. An Angular package also exists (`@copilotkitnext/angular`).
- **Styling**: Tailwind CSS v4 with `@tailwindcss/cli` for build. Utility classes used directly in components. Additional libraries: `class-variance-authority` (cva) for variant-based styling, `clsx` + `tailwind-merge` for class composition, `tw-animate-css` for animations, `lucide-react` for icons.
- **State Management**: No Redux/Zustand. State lives in `AbstractAgent` instances (messages array + state object) with a pub/sub subscriber pattern (`agent.subscribe()`). React integration uses `useReducer` for force-updates, `useSyncExternalStore` for render tool call subscriptions, and React Context (`CopilotKitContext`) via `CopilotKitProvider`. The `CopilotKitCoreReact` class extends `CopilotKitCore` with React-specific reactive notifications.
- **Streaming**: RxJS `Observable` pipelines throughout. Events flow through `run()` -> `transformChunks` -> `verifyEvents` -> `apply` -> `processApplyEvents`, all composed with RxJS `pipe()`.
- **Build**: Turborepo monorepo, tsup for bundling, Rollup for UMD builds, Vitest for testing.
- **Validation**: Zod pervasively in both projects for runtime type validation of all events and messages.

---

**Key Dependencies**

*CopilotKit React (`@copilotkitnext/react`)*: `@ag-ui/client` 0.0.42, `@ag-ui/core` 0.0.42, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `katex` (math rendering), `lucide-react`, `streamdown` (markdown streaming), `tailwind-merge`, `ts-deepmerge`, `use-stick-to-bottom` (auto-scroll), `zod`.

*CopilotKit Core (`@copilotkitnext/core`)*: `@ag-ui/client`, `rxjs` 7.8.1, `zod`, `zod-to-json-schema`.

*AG-UI Client (`@ag-ui/client`)*: `@ag-ui/core`, `@ag-ui/encoder`, `@ag-ui/proto` (protobuf), `rxjs` 7.8.1, `fast-json-patch` (RFC 6902), `uuid`, `compare-versions`, `untruncate-json`, `zod`.

*AG-UI Python SDK*: Python >=3.9, `pydantic` >=2.11.2 (only dependency).

---

**Implementation Details**

**Generative UI (rendering tool calls as custom React components)**: The `useFrontendTool` hook (`/tmp/copilotkit/src/v2.x/packages/react/src/hooks/use-frontend-tool.tsx`) registers a tool with the CopilotKit core and simultaneously registers a render function keyed by `(agentId, toolName)`. When a `TOOL_CALL_START` event arrives over the AG-UI stream, the `defaultApplyEvents` function creates an `AssistantMessage` with a `toolCalls` array. The `CopilotChatToolCallsView` component (`/tmp/copilotkit/src/v2.x/packages/react/src/components/chat/CopilotChatToolCallsView.tsx`) iterates this array and calls `useRenderToolCall()`, which looks up the registered `ReactToolCallRenderer` by name (with priority: exact agent match > unscoped match > wildcard `*`). The renderer component receives a discriminated union of props based on `ToolCallStatus` -- `InProgress` (args still streaming, parsed with `partialJSONParse`/`untruncate-json`), `Executing` (handler running), or `Complete` (result available). This enables progressive rendering of tool call UIs while arguments stream in.

**Shared state sync**: AG-UI provides two mechanisms: `STATE_SNAPSHOT` replaces the agent's entire state object; `STATE_DELTA` applies RFC 6902 JSON Patch operations via `fast-json-patch.applyPatch()`. On the client, `AbstractAgent.state` is updated by the `defaultApplyEvents` pipeline, which then notifies all subscribers via `onStateChanged`. React components use `useAgent()` (`/tmp/copilotkit/src/v2.x/packages/react/src/hooks/use-agent.tsx`) which subscribes to `OnStateChanged` and calls `forceUpdate()` (a `useReducer` dispatch). Context sharing from React to agent is handled by `useAgentContext` (`/tmp/copilotkit/src/v2.x/packages/react/src/hooks/use-agent-context.tsx`), which registers key-value context pairs that get passed in the `RunAgentInput.context` array on every `runAgent()` call.

**Human-in-the-loop**: The `useHumanInTheLoop` hook (`/tmp/copilotkit/src/v2.x/packages/react/src/hooks/use-human-in-the-loop.tsx`) creates a frontend tool whose `handler` returns a `new Promise()` that never resolves until the user interacts. It stores the `resolve` function in a ref (`resolvePromiseRef`). The rendered component receives a `respond` callback (only during `Executing` status) that calls `resolvePromiseRef.current(result)`. The agent's run pipeline pauses at the `TOOL_CALL_END` event while waiting for the tool result -- the promise from the handler blocks until the user clicks confirm/reject in the UI. After the user responds, the tool result propagates back as a `TOOL_CALL_RESULT` event and the agent continues. The type system (`/tmp/copilotkit/src/v2.x/packages/react/src/types/human-in-the-loop.ts`) enforces that `respond` is only available during `Executing` status and is `undefined` during `InProgress` and `Complete` states.

**AG-UI SSE streaming**: The `HttpAgent.run()` method (`/tmp/ag-ui/sdks/typescript/packages/client/src/agent/http.ts`) calls `runHttpRequest()` (`/tmp/ag-ui/sdks/typescript/packages/client/src/run/http-request.ts`), which issues a `fetch()` with `Accept: text/event-stream`. It reads the response body via `ReadableStream.getReader()` in an async loop, emitting raw `Uint8Array` chunks as `HttpDataEvent` observables. The `transformHttpEventStream` function parses SSE `data:` lines into JSON events. The encoder (`/tmp/ag-ui/sdks/typescript/packages/encoder/src/encoder.ts`) also supports binary protobuf framing (4-byte big-endian length prefix + protobuf message) negotiated via the `Accept` header. The entire pipeline is lazy -- it uses RxJS `defer()` so the fetch only executes on subscription.

**Frontend tool calls**: When the agent emits a `TOOL_CALL_START` for a tool name that matches a registered frontend tool (via `useFrontendTool`), CopilotKit's core intercepts it. The tool's `handler` function runs in the browser (not on any server), and its return value is sent back as a `TOOL_CALL_RESULT` event. This enables the agent to invoke browser-side capabilities -- DOM manipulation, reading app state, triggering navigation -- without server round-trips.

---

**Adoption and Ecosystem**

AG-UI has first-party integrations for **16 agent frameworks**: LangChain, LangGraph, CrewAI, Mastra, Google ADK (via `adk-middleware`), Agno, AWS Strands, Microsoft Agent Framework, Pydantic AI, LlamaIndex, Vercel AI SDK, A2A (Agent-to-Agent protocol bridge), plus a community integrations directory. Middleware support includes A2A-middleware and MCP-apps-middleware. CopilotKit lists enterprise users including Arista Networks, Otter.ai, and others on their site. The project has 21k+ GitHub stars. CopilotKit Cloud provides a hosted runtime endpoint at `api.cloud.copilotkit.ai`.

---

**Maturity Assessment**

- **AG-UI Protocol**: Version 0.0.44 -- pre-1.0, API surface actively evolving (event count grew from the originally-documented 17 to 26, adding thinking events, activity events, chunk events, and step events). The Zod-validated type system is thorough. The `transformChunks` layer that expands `CHUNK` events into `START/CONTENT/END` triplets shows production-grade attention to streaming ergonomics. Protobuf support is implemented but optional. Python SDK is minimal (Pydantic models only, no client agent abstraction). The breadth of framework integrations (16+) signals serious investment in ecosystem coverage, but version 0.0.x indicates breaking changes should be expected.

- **CopilotKit**: Version 1.51.4 (v1.x classic) / actively developing v2.x (`@copilotkitnext`). The v2.x rewrite is a ground-up rebuild on AG-UI -- the React package directly depends on `@ag-ui/client` and re-exports it wholesale (`export * from "@ag-ui/client"` in the index). v2.x drops the v1.x GraphQL runtime client in favor of AG-UI's SSE/protobuf streaming. The component library is well-structured (Radix primitives, Tailwind v4, CVA) but still maturing -- `CopilotTextarea` has not been ported to v2.x yet. Human-in-the-loop is cleanly implemented via promise-based blocking. The subscriber/observable architecture is solid but the mutable `agent.messages` pattern (requiring `JSON.stringify` in `useMemo` deps for change detection) is a pragmatic rough edge. Overall: production-usable for v1.x, v2.x is late-stage alpha transitioning toward GA.agentId: a65f325 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 68431
tool_uses: 0
duration_ms: 71231</usage>

---

### assistant-ui

**Repository**: github.com/assistant-ui/assistant-ui | **Author**: AgentbaseAI Inc. | **License**: MIT | **Current version**: `@assistant-ui/react` v0.12.9 (actively developed -- latest commit 2026-02-08)

#### Widget Inventory (Primitive Components from `@assistant-ui/react`)

The library exports 16 namespaced primitive component groups. These are unstyled, composable building blocks following the Radix UI compound-component pattern:

| Primitive Namespace | Sub-components | Purpose |
|---|---|---|
| `ThreadPrimitive` | `Root`, `Empty`, `If`, `Viewport`, `ViewportProvider`, `ViewportFooter`, `ViewportSlack`, `Messages`, `MessageByIndex`, `ScrollToBottom`, `Suggestion`, `Suggestions`, `SuggestionByIndex` | The main chat thread container with virtualized scrolling viewport and auto-scroll |
| `MessagePrimitive` | `Root`, `Parts`, `PartByIndex`, `Content` (alias for Parts), `If`, `Attachments`, `AttachmentByIndex`, `Error`, `Unstable_PartsGrouped`, `Unstable_PartsGroupedByParentId` | Individual message rendering with multipart content support |
| `MessagePartPrimitive` | `Text`, `Image`, `InProgress` | Leaf-level rendering of individual message content parts |
| `ComposerPrimitive` | `Root`, `Input`, `Send`, `Cancel`, `AddAttachment`, `Attachments`, `AttachmentByIndex`, `AttachmentDropzone`, `Dictate`, `StopDictation`, `DictationTranscript`, `If` | Message composition with auto-resize textarea, file drag-and-drop, voice dictation |
| `ActionBarPrimitive` | `Root`, `Copy`, `Reload`, `Edit`, `Speak`, `StopSpeaking`, `FeedbackPositive`, `FeedbackNegative`, `ExportMarkdown` | Per-message actions (copy, regenerate, edit, TTS, feedback, export) |
| `ActionBarMorePrimitive` | `Root`, `Trigger`, `Content`, `Item`, `Separator` | Overflow dropdown menu for additional message actions |
| `BranchPickerPrimitive` | `Root`, `Next`, `Previous`, `Count`, `Number` | Navigate alternative message branches (for regenerated responses) |
| `AttachmentPrimitive` | `Root`, `unstable_Thumb`, `Name`, `Remove` | File attachment display and management |
| `AssistantModalPrimitive` | `Root`, `Trigger`, `Content`, `Anchor` | Floating modal chat widget (popover-based) |
| `SuggestionPrimitive` | `Title`, `Description`, `Trigger` | Suggested prompts / quick-actions |
| `ThreadListPrimitive` | `Root`, `New`, `Items`, `ItemByIndex` | Multi-conversation thread list sidebar |
| `ThreadListItemPrimitive` | `Root`, `Archive`, `Unarchive`, `Delete`, `Trigger`, `Title` | Individual thread list entry with CRUD actions |
| `ThreadListItemMorePrimitive` | `Root`, `Trigger`, `Content`, `Item`, `Separator` | Overflow menu for thread list items |
| `ChainOfThoughtPrimitive` | `Root`, `AccordionTrigger`, `Parts` | Collapsible chain-of-thought / reasoning display |
| `ErrorPrimitive` | `Root`, `Message` | Error state display within messages |

Additional hooks exported: `useMessagePartText`, `useMessagePartReasoning`, `useMessagePartSource`, `useMessagePartFile`, `useMessagePartImage`, `useMessagePartData`, `useThreadViewportAutoScroll`, `useScrollLock`.

#### Tech Stack and Styling

**Core stack**: React 18/19, TypeScript, Zustand (v5) for state management, `@assistant-ui/tap` (a custom reactive primitives library), `@assistant-ui/store` (a Tap-based state store with `useAui`, `useAuiState`, `useAuiEvent` hooks that replace traditional React context selectors).

**Styling approach**: The library itself (`@assistant-ui/react`) ships **zero CSS** -- all primitives are unstyled DOM elements built on `@radix-ui/react-primitive`. The pre-built styled components live in a separate `@assistant-ui/ui` package that uses **Tailwind CSS** with `tailwind-merge`, `class-variance-authority`, and `clsx` -- this is a classic **shadcn/ui** pattern. Components are meant to be copied into your project (shadcn-style) via the `@assistant-ui/cli` and customized in-place. All styled components use `aui-*` CSS class prefixes for targeting.

**UI primitives foundation**: Radix UI is pervasive -- `@radix-ui/react-primitive`, `@radix-ui/react-popover` (for AssistantModal), `@radix-ui/react-dropdown-menu` (for ActionBarMore), `@radix-ui/react-slot` (for `asChild` pattern), `@radix-ui/react-compose-refs`, `@radix-ui/react-use-escape-keydown`, `@radix-ui/react-collapsible` (for tool call display). Icons come from `lucide-react`.

#### Key Dependencies

| Package | Role |
|---|---|
| `zustand` ^5 | Core state store for thread/message/composer state |
| `@assistant-ui/tap` / `@assistant-ui/store` | Custom reactive state primitive layer wrapping Zustand |
| `assistant-stream` ^0.3.2 | Stream protocol -- `ReadableStream<AssistantStreamChunk>` with serialization formats |
| `@radix-ui/react-*` (primitive, popover, dropdown-menu, slot, compose-refs) | Unstyled accessible component primitives |
| `react-textarea-autosize` ^8 | Auto-growing composer input |
| `nanoid` ^5 | Message ID generation |
| `zod` ^4 | Schema validation for tools and configs |
| `react-markdown` ^10 (via `@assistant-ui/react-markdown`) | Markdown rendering |
| `remark-gfm` | GitHub-flavored markdown tables, strikethrough, etc. |

#### Implementation Details

**Component architecture**: Three-layer design. (1) The **runtime layer** (`AssistantRuntime`, `ThreadRuntime`, `MessageRuntime`, `ComposerRuntime`, `AttachmentRuntime`, `ThreadListRuntime`, `ThreadListItemRuntime`, `MessagePartRuntime`) provides imperative APIs and state. (2) The **store layer** (`@assistant-ui/store`) bridges runtime state into a reactive Zustand store accessed via `useAui()` (imperative API handle) and `useAuiState(selector)` (reactive reads). (3) The **primitive layer** renders unstyled compound components consuming the store.

**Message rendering**: `ThreadPrimitive.Messages` receives a `components` prop mapping `{ UserMessage, AssistantMessage, SystemMessage, EditComposer }`. It reads `messagesLength` from the store, generates a `<MessageByIndexProvider>` for each index, which establishes a message scope. Inside each message, `MessagePrimitive.Parts` handles multipart content. The `groupMessageParts()` function analyzes part types and groups consecutive `tool-call` parts into `toolGroup` ranges and consecutive `reasoning` parts into `reasoningGroup` ranges. A `ChainOfThought` mode merges both into `chainOfThoughtGroup` ranges. Each group renders through a configurable wrapper component. Individual parts dispatch to `Text`, `Image`, `File`, `Reasoning`, `Source`, `Unstable_Audio`, or tool-call components based on `part.type`.

**Streaming**: The `assistant-stream` package defines `AssistantStream` as `ReadableStream<AssistantStreamChunk>` with multiple serialization formats -- `DataStream` (Vercel AI SDK compatible), `AssistantTransport` (custom binary), `UIMessageStream`, and `PlainText`. The stream accumulator incrementally builds up message parts as chunks arrive. The `MessagePartPrimitive.InProgress` component renders a blinking dot indicator during streaming. Text parts update reactively as the store receives new chunks from the stream.

**Tool calls**: Tool calls are message parts of type `tool-call` with `toolName`, `argsText`, `result`, and `status` (`running | complete | incomplete | requires-action`). The `ToolUIDisplay` component resolves which component to render by checking: (1) registered tool UIs via `s.tools.tools[toolName]`, (2) `tools.by_name[toolName]` from the `components` prop, (3) `tools.Fallback`. The pre-built `ToolFallback` component renders a collapsible panel (via Radix Collapsible) showing a status icon, tool name, arguments as pretty-printed JSON, result, and error state with shimmer animation while running. Tools can provide results back via `addResult` and resume via `resume` callbacks.

**Composer input**: `ComposerPrimitiveInput` wraps `react-textarea-autosize` with Enter-to-submit (with shift-Enter for newlines), Escape-to-cancel, clipboard paste for file attachments, and intelligent auto-focus management (on run start, thread switch, scroll to bottom). The `asChild` prop allows rendering as any element via Radix Slot. Dictation support (`Dictate`, `StopDictation`, `DictationTranscript`) is built in.

#### Provider Adapters (AI Backend Integration)

| Package | Adapter | Key Export |
|---|---|---|
| `@assistant-ui/react-ai-sdk` v1.3.6 | Vercel AI SDK v6 (`ai`, `@ai-sdk/react`) | `useAISDKRuntime`, `useChatRuntime`, `AssistantChatTransport`, `frontendTools` |
| `@assistant-ui/react-langgraph` v0.12.4 | LangGraph / LangChain | `useLangGraphRuntime`, `useLangGraphMessages`, `convertLangChainMessages`, `LangGraphMessageAccumulator` |
| `@assistant-ui/react-data-stream` v0.12.4 | Generic data streams | Vercel AI SDK data stream format adapter |
| `@assistant-ui/react-a2a` v0.2.4 | Google A2A (Agent-to-Agent) protocol | Protocol adapter |
| `@assistant-ui/react-ag-ui` v0.0.15 | AG-UI protocol (CopilotKit) | `@ag-ui/client` based adapter |
| `@assistant-ui/react-hook-form` | React Hook Form integration | Form-based tool interactions |

#### Customization and Theming

**shadcn-style copy-paste**: The `@assistant-ui/ui` package contains ready-made styled components (`thread.tsx`, `markdown-text.tsx`, `tool-fallback.tsx`, `attachment.tsx`, `thread-list.tsx`, `assistant-modal.tsx`, `reasoning.tsx`, `sources.tsx`, `diff-viewer.tsx`, `mermaid-diagram.tsx`, `shiki-highlighter.tsx`, `syntax-highlighter.tsx`, `model-selector.tsx`, etc.) meant to be scaffolded into your project via `npx assistant-ui init` and then modified directly.

**Component override via composition**: Every primitive supports the `asChild` pattern (Radix Slot). `ThreadPrimitive.Messages` accepts custom `UserMessage`, `AssistantMessage`, `EditComposer` components. `MessagePrimitive.Parts` accepts custom renderers for `Text`, `Image`, `File`, `Reasoning`, `Source`, `tools` (with `by_name` map, `Fallback`, or `Override`), `ToolGroup`, `ReasoningGroup`, and `ChainOfThought`.

**Tool UI registration**: Two mechanisms -- (1) declarative `<Tools>` client component that registers tool renderers into the store, (2) `useAssistantTool` / `useAssistantToolUI` hooks for imperative registration. `makeAssistantTool` and `makeAssistantToolUI` factory functions create reusable tool definitions.

**Model context**: `useAssistantInstructions` injects system instructions. `ModelContext` client provides runtime model configuration. `Suggestions` client provides suggested prompts. `useInlineRender` allows inline rendering within tool execution.

**CSS targeting**: All styled components apply `aui-*` class names (e.g., `aui-thread-root`, `aui-composer-input`, `aui-assistant-message-root`) for CSS overrides. A `--thread-max-width` CSS custom property controls layout width.

#### API Surface Summary

The public API from `@assistant-ui/react` consists of: (1) 16 primitive namespaces with ~80+ sub-components, (2) runtime types (`AssistantRuntime`, `ThreadRuntime`, `MessageRuntime`, `ComposerRuntime`, `AttachmentRuntime`, `ThreadListRuntime`, `ThreadListItemRuntime`, `MessagePartRuntime`), (3) state hooks (`useAui`, `useAuiState`, `useAuiEvent`, `AuiIf`, `AuiProvider`), (4) legacy context hooks (`useAssistantRuntime`, `useThreadRuntime`, `useMessageRuntime`, `useComposerRuntime`, `useAttachmentRuntime`, `useThreadListRuntime`, `useThreadListItemRuntime`, `useMessagePartRuntime`, `useThread`, `useMessage`, `useComposer`, etc.), (5) model context utilities (`useAssistantTool`, `useAssistantToolUI`, `useAssistantInstructions`, `makeAssistantTool`, `makeAssistantToolUI`, `tool`, `useInlineRender`), (6) client components (`Tools`, `Suggestions`, `ExternalThread`, `InMemoryThreadList`, `ModelContextClient`, `ChainOfThoughtClient`), (7) message type exports for all part types and statuses.

#### Maturity Assessment

**Backing and traction**: Built by AgentbaseAI Inc., a Y Combinator-backed company. The repository is actively maintained with commits landing as recently as 2026-02-08. The monorepo contains 24 packages, comprehensive TypeScript types, and a full docs site at assistant-ui.com.

**API stability**: Currently at v0.12.x, indicating pre-1.0 status with API churn. Evidence of ongoing migration: the codebase contains deprecated exports with `@deprecated` annotations (e.g., `useAssistantApi` renamed to `useAui`, `useAssistantState` renamed to `useAuiState`) and a `legacy-runtime` directory wrapping the older API. The `@assistant-ui/store` package (v0.1.6) and `@assistant-ui/tap` (v0.4.5) are new foundational layers replacing the previous Zustand-based context approach. Several APIs are marked `unstable_` or `Unstable_`.

**Breadth**: Unusually wide integration surface for a component library -- adapters for Vercel AI SDK, LangGraph/LangChain, A2A protocol, AG-UI/CopilotKit, generic data streams, and a proprietary cloud backend (`assistant-cloud`). Two markdown renderers (`react-markdown` based and `streamdown` based). Syntax highlighting via both `react-syntax-highlighter` and Shiki. Developer tools package (`react-devtools`). MCP integration packages present.

**Assessment**: This is a serious, well-architected library with a sophisticated component primitive model clearly inspired by Radix UI. The three-layer runtime/store/primitive architecture is clean and extensible. However, the pre-1.0 version and active API migration (legacy-runtime wrappers, deprecated exports, new Tap-based store) mean consumers should expect breaking changes. The breadth of integrations and the shadcn-style customization model make it the most comprehensive open-source React chat UI library available, but teams adopting it should pin versions carefully and be prepared to track upstream changes.agentId: a7eb654 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 75796
tool_uses: 0
duration_ms: 32386</usage>

---

### Code Diff & Editor Component Libraries

#### 1. Monaco Editor (`@monaco-editor/react` v4.7.0 + `monaco-editor`)

**What it is.** The editor that powers VS Code, extracted as a standalone browser library. The React wrapper (`@monaco-editor/react`) provides `<Editor>` and `<DiffEditor>` components. The wrapper itself is tiny (~150 KB unpacked); `monaco-editor` is massive (~72 MB installed, ~16 MB minified).

**Diff Editor API.** The `<DiffEditor>` component accepts:
```tsx
<DiffEditor
  original={oldCode}          // left pane string
  modified={newCode}           // right pane string
  language="typescript"        // shared language, or use originalLanguage/modifiedLanguage
  theme="vs-dark"              // "vs-dark" | "light" | custom via monaco.editor.defineTheme()
  options={{                   // IDiffEditorConstructionOptions -- full VS Code diff options
    renderSideBySide: true,    // false = inline diff
    enableSplitViewResizing: true,
    renderIndicators: true,
    originalEditable: false,
  }}
  onMount={(editor, monaco) => {
    // editor is IStandaloneDiffEditor -- full access to getOriginalEditor(), getModifiedEditor(),
    // getLineChanges(), onDidUpdateDiff, etc.
  }}
  height="500px"
/>
```

Under the hood, `onMount` delivers `editor.IStandaloneDiffEditor`, which exposes `getLineChanges()` returning `ILineChange[]` (original/modified start/end lines + character-level `ICharChange[]`). Languages: every language VS Code supports (~80+) including TypeScript, Python, Go, Rust, etc., loaded on demand from CDN by default via `@monaco-editor/loader`.

**Full prop surface from the type definitions** (file: `/tmp/lib-research/node_modules/@monaco-editor/react/dist/index.d.ts`):
- `original` / `modified` -- the two source strings
- `language` / `originalLanguage` / `modifiedLanguage` -- language identifiers
- `originalModelPath` / `modifiedModelPath` -- URI paths for model identity (`monaco.Uri.parse(...)`)
- `keepCurrentOriginalModel` / `keepCurrentModifiedModel` -- prevent disposal on unmount (default `false`)
- `theme` -- `"vs-dark" | "light"` or any string registered via `monaco.editor.defineTheme`
- `loading` -- ReactNode shown during async load
- `options` -- `editor.IDiffEditorConstructionOptions` (the full VS Code diff options object)
- `width` / `height` -- CSS dimensions (default `"100%"`)
- `className` / `wrapperProps` -- container styling
- `beforeMount` -- `(monaco: Monaco) => void` -- fires before editor creation
- `onMount` -- `(editor: MonacoDiffEditor, monaco: Monaco) => void` -- fires after creation

The wrapper also exports `useMonaco()` hook returning the monaco namespace (or null while loading), and the standard `<Editor>` component with `onChange`, `onValidate`, `defaultValue`, `defaultLanguage`, `defaultPath`, `value`, `path`, `line`, `saveViewState`, `keepCurrentModel`, `overrideServices` props.

**Key trade-offs.** Enormous bundle. Not tree-shakeable in a meaningful way. Loading from CDN (the default) avoids bundling but adds a network dependency. Using `monaco-editor-webpack-plugin` or `vite-plugin-monaco-editor` is required to self-host. The diff engine is C++-quality (same Myers diff + patience as VS Code). Fully editable on both sides. Best for "full IDE" experiences.

**Who uses it.** GitHub Codespaces, Gitpod, StackBlitz, VS Code for Web, Cursor's web view. Any tool that needs a full code editor with diffing.

---

#### 2. CodeMirror 6 Merge (`@codemirror/merge` v6.11.2)

**What it is.** A diff/merge extension for CodeMirror 6. ~186 KB installed (very small). Dependencies: `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@lezer/highlight`, `style-mod`. No WASM, no heavy runtime.

**Diff primitives** (from `/tmp/lib-research/node_modules/@codemirror/merge/dist/index.d.ts`):
```ts
// Low-level diff
class Change { fromA: number; toA: number; fromB: number; toB: number; }
function diff(a: string, b: string, config?: DiffConfig): readonly Change[];
function presentableDiff(a: string, b: string, config?: DiffConfig): readonly Change[];
// DiffConfig: { scanLimit?: number; timeout?: number; }

// Line-level chunks (groups of changes)
class Chunk {
  changes: readonly Change[];  // relative to chunk start
  fromA: number; toA: number; fromB: number; toB: number;
  precise: boolean;  // false if fell back to fast imprecise diff
  get endA(): number;
  get endB(): number;
  static build(a: Text, b: Text, conf?: DiffConfig): readonly Chunk[];
  static updateA(chunks, a, b, changes, conf?): readonly Chunk[];  // incremental update
  static updateB(chunks, a, b, changes, conf?): readonly Chunk[];
}
```

**Split MergeView:**
```ts
const view = new MergeView({
  a: { doc: originalText, extensions: [/* CM6 extensions */] },
  b: { doc: modifiedText, extensions: [] },
  parent: document.getElementById('editor'),
  orientation: "a-b",           // or "b-a"
  revertControls: "a-to-b",     // shows revert buttons between chunks
  renderRevertControl: () => HTMLElement,  // custom revert button
  highlightChanges: true,        // inline character-level highlights
  gutter: true,                  // gutter markers on changed lines
  collapseUnchanged: { margin: 3, minSize: 4 },
  diffConfig: { scanLimit: 500 },
});
// view.a and view.b are full EditorView instances
// view.chunks is readonly Chunk[]
// view.dom is the outer container HTMLElement
// view.reconfigure(config) -- live reconfiguration
// view.destroy() -- cleanup
```

**Unified `unifiedMergeView`:**
```ts
const extensions = [
  unifiedMergeView({
    original: originalText,       // string or Text
    highlightChanges: true,
    gutter: true,
    syntaxHighlightDeletions: true,
    syntaxHighlightDeletionsMaxLength: 3000,  // skip highlighting huge deletions
    allowInlineDiffs: false,       // when true, small changes shown inline not as separate lines
    mergeControls: true,          // accept/reject buttons per chunk
    collapseUnchanged: { margin: 3, minSize: 4 },
    diffConfig: { scanLimit: 500 },
  }),
];
// Feed extensions into a standard EditorView -- deleted lines appear as read-only widgets
```

**Navigation and chunk operations:**
```ts
goToNextChunk: StateCommand;       // move selection to next changed chunk
goToPreviousChunk: StateCommand;   // move selection to previous changed chunk
acceptChunk(view, pos?): boolean;  // accept change at position (unified mode)
rejectChunk(view, pos?): boolean;  // reject change, revert to original (unified mode)
getChunks(state): { chunks: readonly Chunk[], side: "a" | "b" | null } | null;
getOriginalDoc(state): Text;       // get original doc from unified merge state
updateOriginalDoc: StateEffectType<{ doc: Text, changes: ChangeSet }>;
originalDocChangeEffect(state, changes): StateEffect<...>;  // create effect to update original
uncollapseUnchanged: StateEffectType<number>;  // expand collapsed section at position
mergeViewSiblings(view): { a: EditorView, b: EditorView } | null;  // query split view pair
```

**Key advantage.** Extremely lightweight, modular, full CM6 extension ecosystem (syntax highlighting via Lezer grammars, vim mode, etc.). The diff algorithm runs in JS with configurable `scanLimit` and `timeout` to avoid quadratic blowup. The `Chunk.updateA`/`updateB` methods allow incremental diff updates as documents are edited, avoiding full recomputation.

**Who uses it.** Replit (primary editor), many custom coding tools, Obsidian plugins. Ideal for lightweight, embeddable diff views where you want the user to accept/reject individual changes.

---

#### 3. diff2html (v3.x, cloned and examined at `/tmp/diff2html`)

**What it is.** A library that parses unified diff strings (from `git diff`, `diff -u`, etc.) and renders them as styled HTML. Dependencies: `diff` (jsdiff), `@profoundlogic/hogan` (Mustache templates). Optional: `highlight.js` for syntax highlighting. ~2.1 MB installed.

**Type system** (from `/tmp/diff2html/src/types.ts`):
```ts
enum LineType { INSERT = 'insert', DELETE = 'delete', CONTEXT = 'context' }
type OutputFormatType = 'line-by-line' | 'side-by-side';
type LineMatchingType = 'lines' | 'words' | 'none';
type DiffStyleType = 'word' | 'char';
enum ColorSchemeType { AUTO = 'auto', DARK = 'dark', LIGHT = 'light' }

interface DiffLine { type: LineType; oldNumber?: number; newNumber?: number; content: string; }
interface DiffBlock { oldStartLine: number; newStartLine: number; header: string; lines: DiffLine[]; }
interface DiffFile {
  oldName: string; newName: string;
  addedLines: number; deletedLines: number;
  isCombined: boolean; isGitDiff: boolean;
  language: string; blocks: DiffBlock[];
  oldMode?: string; newMode?: string;
  deletedFileMode?: string; newFileMode?: string;
  isDeleted?: boolean; isNew?: boolean; isCopy?: boolean; isRename?: boolean;
  isBinary?: boolean; isTooBig?: boolean;
  unchangedPercentage?: number; changedPercentage?: number;
  checksumBefore?: string | string[]; checksumAfter?: string; mode?: string;
}
```

**Pipeline:**
```
unified diff string --> parse() --> DiffFile[] --> html() --> HTML string
```

**Core API** (from `/tmp/diff2html/src/diff2html.ts`):
```ts
import { parse, html } from 'diff2html';

const files: DiffFile[] = parse(unifiedDiffString, {
  srcPrefix: 'a/',        // strip from old file paths
  dstPrefix: 'b/',        // strip from new file paths
  diffMaxChanges: 5000,   // mark file as "too big" above this
  diffMaxLineLength: 10000,
  diffTooBigMessage: (fileIndex) => 'Diff too big to be displayed',
});

const rendered: string = html(unifiedDiffString /* or DiffFile[] */, {
  outputFormat: 'side-by-side',   // or 'line-by-line' (default)
  drawFileList: true,
  matching: 'lines',              // 'lines' | 'words' | 'none'
  diffStyle: 'word',              // 'word' | 'char'
  colorScheme: 'auto',            // 'auto' | 'dark' | 'light'
  renderNothingWhenEmpty: false,
  matchingMaxComparisons: 2500,
  maxLineSizeInBlockForComparison: 200,
});
```

**Parser internals** (from `/tmp/diff2html/src/diff-parser.ts`): Handles `diff --git`, `diff --combined`, unified diffs, binary files, renames (`rename from/to`), copies (`copy from/to`), mode changes (`old mode/new mode/deleted file mode/new file mode`), similarity/dissimilarity indexes, and combined diffs (three-way merge format with `@@@`). Timestamps in the `---`/`+++` headers are stripped. The parser is a single-pass line-by-line state machine.

**Rendering** (from `/tmp/diff2html/src/side-by-side-renderer.ts`): Uses Hogan.js (Mustache) templates. Two renderers: `LineByLineRenderer` (unified) and `SideBySideRenderer` (split). A `FileListRenderer` draws the collapsible file list. Word-level diff matching uses the `rematch` module to align deleted/inserted lines.

**UI class** (from `/tmp/diff2html/src/ui/js/diff2html-ui-base.ts`):
```ts
const ui = new Diff2HtmlUI(targetElement, diffString, {
  synchronisedScroll: true,   // sync side-by-side scroll via paired scroll listeners
  highlight: true,             // apply highlight.js post-render
  fileListToggle: true,       // collapsible file list
  fileListStartVisible: false,
  fileContentToggle: true,    // collapsible file diffs
  stickyFileHeaders: true,    // sticky headers during scroll
  highlightLanguages: new Map(), // override language detection
});
ui.draw();  // sets innerHTML + wires up scroll sync, highlight, toggles, sticky headers
```

**React integration.** No official React wrapper. Typical pattern: use `html()` with `dangerouslySetInnerHTML`, or use `parse()` and build custom React components from `DiffFile[]`.

**Who uses it.** GitHub (PR diff rendering), GitLab, Bitbucket diff views, many CI/CD dashboard UIs. Best when you already have a unified diff string and need to render it as static HTML.

---

#### 4. react-diff-viewer-continued (v4.1.2)

**What it is.** A React component (`React.Component` class) that takes two raw strings and computes + renders a diff. Active fork of the unmaintained `react-diff-viewer`. Dependencies: `diff` (jsdiff), `@emotion/css`, `@emotion/react`, `classnames`, `memoize-one`, `js-yaml`. ~1.1 MB installed.

**Full props** (from `/tmp/lib-research/node_modules/react-diff-viewer-continued/lib/cjs/src/index.d.ts`):
```tsx
<DiffViewer
  oldValue={oldString}                // string or Record<string, unknown> (for JSON/YAML)
  newValue={newString}
  splitView={true}                    // false = inline/unified
  linesOffset={0}                     // starting line number
  disableWordDiff={false}
  compareMethod={DiffMethod.WORDS}    // see DiffMethod enum below
  extraLinesSurroundingDiff={3}       // context lines around changes
  hideLineNumbers={false}
  alwaysShowLines={['L20', 'R18']}    // always show these lines even when collapsed
  showDiffOnly={true}                 // false = show all lines
  renderContent={(source) => <pre>{source}</pre>}  // syntax highlighting hook
  codeFoldMessageRenderer={(totalFolded, leftStart, rightStart) => <span>...</span>}
  onLineNumberClick={(lineId, event) => {}}
  renderGutter={({ lineNumber, type, prefix, value, additionalLineNumber, additionalPrefix, styles }) => <div/>}
  highlightLines={['L-20', 'R-18']}  // highlight specific lines
  styles={{ /* ReactDiffViewerStylesOverride */ }}
  useDarkTheme={true}
  summary="Changes to config"         // string or ReactElement
  leftTitle="Original"                // string or ReactElement
  rightTitle="Modified"
  nonce="csp-nonce"
  infiniteLoading={{ pageSize: 100, containerHeight: '500px' }}  // virtualization
  loadingElement={() => <Spinner />}   // shown during async diff computation
  hideSummary={false}
  showDebugInfo={false}               // development overlay
/>
```

**DiffMethod enum** (from `compute-lines.d.ts`):
```ts
enum DiffMethod {
  CHARS = "diffChars",
  WORDS = "diffWords",
  WORDS_WITH_SPACE = "diffWordsWithSpace",
  LINES = "diffLines",
  TRIMMED_LINES = "diffTrimmedLines",
  SENTENCES = "diffSentences",
  CSS = "diffCss",
  JSON = "diffJson",
  YAML = "diffYaml",
}
// Also accepts custom: (oldStr: string, newStr: string) => diff.Change[]
```

**Diff types:**
```ts
enum DiffType { DEFAULT = 0, ADDED = 1, REMOVED = 2, CHANGED = 3 }
interface DiffInformation { value?: string | DiffInformation[]; lineNumber?: number; type?: DiffType; }
interface LineInformation { left?: DiffInformation; right?: DiffInformation; }
```

**Notable internals.** Web Worker support via `computeLineInformationWorker()` for non-blocking diff computation. Built-in virtualization with cumulative offset tracking for variable-height rows (`buildCumulativeOffsets`, `findLineAtOffset` via binary search). `ResizeObserver` for responsive measurement. Code folding of unchanged regions. Memoized diff results keyed on input hash.

**Who uses it.** Internal dashboards, config comparison UIs, smaller coding tools. Good for "drop in a diff viewer" when you have two strings.

---

#### 5. react-diff-view (v3.3.2)

**What it is.** A React component library designed to consume **parsed git unified diffs** (not raw strings). Architecturally the most "code review" oriented library. Dependencies: `gitdiff-parser`, `diff-match-patch`, `lodash`, `classnames`, `shallow-equal`, `warning`. ~1.8 MB installed.

**Exports** (from `/tmp/lib-research/node_modules/react-diff-view/types/index.d.ts`):
```ts
// Components
export { Diff, Hunk, Decoration };

// Utilities
export { parseDiff, computeNewLineNumber, computeOldLineNumber, expandCollapsedBlockBy,
  expandFromRawCode, findChangeByNewLineNumber, findChangeByOldLineNumber, getChangeKey,
  getCollapsedLinesCountBetween, getCorrespondingNewLineNumber, getCorrespondingOldLineNumber,
  insertHunk, textLinesToHunk, isInsert, isDelete, isNormal };

// Tokenization
export { markEdits, markWord, pickRanges, tokenize };

// HOCs (legacy)
export { minCollapsedLines, withChangeSelect, withSourceExpansion, withTokenizeWorker };

// Hooks
export { useChangeSelect, useMinCollapsedLines, useSourceExpansion, useTokenizeWorker };
```

**Core model -- parse first, render second:**
```tsx
import { parseDiff, Diff, Hunk, tokenize, markEdits } from 'react-diff-view';

const files = parseDiff(unifiedDiffString);
// FileData = { oldPath, newPath, hunks: HunkData[], type: 'add'|'delete'|'modify'|'rename'|'copy' }

{files.map(file => (
  <Diff
    key={file.newPath}
    diffType={file.type}          // 'add' | 'delete' | 'modify' | 'rename' | 'copy'
    hunks={file.hunks}
    viewType="split"              // 'split' | 'unified'
    gutterType="default"
    tokens={tokens}                // HunkTokens from tokenize()
    renderToken={renderToken}      // custom token renderer
    renderGutter={renderGutter}    // custom gutter renderer
    gutterEvents={{ onClick: handler }}
    codeEvents={{ onClick: handler }}
    widgets={{ 'I42': <CommentWidget /> }}  // inline widgets keyed by change key
    selectedChanges={['I42']}      // highlighted change keys
    optimizeSelection={true}       // CSS-based selection optimization
    className="my-diff"
    generateAnchorID={(change) => `change-${change.lineNumber}`}
    generateLineClassName={({ changes, defaultGenerate }) => defaultGenerate()}
  >
    {hunks => hunks.map(hunk => (
      <Hunk key={hunk.content} hunk={hunk} />
    ))}
  </Diff>
))}
```

The `<Decoration>` component allows injecting arbitrary React nodes between hunks (comment threads, annotations, file-level banners). The `widgets` prop maps change keys to React elements for inline commenting at the line level.

**Tokenization layer.** Separate `tokenize()` function with configurable enhancers:
```ts
const options = {
  highlight: true,
  enhancers: [markEdits(hunks, { type: 'block' })],  // word-level edit highlighting
  language: 'javascript',
  refractor: refractor,  // or use any Prism-compatible highlighter
};
const tokens = tokenize(hunks, options);
```
Integration with Prism/refractor/highlight.js via `useTokenizeWorker()` hook (runs in Web Worker).

**Hooks:**
- `useChangeSelect({ multiple: true })` -- multi-select changes for batch operations
- `useSourceExpansion(hunks, rawCode)` -- expand collapsed context by fetching raw source
- `useMinCollapsedLines(5)` -- minimum lines before collapsing
- `useTokenizeWorker(workerUrl, hunks, options)` -- offload tokenization to worker

**Key differentiator.** The separation between `parseDiff` (data) and `<Diff>/<Hunk>` (rendering) gives maximum flexibility. The `widgets` and `<Decoration>` patterns are purpose-built for code review UIs with threaded comments. `getChangeKey()`, `findChangeByOldLineNumber()`, `getCorrespondingNewLineNumber()` etc. provide a full toolkit for navigating diff data programmatically.

**Who uses it.** Code review UIs, custom GitHub-style PR viewers, GitLab-alternative frontends. Best when you need a GitHub-like diff experience with inline comments and custom annotations.

---

#### 6. Shiki (v3.22.0) + `@shikijs/transformers`

**What it is.** A syntax highlighter using VS Code's TextMate grammars (via Oniguruma WASM or a JS regex engine). Not a diff library itself, but provides diff-aware syntax highlighting via transformers. ~968 KB installed (grammars lazy-loaded). The WASM engine adds ~1.3 MB.

**Core API:**
```ts
import { createHighlighter, codeToHtml, codeToHast, codeToTokens } from 'shiki';

// One-shot (uses singleton highlighter)
const html = await codeToHtml(code, { lang: 'typescript', theme: 'github-dark' });

// Persistent highlighter (recommended for repeated use)
const highlighter = await createHighlighter({
  themes: ['github-dark', 'github-light'],
  langs: ['typescript', 'python', 'rust'],
});
const html = highlighter.codeToHtml(code, { lang: 'ts', theme: 'github-dark' });
const hast = highlighter.codeToHast(code, { lang: 'ts', theme: 'github-dark' });  // HAST AST
const tokens = highlighter.codeToTokens(code, { lang: 'ts', theme: 'github-dark' });  // raw tokens
```

**Diff transformer** (from `/tmp/lib-research/node_modules/@shikijs/transformers/dist/index.d.mts`):
```ts
import { transformerNotationDiff } from '@shikijs/transformers';

const html = await codeToHtml(code, {
  lang: 'typescript',
  theme: 'github-dark',
  transformers: [
    transformerNotationDiff({
      classLineAdd: 'diff add',       // applied to lines with // [!code ++]
      classLineRemove: 'diff remove', // applied to lines with // [!code --]
      classActivePre: 'has-diff',     // applied to <pre> when diff markers present
      classActiveCode: 'has-diff',    // applied to <code> when diff markers present
      matchAlgorithm: 'v3',           // comment matching algorithm
    }),
  ],
});
```

**Other relevant transformers:**
- `transformerNotationHighlight()` -- `[!code highlight]` for highlighted lines
- `transformerNotationFocus()` -- `[!code focus]` for focused lines
- `transformerNotationErrorLevel()` -- `[!code error]` / `[!code warning]`
- `transformerMetaHighlight()` -- `{1,3-5}` in meta string for highlighted lines
- `transformerRenderWhitespace()` -- visible tabs/spaces
- `transformerStyleToClass()` -- converts inline styles to class names (SSR friendly)

**Engines:**
- `@shikijs/engine-oniguruma` -- full TextMate compatibility via WASM (~1.3 MB binary), supports all grammars
- `@shikijs/engine-javascript` -- pure JS regex engine, no WASM, but fewer grammars supported

**Integration pattern for real diffs.** Shiki does not compute diffs. Combine it with a diff library: compute diff with jsdiff/diff-match-patch, then use `codeToHast()` to get a syntax-highlighted AST, then merge diff annotations with the highlighted tokens. The `react-diff-view` library's `tokenize()` function supports this pattern natively via enhancers.

**Who uses it.** VitePress, Astro, Nuxt Content, Slidev, many documentation sites. For diff UIs: used as the highlighting layer on top of diff2html, react-diff-view, or custom renderers.

---

#### 7. xterm.js (`@xterm/xterm` v6.0.0)

**What it is.** A full terminal emulator for the browser. ~5.9 MB installed, ~300 KB minified runtime. Powers the terminal in VS Code, Hyper, Theia, and every web-based coding agent.

**Core API** (from `/tmp/lib-research/node_modules/@xterm/xterm/typings/xterm.d.ts`, 1957 lines):
```ts
import { Terminal } from '@xterm/xterm';

const term = new Terminal({
  // Init-only (cannot change after construction)
  cols: 80,
  rows: 24,

  // Runtime options
  fontSize: 14,
  fontFamily: 'JetBrains Mono, monospace',
  fontWeight: 'normal',              // FontWeight: 'normal'|'bold'|'100'-'900'|number
  fontWeightBold: 'bold',
  lineHeight: 1.2,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: 'bar',                // 'block' | 'underline' | 'bar'
  cursorWidth: 1,
  cursorInactiveStyle: 'outline',    // 'outline'|'block'|'bar'|'underline'|'none'
  scrollback: 5000,                  // lines retained above viewport
  scrollOnUserInput: true,
  smoothScrollDuration: 0,           // ms, 0 = instant
  tabStopWidth: 8,
  allowTransparency: false,
  convertEol: false,
  disableStdin: false,
  screenReaderMode: false,
  macOptionIsMeta: false,
  minimumContrastRatio: 1,           // 1=off, 4.5=WCAG AA, 7=WCAG AAA
  drawBoldTextInBrightColors: true,
  customGlyphs: true,                // render box-drawing chars as custom glyphs
  rescaleOverlappingGlyphs: false,
  logLevel: 'info',                  // 'trace'|'debug'|'info'|'warn'|'error'|'off'
  linkHandler: null,                 // custom OSC 8 hyperlink handler
  windowsPty: { backend: 'conpty', buildNumber: 19045 },
  overviewRuler: { width: 14, showTopBorder: false, showBottomBorder: false },
  theme: {
    background: '#1e1e1e', foreground: '#d4d4d4',
    cursor: '#ffffff', cursorAccent: '#000000',
    selectionBackground: '#264f78', selectionForeground: undefined,
    selectionInactiveBackground: '#3a3d41',
    scrollbarSliderBackground: undefined,  // defaults to fg @ 20% opacity
    // 16 ANSI colors + bright variants
    black: '#000000', red: '#cd3131', green: '#0dbc79', /* ... */
    brightBlack: '#666666', brightRed: '#f14c4c', /* ... */
    extendedAnsi: [],  // colors 16-255
  },
});

term.open(document.getElementById('terminal'));  // mount into DOM
```

**Key methods:**
```ts
term.write(data: string | Uint8Array, callback?: () => void): void;  // output to terminal
term.writeln(data: string, callback?: () => void): void;              // output + newline
term.input(data: string, wasUserInput?: boolean): void;               // simulate input
term.resize(columns: number, rows: number): void;                     // resize terminal
term.clear(): void;                    // clear viewport + scrollback
term.reset(): void;                    // full reset
term.scrollToBottom(): void;
term.scrollToTop(): void;
term.scrollToLine(line: number): void;
term.select(column, row, length): void;
term.selectAll(): void;
term.getSelection(): string;
term.hasSelection(): boolean;
term.paste(data: string): void;
term.refresh(start: number, end: number): void;
term.dispose(): void;                  // cleanup
term.loadAddon(addon: ITerminalAddon): void;
```

**Key events:**
```ts
term.onData: IEvent<string>;           // user input (keystrokes) -- send to PTY
term.onBinary: IEvent<string>;         // binary input -- send as Buffer.from(data, 'binary')
term.onKey: IEvent<{ key: string, domEvent: KeyboardEvent }>;
term.onLineFeed: IEvent<void>;
term.onScroll: IEvent<number>;
term.onSelectionChange: IEvent<void>;
term.onTitleChange: IEvent<string>;     // OSC 2 title changes
term.onBell: IEvent<void>;
term.onResize: IEvent<{ cols: number, rows: number }>;
term.onRender: IEvent<{ start: number, end: number }>;
term.onWriteParsed: IEvent<void>;       // fires after write() data is parsed
```

**Connecting to a PTY:**
```ts
// Frontend
term.onData(data => websocket.send(data));         // keystrokes -> PTY
term.onBinary(data => websocket.send(data));       // binary -> PTY
websocket.onmessage = (e) => term.write(e.data);  // PTY output -> terminal
term.onResize(({ cols, rows }) => websocket.send(JSON.stringify({ type: 'resize', cols, rows })));

// Backend (Node.js with node-pty)
import { spawn } from 'node-pty';
const pty = spawn('bash', [], { cols: 80, rows: 24, cwd: process.env.HOME });
pty.onData(data => ws.send(data));
ws.on('message', msg => {
  const parsed = JSON.parse(msg);
  if (parsed.type === 'resize') pty.resize(parsed.cols, parsed.rows);
  else pty.write(msg);
});
```

**Addon: `@xterm/addon-fit`** (from typings):
```ts
import { FitAddon } from '@xterm/addon-fit';
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
fitAddon.fit();                                    // resize to container
const dims = fitAddon.proposeDimensions();         // { rows: number, cols: number } | undefined
window.addEventListener('resize', () => fitAddon.fit());
```

**Addon: `@xterm/addon-webgl`** (from typings):
```ts
import { WebglAddon } from '@xterm/addon-webgl';
const webglAddon = new WebglAddon(false);          // preserveDrawingBuffer?: boolean
webglAddon.onContextLoss(() => {
  webglAddon.dispose();                            // fallback to canvas renderer
});
webglAddon.onChangeTextureAtlas((canvas) => {});   // texture atlas events
webglAddon.onAddTextureAtlasCanvas((canvas) => {});
webglAddon.onRemoveTextureAtlasCanvas((canvas) => {});
term.loadAddon(webglAddon);
webglAddon.textureAtlas;                           // HTMLCanvasElement | undefined
webglAddon.clearTextureAtlas();                    // force re-render
```

**Addon: `@xterm/addon-search`** (from typings):
```ts
import { SearchAddon } from '@xterm/addon-search';
const searchAddon = new SearchAddon({ highlightLimit: 1000 });
term.loadAddon(searchAddon);

searchAddon.findNext('error', {
  regex: false,
  wholeWord: false,
  caseSensitive: false,
  incremental: true,                              // expand selection if still matching
  decorations: {
    matchBackground: '#FFD70050',                  // must be #RRGGBB format
    matchBorder: '#FFD700',
    matchOverviewRuler: '#FFD700',                 // required
    activeMatchBackground: '#FF6B00',
    activeMatchBorder: '#FF6B00',
    activeMatchColorOverviewRuler: '#FF6B00',      // required
  },
});
searchAddon.findPrevious('error', { /* same options */ });
searchAddon.clearDecorations();
searchAddon.clearActiveDecoration();               // reveals selection underneath
searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
  console.log(`Match ${resultIndex + 1} of ${resultCount}`);
});
```

**Other notable addons:** `@xterm/addon-serialize` (serialize buffer to string/HTML), `@xterm/addon-unicode11` (proper Unicode width tables), `@xterm/addon-image` (inline images via iTerm2/Sixel protocol), `@xterm/addon-clipboard` (OSC 52 clipboard), `@xterm/addon-ligatures` (font ligature support), `@xterm/addon-attach` (attach to WebSocket directly).

---

#### Library Comparison Matrix

| Library | Input | Output | Syntax Highlighting | Installed Size | Min+GZ Estimate | Editable | React Native |
|---|---|---|---|---|---|---|---|
| **Monaco DiffEditor** | Two strings | Full IDE diff view | Built-in (80+ langs) | ~72 MB | ~1.5 MB | Both sides | No |
| **CM6 @codemirror/merge** | Two strings/Text | Split or unified view | Lezer grammars (ext) | ~186 KB (+deps) | ~20-30 KB | Both sides | No |
| **diff2html** | Unified diff string | HTML string | highlight.js (opt) | ~2.1 MB | ~40 KB | No | N/A |
| **react-diff-viewer-continued** | Two strings | React component | Custom renderContent | ~1.1 MB | ~15 KB +emotion+jsdiff | No | No |
| **react-diff-view** | Unified diff string | React components | tokenize()+enhancers | ~1.8 MB | ~20 KB +lodash+dmp | No | No |
| **Shiki** | Code + annotations | HTML/HAST | Built-in (TextMate) | ~968 KB | ~30 KB +WASM 1.3MB | No | N/A |
| **xterm.js** | PTY data stream | Terminal emulator | ANSI escape codes | ~5.9 MB | ~300 KB | Terminal I/O | No |

#### Which Coding Agents Use Which

| Agent / Tool | Editor | Diff | Terminal |
|---|---|---|---|
| **VS Code / Cursor / Windsurf** | Monaco | Monaco DiffEditor | xterm.js |
| **GitHub Codespaces / github.dev** | Monaco | Monaco DiffEditor | xterm.js |
| **Gitpod** | Monaco (via Theia) | Monaco DiffEditor | xterm.js |
| **Replit** | CodeMirror 6 | @codemirror/merge | xterm.js |
| **StackBlitz / CodeSandbox** | Monaco | Monaco DiffEditor | xterm.js |
| **Claude Code (web terminal)** | N/A | Custom / diff2html | xterm.js |
| **Aider (web UIs)** | N/A | diff2html | xterm.js |
| **GitHub PR diff views** | N/A | diff2html (server) | N/A |
| **Documentation sites** | N/A | Shiki transformerNotationDiff | N/A |
| **Custom code review tools** | N/A | react-diff-view | N/A |

#### Recommendations

**Use Monaco DiffEditor when:** You are building a full IDE experience, need editable diffs with full VS Code fidelity, support 80+ languages out of the box, and can tolerate the enormous bundle. Load from CDN (the `@monaco-editor/loader` default) to avoid webpack/vite bundling complexity. The `IStandaloneDiffEditor` gives you `getLineChanges()` with character-level granularity and `onDidUpdateDiff` for reactive updates.

**Use @codemirror/merge when:** You want the best balance of features vs. bundle size. The unified merge view with accept/reject controls (`mergeControls: true`, `acceptChunk()`, `rejectChunk()`) is ideal for AI coding agent "apply edit" UIs where the user reviews and approves changes one chunk at a time. The incremental diff update methods (`Chunk.updateA`/`updateB`) mean you can update diffs as the user or AI edits the document without recomputing from scratch. CM6's extension system means you can add vim mode, collaborative editing, custom keybindings, etc.

**Use diff2html when:** You already have a unified diff string (from `git diff`, CI output, etc.) and need to render it as static, non-editable HTML. No framework dependency. Works server-side. The `parse()` function gives you structured `DiffFile[]` data if you want to build custom rendering. Pair with highlight.js for syntax coloring. The `Diff2HtmlUI` class handles scroll sync, file list toggles, and sticky headers out of the box.

**Use react-diff-viewer-continued when:** You have two strings and want a simple drop-in React diff component with minimal ceremony. Particularly useful for JSON/YAML diffs (`DiffMethod.JSON`, `DiffMethod.YAML`). The `renderContent` prop is the hook for integrating any syntax highlighter (Shiki, Prism, highlight.js). The Web Worker diff computation and virtualization support make it viable for moderately large files.

**Use react-diff-view when:** You need a GitHub-style PR review UI with inline comments, hunk-level widgets, change selection, and source expansion. The architecture of `parseDiff()` + `<Diff>` + `<Hunk>` + `<Decoration>` gives maximum composability. The `widgets` prop (keyed by change ID) and `<Decoration>` component are purpose-built for threaded inline comments. The hooks (`useChangeSelect`, `useSourceExpansion`, `useTokenizeWorker`) support real code review workflows. Pair with Shiki or refractor for syntax highlighting via the `tokenize()` enhancer system.

**Use Shiki when:** You need VS Code-quality syntax highlighting in any diff output. Not a diff engine -- combine with one of the above. `transformerNotationDiff` is specifically useful for documentation/blog code blocks with `// [!code ++]`/`// [!code --]` annotations. For production diff UIs, use `codeToHast()` to get a syntax-highlighted AST and merge it with diff data from another library.

**Use xterm.js when:** You need a terminal emulator in the browser. This is the only real option -- it has no serious competitors. Use `@xterm/addon-fit` (mandatory for responsive layouts), `@xterm/addon-webgl` (3-5x rendering performance for large scrollback), and `@xterm/addon-search` (find-in-terminal with highlighted matches and overview ruler). Connect to a real PTY via WebSocket + `node-pty` on the backend. Every serious coding agent web UI uses xterm.js for the terminal component.agentId: a7bc732 (for resuming to continue this agent's work if needed)
<usage>total_tokens: 88868
tool_uses: 0
duration_ms: 213227</usage>

---

## Part 4: UX Design Challenges & Lessons

### 4.1 Scroll Position During Streaming

**The #1 reported UX pain point across tools.**

- New streamed content pushes viewport around.
- Solution: **Intersection Observer pattern** — auto-scroll only when user is already at
  bottom; if user scrolls up, respect their position.
- `isAtBottom` state controls `ChatScrollAnchor` behavior.
- Real-world bugs: Warp + Claude Code exhibits aggressive scrolling with long
  conversations (strobing/flashing effect); AFFiNE's AI chat panel had `scrollHeight`
  jumping to zero during streaming updates due to race conditions.
- **Key principle**: streaming updates should never fight the user's scroll position.

### 4.2 Collapse/Expand Patterns

- **Claude Code VSCode**: All thinking items expand/collapse together.
  Works well IF the clicked item doesn't scroll its expansion offscreen.
- **Roo Code**: "Prettier thinking blocks" with improved collapse handling.
- **General pattern**: Default collapsed for thinking and tool use; expand on click.
- **Challenge**: When an expanded section is very long, expanding it can push the trigger
  element out of the viewport, disorienting the user.
- **Possible improvement**: Scroll-to and pin the expanded section header.

### 4.3 Multi-File Edit Coherence

- Cursor 2.0 addresses this with **aggregated multi-file diffs** (PR-review style).
- Most tools still show file-by-file diffs in sequence.
- **Challenge**: Understanding the holistic intent of a multi-file change.
- **Lesson**: PR-style aggregated view is better than sequential individual diffs.

### 4.4 Tool Use Transparency vs. Noise

- Tools like Copilot show every tool invocation transparently.
- Too much detail becomes noise; too little loses trust.
- **Best pattern**: Collapsed tool use with clear summary line; expand for details.
- **Generative UI** (CopilotKit, Vercel) replaces tool-use dumps with meaningful UI
  (e.g., a weather card instead of "called getWeather({city: 'SF'})").

### 4.5 Streaming Partial Markdown

- Markdown rendered mid-stream can produce broken formatting (unclosed code blocks, partial
  tables).
- **Solutions**: Buffer until complete blocks; use streaming-aware markdown renderers;
  Vercel AI Elements handles this natively.

### 4.6 Long-Running Agent Operations

- Tasks can take 1–30 minutes (Codex cloud).
- Users need: progress visibility, checkpoints, ability to intervene, cancel, or redirect.
- **Codex App pattern**: Threads with status; continue other work while agents run.
- **Manus pattern**: Live "Computer" window showing real-time agent activity.
- **Claudia pattern**: Visual timeline with checkpoint branching.

### 4.7 Approval Granularity

- Simple yes/no is insufficient for power users.
- **Copilot pattern**: Allow dropdown with scope options (once, session, solution, always).
- **Windsurf "Turbo mode"**: Blanket auto-approve for terminal commands.
- **Balance**: Too many prompts slow down; too few risk unwanted actions.

### 4.8 Context & File References

- `@`-mentions with fuzzy autocomplete is now table stakes.
- Drag-and-drop from file explorer gaining traction (Windsurf, Copilot).
- **Challenge**: Large codebases make fuzzy search noisy.
- **Opportunity**: Smart context suggestions based on current task.

### 4.9 Multi-Select User Choice

- Newer pattern where the agent presents options and asks user to pick.
- More structured than free-text; faster than re-prompting.
- **Opportunity**: Under-explored; most tools still rely on free-text responses.

### 4.10 Mobile & Responsive

- Most coding agent UIs are desktop-only.
- **CloudCLI/Claude Code UI**: One of the few with responsive mobile design.
- **Claude.ai**: Web sessions accessible from iOS app.
- **Opportunity**: Monitoring and light interaction on mobile is valuable even if heavy
  coding stays on desktop.

---

## Part 5: Recommendations for Building a New Interface

### Reusable Stack Recommendations

| Layer | Recommended Libraries |
|-------|----------------------|
| **Chat core** | Vercel AI SDK (`useChat`) + AI Elements, or assistant-ui |
| **Agent protocol** | AG-UI protocol (CopilotKit) for standardized event streaming |
| **Code editor** | CodeMirror 6 (lighter) or Monaco (richer) |
| **Diff display** | Monaco diff editor or CodeMirror merge extension; diff2html for lightweight |
| **Terminal** | xterm.js |
| **Markdown** | react-markdown + Shiki for syntax highlighting |
| **Scrolling** | TanStack Virtual for long histories + Intersection Observer for auto-scroll |
| **Animations** | Framer Motion for expand/collapse |

### Key Design Principles

1. **Streaming-first**: Every output element must gracefully handle partial/streaming data.
2. **Collapse by default, expand on demand**: Thinking, tool use, and diffs should be
   collapsed with clear summary lines.
3. **Never fight scroll position**: Auto-scroll only when user is at bottom.
4. **PR-style multi-file diffs**: Show holistic changes, not file-by-file fragments.
5. **Granular approvals**: Offer scope options (once, session, always) not just yes/no.
6. **Visual timeline**: A vertical line with color-coded dots/markers for each event type
   gives users a scannable overview of agent activity.
7. **Checkpoints with rollback**: Let users revert to any point in the conversation.
8. **Progressive disclosure**: Summary → details → full output.
   Don't front-load raw tool output.

### What's Missing in Current Tools

- **No truly reusable, comprehensive "coding agent UI kit"** exists yet.
  Vercel AI Elements is closest but lacks diff views, tool-use timelines, and approval
  dialogs.
- **AG-UI + AI Elements** together could form a strong foundation but haven't been
  combined for a coding-specific interface.
- **Timeline/activity visualization** is under-developed across all tools.
  The Claudia visual timeline and Roo Code checkpoint timeline are the most advanced.
- **Multi-agent orchestration UI** is nascent; only VS Code 1.107+ (Copilot) and Cursor
  2.0 have real multi-agent management.
- **Mobile-responsive coding agent interfaces** barely exist.

---

## Part 6: Open-Source Projects with Rich GUIs (Summary Table)

| Project | Interface Type | Framework | Key UI Libraries | GitHub Stars | License |
|---------|---------------|-----------|-----------------|--------------|---------|
| **OpenHands** | Web app (React SPA) | React 19, FastAPI | VS Code web, xterm.js, Chromium | 65k+ | MIT |
| **bolt.diy** | Web app | Remix/React | CodeMirror, xterm.js, WebContainers | ~20k | OSS (StackBlitz) |
| **Cline** | VSCode webview | React 18 (webview) | react-virtuoso, Shiki, gRPC | ~30k+ | Apache 2.0 |
| **Roo Code** | VSCode webview | React 18 (webview) | Radix UI, Tailwind v4, Shiki | ~25k+ | Apache 2.0 |
| **OpenCode** | TUI + Desktop + Web | SolidJS + OpenTUI (TUI), Tauri v2 (desktop) | Custom TUI renderer, 50+ shared components | 45k+ | MIT |
| **Goose** | CLI + Electron desktop | Rust (CLI), Electron/React (desktop) | rustyline, bat, cliclack, react-markdown | ~15k+ | Apache 2.0 |
| **Devon** | Electron desktop | Electron 31 + React | XState, Monaco, xterm.js | ~6k | MIT |
| **Codex CLI** | TUI | Rust + Ratatui | crossterm, tokio, tui-textarea | ~20k+ | Apache 2.0 |
| **Aider** | Terminal + browser | Python (prompt_toolkit + rich), Streamlit | prompt_toolkit, rich, streamlit | ~22k+ | Apache 2.0 |

---

## References

### Official Documentation & Blogs
- [Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- [Claude Code on the Web](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Claude MCP Apps in Chat](https://www.theregister.com/2026/01/26/claude_mcp_apps_arrives/)
- [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Introducing Codex](https://openai.com/index/introducing-codex/)
- [Introducing the Codex App](https://openai.com/index/introducing-the-codex-app/)
- [Codex CLI](https://developers.openai.com/codex/cli/)
- [Codex Developer Docs](https://developers.openai.com/codex)
- [Cursor Features](https://cursor.com/features)
- [Windsurf Cascade](https://windsurf.com/cascade)
- [Copilot Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode)
- [VS Code 1.107 Multi-Agent](https://visualstudiomagazine.com/articles/2025/12/12/vs-code-1-107-november-2025-update-expands-multi-agent-orchestration-model-management.aspx)

### Open-Source Projects
- [OpenHands](https://github.com/OpenHands/OpenHands)
- [bolt.diy](https://github.com/stackblitz-labs/bolt.diy)
- [Cline](https://github.com/cline/cline)
- [Roo Code](https://github.com/RooCodeInc/Roo-Code)
- [OpenCode](https://github.com/sst/opencode)
- [Goose](https://github.com/block/goose)
- [Devon](https://github.com/entropy-research/Devon)
- [Codex CLI (open source)](https://github.com/openai/codex)
- [Aider](https://github.com/paul-gauthier/aider)

### UI Libraries & Frameworks
- [Vercel AI SDK](https://vercel.com/docs/ai-sdk)
- [Vercel AI Elements](https://github.com/vercel/ai-elements)
- [CopilotKit](https://github.com/CopilotKit/CopilotKit)
- [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui) / [Docs](https://docs.ag-ui.com/)
- [assistant-ui](https://github.com/assistant-ui/assistant-ui)
- [Monaco Editor React](https://www.npmjs.com/package/@monaco-editor/react)
- [CodeMirror 6](https://codemirror.net/)
- [diff2html](https://diff2html.xyz/)
- [react-diff-viewer (fork)](https://www.npmjs.com/package/@mutefire/react-diff-viewer)
- [xterm.js](https://xtermjs.org/)

### Third-Party Claude Code UIs
- [claude-code-webui](https://github.com/sugyan/claude-code-webui)
- [CloudCLI / Claude Code UI](https://github.com/siteboon/claudecodeui)
- [Claudia GUI](https://claudia.so/)
- [Claudix](https://github.com/Haleclipse/Claudix)
- [Claude Code Chat (andrepimenta)](https://github.com/andrepimenta/claude-code-chat)

### UX & Design
- [Intuitive Scrolling for Chatbot Streaming](https://tuffstuff9.hashnode.dev/intuitive-scrolling-for-chatbot-message-streaming)
- [AFFiNE Scroll Position Fix PR](https://github.com/toeverything/AFFiNE/pull/9653)
- [Warp Scrolling Bug with Claude Code](https://github.com/warpdotdev/Warp/issues/8089)
- [CopilotKit Generative UI Guide 2026](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026)
- [Google A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [Cursor Design Mode](https://www.builder.io/blog/cursor-design-mode-visual-editing)
- [Cursor IDE Review 2026](https://prismic.io/blog/cursor-ai)

### Surveys & Comparisons
- [2026 Guide to Coding CLI Tools (Tembo)](https://www.tembo.io/blog/coding-cli-tools-comparison)
- [Best AI Coding Assistants Feb 2026 (Shakudo)](https://www.shakudo.io/blog/best-ai-coding-assistants)
- [OpenCode InfoQ Article](https://www.infoq.com/news/2026/02/opencode-coding-agent/)
- [Manus AI Review (MIT Technology Review)](https://www.technologyreview.com/2025/03/11/1113133/manus-ai-review/)

---

## Appendix: Deep-Dive Beads

Each tool and component library has a dedicated bead for in-depth technical research.
The task for each bead is: **check out the source repo (where open source), examine the
actual UI implementation, and document ~1 page of technical detail** covering:
- GUI widget inventory (chat, thinking, tool use, diffs, timelines, file trees, terminals)
- Implementation tech stack (React, Svelte, webview, Electron, Tauri, etc.)
- Key dependencies (specific npm packages, component libraries used)
- How each widget works (component names, rendering approach, state management)
- Maturity, quality, and reusability assessment

**Parent epic:** `clam-ng04` — Deep-dive research: coding agent GUI interfaces and widget
implementations

### Coding Agent Tools

| Bead | Tool | Status |
|------|------|--------|
| `clam-gfwe` | Claude Code | Complete |
| `clam-epmq` | OpenAI Codex | Complete |
| `clam-o83q` | Cursor IDE | Complete |
| `clam-iq2i` | Windsurf (Codeium) | Complete |
| `clam-il8f` | GitHub Copilot Chat | Complete |
| `clam-ox80` | OpenCode | Complete |
| `clam-lb1g` | Manus AI | Complete |
| `clam-89x6` | Aider | Complete |
| `clam-f3lv` | OpenHands | Complete |
| `clam-y5ee` | bolt.diy | Complete |
| `clam-5gpv` | Goose (Block) | Complete |
| `clam-8a9d` | Cline | Complete |
| `clam-0wkm` | Roo Code | Complete |
| `clam-rua7` | Amp (Sourcegraph) | Complete |
| `clam-56mu` | Devon | Complete |

### Component Libraries & Frameworks

| Bead | Library | Status |
|------|---------|--------|
| `clam-ucpl` | Vercel AI SDK + AI Elements | Complete |
| `clam-s9pf` | CopilotKit + AG-UI Protocol | Complete |
| `clam-aeil` | assistant-ui | Complete |
| `clam-4de5` | Diff/Editor components | Complete |
