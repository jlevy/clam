---
title: Research Brief - ACP + Clam Terminal UI for AI Agents
description: Research on building a graphical UI layer for Claude Code and other agents using ACP semantics with Clam terminal presentation
author: Joshua Levy with LLM assistance
---
# Research: ACP + Clam Terminal UI for AI Coding Agents

**Date:** 2026-02-02 (last updated 2026-02-02)

**Status:** In Progress

## Overview

This research explores how to build a **Clam-native UI layer** for Claude Code (and
other AI coding agents) that combines the **semantic richness of ACP (Agent Client
Protocol)** with the **speed, flexibility, and convenience of a terminal interface**.

The goal is to create a terminal-first experience that provides many of the graphical
elements found in VS Code-style IDEs (expandable/collapsible content, diff views,
permission buttons, plan review panels) while maintaining the terminal’s core
advantages: SSH compatibility, scrollable text history, and instant responsiveness.

### The Core Insight

Most terminal coding agents (Claude Code CLI, Codex CLI, etc.)
try to render everything as raw terminal output or take over the entire screen with a
custom TUI. IDE extensions (VS Code, Cursor) provide rich UI but require a full IDE
environment.

The proposed approach is different: **keep the terminal as a scrollable text buffer
(like xterm) but add selective GUI enhancements** through:

1. **Clickable text elements** that trigger overlays
2. **Expandable/collapsible sections** for details (thinking, diffs, logs)
3. **Popovers and tooltips** for rich content (diff viewers, file previews)
4. **Interactive buttons** for permission prompts

This would work in any terminal with graceful degradation, but provide rich features in
Clam.

## Questions to Answer

1. **What does ACP provide?** What semantic primitives does ACP expose that we can
   render in a terminal UI?

2. **What open-source tooling exists?** Are there ACP clients, adapters, or reference
   implementations we can build on?

3. **What are the viable UI architectures?** Should we build a full takeover UI or a
   scrollback-first approach with overlays?

4. **What is the minimal protocol needed?** How do we map ACP events to Clam escape
   sequences?

5. **What are the key technical risks?** What must we de-risk first?

6. **How does this integrate with existing Clam plans?** How does this fit with the
   Clam-Ghostty spec?

## Scope

**Included:**
- ACP protocol analysis (transport, content model, events)
- Survey of existing open-source ACP tooling
- Comparison of UI architecture approaches
- Protocol design for ACP → Clam mapping
- Technical risk assessment
- Integration considerations with Clam-Ghostty

**Excluded:**
- Full implementation specification (see plan-spec for that)
- Native macOS Ghostty integration details (separate research)
- Non-Claude agents (focus on Claude Code first, extensible to others)

## Findings

### 1. ACP Protocol Semantics

ACP (Agent Client Protocol) is explicitly designed to decouple **agent backends** from
**client UIs** using JSON-RPC over stdin/stdout with streaming notifications and
bidirectional requests.

#### 1.1 Transport Model

ACP clients launch an agent as a subprocess and communicate via stdin/stdout using
NDJSON. The client receives `session/update` notifications to stream UI updates in real
time.

This is ideal for terminal-as-viewport because you can implement the ACP “client” as a
CLI that prints text + Clam codes.

#### 1.2 Content Model: Structured Blocks

ACP uses MCP-style **ContentBlocks**, including:
- `text` - Plain text content
- `image` - Base64-encoded images
- `audio` - Base64-encoded audio
- `resource` - Embedded file content with URI and mimeType

This lets you treat the transcript as **structured events** that can be rendered
minimally in plain terminals but richly in Clam.

#### 1.3 Session Update Events

During a prompt turn, the agent reports output via `session/update` notifications:

| Event Type | Description | UI Mapping |
| --- | --- | --- |
| `plan` | Task plan entries with priority/status | Collapsible plan panel |
| `agent_message_chunk` | Streaming model output | Direct text output |
| `tool_call` | Tool invocation (id/title/kind/status) | Tool card header |
| `tool_call_update` | Progress + completion + content | Tool card updates |

#### 1.4 Tool Call Content Primitives

Tool calls can produce specialized content beyond plain text:
- **Content blocks**: `{ type: "content", ... }`
- **Diffs**: `{ type: "diff", path, oldText, newText }` - First-class diff primitive
- **Terminals**: `{ type: "terminal", terminalId }` - Live terminal output

ACP already includes “UI primitives” that map well to rich terminal widgets.

#### 1.5 Permission Requests

Agents call `session/request_permission` with options (allow once/always, reject
once/always). This is the main “interactive UI” integration point.

In a terminal, render as numbered options.
In Clam, render as clickable buttons in a popover anchored to the tool call line.

#### 1.6 Terminal Capability

If the client advertises `clientCapabilities.terminal = true`, the agent can manage
terminal sessions via:
- `terminal/create` - Spawn command
- `terminal/output` - Poll output
- `terminal/wait_for_exit`, `terminal/release`, etc.

Terminals can be embedded into tool calls for live logs.

### 2. Existing Open-Source Tooling

#### 2.1 Claude Code ACP Adapter (Key Integration Point)

**`zed-industries/claude-code-acp`** is an open-source ACP adapter for Claude Code
intended for ACP-compatible clients like Zed.

This is the critical integration point:
- Clam client speaks **ACP**
- Claude Code is reachable through the **adapter**
- No need to parse Claude Code’s terminal UI

**Repository:** https://github.com/zed-industries/claude-code-acp

#### 2.2 TypeScript ACP Client SDK

GitHub’s docs include a TypeScript example using `@agentclientprotocol/sdk`:
- Spawn ACP server subprocess
- NDJSON stream over stdio
- Implement `sessionUpdate` and handle events

This provides a ready-made skeleton for a Clam-first ACP client.

**Reference:**
https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/acp-server

#### 2.3 Emacs agent-shell (Conceptual Precedent)

`agent-shell` is an Emacs shell that interacts with LLM agents via ACP. It proves that:
- ACP’s event stream can be rendered into a scrollable buffer UI
- Rich expand/collapse and diff experiences work on top of ACP

Conceptually similar to what we want for Clam—except our “buffer” is xterm.js scrollback
with overlays.

**Repository:** https://github.com/xenodium/agent-shell

#### 2.4 Zed Multi-Agent Ecosystem

Zed’s GitHub org has multiple ACP-related repos (`claude-code-acp`, `codex-acp`),
suggesting the pattern “agent CLI ↔ ACP adapter ↔ multiple clients” is already
production-ready.

### 3. UI Architecture Options

#### Option A: Full Takeover UI (VS Code-style)

**Description:** Clam renders a full React app overlay (chat panel, tool cards, diff
views) that “owns” the interaction.
Terminal is mostly transport/fallback.

**Pros:**
- Closest to VS Code UX (diff panels, multi-tabs, rich controls)
- Minimal terminal rendering constraints
- Easy to implement complex widgets and nested expansions

**Cons:**
- Less terminal-native
- SSH compatibility is complex (UI is local, agent is remote)
- Focus/input management becomes a product problem
- Risk of building a mini-editor UI

#### Option B: Scrollback-First + Overlays (Recommended)

**Description:** Base remains **pure xterm.js text scrollback**. Enhancements added
selectively:
- Clickable “expanders” on certain lines
- Hover tooltips
- Popovers for diffs/logs/tool details
- Optional side overlay when needed

Terminal never fully replaced.

**Pros:**
- Extremely terminal-native
- Works beautifully over SSH (remote emits text + escapes, Clam renders locally)
- Minimal engineering: CLI output readable everywhere
- UI is additive, doesn’t fight the terminal

