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

## Part 1: Tool-by-Tool Survey

### 1.1 Claude Code (Anthropic)

Claude Code has three distinct interface surfaces:

#### CLI (Terminal)

- Streaming markdown chat with syntax-highlighted code blocks.
- Thinking display: collapsed by default, expandable inline.
- Tool use: shows tool name, inputs, and outputs with collapsible sections.
- Diffs: shown as unified diff output in terminal (colored additions/deletions).
- Input: text prompt, `/` commands, `@` file mentions with fuzzy auto-complete.
- Confirmations: inline yes/no prompts for tool use approval.
- Context indicator shows usage of context window.

#### VS Code Extension (Official)

- **Chat panel** in sidebar with full webview-based UI.
- **Colored status dots** on the spark tab icon:
  - Blue dot: permission request pending.
  - Orange dot: Claude finished while tab was hidden.
  - PR review status: colored dot indicator (approved, changes requested, pending, draft)
    with clickable link.
- **Thinking display**: Extended thinking can be toggled on/off.
  When expanded, **all "Thinking" items expand/collapse together** (clicking one expands
  all) — an interesting design choice that works well so long as the clicked item doesn't
  scroll its expansion offscreen.
- **Diff view**: Inline diffs in the sidebar panel; click any file to open VS Code's native
  side-by-side diff viewer.
  Drag the sidebar wider for inline view.
- **Input**: Chat text input, `@`-mentions for files/folders with fuzzy auto-complete, `/`
  command menu (attach files, switch models, toggle thinking, view plan usage).
- **Context indicator** in prompt box shows context window usage.
- **Auto-install**: The extension auto-installs when running `claude` from VS Code's
  integrated terminal.

#### Claude Code on the Web (claude.ai)

- Launched as a research preview for delegating coding tasks from the browser.
- Tasks run on Anthropic-managed cloud infrastructure while you continue working.
- GitHub-connected: link a repo, describe tasks in plain English, runs in sandboxed
  environment.
- Can plan locally (read-only plan mode) then send to web for autonomous execution.
- Progress tracked via `/tasks` command or directly on claude.ai / iOS app.
- Limitation: only works with GitHub-hosted repos.

#### MCP Apps in Chat (January 2026)

- Claude can now render **third-party application UI within the chat window** via MCP
  extensions — charts, forms, dashboards, interactive controls.

#### Third-Party Web UIs for Claude Code

- **claude-code-webui** (sugyan): Web frontend for Claude CLI with streaming chat.
- **CloudCLI / Claude Code UI** (siteboon): Desktop & mobile UI with file explorer, git
  explorer, integrated shell terminal, session management.
  Responsive design for mobile use.
- **Claudia GUI**: Open-source visual interface with advanced session management, time
  travel (checkpoints, branching, visual timeline navigation), custom AI agents.

### 1.2 OpenAI Codex

Codex has evolved into a multi-surface coding platform:

#### Web Interface (ChatGPT Integration)

- Accessible via ChatGPT sidebar.
- Two modes: "Code" (assign a task) and "Ask" (question about codebase).
- Each task runs in an isolated cloud container with the codebase preloaded.
- Task completion: 1–30 minutes depending on complexity.
- Agent can read/edit files, run commands, tests, linters, type checkers.

#### Desktop App (Codex App)

- Purpose-built GUI focused on multi-tasking with agents.
- **Threads organized by projects**: switch between tasks without losing context.
- **Diff review in-thread**: review changes, comment on diffs, open in editor.
- **Built-in worktree support**: multiple agents work on same repo in isolated copies
  without conflicts.
- Represents a shift from "model you prompt" to "coding surface."

#### CLI (Open Source, Rust)

- Open source at github.com/openai/codex.
- Terminal agent with local file access.

#### IDE Extension

- Brings Codex agent into VS Code, Cursor, and forks.
- Preview local changes and edit code seamlessly.

#### Skills & Automations

- "Skills" bundle instructions + resources + scripts for repeatable tasks.
- "Automations" let Codex work unprompted (issue triage, CI/CD, monitoring).

### 1.3 Cursor IDE

A full IDE (VS Code fork) with deeply integrated AI:

#### Agent-Centric Interface (Cursor 2.0)

- **Agent layout** where agents, plans, and runs are first-class sidebar objects.
- Multiple parallel agents on the same project (refactoring, tests, UI polish).
- Switch between agents like switching terminals or branches.
- Viewing changes feels "like reviewing a pull request."

#### Three AI Interaction Modes

| Mode | Shortcut | Purpose |
|------|----------|---------|
| Ask/Chat | `Cmd+L` | Ask questions, get explanations |
| Agent/Composer | `Cmd+I` | Multi-step autonomous edits (default mode) |
| Inline Edit | `Cmd+K` | Quick single-location edits with inline prompt |

#### Diff & Edit Display

- Proposed changes shown as diffs; **files never written to disk** until accepted.
- Aggregated multi-file diffs in Cursor 2.0.
- Diff discipline: "minimize diff size and avoid whitespace churn."

#### Visual Design Mode (Late 2025)

- Browser sidebar with visual web editor: move, resize, color, style elements visually.
- "Apply" button triggers agent to update code with hot reload.
- Two loops: visual loop (adjust styles) and code loop (agent edits, hot reload).
- Known UX issues: no multi-select, finicky selection, no undo (Cmd+Z doesn't work as
  expected), messy DOM tree for layers.

### 1.4 Windsurf (formerly Codeium)

AI-native IDE built on VS Code foundation:

#### Cascade AI Assistant

- Sidebar agent with Code and Chat modes, tool calling, voice input.
- **Cascade flow**: multi-step code edits with deep codebase understanding.
- Shows proposed changes as diffs; asks for approval before executing.
- Checkpoints for rolling back.
- Auto-detects and fixes lint errors it generates.
- Image input: drop images/mockups into Cascade.
- Drag-and-drop file context from File Explorer.
- "Turbo mode": auto-execute terminal commands without approval.
- Iterative debugging: if code fails, it analyzes errors, hypothesizes fixes, re-runs
  autonomously.

### 1.5 GitHub Copilot Chat (VS Code)

#### Agent Mode (2025)

- Acts as autonomous peer programmer: reads files, proposes edits, runs terminal commands.
- **Tool invocations transparently displayed in UI**.
- Terminal tools require user approval.
- **Undo Last Edit** control in view title bar.
- Automatic context finding via workspace tools.
- Context references: `#file`, drag and drop, Add Files button.
- MCP server tools available (opt-in with checkboxes).
- When Copilot invokes a tool, it shows a **confirmation dialog** with Allow dropdown
  (once, this session, this solution, always).

#### Copilot Coding Agent (Background)

- GitHub-hosted autonomous agent for background tasks.
- Assign an issue to Copilot → it implements and creates a PR.
- PR rendered as a card in the Chat view.

#### Multi-Agent Orchestration (VS Code 1.107+, late 2025)

- Agent HQ: manage all agents from one place.
- Background agents run in isolated workspaces.
- Session list shows status, progress, file change statistics.
- Delegate work across local, background, or cloud agents.

### 1.6 OpenCode

Open-source coding agent (Go-based, 45k+ GitHub stars):

#### Terminal UI (TUI)

- Interactive terminal interface with multi-session support.
- Two built-in agents: "build" (full access) and "plan" (read-only analysis).
- Auto-compact feature for context window management.
- Image drag-and-drop support.

#### Desktop App (Beta)

- Graphical layer over the terminal: chat panels, file explorer, diff viewers, embedded
  terminal.
- Tauri-based community GUI also exists.

#### Web Interface Projects

- **opencode-web** (chris-tse): Web-based UI for the OpenCode API with modern chat
  interface.
- **OpenChamber** (fan-made): Desktop and web interface with background/daemon mode,
  password-protected UI, Cloudflare Quick Tunnel for remote access with QR code.

#### IDE Integration

- Works with VS Code, Cursor, any editor supporting Agent Client Protocol (ACP).
- Quick launch: Cmd+Esc / Ctrl+Esc for split terminal view.

### 1.7 Manus AI

General-purpose autonomous AI agent:

#### Web Interface

- Clean, minimalist design resembling ChatGPT/DeepSeek.
- Previous sessions in left column, chat input in center.
- **"Manus's Computer" window**: real-time view of agent thinking, browsing, clicking,
  executing.
  Users can observe AND intervene at any point.
- Multi-agent architecture: Planner Agent → Execution Agent with tool-use framework.
- Full web development lifecycle capability.
- Built on Browser Use open-source framework for web navigation.

### 1.8 Aider

Terminal-first AI pair programming tool:

#### Browser UI (Experimental)

- Launch with `aider --browser` for localhost web UI.
- Chat-based interface for editing local git repo files.
- Still experimental; terminal remains the primary interface.
- Popular with ~22k+ GitHub stars; strong community.

### 1.9 OpenHands (formerly OpenDevin)