**Cons:**
- True inline fold/unfold that changes scrollback is hard in xterm.js
- Need to design a small UI protocol and reliable anchoring
- “Updating a previous tool card” in scrollback is not straightforward

**Recommendation:** Option B is the better fit given constraints (little engineering,
lots of flexibility, works remotely).

### 4. ACP → Clam Protocol Mapping

#### 4.1 Event Mapping Strategy

| ACP Event | Terminal Rendering | Clam Enhancement |
| --- | --- | --- |
| `agent_message_chunk` | Print text as it streams | Attach metadata to code blocks for hover actions |
| `plan` | Print summary: `▶ Plan (4 steps)` | Click expander → popover with step list, edit input |
| `tool_call` | Print card header: `▶ Tool: Running tests [execute]` | Click → detail panel (status, content, locations) |
| `tool_call_update` | Print new line or keep in overlay only | Update overlay state, status indicators |
| Diff content | Print: `▶ Diff: src/config.json (123 lines)` | Show real diff widget (Monaco or lightweight) |
| Terminal content | Print: `▶ Terminal: npm test (live)` | Show scrollable log view with follow mode |
| `request_permission` | Print numbered options, read stdin | Render buttons in popover, inject selection |

#### 4.2 Proposed Clam UI Protocol

Define a small, stable semantic layer for escape sequences:

**Block Events:**
```typescript
type KuiEvent =
  | { t: "block.start"; id: string; kind: "tool"|"plan"|"diff"|"terminal"; summary: string; data?: unknown }
  | { t: "block.patch"; id: string; patch: unknown }
  | { t: "anchor"; id: string; line: "last"; cols?: [number, number] }
  | { t: "action"; id: string; actionId: string; label: string; inject: string };
```

**Block IDs:**
- Plan block: `plan:<turn>`
- Tool call block: `tool:<toolCallId>`
- Diff content block: `diff:<toolCallId>:<path>`
- Terminal block: `term:<terminalId>`

**Event Types:**
- `ui.block.start` - Create block, attach metadata
- `ui.block.update` - Patch new fields, status changes
- `ui.block.end` - Optional close marker
- `ui.anchor` - Attach block to printed line/column region
- `ui.action` - Declare clickable actions (input injection)

#### 4.3 Payload Sizing

Keep SSH-friendly by putting small metadata inline; for large payloads (diff text,
logs):
- Set `maxInlinePayloadBytes` (e.g., 64KB)
- If exceeded, show summary only
- User can request “expand” which prints full payload as text

### 5. Technical Risks and De-risking Priorities

#### 5.1 ACP Ordering + Partial Updates (Medium Risk)

Tool calls arrive as create → multiple patches.
Must implement correct merge semantics and tolerate out-of-order content, missing
fields.

**De-risk:** Build minimal state store early, test with real Claude Code output.

#### 5.2 Anchoring Overlays to xterm.js Lines (High Risk - Clam-specific)

Design depends on: “This summary line corresponds to a stable on-screen anchor.”
Scrolling and reflow make this tricky.

**Solutions:**
1. Anchor by terminal buffer marker (xterm.js markers)
2. Anchor by row/col snapshot, update on scroll
3. Anchor by DOM hit-testing on click

**De-risk:** Prototype anchoring with simple tooltip first.

#### 5.3 Inline Expand/Collapse (High Complexity - Avoid Initially)

True folding (hiding lines already written) requires re-rendering buffer from own
transcript model or hacking xterm internals.

**Recommendation:** Avoid initially.
Use overlays/popovers for drill-in.
Print “expanded content” as new lines if needed.

#### 5.4 Permission UI (Critical - Must be Rock-Solid)

`session/request_permission` gates safety and workflow.
Need:
- Clear display of what’s being allowed/rejected
- Reliable input mapping
- Safe default behavior

**De-risk:** Implement this first after basic streaming works.

#### 5.5 Terminal Capability (Medium Risk)

If advertising `terminal: true`, must safely run commands with:
- cwd restrictions
- Confirmation for destructive commands
- Output byte limits

**De-risk:** Start with terminal capability disabled, add later.

#### 5.6 Security: Escape Sequence Injection (Critical)

Rendering agent-provided text while parsing escape sequences creates injection risk.

**Mitigations:**
- Never treat agent text as control sequences
- Strictly parse Clam codes (ignore unknown)
- Sanitize markdown/HTML in overlays

### 6. Integration with Clam-Ghostty Plans

The ACP client fits naturally into the Clam-Ghostty architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Clam Application                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  clam-acp CLI                                                 │  │
│  │  - ACP client that prints text + Clam codes                   │  │
│  │  - State store for session, tool calls, permissions           │  │
│  │  - Runs inside terminal session (local or SSH)                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Clam Terminal (ghostty-web + Clam Features)                  │  │
│  │  - Clam escape sequence parser                                │  │
│  │  - Overlay manager (tooltips, popovers, diff viewers)         │  │
│  │  - Input injector (button click → inject selection)           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Integration Points:**

1. **Phase 2 of Clam-Ghostty** (Clam Codes Protocol) provides the overlay infrastructure
2. **Phase 3** (Collapsible Blocks) directly supports the expand/collapse needs
3. The `clam-acp` CLI is a new component that uses these features

### 7. Emulating VS Code Features

The scrollback-first approach can emulate most VS Code Claude Code extension features:

| VS Code Feature | Terminal Approach |
| --- | --- |
| **Plan review** | Render `plan` block as collapsible overlay with approve/feedback prompt |
| **Diff review + permission** | Show diff overlay tied to tool_call + permission options |
| **Multiple conversations** | Multiple sessions in different Clam tabs |
| **Command menu / slash** | Popover "command palette" that prints `/…` commands to CLI |
| **@-mentions with ranges** | Could extend protocol for file/line references |

The key insight: ACP already provides most of the “semantic surface area” needed.

## Options Considered

### Option A: Full ACP GUI Client

**Description:** Build a complete React-based GUI that renders ACP events in a dedicated
panel, similar to VS Code extensions.

**Pros:**
- Full control over UI layout and interactions
- No terminal rendering constraints
- Can implement complex nested UIs easily

**Cons:**
- Significant engineering effort
- Less terminal-native (feels like using an IDE)
- SSH workflow requires complex tunneling or local-only use
- Duplicates work better done in actual IDEs

### Option B: Scrollback-First Terminal + Clam Overlays (Recommended)

**Description:** Build a lightweight ACP client that outputs to terminal with Clam
escape codes. Rich features via overlays.

**Pros:**
- Terminal-native UX
- Works over SSH (remote CLI emits codes, local Clam renders)
- Minimal engineering (most work is in existing Clam infrastructure)
- Graceful degradation to plain terminals
- Leverages existing Clam Codes protocol

**Cons:**
- True inline folding is complex
- Some VS Code features may not translate directly
- Requires careful protocol design

### Option C: Hybrid (Minimal GUI + Terminal Core)

**Description:** Terminal for main output, with a small persistent sidebar/panel for
status, history, and controls.

**Pros:**
- Balance of terminal speed and GUI convenience
- Clear separation of concerns

**Cons:**
- Two UI paradigms to maintain
- Focus management between terminal and panel
- More complex than pure terminal approach

## Recommendations

**Primary Recommendation: Option B (Scrollback-First + Clam Overlays)**

This approach provides the best balance of:
- **Speed/flexibility**: Terminal remains the core interaction model
- **Rich features**: Overlays enable diffs, permissions, expandable content
- **SSH compatibility**: Works remotely without modification
- **Engineering efficiency**: Builds on existing Clam infrastructure