Open-source cloud coding agent platform (65k+ GitHub stars):

#### Web UI Architecture

- **Single-page React application** backed by REST/WebSocket API.
- Three interactive workspace interfaces:
  1. **Browser-based VS Code IDE** (code editor).
  2. **Terminal** for command execution in sandboxed Docker containers.
  3. **Persistent Chromium browser** for web interaction.
- **Event-sourced state model** with deterministic replay.
- Chat-based interface visualizing agent's current actions.
- VNC desktop for GUI interaction.

#### SDK & Architecture

- Modular SDK: core SDK, tools, workspace (sandboxing), agent-server (API).
- Typed tool system with MCP integration.
- MIT licensed (including core Docker images).

### 1.10 bolt.new / bolt.diy

AI-powered web development in the browser:

#### Web UI Components

- **Chat interface**: conversational panel for prompting AI.
- **CodeMirror-based code editor**: in-browser code editing with syntax highlighting.
- **xterm.js terminal**: integrated terminal for Node.js server and package manager.
- **Live browser preview**: WebContainers-powered live app preview.
- **File tree**: filesystem navigation.
- AI has full control of filesystem, node server, package manager, terminal, browser
  console.
- Open source: github.com/stackblitz-labs/bolt.diy.

### 1.11 Goose (Block)

Open-source extensible AI agent framework (Apache 2.0):

#### Interfaces

- **CLI** in Rust.
- **Electron desktop app** with graphical interface.
- Works with any LLM, supports multi-model configuration.
- MCP integration for connecting to external tools.
- Recent features: parallel sessions with isolated agent state, CLI permission prompts,
  external editor support (vim, helix).

### 1.12 Cline

Open-source autonomous coding assistant for VS Code:

#### UI Components

- Dual "Plan" and "Act" modes.
- Chat interface with conversation history, tool actions, file edits, command executions.
- Checkpoint entries in chat with diff view and rollback buttons.
- Multi-IDE: VS Code extension, CLI, JetBrains integration.
- Model-agnostic (plug in any API).

### 1.13 Roo Code (fork of Cline)

Enhanced Cline fork:

#### UI Enhancements

- "Prettier thinking blocks" (v3.7).
- Improved long text handling in ChatRow component.
- Chat view maintains scroll position during streaming.
- Timeline with comprehensive change history.
- Checkpoint entries with diff view and rollback.
- Interleaved thinking and native tool calling.
- Dropdown hover color fixes and UI polish.

### 1.14 Amp (Sourcegraph)

Commercial coding agent (not open source):

#### Interfaces

- CLI and VS Code extension.
- "Deep mode" for autonomous research/problem-solving.
- Composable tool system with sub-agents (Oracle, Librarian).
- Code review agent.
- No standalone web interface found.

### 1.15 Devon (Entropy Research)

Open-source pair programmer:

- Python-based agent with `devon-ui` web interface (npx launch).
- Terminal interface available.
- Lightweight; limited UI/IDE integration compared to OpenHands.

---

## Part 2: Constituent UI Widgets & Elements

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

## Part 3: Open-Source UI Component Libraries

### 3.1 Vercel AI SDK + AI Elements

**The leading TypeScript toolkit for AI applications (20M+ monthly npm downloads).**

- **AI SDK core**: Unified API across providers; `useChat`, `useCompletion`, `useAssistant`
  hooks for React, Vue, Svelte.
- **AI Elements** (new, open source): 20+ production-ready React components built on
  shadcn/ui.
  - `Conversation`, `ConversationContent`, `Message`, `MessageContent`,
    `MessageResponse`, `PromptInput`, and more.
  - **Tool use display**: Elements `Tool` component for rendering tool calls/results.
  - **Generative UI**: Render custom React components for tool results instead of generic
    displays (e.g., weather cards instead of JSON).
  - **Reasoning display**: Component for showing agent reasoning.
  - **Streaming**: Built-in handling of streaming responses, partial markdown, etc.
  - **`message.parts` array**: Typed message parts including text, tool calls, reasoning.
  - Installed to your codebase (shadcn/ui pattern) for full customization.
- **AI SDK 6.0+** (late 2025): Decoupled state model, framework-agnostic `AbstractChat`
  class, SSE streaming.
- **RSC approach paused**: AI SDK RSC (React Server Components) is paused in favor of
  AI Elements.
- **Repo**: github.com/vercel/ai-elements

### 3.2 CopilotKit

**Framework for agent-native applications with Generative UI.**

- React-based chat UI with message streaming, tool calls, agent responses.
- **Generative UI**: Agents generate/update UI components dynamically at runtime.
- **Shared State**: Synchronized state between agent and UI in real-time.
- **Human-in-the-Loop**: Agents pause for user input/confirmation/edits.
- Full design freedom: use default components or build fully custom.
- **AG-UI Protocol** (see below): Open protocol for standardizing agent–UI communication.
- **Repo**: github.com/CopilotKit/CopilotKit

### 3.3 AG-UI Protocol (Agent–User Interaction)

**Open protocol standardizing real-time agent–UI communication.**

- Developed by CopilotKit team with LangGraph, CrewAI, and others.
- **17 event types**: messages, tool calls, state patches, lifecycle signals.
- SSE (Server-Sent Events) streaming over HTTP.
- **Bi-directional state sync** between agent and application.
- **Frontend tool calls**: agent invokes tools integrated in the frontend.
- TypeScript and Python SDKs available.
- Adopted by Oracle (Agent Spec), Microsoft Agent Framework.
- Related specs: A2UI (Google, declarative generative UI), Open-JSON-UI (OpenAI).
- **Repo**: github.com/ag-ui-protocol/ag-ui
- **Docs**: docs.ag-ui.com

### 3.4 assistant-ui

**TypeScript/React library specifically for AI chat interfaces (Y Combinator-backed).**

- `@assistant-ui/react` on npm (v0.12.6).
- Pre-built, customizable React components for chat UI.
- Handles streaming, message rendering, code blocks.
- Used by hundreds of companies.
- 33 repositories in the assistant-ui GitHub org.
- **Repo**: github.com/assistant-ui/assistant-ui

### 3.5 Code Diff Components

| Library | Description | Notes |
|---------|-------------|-------|
| **Monaco Editor** (`@monaco-editor/react`) | VS Code's editor; built-in diff editor | Richest experience, heaviest bundle |
| **CodeMirror 6** (`@codemirror/merge`) | Lightweight code editor with merge/diff extension | Used by bolt.diy; modern, extensible |
| **react-diff-viewer** / `@mutefire/react-diff-viewer` | Simple side-by-side/inline diff component | Original unmaintained; fork active |
| **diff2html** | Converts unified diff to HTML; syntax highlighting via highlight.js | Framework-agnostic; good for displaying git diffs |
| **react-diff-view** | React component for rendering diffs with virtual DOM | Supports inline and side-by-side |

### 3.6 Markdown Rendering for Chat

| Library | Purpose |
|---------|---------|
| **react-markdown** + remark/rehype | Standard React markdown rendering pipeline |
| **Shiki** | Syntax highlighting (used by many modern tools; TextMate grammars) |
| **Prism.js** | Lightweight syntax highlighting |
| **highlight.js** | Used by diff2html and many chat UIs |

### 3.7 Terminal Emulation

| Library | Purpose |
|---------|---------|
| **xterm.js** | Full terminal emulator in the browser (used by bolt.diy, VS Code web) |
| **node-pty** | Pseudo-terminal for Node.js (backend for xterm.js) |

### 3.8 Other Notable Libraries

- **Shiki Magic Move** / **shiki-stream**: Streaming code highlighting for AI chat.
- **TanStack Virtual**: Virtual scrolling for long chat histories.
- **Framer Motion**: Animations for expanding/collapsing sections.

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
| **OpenHands** | Web app (React SPA) | React, FastAPI | VS Code web, xterm.js, Chromium | 65k+ | MIT |
| **bolt.diy** | Web app | React | CodeMirror, xterm.js, WebContainers | ~20k | OSS (StackBlitz) |
| **Cline** | VSCode webview | React (webview) | Custom ChatRow components | ~30k+ | OSS |
| **Roo Code** | VSCode webview | React (webview) | Enhanced Cline components | ~25k+ | OSS |
| **OpenCode** | TUI + Desktop + Web | Go (TUI), Tauri (desktop) | Bubble Tea (TUI), community web UIs | 45k+ | MIT |
| **Goose** | CLI + Electron desktop | Rust (CLI), Electron (desktop) | Custom | ~15k+ | Apache 2.0 |
| **Claudia GUI** | Desktop/web | Unknown | Custom timeline, session management | Newer | OSS |
| **CloudCLI** | Web (responsive) | Web-based | File explorer, terminal, git explorer | Newer | OSS |
| **Devon** | Web + terminal | Python, npx UI | Minimal | ~6k | OSS |
| **claude-code-webui** | Web | Web-based | Streaming chat | Newer | OSS |

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