**Implementation Strategy:**

1. **Phase 1: Minimal ACP Client**
   - Build `clam-acp` CLI using `@agentclientprotocol/sdk`
   - Connect to Claude Code via `claude-code-acp` adapter
   - Print streaming text + simple Clam codes for tool headers
   - Implement permission prompts (text fallback + Clam buttons)

2. **Phase 2: Rich Overlays**
   - Add diff content rendering (summary line + overlay viewer)
   - Add terminal output streaming (summary line + log popover)
   - Add plan review (collapsible overlay with feedback input)

3. **Phase 3: Collapsible Blocks**
   - Leverage Clam-Ghostty Phase 3 collapsible blocks
   - Integrate thinking/reasoning collapse
   - Support nested tool call details

**Protocol Decision:**

Use **one-way rendering with input injection** for actions.
This keeps SSH compatibility as the default:
- Remote CLI prints escape sequences
- Clam (local) interprets them
- User clicks UI → Clam injects input → remote CLI receives normally

Avoid side-channel protocols unless explicitly needed for local-only features.

## Next Steps

### Immediate (Validated by Research)

- [x] Verify `claude-code-acp` adapter compatibility - **Confirmed working** (Zed uses
  it, Toad connects to it)
- [ ] Study Toad’s ACP client implementation in `repos/toad/src/toad/acp/`
- [ ] Study OpenCode’s auto-scroll implementation in `repos/opencode/packages/ui/`
- [ ] Prototype minimal ACP client using `@agentclientprotocol/sdk`

### Short-term

- [ ] Design KUI (Clam UI) escape sequence specification
- [ ] Implement permission prompt UI as first rich feature
- [ ] Add tab completion for slash commands (reference: Toad’s `slash_command.py`)
- [ ] Coordinate with Clam-Ghostty Phase 2/3 for overlay infrastructure

### Medium-term

- [ ] Implement diff overlay viewer (reference: Toad’s `diff_view.py`)
- [ ] Add block cursor navigation (reference: Toad’s `Cursor` widget)
- [ ] Test SSH workflow end-to-end
- [ ] Session persistence and resume

## References

### ACP Protocol Documentation

- [ACP Protocol Overview](https://agentclientprotocol.com/protocol/overview)
- [ACP Architecture](https://agentclientprotocol.com/get-started/architecture)
- [ACP Content Model](https://agentclientprotocol.com/protocol/content)
- [ACP Prompt Turn Events](https://agentclientprotocol.com/protocol/prompt-turn)
- [ACP Tool Calls](https://agentclientprotocol.com/protocol/tool-calls)
- [ACP Terminals](https://agentclientprotocol.com/protocol/terminals)

### Open Source Repositories

- [claude-code-acp](https://github.com/zed-industries/claude-code-acp) - ACP adapter for
  Claude Code
- [agent-shell](https://github.com/xenodium/agent-shell) - Emacs ACP client
- [Zed Industries repos](https://github.com/orgs/zed-industries/repositories) -
  Multi-agent ACP ecosystem

### Related Clam Documents

- [Clam-Ghostty Plan Spec](../specs/active/plan-2026-02-02-clam-rich-terminal.md) -
  Implementation plan for Clam terminal
- [Draft Notes: Clam ACP](./draft-notes-clam-acp.md) - Initial exploration notes

### VS Code Claude Code Reference

- [Claude Code VS Code Extension](https://code.claude.com/docs/en/vs-code) - Feature
  reference
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
  \- Extension listing

* * *

## Appendix: Open Source Reference Implementations

This section catalogs open source projects relevant to Phase 5 of the Clam-Ghostty spec
(Native Agent Client).
These repositories provide reference implementations for UI patterns, protocol handling,
and agent architecture.

### A.1 VSCode/IDE Extensions (Highly Relevant for UI Patterns)

These projects demonstrate how to build rich UI for AI coding agents.
Study their component architecture, state management, and interaction patterns.

| Project | Repository | Key Insights |
| --- | --- | --- |
| **Cline** | [github.com/cline/cline](https://github.com/cline/cline) | Most popular open-source agent (4M+ users). Plan/Act modes, MCP integration, terminal-first workflows. Created by Saoud Rizwan. Apache 2.0. |
| **Roo Code** | [github.com/RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code) | Fork of Cline with multi-agent workflows, Custom Modes (security reviewer, test engineer, etc.), and UI upgrades. Apache 2.0. |
| **Continue.dev** | [github.com/continuedev/continue](https://github.com/continuedev/continue) | Leading open-source AI code assistant. TypeScript architecture with clear core/gui/extensions separation. Agent Mode for multi-file operations. Apache 2.0. |
| **Void IDE** | [github.com/voideditor/void](https://github.com/voideditor/void) | Open-source Cursor alternative, Y Combinator backed. VSCode fork with AI-centric features. Privacy-focused. |
| **Claudix** | [github.com/Haleclipse/Claudix](https://github.com/Haleclipse/Claudix) | VSCode extension bringing Claude Code into editor. Vue 3 + TypeScript. Conversation history, tool integration. |
| **Claude Code Chat** | [github.com/andrepimenta/claude-code-chat](https://github.com/andrepimenta/claude-code-chat) | Clean chat interface using Claude Code SDK. Good reference for minimal UI. |

**Relevance to Clam:** These projects show UI patterns for:
- Tool call visualization (collapsible cards, status indicators)
- Permission prompts (accept/reject buttons, scope options)
- Diff display (inline, side-by-side)
- Session/conversation management
- Context window indicators

### A.2 ACP Protocol Implementations (Critical for Protocol Integration)

These implement the Agent Client Protocol, which Clam can use to communicate with Claude
Code and other agents.

| Project | Repository | Key Insights |
| --- | --- | --- |
| **ACP Spec** | [github.com/agentclientprotocol/agent-client-protocol](https://github.com/agentclientprotocol/agent-client-protocol) | Official protocol spec. JSON-RPC 2.0 based. TypeScript and Rust SDKs. Apache 2.0. |
| **claude-code-acp** | [github.com/zed-industries/claude-code-acp](https://github.com/zed-industries/claude-code-acp) | **Critical.** Official Claude Code ACP adapter by Zed. Uses Claude Agent SDK. Apache 2.0. |
| **acp-claude-code** | [github.com/Xuanwo/acp-claude-code](https://github.com/Xuanwo/acp-claude-code) | Alternative ACP implementation for Claude Code. |

**Relevance to Clam:** The `claude-code-acp` adapter is the integration point.
Clam can build an ACP client that:
1. Spawns Claude Code via the adapter
2. Receives `session/update` events (streaming text, tool calls, diffs)
3. Renders to terminal + Clam overlays
4. Handles `session/request_permission` with Clam buttons

### A.3 Terminal-Based AI Agents (Architecture Reference)

These are terminal-native AI agents that demonstrate TUI patterns, session management,
and tool execution workflows.

| Project | Repository | Key Insights |
| --- | --- | --- |
| **Aider** | [github.com/Aider-AI/aider](https://github.com/Aider-AI/aider) | Python terminal agent with automatic git commits, repo map, voice input. Very popular, works with many LLMs. |
| **OpenCode** | [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode) | **Highly relevant.** Go-based TUI using Bubble Tea. Client/server architecture. ACP support. SQLite sessions. 70k+ stars. |
| **Goose** | [github.com/block/goose](https://github.com/block/goose) | Block's open-source agent. Rust + Electron. MCP integration. Parallel sessions via goose-acp. Apache 2.0. |

**OpenCode Deep Dive:**

OpenCode is particularly relevant because it demonstrates a modern TUI architecture that
could inform Clam’s agent client:

- **Bubble Tea TUI**: Go library for rich terminal interfaces (interactive widgets, key
  bindings)
- **Client/Server Split**: HTTP server + TUI client allows remote control
- **LSP Integration**: Language Server Protocol for code intelligence
- **Session Persistence**: SQLite for conversation history

Study: `github.com/opencode-ai/opencode` architecture for TUI patterns.

### A.4 Emacs/Editor Integrations

| Project | Repository | Key Insights |
| --- | --- | --- |
| **agent-shell** | [github.com/xenodium/agent-shell](https://github.com/xenodium/agent-shell) | Emacs shell for ACP agents. Proves ACP event stream can render to scrollable buffer UI with expand/collapse. Conceptual precedent for Clam approach. |
| **Aidermacs** | [github.com/MatthewZMD/aidermacs](https://github.com/MatthewZMD/aidermacs) | Emacs integration for Aider with ediff interface for AI-modified files. |

### A.5 Curated Lists & Resources

| Resource | URL | Description |
| --- | --- | --- |
| **awesome-claude-code** | [github.com/hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Curated list of Claude Code skills, hooks, slash-commands, and plugins. |
| **awesome-cursorrules** | [github.com/PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) | Configuration patterns for Cursor AI. Useful for understanding agent customization. |
| **vibe-tools** | [github.com/eastlondoner/vibe-tools](https://github.com/eastlondoner/vibe-tools) | CLI tools for Cursor Composer Agent. Supports Claude Code, Codex, Windsurf, Cline, Roo. |

### A.6 Terminal Emulators with Rich UI

These terminals have features that could inform Clam’s overlay architecture:

| Project | Repository | Key Insights |
| --- | --- | --- |
| **Ghostty** | [github.com/ghostty-org/ghostty](https://github.com/ghostty-org/ghostty) | Clam's foundation. Terminal inspector, libghostty for embedding. Zig/Metal/Vulkan. |
| **WezTerm** | [github.com/wez/wezterm](https://github.com/wez/wezterm) | Lua scripting, multiplexing, WebGPU. Highly programmable. |
| **Kitty** | [github.com/kovidgoyal/kitty](https://github.com/kovidgoyal/kitty) | Kitty graphics protocol, "kittens" tooling ecosystem. |

### A.7 Recommended Study Order

For Phase 5 implementation, study these repositories in order:

1. **ACP Protocol Spec** - Understand the protocol semantics
2. **claude-code-acp** - The critical integration adapter
3. **Continue.dev** - Clean TypeScript architecture, gui/core separation
4. **Cline** - UI patterns for tool calls, permissions, diffs
5. **OpenCode** - TUI architecture patterns (if building pure terminal features)
6. **agent-shell** - Scrollback-first approach validation

### A.8 Code Patterns to Extract

From these repositories, extract patterns for:

| Pattern | Source Repository | Files to Study |
| --- | --- | --- |
| Tool call state machine | Cline, Continue | State management for pending/running/completed |
| Permission prompt UI | Cline, Roo Code | Button rendering, keyboard shortcuts |
| Diff visualization | Continue, Void | Monaco integration, unified/split view |
| Session persistence | OpenCode | SQLite schema, resume logic |
| ACP event handling | agent-shell | Event loop, streaming updates |
| Collapsible sections | Cline | Expand/collapse with animation |

### A.9 Licensing Summary

All recommended repositories use permissive open-source licenses:

| License | Projects |
| --- | --- |
| **Apache 2.0** | ACP, claude-code-acp, Continue, Cline, Roo Code, Goose |
| **MIT** | Various smaller projects |
| **Apache/MIT dual** | Some Rust projects |

This allows free use, modification, and integration into Clam.

* * *

## Appendix B: Rich GUI Constructs in Terminal Implementations

This section analyzes how existing terminal-based tools implement rich GUI features
similar to what Clam Codes aims to provide (overlays, tooltips, collapsible blocks,
images, etc.).

### B.1 Wave Terminal (Most Relevant Open Source Reference)

**Repository:**
[github.com/wavetermdev/waveterm](https://github.com/wavetermdev/waveterm) **License:**
Apache 2.0

Wave Terminal is the **most feature-rich open source terminal** for GUI constructs and
should be studied closely for Clam’s implementation.

| Feature | Implementation | Clam Relevance |
| --- | --- | --- |
| **Collapsible JSON tree view** | Inline rendering with expand/collapse | Direct precedent for collapsible blocks |
| **Markdown preview** | Rich rendering of `.md` files | Pattern for rich content display |
| **Image/video/PDF preview** | Embedded viewers in terminal blocks | Pattern for media overlays |
| **Monaco editor embedded** | Full CodeMirror-like editor in blocks | Pattern for code editing overlays |
| **Chromium web blocks** | Embedded browser alongside terminal | **Critical** - validates web overlay approach |
| **Command blocks** | Isolated command+output grouping | Similar to Clam's tool call visualization |
| **CSV table view** | Interactive grid with cell selection | Pattern for structured data display |

**Key Architecture Insight:** Wave uses a **block-based** architecture where different
content types (terminal, editor, browser, preview) coexist in the same interface.
This validates Clam’s overlay approach.

**Study:** Wave’s block management system, file preview rendering, and Chromium
integration.

### B.2 Warp Terminal (Closed Source, but Conceptual Reference)

**Status:** Closed source (planning to open-source Rust UI framework) **Documentation:**
[docs.warp.dev/terminal/blocks](https://docs.warp.dev/terminal/blocks)

Warp pioneered the **block-based terminal** concept:

| Feature | Description | Clam Comparison |
| --- | --- | --- |
| **Command blocks** | Every command+output is grouped atomically | Similar to Clam tool call cards |
| **Block sharing** | Share specific blocks with team | Session export potential |
| **AI integration** | Context-aware command suggestions | Agent client integration |
| **IDE-like input** | Multiple cursors, syntax highlighting | Enhanced input editing |

**Limitation:** Closed source means we can’t study implementation details, but the UX
concepts are valuable references.

### B.3 xterm.js Overlay & Decoration Support

**Repository:** [github.com/xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)
**Documentation:**
[xtermjs.org/docs](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)

Since Clam builds on ghostty-web (which has xterm.js-compatible APIs), understanding
xterm.js overlay capabilities is essential.

| Feature | API | Notes |
| --- | --- | --- |
| **Link hover tooltips** | `linkHandler` option (v5.0+) | Create DOM element in `Terminal.element`, add `xterm-hover` class |
| **Decorations** | `registerDecoration()` | Monaco-like decorations for buffer ranges |
| **OSC 8 hyperlinks** | Built-in with custom handlers | Security: must handle untrusted URLs carefully |
| **Custom glyphs** | `customGlyphs` option | Block elements, box drawing |

**Creating Custom Tooltips in xterm.js:**
```typescript
// linkHandler option for custom hover behavior
terminal.options.linkHandler = {
  activate: (event, text, range) => { /* handle click */ },
  hover: (event, text, range) => { /* show tooltip */ },
  leave: (event, text, range) => { /* hide tooltip */ }
};

// Add xterm-hover class to tooltip element to prevent mouse event passthrough
const tooltip = document.createElement('div');
tooltip.className = 'xterm-hover';
terminal.element.appendChild(tooltip);
```

**Relevance to Clam:** ghostty-web likely has similar or compatible APIs.
Verify and extend as needed for Clam Codes.

### B.4 Textual (Python TUI Framework)

**Repository:** [github.com/Textualize/textual](https://github.com/Textualize/textual)
**Documentation:** [textual.textualize.io](https://textual.textualize.io/)

Textual demonstrates what’s possible with rich TUI without web overlays:

| Widget | Description | Clam Pattern |
| --- | --- | --- |
| **Collapsible** | Expand/collapse container with customizable symbols | Direct model for collapsible blocks |
| **ModalScreen** | Overlay screen with alpha background showing content beneath | Pattern for permission prompts |
| **TreeView** | Hierarchical expand/collapse | Pattern for nested content |
| **DataTable** | Scrollable tables with selection | Pattern for structured output |

**Collapsible Widget Pattern:**
```python
# Textual's Collapsible widget (conceptual TypeScript translation)
interface CollapsibleOptions {
  collapsed: boolean;          // Initial state
  collapsed_symbol: string;    // e.g., "▶"
  expanded_symbol: string;     // e.g., "▼"
  title: string;
}
```

**Key Insight:** Textual’s Collapsible widget fires events (`on_collapsible_collapsed`,
`on_collapsible_expanded`) that can be handled by parent widgets.
Clam should adopt similar event patterns.

### B.5 Rich (Python Terminal Formatting Library)

**Repository:** [github.com/Textualize/rich](https://github.com/Textualize/rich)
**Documentation:** [rich.readthedocs.io](https://rich.readthedocs.io/)

Rich is primarily for static rendering but provides useful patterns:

| Feature | API | Clam Use |
| --- | --- | --- |
| **Tree view** | `Tree` class with `add()` method | Hierarchical tool output |
| **Panels** | `Panel` with borders, titles | Tool call cards |
| **Tables** | `Table` with column alignment | Structured data display |
| **Syntax highlighting** | `Syntax` class | Code block rendering |
| **Progress bars** | `Progress` with tasks | Long-running operation feedback |
| **Live display** | `Live` context manager | Real-time updates |

**OSC 8 Hyperlink Support:** Rich has supported OSC 8 hyperlinks since May 2020, making
terminal text clickable in supported terminals.

### B.6 OpenCode TUI Architecture

**Repository:**
[github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode)

OpenCode’s TUI architecture provides patterns for AI agent interfaces:

| Feature | Implementation | Notes |
| --- | --- | --- |
| **Collapsible sidebar** | State-managed visibility | Shows when >2 MCP servers configured |
| **OSC 11 theme detection** | Background color query | Auto dark/light mode |
| **Kitty keyboard protocol** | Enhanced key events | Better keyboard handling |
| **OSC 52 clipboard** | System clipboard access | Copy/paste integration |
| **60 FPS rendering** | Optimized render loop | Smooth animations |
| **Client/server split** | HTTP + TUI | Remote control capability |

**Bubble Tea Architecture:**
```
Model (state) → Update (handle messages) → View (render)
```

This Elm-architecture pattern is clean and could inform Clam’s overlay state management.

### B.7 Terminal Graphics Protocols

For image display, multiple protocols exist with varying support:

| Protocol | Terminals | Quality | Notes |
| --- | --- | --- | --- |
| **Kitty Graphics** | Kitty, Ghostty | Excellent | Full color, animations |
| **iTerm2 Protocol** | iTerm2, WezTerm | Excellent | Base64 encoded |
| **Sixel** | Many older terminals | Good (palette-limited) | 0-100 color range |

**Claude Code Feature Request:** There’s an
[open issue](https://github.com/anthropics/claude-code/issues/2266) requesting terminal
graphics support in Claude Code for displaying charts, diagrams, and plots inline.

**Relevance to Clam:** Clam could support Kitty Graphics Protocol for image display in
tool outputs (e.g., matplotlib plots, architecture diagrams).

### B.8 Feature Comparison Matrix

| Feature | Wave | Warp | xterm.js | Textual | OpenCode | Clam (Planned) |
| --- | --- | --- | --- | --- | --- | --- |
| **Collapsible blocks** | ✅ JSON tree | ✅ Blocks | ❌ | ✅ Widget | ✅ Sidebar | ✅ Phase 3 |
| **Tooltips on hover** | ❌ | ❌ | ✅ linkHandler | ❌ | ❌ | ✅ Phase 2 |
| **Web overlays/popovers** | ✅ Chromium | ❌ | ❌ | ❌ | ❌ | ✅ Phase 2 |
| **Inline images** | ✅ Preview | ❌ | ❌ | ❌ | ❌ | ⚡ Future |
| **Embedded editor** | ✅ Monaco | ✅ IDE-like | ❌ | ❌ | ❌ | ⚡ Phase 5 |
| **Diff viewer** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Phase 5 |
| **Modal dialogs** | ❌ | ❌ | ❌ | ✅ ModalScreen | ❌ | ✅ Permissions |
| **Block-based output** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ Tool cards |
| **OSC 8 hyperlinks** | ✅ | ✅ | ✅ | ✅ Rich | ✅ | ✅ KRI |
| **Open source** | ✅ Apache | ❌ | ✅ MIT | ✅ MIT | ✅ | ✅ |

### B.9 Key Takeaways for Clam Implementation

1. **Wave Terminal is the best reference** for rich GUI in terminals.
   Study its:
   - Block management system
   - Chromium web block integration
   - File preview rendering pipeline

2. **xterm.js provides overlay primitives** that ghostty-web likely inherits:
   - `linkHandler` for custom hover behavior
   - DOM elements with `xterm-hover` class
   - Decoration API for buffer annotations

3. **Textual’s Collapsible widget** is a clean model for Phase 3:
   - Customizable expand/collapse symbols
   - Event-driven state changes
   - Parent widget notification

4. **No existing terminal does web overlays like Clam plans** (except Wave’s Chromium
   blocks). This is Clam’s unique value proposition - bringing IDE-like overlays to a
   terminal-first experience.

5. **OpenCode’s architecture** validates the client/server split for AI agents, which
   could enable remote Clam scenarios.

### B.10 Repositories to Clone and Study

For Phase 5 implementation, clone and study these codebases:

```bash
# Wave Terminal - Most comprehensive rich terminal features
git clone https://github.com/wavetermdev/waveterm

# Textual - Clean Collapsible widget implementation
git clone https://github.com/Textualize/textual

# xterm.js - Overlay and decoration APIs
git clone https://github.com/xtermjs/xterm.js

# OpenCode - Modern AI agent TUI patterns
git clone https://github.com/opencode-ai/opencode

# Cline - VSCode extension UI patterns
git clone https://github.com/cline/cline
```

Focus on:
- `wavetermdev/waveterm` → `pkg/waveobj/`, `pkg/blockcontroller/`, `frontend/`
- `Textualize/textual` → `src/textual/widgets/_collapsible.py`
- `xtermjs/xterm.js` → `src/browser/Linkifier2.ts`, `src/browser/Decorations/`
- `opencode-ai/opencode` → TUI components and state management

* * *

## Appendix C: Adoption, Momentum & Market Context

This section provides historical context, adoption metrics, and growth trajectories to
help prioritize which projects to study and potentially integrate with.

### C.1 Market Context (2025-2026)

The AI coding tools market provides important context for Clam’s positioning:

| Metric | Value | Source |
| --- | --- | --- |
| **Global market size (2025)** | $4.8 billion | Industry analysts |
| **Projected market (2030)** | $17.2 billion (35% CAGR) | Industry analysts |
| **Developer AI adoption** | 85% use AI tools regularly | 2025 surveys |
| **Code AI-generated** | 41% of all code globally | GitHub/Stack Overflow |
| **Top 3 market share** | 70%+ (Copilot, Cursor, Claude) | CB Insights |

**Market Leaders (by revenue):**
1. **GitHub Copilot** - 42% market share, 20M+ users, 90% of Fortune 100
2. **Cursor** - 18% market share, $1B+ ARR, $9.9B valuation
3. **Claude Code** - Part of top 3, crossed $1B ARR threshold

### C.2 Open Source Project Adoption Metrics

#### Cline (Most Popular Open Source Agent)

| Metric | Value | Notes |
| --- | --- | --- |
| **GitHub Stars** | ~25,000+ | Rapidly growing |
| **VS Code Installs** | **5 million** (Jan 2026) | 2M in July 2025 → 5M in 6 months |
| **User Base** | 4M+ developers | Across VS Code, JetBrains, Cursor, Windsurf |
| **Founded** | 2025 | By Saoud Rizwan |
| **License** | Apache 2.0 | Fully open source |

**Growth Trajectory:** Cline achieved explosive growth from launch to 5M installs in
under 12 months. It’s now the de facto standard for open-source AI coding agents.

**Fork Ecosystem:** Cline’s success spawned forks:
- **Roo Code** - Added multi-agent workflows, renamed from “Roo Cline”
- **Kilo Code** - Raised $8M (Dec 2025), targeting “agentic engineering platform”

**What Users Use It For:**
- Autonomous multi-file edits with approval
- Terminal command execution
- MCP tool integration
- Plan/Act mode workflow (pioneered by Cline)

#### Continue.dev

| Metric | Value | Notes |
| --- | --- | --- |
| **GitHub Stars** | **26,000+** | 5x growth in 2 years |
| **Discord Members** | 750+ (Nov 2023) → thousands | Active community |
| **VS Code Downloads** | 30,000 (Nov 2023) → hundreds of thousands | Significant growth |
| **Founded** | 2023 (YC S23) | By Ty Dunn and Nate Sesti |
| **Funding** | YC + Heavybit (Jesse Robbins) | Angels from Hugging Face, Mesosphere |
| **Pricing** | Free (Solo), $10/dev (Teams) | Very accessible |

**Growth Trajectory:** ~5,000 stars (Nov 2023) → 26,000+ stars (late 2025) = **5x growth
in 2 years**.

**What Users Use It For:**
- Model-agnostic AI assistance (GPT-4, Claude, Gemini, local LLMs)
- MCP integration (GitHub, Sentry, Snyk, Linear)
- Agent Mode for multi-file operations
- Enterprise deployments with self-hosted models

#### OpenCode (Fastest Growing Terminal Agent)

| Metric | Value | Notes |
| --- | --- | --- |
| **GitHub Stars** | **45,000+** | +30k in first month |
| **Monthly Active Users** | **650,000** | In 5 months |
| **Contributors** | 500+ | Very active community |
| **Founded** | June 2025 | By SST team (Jay, Frank, Dax Raad, Adam Elmore) |
| **Funding** | Undisclosed round | Post-launch funding secured |
| **Background** | SST (25k stars, profitable 2025) | YC-backed serverless framework |

**Growth Trajectory:** 0 → 650k MAU in 5 months = **one of fastest adoption curves in
developer tooling history**.

**Why It Grew So Fast:**
- Built by trusted SST team (established open source reputation)
- Terminal-first design (years of TUI experimentation)
- Provider-agnostic (Claude, OpenAI, Google, local models)
- Client/server architecture enables unique workflows

**What Users Use It For:**
- Terminal-based AI coding (preferred over IDE extensions by some)
- Remote development workflows
- Local model experimentation

#### Aider

| Metric | Value | Notes |
| --- | --- | --- |
| **GitHub Stars** | 20,000+ | Steady growth |
| **User Sentiment** | "Quadrupled productivity" | Developer reviews |
| **Model Support** | Claude 3.7, DeepSeek, OpenAI, local | Very flexible |
| **License** | Apache 2.0 | Fully open source |

**What Users Use It For:**
- Git-native AI coding with automatic commits
- Multi-file editing with repo map context
- Enterprise hybrid deployments (sensitive projects on-prem)
- Voice-driven coding

#### Goose (Block/Square)

| Metric | Value | Notes |
| --- | --- | --- |
| **GitHub Stars** | **27,000+** | At launch |
| **Community Contributors** | Dozens external | 6 months post-launch |
| **Enterprise Adopters** | Databricks, startups, universities | Rapid enterprise uptake |
| **Founded** | January 2025 | By Block (Square, Cash App, Afterpay) |
| **Foundation** | **Linux Foundation AAIF** | Dec 2025 - alongside MCP, AGENTS.md |
| **Funding Program** | Goose Grant Program | Block funds external innovators |

**Significance:** Goose joining the Linux Foundation’s Agentic AI Foundation (alongside
Anthropic’s MCP and OpenAI’s AGENTS.md) signals it’s becoming industry infrastructure,
not just a tool.

**What Users Use It For:**
- Full autonomous task completion (build projects from scratch)
- MCP server integration (enterprise tool connectivity)
- Internal tooling at Block

### C.3 Protocol & Framework Adoption

#### Agent Client Protocol (ACP)

| Metric | Value | Notes |
| --- | --- | --- |
| **Supported Editors** | Zed, Neovim, Marimo | + JetBrains coming |
| **Supported Agents** | Claude Code, Codex CLI, Gemini, Goose, StackPack | Growing |
| **Launch** | August 2025 | By Zed |
| **Backing** | Google (Gemini CLI reference impl) | Strong industry support |

**Trajectory:** ACP is following the LSP (Language Server Protocol) playbook - if
adoption continues, “supports ACP” may become table stakes for editors and AI tools.

**Key Milestone:** Zed refactored their own AI assistant to use ACP internally, ensuring
first-party feature parity with external agents.

#### Textual (Python TUI Framework)

| Metric | Value | Notes |
| --- | --- | --- |
| **Rich library stars** | 40,000+ | Used by pip |
| **Textual stars** | ~20,000 | In <2 years |
| **Creator** | Will McGugan | Textualize founder |
| **Company Status** | Textualize closed | Community continues |

**Recent Development (July 2025):** Will McGugan built “Toad” prototype for
terminal-based AI coding after noting Claude Code and Gemini CLI “suffer from jank that
Textualize solved years ago.”
This validates the opportunity for better terminal AI UX.

### C.4 Project Momentum Summary

| Project | Stars | Growth | Funding | Momentum | Priority for Clam |
| --- | --- | --- | --- | --- | --- |
| **Cline** | 25k+ | 🚀 Explosive | Community | ⬆️ Very High | Study UI patterns |
| **OpenCode** | 45k+ | 🚀 Explosive | VC-backed | ⬆️ Very High | Study TUI architecture |
| **Continue.dev** | 26k+ | 📈 Strong | YC-backed | ⬆️ High | Study core/gui separation |
| **Goose** | 27k+ | 📈 Strong | Block + Linux Foundation | ⬆️ High | Study MCP patterns |
| **Aider** | 20k+ | 📈 Steady | Community | ➡️ Medium | Study terminal UX |
| **Wave Terminal** | ~10k | 📈 Steady | VC-backed | ⬆️ High | Study rich UI architecture |
| **Textual** | 20k+ | 📈 Steady | (Textualize closed) | ➡️ Medium | Study widget patterns |
| **ACP** | N/A | 📈 Growing | Zed + Google | ⬆️ Very High | **Critical integration** |

### C.5 Key Takeaways for Clam Strategy

1. **The open source AI coding market is massive and growing fast.**
   - Cline went 0 → 5M installs in ~12 months
   - OpenCode went 0 → 650k MAU in 5 months
   - There’s clear demand for alternatives to closed-source tools

2. **Terminal-first is a viable strategy.**
   - OpenCode’s success proves terminal-based AI agents can compete
   - Aider maintains strong adoption despite being terminal-only
   - Will McGugan’s “Toad” prototype shows terminal UX innovation opportunity

3. **ACP is becoming the standard protocol.**
   - Multiple editors (Zed, Neovim, JetBrains coming)
   - Multiple agents (Claude Code, Gemini, Goose, Codex)
   - Google and Zed backing provides credibility
   - Clam should prioritize ACP integration

4. **Rich terminal UI is underexplored.**
   - Wave Terminal has rich features but isn’t focused on AI agents
   - Most AI agents have minimal terminal UI
   - Clam’s overlay approach is differentiated

5. **Study these codebases in priority order:**
   1. **ACP protocol** - The integration standard
   2. **Cline** - UI patterns, most popular agent
   3. **OpenCode** - TUI architecture, fastest growing
   4. **Wave Terminal** - Rich terminal features
   5. **Continue.dev** - Clean architecture patterns

### C.6 Historical Timeline

| Date | Event |
| --- | --- |
| **2021** | Rich library reaches 40k+ GitHub stars |
| **2021** | SST goes through Y Combinator |
| **2023 (Aug)** | Continue.dev launches (YC S23) |
| **2023 (Nov)** | Continue.dev: 5k stars, 30k VS Code downloads |
| **2025 (Jan)** | Cline launches AI engineer extension |
| **2025 (Jan)** | Goose released by Block |
| **2025 (Jun)** | OpenCode launches (0 → 30k stars in month 1) |
| **2025 (Jul)** | Cline reaches 2M downloads |
| **2025 (Aug)** | ACP launched by Zed with Gemini CLI |
| **2025 (Sep)** | Claude Code beta support added to Zed via ACP |
| **2025 (Oct)** | Cline, Continue, Codex, Roo Code among top 6 agentic VSCode extensions |
| **2025 (Nov)** | OpenCode reaches 650k MAU |
| **2025 (Dec)** | Kilo Code raises $8M |
| **2025 (Dec)** | Linux Foundation forms AAIF with MCP, Goose, AGENTS.md |
| **2025 (Dec)** | OpenCode reaches 45k stars |
| **2026 (Jan)** | Cline reaches 5M installs |
| **2026 (Jan)** | Market crystallizes: Copilot (42%), Cursor (18%), Claude Code (top 3) |
| **2026 (Jan)** | Toad (Will McGugan) releases terminal ACP client |

* * *

## Appendix D: Scrollable ACP Clients - Deep Dive

This appendix analyzes ACP clients and their scrolling implementations, with a focus on
finding clients that use **true terminal scrollback** rather than **TUI re-rendering**.

### D.1 The Scrollable UI Problem - CRITICAL REQUIREMENT

**IMPORTANT: Clam requires TRUE terminal scrollback, not TUI-simulated scrolling.**

#### What We Want: True Terminal Scrollback

True terminal scrollback means:
- **Scrolling = viewport offset of the canvas** - the terminal’s native scrollback
  buffer
- Text is printed sequentially to stdout (no cursor repositioning)
- Content lives in the terminal’s native scrollback buffer
- User scrolls with terminal’s native mechanisms (mouse wheel, scrollbar, trackpad)
- Scrolling is instant - no re-rendering required, the buffer is already there
- When you exit the app, you can still scroll up and see the output
- Works identically over SSH - just bytes flowing through the pipe

#### What We DON’T Want: TUI Re-rendering

TUI “scrollable” (used by most terminal apps like vim, htop, Textual apps):
- Uses **alternate screen buffer** (`\x1b[?1049h` / `tput smcup`)
- Application takes over the terminal and re-renders visible portion on each frame
- “Scrolling” is simulated by the app redrawing with different content via ANSI codes
- Scrolling requires CPU work and can be janky with large content
- When you exit, the history disappears (alternate screen is discarded)
- Over SSH, scrolling sends commands back and forth, adding latency

#### Why This Matters for Clam

Clam’s design philosophy is **terminal-first with selective GUI enhancements**:
- Base experience = pure scrollback text (works everywhere, SSH, any terminal)
- Rich features = overlays/popovers that Clam adds on top (graceful degradation)
- The scrollback IS the conversation history - it’s persistent and fast

Claude Code’s current terminal UI uses fixed-position ANSI rendering, causing:
- Scrolling glitches with long conversation histories
- “Jump to top then back down” artifacts during streaming
- History not properly preserved when scrolling up during output

#### The Research Question

**Do any existing ACP clients use true terminal scrollback?** If not, this is a gap that
Clam’s `clam-acp` client would uniquely fill.

### D.2 Research Findings: No True Scrollback ACP Clients Exist

**CONCLUSION: After careful code analysis, NO existing terminal-based ACP client uses
true terminal scrollback.
All use either TUI re-rendering or web/DOM-based scrolling.**

This represents a significant gap that `clam-acp` can uniquely fill.

* * *

### D.3 Toad (Python + Textual) - TUI Re-rendering, NOT True Scrollback

**Repository:** [github.com/batrachianai/toad](https://github.com/batrachianai/toad)
**Author:** Will McGugan (creator of Rich and Textual libraries) **License:** GPL-3.0

**VERDICT: Uses TUI re-rendering via Textual framework.
NOT true scrollback.**

#### Evidence from Code Analysis

```python
# From toad/app.py - Toad uses Textual App
from textual.app import App
class ToadApp(App, inherit_bindings=False):

# From toad/widgets/terminal.py - Explicitly tracks alternate screen
self._alternate_screen: bool = False

# From toad/ansi/_ansi.py - ANSI alternate screen handling
ENABLE_ALTERNATE_SCREEN = ANSIFeatures(alternate_screen=True)
DISABLE_ALTERNATE_SCREEN = ANSIFeatures(alternate_screen=False)
```

#### How Textual Works (Why It’s NOT True Scrollback)

1. On startup, Textual enters **alternate screen mode** (`\x1b[?1049h`)
2. Takes complete control of the terminal display
3. `VerticalScroll` container **simulates scrolling** by re-rendering visible portion
4. Content lives in Textual’s internal buffer, NOT the terminal’s scrollback
5. On exit, alternate screen is disabled (`\x1b[?1049l`)
6. **All conversation history disappears** - cannot scroll up after exit

#### Features (Still Valuable as Reference)

Despite not using true scrollback, Toad has excellent features worth studying:

| Feature | Location | Value for Clam |
| --- | --- | --- |
| ACP client implementation | `toad/acp/` | Protocol handling patterns |
| Side-by-side diffs | `toad/widgets/diff_view.py` | Diff rendering logic |
| Slash command completion | `toad/slash_command.py` | Completion UX |
| Streaming Markdown | `toad/widgets/` | Incremental rendering |
| Permission modals | `toad/screens/permissions.py` | Permission UI patterns |

* * *

### D.4 OpenCode (TypeScript + Solid.js) - Web App, NOT Terminal

**Repository:** [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
**Authors:** SST team (Jay, Frank, Dax Raad, Adam Elmore) **License:** MIT

**VERDICT: Web application with DOM-based scrolling.
NOT a terminal app at all.**

#### Evidence from Code Analysis

```json
// From package.json - Web technologies, not terminal TUI
"dependencies": {
  "solid-js": "1.9.10",
  "tailwindcss": "4.1.11",
  "vite": "7.1.4",
  "ghostty-web": "0.3.0"  // Embedded terminal widget
}
```

```typescript
// From packages/app/src/context/layout-scroll.ts - DOM scroll positions
export type SessionScroll = {
  x: number  // DOM scroll coordinates
  y: number
}
```

#### Architecture

- **Desktop app**: Electron-based with Solid.js UI
- **Terminal widget**: Uses `ghostty-web` for embedded terminal
- **Scrolling**: DOM-based (`overflow: scroll`), not terminal scrollback
- **Not SSH-compatible**: Requires the web UI to be local

#### Smart Auto-Scroll (DOM-based, Worth Studying)

OpenCode’s auto-scroll handling is sophisticated and worth studying for Clam’s overlay
anchoring, even though it’s DOM-based:

```typescript
// From packages/ui/src/hooks/create-auto-scroll.tsx
createAutoScroll({
  working: () => boolean,          // Is agent working?
  onUserInteracted?: () => void,
  overflowAnchor?: "none" | "auto" | "dynamic",
  bottomThreshold?: number          // 10px threshold
})
```

Key patterns:
- Distinguishes between auto-scroll and user-scroll
- Handles nested scrollable regions (code blocks)
- ResizeObserver watches content height changes
- 250ms settling time for detecting user interaction

* * *

### D.5 Zed Editor - Native IDE, NOT Terminal

**Documentation:**
[zed.dev/docs/ai/external-agents](https://zed.dev/docs/ai/external-agents)

**VERDICT: IDE native UI. NOT a terminal at all.**

Zed created ACP and has native support for Claude Code via the adapter.
However, it’s an IDE, not a terminal application.

* * *

### D.6 Agent-Shell (Emacs) - Closest to True Scrollback

**Repository:**
[github.com/xenodium/agent-shell](https://github.com/xenodium/agent-shell)

**VERDICT: Emacs buffers ARE truly scrollable, but Emacs-specific paradigm.**

Emacs buffers work differently from terminals - they’re genuinely infinite scrollable
text buffers without re-rendering.
However, this requires running inside Emacs.

Features:
- Native Emacs buffer (infinitely scrollable)
- Traffic buffer for JSON inspection
- Supports Claude Code, Gemini CLI, Codex, Goose
- Fake agent for replaying saved sessions

* * *

### D.7 Claude Code CLI - ANSI Positioning, NOT True Scrollback

**VERDICT: Uses ANSI cursor positioning.
NOT true scrollback.**

Claude Code CLI uses fixed-position rendering that repositions the cursor to update the
display. This causes:
- Scrolling glitches with long conversations
- “Jump to top then back down” artifacts
- History corruption when scrolling during streaming

* * *

### D.8 Corrected Comparison Matrix

| Client | Scrolling Type | True Terminal Scrollback? | Notes |
| --- | --- | --- | --- |
| **Toad** | TUI re-render | ❌ NO | Textual alternate screen |
| **OpenCode** | DOM scroll | ❌ NO | Web app, not terminal |
| **Zed** | Native UI | ❌ NO | IDE, not terminal |
| **agent-shell** | Emacs buffer | ⚠️ Emacs-only | True scrollback within Emacs |
| **Claude Code** | ANSI position | ❌ NO | Cursor repositioning |
| **clam-acp** | Native scrollback | ✅ YES (planned) | **Clam's unique value** |

* * *

### D.9 The Opportunity for Clam

**NO existing terminal-based ACP client uses true terminal scrollback.**

This is a significant gap that `clam-acp` can uniquely fill:

| Approach | How It Works | Clam Advantage |
| --- | --- | --- |
| **TUI (Toad)** | Re-renders visible area | True scrollback is instant, no CPU work |
| **Web (OpenCode)** | DOM scrolling | True scrollback works over SSH |
| **IDE (Zed)** | Native UI widgets | True scrollback is terminal-native |
| **ANSI (Claude)** | Cursor repositioning | True scrollback doesn't corrupt on scroll |

* * *

### D.10 Implementation Strategy for clam-acp

Given that **no existing solution provides true terminal scrollback**, clam-acp must be
built from scratch with this as a core design principle.

#### Architecture: Sequential Print + Clam Overlays

```
┌─────────────────────────────────────────────────────────────────────┐
│  clam-acp CLI                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ACP Client (TypeScript)                                      │  │
│  │  - Connects to claude-code-acp adapter                        │  │
│  │  - Receives session/update events                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Sequential Text Renderer                                     │  │
│  │  - print() text to stdout (NO cursor repositioning)           │  │
│  │  - Content flows into terminal's native scrollback            │  │
│  │  - Add Clam escape codes for overlay anchors                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Clam Terminal (interprets escape codes)                      │  │
│  │  - Parses Clam codes, stores overlay metadata                 │  │
│  │  - Renders overlays on hover/click                            │  │
│  │  - Scrollback buffer is NATIVE (instant, no re-render)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Key Design Principles

1. **Never use cursor repositioning** - All output is sequential `print()` to stdout
2. **Scrollback is the viewport** - User scrolls with terminal’s native mechanisms
3. **Overlays are additive** - Clam codes add metadata, don’t change the text
4. **Graceful degradation** - In plain terminals, just shows text without overlays
5. **SSH-first** - Works identically over SSH (just bytes flowing through pipe)

#### Phase 1: Minimal True-Scrollback Client

```typescript
// Pseudo-code for sequential ACP client
for await (const event of acpSession.events()) {
  if (event.type === 'agent_message_chunk') {
    // Just print the text - no cursor magic
    process.stdout.write(event.text);
  }
  if (event.type === 'tool_call') {
    // Print a summary line
    console.log(`▶ ${event.title} [${event.kind}]`);
    // Emit Clam code to anchor overlay data (Clam ignores if not recognized)
    emitClamAnchor(event.id, event);
  }
}
```

#### Phase 2: Add Clam Overlays

- Diff viewer popover (anchored to diff summary line)
- Permission buttons (anchored to permission request line)
- Collapsible thinking sections (Clam Phase 3)

#### Phase 3: Feature Parity

- Tab completion for slash commands
- Session persistence and resume
- File picker with `@` mentions

* * *

### D.11 Code Patterns to Study (Despite Not Being True Scrollback)

Even though existing clients don’t use true scrollback, they have valuable patterns:

| Pattern | Source | Location | Use for Clam |
| --- | --- | --- | --- |
| ACP protocol handling | Toad | `src/toad/acp/` | Event parsing, state management |
| Diff rendering logic | Toad | `src/toad/widgets/diff_view.py` | Diff overlay content |
| Permission UI patterns | Toad | `src/toad/screens/permissions.py` | Permission overlay design |
| Slash command completion | Toad | `src/toad/slash_command.py` | Tab completion UX |
| claude-code-acp adapter | Zed | `repos/claude-code-acp/` | ACP ↔ Claude Code bridge |

* * *

### D.12 Key Takeaways

1. **Gap confirmed**: No terminal ACP client uses true scrollback
2. **Clam’s unique value**: True scrollback + rich overlays
3. **Study Toad for**: ACP protocol handling, diff logic, permission UX
4. **Don’t copy Toad’s**: TUI rendering approach (alternate screen)
5. **Build fresh**: Sequential print renderer with Clam overlay anchors
