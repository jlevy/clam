# Research: Asynchronous Terminal UI for Concurrent Tool Execution

**Date:** 2026-02-06 (last updated 2026-02-06, reconciled with web research)

**Author:** Joshua Levy with Claude assistance

**Status:** In Progress

## Overview

AI coding agents like Claude Code execute multiple tools concurrently, streaming status
updates while the user may still be providing input.
This creates a fundamental tension:

1. **Dynamic updates**: Tool status, progress indicators, and streaming output need to
   update in real-time
2. **True scrollback**: Terminal history should be preserved and scrollable, allowing
   users to review what happened
3. **Input availability**: Users should be able to type even while tools are executing
4. **Rich interactions**: Scrollback content should support interactions (copy code,
   open popovers, etc.)

This research explores how to achieve the best of all worlds: a rich, interactive
terminal experience that maintains true scrollback while supporting concurrent tool
execution with dynamic updates.

## Key Terminology

| Term | Meaning |
| --- | --- |
| **Alternate screen** | Separate buffer (`\x1b[?1049h`). Session content gone on exit. Used by vim, less, Ink fullscreen, Amp, OpenCode. |
| **Primary screen (inline)** | Main buffer. Content flows into scrollback. Used by Claude Code. |
| **Scrollback** | Terminal history you can scroll up to see. Only exists in primary screen mode. |
| **Differential rendering** | Update only changed cells, not full redraw. Reduces flicker. |
| **Full redraw** | Erase and rewrite everything. Causes flicker and can destroy scrollback in inline mode. |
| **DEC 2026** | Synchronized output mode. Terminal buffers all updates until "end sync", then renders atomically. Eliminates tearing. |

## Questions to Answer

1. How does Claude Code currently handle concurrent tool execution and terminal updates?
2. What are the fundamental constraints of terminal rendering (ANSI codes, alternate
   screen, cursor positioning)?
3. Can we update only the “viewport visible” portion while preserving scrollback above?
4. What terminal protocols exist for embedding dynamic/interactive elements (OSC, iTerm,
   Kitty)?
5. How do other AI coding agents (OpenCode, Warp, Cursor) solve this problem?
6. What are the trade-offs between different approaches (full rewrite, viewport-only,
   overlay protocols)?
7. Can we leverage terminal emulator features (Clam’s graphical overlays) to add
   interactivity to static scrollback?

## Scope

**Included:**

- Analysis of terminal rendering constraints and capabilities
- Survey of how existing AI agents handle concurrent tool updates
- Terminal protocols for dynamic elements (OSC 8, OSC 1337, Kitty graphics, etc.)
- Hybrid approaches combining scrollback with dynamic updates
- Clam-specific overlay opportunities

**Excluded:**

- Full TUI frameworks that take over the entire screen (Ink, Textual, etc.)
- Web-only solutions without terminal focus
- IDE extension approaches (VS Code, JetBrains)

* * *

## Document Structure

This research is organized in four parts:

1. **Part 1: Survey of Existing Tools** - What do current AI coding agents do for their
   terminal interfaces?
   How do they handle concurrent tool execution, streaming, and scrollback?

2. **Part 2: Terminal Fundamentals** - The constraints we’re working with: ANSI codes,
   screen buffers, cursor positioning, and their limitations.

3. **Part 3: Approach for Emulating Claude Code-like UI** - Our strategy for achieving
   similar UX: options considered, trade-offs, and implementation details.

4. **Part 4: Pluggable Architecture & Progressive Enhancement** - How to make the
   renderer swappable and upgrade to rich GUI elements via Clam codes.

* * *

## Part 1: Survey of Existing Terminal Interfaces

### 1.1 Claude Code - The Industry Leader

Claude Code (Anthropic) is the primary reference point.
Understanding their approach is critical since they’ve invested heavily in solving this
problem at scale.

#### What It Looks Like

Claude Code’s terminal UI features:
- **Tool cards** - Each tool execution shows as a collapsible card with icon, name,
  status (spinner/checkmark/error), and timing
- **Concurrent execution** - Multiple tools run and display simultaneously
- **Streaming output** - stdout/stderr streams in real-time within tool cards
- **Input always available** - User can type while tools run (prompt stays at bottom)
- **Scrollback preserved** - Can scroll up to see previous conversation turns

#### Technical Architecture

From [Peter Steinberger’s analysis](https://steipete.me/posts/2025/signature-flicker)
and Hacker News discussions:

**Key decisions:**
1. **Primary screen buffer** (not alternate screen) - enables true scrollback
2. **Custom differential renderer** - replaced Ink (React terminal) with custom solution
3. **React for component model** - keeps developer ergonomics
4. **Scene graph → layout → diff → ANSI** pipeline
5. **TypedArray buffers** - avoids GC pauses that caused stuttering
6. **DEC 2026 synchronized output** - atomic screen updates, no tearing

**Critical insight from Claude Code team:**
> “There’s no way to incrementally update scrollback in a terminal.”

They don’t try to update scrollback.
Instead:
- They **clear and redraw** the viewport content using cursor positioning
- The **diff algorithm** minimizes ANSI output (only changed cells)
- **Synchronized output** batches updates to prevent tearing
- Content that scrolls into scrollback becomes immutable

#### Remaining Issues

Despite the custom renderer, Claude Code still has significant scrollback issues.
[Issue #2479](https://github.com/anthropics/claude-code/issues/2479) has **10+ duplicate
issues** reporting scrollback destruction:

- Issue #5207: Scroll History Lost After /clear Command
- Issue #7597: /compact and /clear commands clear terminal scrollback
- Issue #7818: /login should not wipe Terminal scrollback
- Issue #8392: Claude Code nukes all previous terminal content

**Anthropic’s position** (from Thariq on the team):
> “We value this native experience a lot.
> We may explore alternate screen mode in the future, but our bar is quite high.”

This confirms they’re committed to the inline approach despite ongoing issues.

**Other edge cases:**
- Scrolling during active streaming can cause glitches
- Long sessions may have “jump to top” artifacts
- Terminal multiplexers (tmux, screen) need special handling
- Some terminal emulators don’t fully support DEC 2026

### 1.2 OpenCode/Crush - Terminal-First TUI

**Repository:**
[github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode)

OpenCode (now “Crush”, developed with Charm team) is a Go-based terminal coding agent.
According to their website, it has 95k+ GitHub stars and is used by over 2.5M developers
monthly.

#### What It Looks Like

- Full TUI with sidebar, conversation view, and input area
- **Alternate screen buffer** - takes over terminal completely
- Bubble Tea (Elm architecture) for state management
- 60 FPS render loop with efficient updates
- Rich widget library from Charm

#### Technical Architecture

```go
// From OpenCode's list.go
type messagesCmp struct {
    viewport      viewport.Model    // Charmbracelet viewport handles scrolling
    cachedContent map[string]cacheItem  // Cache rendered content by message ID
    rendering     bool
}
```

**Key features:**
- **Viewport model** - Charm’s viewport.Model handles “simulated” scrolling
- **Message caching** - Rendered content cached by ID for efficient re-render
- **Overlay system** - Modal overlays for permissions, settings
- **Auto-scroll logic** - Sophisticated handling of scroll position during updates

**Trade-offs:**
- ❌ **No true scrollback** - alternate screen means history lost on exit
- ❌ **Not SSH-transparent** - all rendering is local
- ✅ **Full control** - can build any UI widget
- ✅ **No cursor bugs** - application owns the display

### 1.3 Toad - Textual-Based ACP Client

**Repository:** [github.com/batrachianai/toad](https://github.com/batrachianai/toad)

Toad is Will McGugan’s (creator of Rich/Textual) terminal ACP client, built to
demonstrate what’s possible with Textual.

#### What It Looks Like

- Full TUI using Python’s Textual framework
- Side-by-side diff viewer
- Streaming markdown rendering
- Permission modals
- Slash command completion

#### Technical Architecture

From our analysis of `toad/acp/agent.py` and `toad/widgets/`:

```python
# Tool call state management
class AgentController:
    tool_calls: dict[str, ToolCall]  # Keyed by tool_call_id

    async def handle_tool_call_update(self, update):
        # Merge non-None fields into existing tool_call
        tool_call = self.tool_calls[update.tool_call_id]
        # Update and notify widgets
```

**Key patterns:**
- **ACP message types map to widgets** - `tool_call` → ToolCallWidget
- **Reactive properties** - Setting `widget.tool_call = new_value` triggers recompose
- **Content pruning** - `prune_window(low_mark, high_mark)` removes old content
- **Streaming markdown** - Uses Textual’s MarkdownStream API

**Trade-offs:**
- ❌ **No true scrollback** - Textual uses alternate screen
- ❌ **Full recompose on update** - can be expensive with many tools
- ✅ **Clean ACP integration** - good reference for protocol handling
- ✅ **Rich widgets** - diff viewer, modals, etc.

### 1.4 Aider - Python Terminal Agent

**Repository:** [github.com/Aider-AI/aider](https://github.com/Aider-AI/aider)

Aider is a Python-based AI pair programming tool with 40k+ stars.

#### What It Looks Like

- Sequential terminal output with Rich formatting
- Git-native with automatic commits
- Voice input support
- Model-agnostic (Claude, GPT-4, local models)

#### Technical Architecture

Uses Rich library for formatting:
- `Live` context manager for updatable regions
- `Markdown` class for rendering
- `Panel` and `Tree` for structured output
- `Progress` for long operations

**Approach:** More sequential than Claude Code - status updates often print new lines
rather than updating in place.
Simpler but more verbose.

### 1.5 Wave Terminal - Rich GUI in Terminal

**Repository:**
[github.com/wavetermdev/waveterm](https://github.com/wavetermdev/waveterm)

Wave Terminal is the most feature-rich open source terminal for GUI constructs.

#### What It Looks Like

- **Block-based architecture** - different content types coexist
- Collapsible JSON tree view
- Embedded Monaco editor
- Chromium web blocks alongside terminal
- Markdown/image/PDF preview
- Command grouping

#### Technical Architecture

Wave validates that rich GUI can coexist with terminal:
- **Block management system** - different renderers for different content
- **Chromium integration** - web views embedded in terminal
- **Not standard terminal semantics** - Wave manages its own model

**Relevance to Clam:** Wave proves that embedding GUI elements in terminal context
works. Clam can achieve similar with overlays rather than blocks.

### 1.6 Amp Code - Alternate Screen TUI

**URL:** [ampcode.com](https://ampcode.com)

Amp Code (by Sourcegraph) is an AI coding agent that initially shared Claude Code’s
flickering issues but made a different architectural choice.

#### Technical Evolution

Amp initially used Ink and experienced the same flickering problems as early Claude
Code. In September 2025, they rewrote their renderer and **switched to alternate screen
mode**.

From their [announcement](https://ampcode.com/news/look-ma-no-flicker):
> “Our framework now enables smooth scrolling while tool calls stream in, real mouse
> interactions, overlays, popups, and clickable buttons.
> Most importantly: no flicker, no jarring redraws, no stuttering text.”

#### Key Trade-off

**Amp chose the opposite of Claude Code**: They sacrificed scrollback preservation for
perfect rendering. This is a valid choice for users who prioritize visual polish over
terminal history.

**Trade-offs:**
- ❌ **No true scrollback** - session content lost on exit
- ❌ **Not SSH-transparent** - full TUI requires local rendering
- ✅ **Zero flicker** - alternate screen eliminates rendering issues
- ✅ **Full interactivity** - mouse, overlays, buttons work perfectly

### 1.7 Ink (React for CLI) - The Framework Most Use

**Repository:** [github.com/vadimdemedes/ink](https://github.com/vadimdemedes/ink)

Ink is the dominant React-based terminal UI framework, used by Gatsby, Prisma, Shopify,
and originally by Claude Code.

#### Scrollback Limitation (Critical)

Ink explicitly destroys scrollback when output exceeds viewport height.
From their docs:

> "Unfortunately, terminals can’t rerender output that is taller than terminal window.
> So if your app output has a height of 60 rows, but user resized terminal window to 50
> rows, first 10 rows won’t be rerendered … **Entire scrollback history in that terminal
> session will be lost.**"

#### Available Workarounds

1. **`<Static>` component** - Permanently renders content that won’t be re-rendered.
   Useful for logs that should persist, but doesn’t solve the core update problem.

2. **Alternate screen buffer** - Via manual escape codes or the
   [`fullscreen-ink`](https://www.npmjs.com/package/fullscreen-ink) package:
   ```javascript
   const enterAltScreenCommand = '\x1b[?1049h';
   const leaveAltScreenCommand = '\x1b[?1049l';
   process.stdout.write(enterAltScreenCommand);
   process.on('exit', () => process.stdout.write(leaveAltScreenCommand));
   ```

**Key insight:** Neither workaround provides true scrollback-compatible inline updates.
This is why Claude Code had to write a custom renderer.

### 1.8 Reverse Engineering Efforts

Several projects have analyzed Claude Code’s internals, providing valuable architectural
insights:

#### claude-code-reverse (~1.7k stars)

**Repository:**
[github.com/Yuyz0112/claude-code-reverse](https://github.com/Yuyz0112/claude-code-reverse)

Intercepts API calls to visualize LLM interactions.
Key findings:
- Multi-layered agent system with main + sub-agents
- Sub-agents isolate “dirty context” from failed explorations
- Context compaction activates at 92% token usage
- System prompts and tool definitions exposed

#### ShareAI Lab Deep Dive Report

De-obfuscated 50,000+ lines of Claude Code, released under Apache 2.0:
- Tiered multi-agent runtime with sandboxed privilege isolation
- 6-layer security gate for tool invocations (~0.8ms overhead per call)
- ~6.8x context compression ratios
- Full architecture documentation available

#### ghuntley/claude-code-source-code-deobfuscation

“Cleanroom deobfuscation” of the npm package (archived March 2025). Demonstrated that
LLMs are effective at deobfuscation and structure-to-structure conversions.

**Note:** The official repo (github.com/anthropics/claude-code, 65k stars) is public but
contains primarily scripts/plugins/examples, not the bundled source.
The npm package contains obfuscated/bundled code.

### 1.9 Comparison Matrix

| Feature | Claude Code | OpenCode | Toad | Aider | Amp | Ink |
| --- | --- | --- | --- | --- | --- | --- |
| **Buffer mode** | Primary | Alternate | Alternate | Primary | Alternate | Both* |
| **Scrollback after exit** | ✅ Yes | ❌ Lost | ❌ Lost | ✅ Yes | ❌ Lost | ⚠️ Depends |
| **Scrollback during use** | ⚠️ Buggy | ❌ N/A | ❌ N/A | ✅ Yes | ❌ N/A | ❌ Destroyed |
| **Native features** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ❌ No | ⚠️ Depends |
| **In-place updates** | ✅ Diff-based | ✅ Full redraw | ✅ Full redraw | ⚠️ Limited | ✅ Custom | ✅ Full redraw |
| **SSH-compatible** | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ |
| **Concurrent tools** | ✅ Cards | ✅ Viewport | ✅ Widgets | ⚠️ Sequential | ✅ Cards | ✅ Components |
| **Sync output** | ✅ DEC 2026 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Flicker-free** | ⚠️ Mostly | ❌ | ❌ | N/A | ✅ Yes | ❌ |
| **Language** | TypeScript | Go | Python | Python | TypeScript | TypeScript |
| **Framework** | React + Custom | Bubble Tea | Textual | Rich | Custom | React + Yoga |

*Ink uses primary screen by default (destroys scrollback on tall output) or alternate
screen via `fullscreen-ink` package.

* * *

## Part 2: Terminal Fundamentals & Constraints

### 2.1 The Core Problem: Concurrent Tool Execution Display

When an AI agent executes multiple tools concurrently, the UI must:

1. **Show status for each tool**: “Running tests...”, “Editing file.ts...”, etc.
2. **Update status as tools complete**: Change from spinner to checkmark
3. **Display output**: Stream stdout/stderr from each tool
4. **Allow user input**: User can type while tools are running
5. **Maintain history**: User can scroll up to see what happened

#### The Fundamental Tension

```
┌─────────────────────────────────────────────────────────────────┐
│  Scrollback (want: immutable history, preserved on scroll up)   │
│  ─────────────────────────────────────────────────────────────  │
│  > User: Fix the tests                                          │
│  Claude: I'll run the tests first...                            │
│  ✓ Running tests... [completed]                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Viewport (want: dynamic updates to tool status)                │
│  ─────────────────────────────────────────────────────────────  │
│  ⟳ Tool 1: Running npm test... [3s]     ← UPDATE IN PLACE       │
│  ⟳ Tool 2: Editing src/index.ts...      ← UPDATE IN PLACE       │
│  ⟳ Tool 3: Reading package.json         ← UPDATE IN PLACE       │
│  ─────────────────────────────────────────────────────────────  │
│  Input line (want: always accessible, not blocked)              │
│  ─────────────────────────────────────────────────────────────  │
│  > [user can type here while tools run]                         │
└─────────────────────────────────────────────────────────────────┘
```

**The problem**: Standard terminals don’t distinguish between “scrollback” and
“viewport”. ANSI cursor positioning (`\x1b[H`, `\x1b[2J`) affects the entire buffer.

* * *

### 2.2 How Terminals Actually Work

#### 2.1 Two Buffer Modes

**Primary Screen Buffer (normal mode)**:
- Text flows sequentially from top to bottom
- When screen fills, lines scroll into scrollback buffer
- Scrollback is preserved and accessible
- No cursor repositioning for updates (new content = new lines)

**Alternate Screen Buffer** (enabled with `\x1b[?1049h`):
- Separate buffer that replaces primary screen
- Application has full control
- No scrollback (content doesn’t persist)
- Used by vim, less, htop, Ink, Textual, etc.
- When disabled (`\x1b[?1049l`), previous scrollback returns

#### 2.2 Cursor Positioning Limitations

ANSI cursor positioning works **within the current visible screen only**:

```
\x1b[H        - Move cursor to row 1, col 1 of VIEWPORT (not scrollback)
\x1b[{row};{col}H - Move to specific row/col in VIEWPORT
\x1b[2J       - Clear entire screen (viewport only)
\x1b[K        - Clear from cursor to end of line
```

**Key insight**: You CANNOT move the cursor into scrollback.
Once a line scrolls out of the visible viewport, it’s “frozen” and can only be viewed by
scrolling.

#### 2.3 The Scrollback Corruption Problem

When Claude Code (or similar tools) updates in-progress tool status:

```typescript
// Typical approach: move cursor up and rewrite
process.stdout.write('\x1b[3A');  // Move up 3 lines
process.stdout.write('\x1b[2K');  // Clear line
process.stdout.write('✓ Tool 1: Complete');  // Rewrite
process.stdout.write('\x1b[3B');  // Move back down
```

**This breaks when**:
1. User scrolls up → cursor positions become wrong
2. Content exceeds viewport → lines enter scrollback, become unrewritable
3. Terminal resizes → positions become invalid
4. Long streaming output → previous tool cards scroll out of reach

* * *

### 2.3 How Claude Code Currently Handles This (2026 Architecture)

#### 3.1 The Breakthrough: Differential Renderer

In late 2025/early 2026, Anthropic completely **rewrote Claude Code’s renderer** to
solve the flickering and scrollback issues.
Key details from
[Peter Steinberger’s analysis](https://steipete.me/posts/2025/signature-flicker):

> “Ink, the React-based terminal renderer Claude Code originally used, didn’t support
> the kind of fine-grained incremental updates needed for a long-running interactive
> UI.”

**Key architectural decisions:**

1. **Primary screen buffer** - Claude Code uses scrollback (not alternate screen like
   vim), so users can scroll up to see history, copy text, etc.

2. **Custom differential renderer** - They kept React but rewrote the rendering backend:
   - Constructs scene graphs through React
   - Layouts elements, rasterizes to 2D screen
   - **Diffs against the previous frame**
   - Generates minimal ANSI sequences
   - All within ~16ms budget

3. **Memory optimization** - Screen buffers converted to packed TypedArrays to avoid GC
   pauses that caused stuttering

4. **Double-buffering with smart diffing** - “Blits similar cells between front and back
   buffer to reduce memory pressure”

#### 3.2 The Core Constraint Still Exists

From the [Hacker News discussion](https://news.ycombinator.com/item?id=46699072):

> **“There’s no way to incrementally update scrollback in a terminal.”**

Claude Code’s solution is NOT to update scrollback.
Instead:
- They **clear and redraw** the viewport content
- The **diff algorithm** minimizes what needs to be redrawn
- **Synchronized output (DEC 2026 mode)** batches ANSI commands to prevent tearing

This means content that has scrolled OFF the viewport into scrollback is effectively
frozen. Updates only affect the visible viewport area.

#### 3.3 DEC Mode 2026 (Synchronized Output)

Claude Code has pushed patches upstream to VSCode’s terminal and tmux to support
synchronized output mode:

```
\x1b[?2026h  - Begin synchronized update (buffer rendering)
\x1b[?2026l  - End synchronized update (flush to screen)
```

**How it works:**
1. Application sends “begin sync” sequence
2. All subsequent ANSI codes are buffered
3. Application sends “end sync” sequence
4. Terminal renders entire update atomically

**Result:** Zero flickering in terminals that support it (Ghostty, VSCode 2026+, tmux)

#### 3.3.1 Reference Implementation: pi

[Mario Zechner’s pi](https://github.com/badlogic/pi-mono) (specifically the `pi-tui`
library) is described by Peter Steinberger as the “gold-standard for differential
rendering”:

> “Mario Zechner’s pi is currently the gold-standard for differential rendering, while
> also using all tricks of modern terminals—including showing inline images.
> Claude Code and pi prove you can kill flicker without giving up the terminal’s muscle
> memory.”

The pi-tui approach writes to the terminal like any CLI program, appending content to
the scrollback buffer, only occasionally moving the cursor back up within the visible
viewport to redraw dynamic elements like spinners or input fields.
To prevent flicker, it wraps all rendering in synchronized output sequences (CSI ?2026h
and CSI ?2026l).

Worth studying for implementation patterns—see Zechner’s detailed write-up at
[mariozechner.at](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/).

#### 3.4 What This Means for Clam

Claude Code’s approach validates several key points:

1. **Primary screen buffer is correct** - Users expect scrollback for copying/searching
2. **Differential rendering works** - Only updating changed cells reduces flicker
3. **Synchronized output is critical** - DEC 2026 mode eliminates tearing
4. **Scrollback remains immutable** - Can’t update content that scrolled off

**Clam opportunity:** Since Clam controls the terminal emulator, we can potentially go
further than Claude Code:
- Clam codes could enable **semantic updates** to scrollback (overlays that change)
- We’re not limited to ANSI-only communication

#### 3.5 Remaining Issues (from GitHub Issues)

Despite improvements, some issues persist:

- [Issue #826](https://github.com/anthropics/claude-code/issues/826): Scroll flashing in
  long sessions (stroboscope effect)
- [Issue #11537](https://github.com/anthropics/claude-code/issues/11537): Can’t scroll
  back while Claude is “thinking”
- [Issue #12286](https://github.com/anthropics/claude-code/issues/12286): Some terminals
  report can’t scroll back at all (alternate screen mode detection issue?)
- [Issue #10587](https://github.com/anthropics/claude-code/issues/10587): Cannot scroll
  past start of Claude in some configurations

These suggest the solution works well but still has edge cases, particularly around:
- Long sessions with lots of content
- Scrolling during active streaming
- Terminal multiplexers (tmux, screen)
- Non-standard terminal emulators

* * *

### 3.6 Claude Code Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Claude Code Terminal Renderer                        │
├─────────────────────────────────────────────────────────────────────────┤
│  React Components                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Tool cards, messages, spinners, input field, etc.                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  Scene Graph Builder                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Convert React tree → 2D layout → character grid                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  Differential Renderer (TypedArrays, double-buffered)                   │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  1. Compare new frame vs previous frame                             ││
│  │  2. Calculate minimal set of changed cells                          ││
│  │  3. Generate ANSI sequences for only changed cells                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  Output with Synchronized Update Mode                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  \x1b[?2026h ... (all ANSI updates) ... \x1b[?2026l                ││
│  │  Terminal renders atomically (no tearing)                           ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  Terminal (Primary Screen Buffer)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  [Scrollback: immutable, user can scroll up]                        ││
│  │  [Viewport: dynamically updated via diff]                           ││
│  │  [Input: always at bottom]                                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Claude Code’s approach is essentially “Option C” from our analysis
(Viewport-Only Updates) but implemented at a very sophisticated level with:
- React for component model (developer ergonomics)
- Custom renderer for performance (differential updates)
- Synchronized output for visual polish (no tearing)
- Primary screen buffer for user expectations (scrollback works)

* * *

### 2.4 Terminal Protocols for Dynamic Elements

#### 5.1 OSC 8 Hyperlinks

**Standard**: https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda

```
\x1b]8;;URL\x1b\\Link Text\x1b]8;;\x1b\\
```

**Support**: iTerm2, Kitty, Ghostty, Alacritty, WezTerm, GNOME Terminal, Windows
Terminal

**Use case**: Make file paths, URLs clickable.
Already works with true scrollback.

#### 5.2 iTerm2 Inline Images (OSC 1337)

**Standard**: https://iterm2.com/documentation-images.html

```
\x1b]1337;File=name=base64_name;size=filesize;inline=1:base64_data\x07
```

**Support**: iTerm2, WezTerm, Mintty, Konsole (partial)

**Use case**: Embed images directly in terminal output.

#### 5.3 Kitty Graphics Protocol

**Standard**: https://sw.kovidgoyal.net/kitty/graphics-protocol/

More sophisticated than iTerm2:
- Supports animation
- Transmit large images in chunks
- Virtual placements (image at specific cell position)

**Support**: Kitty, Ghostty (partial)

**Use case**: Rich graphics in scrollback.

#### 5.4 Kitty Keyboard Protocol

**Standard**: https://sw.kovidgoyal.net/kitty/keyboard-protocol/

Enables full modifier detection (Shift+Enter distinct from Enter):

```
CSI > 1 u  # Enable protocol
```

**Support**: Kitty, Ghostty, Alacritty, WezTerm, iTerm2

**Use case**: Better keyboard handling for input (not directly related to display).

#### 5.5 OSC 11 Background Query

Query terminal background color for theme detection:

```
\x1b]11;?\x07
```

Terminal responds with RGB value.
Used by OpenCode for dark/light mode detection.

#### 5.6 OSC 52 Clipboard Access

Copy text to system clipboard:

```
\x1b]52;c;base64_data\x07
```

**Support**: Most modern terminals

**Use case**: “Copy code” buttons in scrollback.

* * *

## Part 3: Approach for Emulating Claude Code-like UI

### 3.1 Potential Approaches

#### 3.1.1 Option A: Full TUI (What Most Do)

**Description**: Use alternate screen buffer, manage all rendering ourselves.

**Implementation**: Ink (React), Textual (Python), Bubble Tea (Go), Ratatui (Rust)

**How it works**:
- Enter alternate screen mode
- Application owns the entire display
- “Scrolling” is simulated by application
- All state managed in memory

**Pros**:
- Full control over updates
- No cursor positioning bugs
- Consistent cross-terminal

**Cons**:
- **No true scrollback** - history lost on exit
- **Not SSH-friendly** - all rendering is local
- **Application complexity** - must implement scrolling, virtualization
- **Conflicts with Clam overlay approach**

**Verdict**: Works, but violates our core design principle of true scrollback.

* * *

#### 3.1.2 Option B: True Scrollback Only (No Dynamic Updates)

**Description**: Output flows sequentially, no cursor repositioning.

**Implementation**: Pure print-based output

**How it works**:
- Each tool execution prints new lines
- Status updates print NEW lines (not update existing)
- Spinners rendered as inline animation (e.g., `-\|/` cycling)
- Completed tools print final status on new line

**Example output**:
```
> User: Fix the tests
Claude: I'll run the tests first...

⟳ Tool 1: Running npm test...
⟳ Tool 2: Editing src/index.ts...
⟳ Tool 3: Reading package.json...

✓ Tool 3: Complete (0.1s)
✓ Tool 2: Complete (0.5s)
  [diff output here]
✓ Tool 1: Complete (3.2s)
  12 tests passed
```

**Pros**:
- **Perfect scrollback** - everything preserved
- **SSH-compatible** - just bytes flowing through
- **Simple implementation** - no cursor tricks
- **Clam overlays work** - can add interactivity to frozen text

**Cons**:
- **Verbose output** - status updates create new lines
- **No in-place updates** - can’t show spinner progress cleanly
- **Tool cards don’t update** - must wait for completion

**Verdict**: Cleanest approach, but loses the dynamic feel of in-place updates.

* * *

#### 3.1.3 Option C: Differential Renderer (What Claude Code Does)

**Description**: Keep React component model, but write a custom renderer that:
- Tracks all UI state as a 2D character grid
- Diffs each frame against the previous frame
- Only emits ANSI for changed cells
- Uses synchronized output to prevent tearing

**Implementation**: Custom render pipeline with TypedArray buffers

**How it works** (based on
[Claude Code’s approach](https://steipete.me/posts/2025/signature-flicker)):
1. React components describe the UI (tool cards, messages, input)
2. Layout engine converts to 2D character grid
3. Diff algorithm compares new grid vs previous grid
4. Generate minimal ANSI sequences for changed cells only
5. Wrap in synchronized output mode (`\x1b[?2026h` … `\x1b[?2026l`)
6. Send to terminal atomically

**Key insight from Claude Code**:
> “There’s no way to incrementally update scrollback in a terminal.”

So they don’t try to update scrollback.
Instead:
- Clear and redraw the **viewport portion** using cursor positioning
- Content that scrolls into scrollback becomes immutable
- Diff algorithm makes redraws efficient (only changed cells)
- Synchronized output prevents visual tearing

**Example render cycle**:
```
Frame N:                    Frame N+1:
┌──────────────────┐        ┌──────────────────┐
│ ⟳ Running tests  │   →    │ ✓ Tests passed   │  ← Only this line changed
│ ⟳ Editing file   │        │ ⟳ Editing file   │
│ ⟳ Reading config │        │ ⟳ Reading config │
└──────────────────┘        └──────────────────┘

ANSI output: \x1b[?2026h\x1b[1;1H\x1b[2K✓ Tests passed\x1b[?2026l
             ^sync start   ^row 1  ^clear ^new text   ^sync end
```

**Pros**:
- **Proven at scale** - Claude Code uses this with millions of users
- **React ergonomics** - Component model for developer productivity
- **Minimal flicker** - Differential updates + synchronized output
- **Scrollback preserved** - Primary screen buffer, users can scroll up
- **Works cross-platform** - Just ANSI codes

**Cons**:
- **Complex to implement** - Custom renderer with TypedArray buffers
- **Still can’t update scrollback** - Content that scrolled up is frozen
- **Edge cases remain** - User scrolling during updates causes issues
- **Terminal support varies** - DEC 2026 not universal (but graceful degradation)

**Verdict**: This is the current best practice.
Claude Code has proven it works.

* * *

#### 3.1.4 Option D: Terminal Protocol Extensions (Clam-Specific)

**Description**: Define custom escape sequences for semantic blocks that Clam
interprets.

**Implementation**: Clam codes for “ui.block.start”, “ui.block.update”, etc.

**How it works**:
1. CLI emits semantic escape codes: `\x1b]kui;block.start;tool-123;Running...\x07`
2. Clam terminal intercepts and interprets these codes
3. Clam renders overlays, updates, and interactions
4. Non-Clam terminals see fallback text or ignore codes

**From existing research**
([research-2026-02-02-acp-clam-terminal-ui.md](research-2026-02-02-acp-clam-terminal-ui.md)):

```typescript
type KuiEvent =
  | {
      t: 'block.start';
      id: string;
      kind: 'tool' | 'plan' | 'diff' | 'terminal';
      summary: string;
      data?: unknown;
    }
  | { t: 'block.patch'; id: string; patch: unknown }
  | { t: 'anchor'; id: string; line: 'last'; cols?: [number, number] }
  | { t: 'action'; id: string; actionId: string; label: string; inject: string };
```

**Pros**:
- **Semantic richness** - Clam knows what each element means
- **True scrollback preserved** - text is text, overlays are additive
- **Graceful degradation** - works in plain terminals (just shows summary text)
- **SSH-compatible** - escape codes flow through SSH, Clam renders locally
- **Full interactivity** - popovers, diffs, copy buttons, permission prompts

**Cons**:
- **Clam-specific** - only works in Clam terminal
- **Protocol design** - need to design and implement the protocol
- **Integration work** - CLI must emit codes, Clam must interpret

**Verdict**: Long-term vision for Clam.
The right answer for a Clam-native experience.

* * *

#### 3.1.5 Option E: Hybrid Single-Line Status Bar

**Description**: Use a single “status bar” line at the bottom that updates in place, all
other content flows sequentially.

**Implementation**: Reserve bottom line for status, use cursor save/restore

**How it works**:
```
[Scrollback - sequential output, frozen]
> User: Fix the tests
Claude: I'll run the tests first...
  Starting tool execution...
  Tool 1 output: ...
  Tool 2 output: ...
---
[Status bar - single line, always at bottom of viewport]
⟳ Tools: 2 running, 1 complete  [Tool 2: 45%] [Tool 3: 12%]
---
[Input line]
> [cursor]
```

**Implementation approach**:
```typescript
// Save cursor position
process.stdout.write('\x1b[s');
// Move to last line
process.stdout.write('\x1b[999;1H');
// Clear and write status
process.stdout.write('\x1b[2K' + statusLine);
// Restore cursor
process.stdout.write('\x1b[u');
```

**Pros**:
- **Simple** - only one line updates, rest is sequential
- **Scrollback preserved** - all content above status bar is immutable
- **SSH-compatible** - standard ANSI codes
- **Input available** - status bar doesn’t block input

**Cons**:
- **Limited space** - only one line for all tool status
- **Summary only** - can’t show detailed tool cards
- **May flicker** - cursor save/restore can cause brief flash

**Verdict**: Good compromise for simpler implementation.
Works everywhere.

* * *

#### 3.1.6 Option F: Ink-Style React TUI with Scrollback Export

**Description**: Use TUI for interaction, but export/persist scrollback separately.

**Implementation**: Ink with session transcript

**How it works**:
1. During session: Full TUI with rich updates (alternate screen)
2. Session transcript: All content logged to file or memory
3. On exit/scroll request: Switch to primary screen, dump transcript
4. Transcript becomes scrollback

**Pros**:
- **Rich interaction during session**
- **Scrollback available on demand**

**Cons**:
- **Not true scrollback** - can’t scroll up during session
- **Context switch** - must exit TUI to see history
- **Complexity** - managing two modes

**Verdict**: Workaround, not a real solution to the core problem.

* * *

### 3.2 Analysis: Claude Code’s Specific Approach

To understand Claude Code’s approach better, let me analyze what we know:

#### 3.2.1Observed Terminal Behavior

Claude Code appears to use:
1. **Primary screen buffer** (not alternate) - scrollback exists
2. **ANSI cursor positioning** - tool cards update in place
3. **Multiple concurrent tools** - status shown for each
4. **Streaming output** - tool output streams in real-time

#### 3.2.2Known Issues

From user reports and observation:
- Scrolling during output causes visual glitches
- Long sessions can corrupt history
- “Jump to top” artifacts when tool completes
- Status updates fail when lines scroll out of viewport

#### 3.2.3What Claude Code Does Right

- **Input remains available** during tool execution
- **Multiple tools visible** at once
- **Status updates** give feedback on progress
- **Streaming output** from tools is visible

#### 3.2.4What Could Be Improved

- **Viewport-aware updates** - only update lines still in viewport
- **Freeze on scroll-out** - when line leaves viewport, freeze it
- **Semantic markers** - for Clam-style rich terminal support
- **Fallback gracefully** - if update fails, append new line instead

* * *

### 3.3 The Clam Opportunity

#### 3.3.1Clam’s Unique Position

Clam is building a terminal emulator with:
- **Custom escape code support** (Clam codes)
- **Overlay infrastructure** (popovers, tooltips, panels)
- **React-based rendering** (xterm.js/ghostty-web + overlays)

This enables approaches not possible in standard terminals.

#### 3.3.2Proposed Clam Architecture

From
[research-2026-02-02-acp-clam-terminal-ui.md](research-2026-02-02-acp-clam-terminal-ui.md):

```
┌─────────────────────────────────────────────────────────────────────┐
│  clam-acp CLI                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Sequential Text Renderer                                     │  │
│  │  - print() text to stdout (NO cursor repositioning for output)│  │
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

#### 3.3.3Key Design Decisions

1. **Output uses sequential print** - no cursor repositioning for output
2. **Input can be interactive** - cursor positioning for input editing is fine
3. **Clam codes add metadata** - semantic markers for overlays
4. **Overlays update dynamically** - Clam manages overlay state separately from text
5. **Scrollback is native** - terminal manages scrollback, overlays are additive

#### 3.3.4How Tool Status Would Work

1. **CLI prints summary line**: `▶ Tool: Running npm test [tool-123]`
2. **CLI emits Clam code**: `\x1b]kui;tool.status;id=tool-123;status=running\x07`
3. **Clam attaches overlay** to the summary line
4. **Overlay shows spinner** or progress indicator
5. **When complete**: CLI emits `\x1b]kui;tool.status;id=tool-123;status=complete\x07`
6. **Clam updates overlay** to show checkmark
7. **Summary line in scrollback remains frozen text**

**Result**: Text scrollback is standard, overlays add dynamic elements.

* * *

### 3.4 Implementation Recommendations

#### 3.4.1Short-Term: Status Bar Approach (Option E)

For immediate implementation without Clam-specific features:

1. Reserve bottom line(s) for status bar
2. Use cursor save/restore to update status
3. All other content flows sequentially
4. When tool completes, print final status to main flow

**Benefits**: Works everywhere, simple, no scrollback issues.

#### 3.4.2Medium-Term: Viewport-Aware Updates (Option C)

For improved UX in standard terminals:

1. Track which lines are in viewport
2. Update only viewport-visible tool cards
3. When line scrolls out, freeze it (print final status)
4. Clam codes can be emitted even before Clam supports them

**Benefits**: Better UX than status bar, prepares for Clam.

#### 3.4.3Long-Term: Clam Protocol (Option D)

For full Clam-native experience:

1. Define and implement Clam UI protocol
2. CLI emits semantic escape codes
3. Clam renders overlays with full interactivity
4. Non-Clam terminals get graceful degradation

**Benefits**: Best possible UX, rich interactions, true scrollback.

* * *

* * *

## Part 4: Pluggable Architecture & Progressive Enhancement

### 4.1 Reference Implementations Analyzed

We explored several open-source implementations to understand different approaches:

#### 4.1.1 Claude Code (TypeScript + Custom React Renderer)

**Approach**: Differential renderer with synchronized output

**Key implementation details** (from
[Peter Steinberger’s analysis](https://steipete.me/posts/2025/signature-flicker)):
- React components → scene graph → 2D character grid → diff → ANSI
- TypedArray buffers for memory efficiency (avoid GC pauses)
- Double-buffered with smart cell blitting
- DEC 2026 synchronized output for atomic updates
- Primary screen buffer (preserves scrollback)

**Lessons**:
- Differential rendering at cell level is proven and works
- Synchronized output (DEC 2026) is critical for eliminating flicker
- Can’t update scrollback, only viewport
- ~16ms frame budget achievable

#### 4.1.2 OpenTUI (TypeScript + Zig) - [github.com/sst/opentui](https://github.com/sst/opentui)

**Approach**: High-performance differential renderer with native code

**Status**: Currently in development.
From their README:
> “It is currently in development and is not ready for production use.”

Powers OpenCode and will be the foundation for terminaldotshop.
~6.2k stars.

**Key implementation details**:
- **Double-buffered rendering**: `currentRenderBuffer` vs `nextRenderBuffer`
- **Per-cell comparison** with 4 attributes: char, fg color, bg color, attributes
- **SIMD color comparison** with epsilon tolerance (COLOR_EPSILON_DEFAULT = 0.00001)
- **Run-length encoding** for ANSI output (adjacent same-style cells share codes)
- **Hit grid** for O(1) mouse event dispatch
- **Threaded output** to prevent I/O blocking

**Buffer structure** (from renderer.zig):
```
buffer: {
    char: []u32,      // Unicode codepoint
    fg: []RGBA,       // Foreground color (4 floats)
    bg: []RGBA,       // Background color (4 floats)
    attributes: []u32 // Bold, italic, underline, link IDs
}
```

**Render loop** (simplified):
1. Frame callbacks execute
2. Component tree renders to `nextRenderBuffer`
3. Post-processing functions run
4. Native renderer diffs `nextRenderBuffer` vs `currentRenderBuffer`
5. Only changed cells generate ANSI sequences
6. Output wrapped in DEC 2026 sync

**Lessons**:
- Cell-level diffing with parallel arrays is very efficient
- Color epsilon prevents spurious updates from floating-point roundtrip
- Native code (Zig/Rust) can achieve sub-millisecond frame times
- TypeScript FFI works well for this pattern

#### 4.1.3 ansi-diff (JavaScript) - [github.com/mafintosh/ansi-diff](https://github.com/mafintosh/ansi-diff)

**Approach**: Simple line-based diffing library

**Key implementation details**:
- **Line-by-line comparison** with `same(a, b)` checking y, width, raw content, newline
- **Inline partial updates** when beneficial (left + right diff > 4 chars saved)
- **Cursor position tracking** with relative movements only
- **Unicode-aware** via wcwidth for accurate positioning
- **Word wrap handling** with terminal width awareness

**API**:
```javascript
var diff = require('ansi-diff')({ width: process.stdout.columns });
process.stdout.write(diff.update('new content'));
```

**Lessons**:
- Line-level diffing is simpler than cell-level
- Relative cursor movements minimize ANSI output
- Good enough for many use cases
- ~200 lines of code, easy to understand

#### 4.1.4 OpenCode/Crush (Go + Bubble Tea) - [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode)

**Approach**: Full TUI with viewport-based caching

**Key implementation details**:
- **Alternate screen buffer** (full TUI mode)
- **Message caching** per message ID + width for efficient rerender
- **Viewport model** (Charmbracelet’s viewport.Model) handles scrolling
- **Overlay placement** with character-by-character positioning
- **Pub/sub events** for status updates with TTL-based clearing

**Message list cache pattern** (from list.go):
```go
type messagesCmp struct {
    viewport      viewport.Model
    cachedContent map[string]cacheItem  // ID → rendered content
    rendering     bool                   // Prevent partial renders
}
```

**Lessons**:
- Caching rendered content by ID is effective
- Viewport handles scrolling complexity
- Bubble Tea’s Elm architecture works well for TUI
- Overlay system useful for modals/permissions

#### 4.1.5 Toad (Python + Textual) - [github.com/batrachianai/toad](https://github.com/batrachianai/toad)

**Approach**: Full TUI with ACP protocol support

**Key ACP handling** (from acp/agent.py):
- Tool calls stored in dict keyed by `tool_call_id`
- Updates merge non-None fields into existing tool_calls
- Streaming via Textual’s MarkdownStream API
- Future-based async coordination for permissions

**Reactive widget updates** (from widgets/tool_call.py):
```python
@tool_call.setter
def tool_call(self, tool_call: protocol.ToolCall):
    self._tool_call = tool_call
    self.refresh(recompose=True)  # Full rebuild
```

**Content pruning** (from widgets/conversation.py):
- `prune_window(low_mark, high_mark)` removes old content
- Preserves memory bounds in long sessions
- Configurable via settings

**Lessons**:
- ACP message types map cleanly to widget updates
- Reactive properties simplify state management
- Full recompose on update is expensive for many tools
- Pruning strategy essential for long sessions
- Textual’s streaming markdown API is convenient

#### 4.1.6 Implementation Comparison Matrix

| Aspect | Claude Code | OpenTUI | ansi-diff | OpenCode | Toad | Amp | Ink |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Language** | TypeScript | TS + Zig | JavaScript | Go | Python | TypeScript | TypeScript |
| **Screen mode** | Primary | Alternate | Primary | Alternate | Alternate | Alternate | Both* |
| **Diff level** | Cell | Cell | Line | None (cache) | None (recompose) | Cell | None (full) |
| **ANSI sync** | DEC 2026 | DEC 2026 | No | No | No | No | No |
| **Scrollback** | ⚠️ Partial | Lost | Preserved | Lost | Lost | Lost | Destroyed** |
| **Performance** | High | Very High | Medium | High | Medium | High | Medium |
| **Complexity** | High | Very High | Low | Medium | Medium | High | Low |
| **Production** | ✅ Yes | ❌ Dev | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

*Ink uses primary screen by default but can use alternate via `fullscreen-ink`. **Ink
destroys scrollback when output exceeds viewport height in primary mode.

* * *

### 4.2 Options Considered (Summary)

| Option | Approach | Scrollback | Dynamic Updates | Complexity |
| --- | --- | --- | --- | --- |
| **A: Full TUI** | Alternate screen | ❌ Lost | ✅ Full control | Medium |
| **B: Sequential** | Print only | ✅ Perfect | ❌ None | Low |
| **C: Diff Renderer** | Cell-level diff | ⚠️ Partial | ✅ Viewport | High |
| **D: Clam Protocol** | Semantic codes | ✅ Perfect | ✅ Via overlays | Medium |
| **E: Status Bar** | Bottom line only | ✅ Perfect | ⚠️ Limited | Low |

**Recommended path**: Start with Option B or E for simplicity, then implement Option C
for Claude Code-like UX, with Option D as the long-term vision for Clam-native
experience.

* * *

## Recommendations

### Immediate (v0.2)

1. **Study Claude Code’s differential renderer approach** in detail:
   - They’ve solved most of the hard problems
   - React + custom renderer is proven
   - Synchronized output (DEC 2026) is critical
   - Consider whether we can adopt similar patterns

2. **For MVP, use simpler approach (Status Bar or Sequential)**:
   - Single status line at bottom (Option E), or
   - Pure sequential output (Option B) for simplicity
   - Either works while we build more sophisticated solution

3. **Emit Clam codes even if not interpreted yet**:
   - Prepare for future Clam support
   - Codes will be ignored by non-Clam terminals
   - Start with tool.status events

### Medium-Term (v0.3-v0.4)

4. **Implement differential renderer (Option C)** if needed:
   - Follow Claude Code’s proven architecture
   - React components → layout → diff → ANSI
   - TypedArray buffers for performance
   - Synchronized output mode

5. **Add DEC 2026 support to Clam terminal**:
   - Ghostty already supports it
   - Critical for flicker-free rendering
   - Batch updates atomically

### Long-Term (v1.0+)

6. **Full Clam Protocol Implementation (Option D)**:
   - This is where Clam can differentiate
   - Since we control the terminal emulator, we can go beyond ANSI
   - Rich tool cards with progress, diffs, permissions
   - **Overlays that update even in scrollback**
   - Popovers, copy buttons, diff viewers

**Key insight:** Claude Code proves that sophisticated viewport updates + scrollback
preservation is possible with the differential renderer approach.
But they can’t update scrollback content.
Clam can potentially go further with custom protocols.

### General Principles

1. **Never corrupt scrollback** - if update might fail, don’t try
2. **Graceful degradation** - always have a text-only fallback
3. **SSH-first** - assume remote execution is common
4. **Input availability** - user can always type
5. **Learn from Claude Code** - they’ve solved hard problems, study their approach

* * *

### 4.3 Progressive Enhancement: From Text to GUI

#### 4.3.1 The Kerm Codes Philosophy

The kermg project (from which Clam draws inspiration) establishes a key design
principle: **start with Claude Code-like text output that works everywhere, then add
Clam codes that upgrade to proper graphical elements when running in Clam terminal**.

This is **progressive enhancement** for terminal UIs:
1. **Base layer**: Plain text output (works in any terminal, over SSH, in tmux)
2. **Semantic layer**: Clam codes that attach metadata to text (ignored by non-Clam
   terminals)
3. **Rich layer**: Clam interprets codes and renders proper GUI overlays

#### 4.3.2 Protocol Constants (from kermg)

```typescript
// From @kerm/kerm-codes
export const KC_VERSION = 0;        // Protocol version
export const KERM_OSC = 77;         // OSC number for Kerm/Clam codes
export const KUI_PROTOCOL = 'kui:'; // Short protocol for anchors
export const KUI_SCHEME = 'kui://'; // Full scheme for resources
```

The `KUI` (Kerm UI) protocol provides semantic anchors that Clam can interpret.

#### 4.3.3 Widget Upgrade Path

Each UI element can be implemented in three tiers:

| Widget | Base (Text) | Enhanced (ANSI) | Rich (Clam Overlays) |
| --- | --- | --- | --- |
| **Tool status** | `⟳ Running tests...` | Spinner animation, colors | Progress bar, expandable card |
| **Tool completion** | `✓ Complete (3.2s)` | Green checkmark | Collapsible output, copy button |
| **Diff preview** | `diff: +12 -5 lines` | Color-coded summary | Side-by-side diff viewer popover |
| **Permission prompt** | `Allow? [y/n]` | Numbered options | Clickable buttons, scope selector |
| **Code block** | Indented text | Syntax highlighting | Copy button, language badge |
| **File reference** | `src/index.ts:42` | OSC 8 hyperlink | Inline preview, jump-to-line |
| **Error** | `Error: ...` | Red text | Expandable stack trace, fix suggestions |
| **Thinking** | `Thinking...` | Collapsed by default | Expandable reasoning panel |

#### 4.3.4 Implementation Examples

#### 1. Tool Status Widget

**Base (any terminal):**
```
⟳ Tool: Running npm test...
```

**Enhanced (ANSI-capable terminal):**
```ansi
\x1b[33m⟳\x1b[0m Tool: \x1b[1mRunning npm test...\x1b[0m \x1b[90m[3s]\x1b[0m
```

**With Clam code (Clam terminal):**
```
⟳ Tool: Running npm test...\x1b]77;{"t":"tool.status","id":"tool-123","status":"running","progress":0.45}\x07
```

**Clam interpretation:**
- Parse the KUI event from OSC 77
- Attach an overlay to the line
- Render a real progress bar (45%)
- Update overlay when `tool.status` event with same `id` arrives with new progress
- When complete, show checkmark and timing

#### 2. Diff Preview Widget

**Base:**
```
▶ Diff: src/config.ts (+12 -5)
```

**Enhanced (with OSC 8 link):**
```
\x1b]8;;file://src/config.ts\x07▶ Diff: src/config.ts\x1b]8;;\x07 (+12 -5)
```

**With Clam code:**
```
▶ Diff: src/config.ts (+12 -5)\x1b]77;{"t":"diff","id":"diff-456","path":"src/config.ts","additions":12,"deletions":5,"preview":"..."}\x07
```

**Clam interpretation:**
- On click, show side-by-side diff viewer popover
- Syntax highlighting in diff view
- “Apply” / “Reject” buttons
- Copy button for changed code

#### 3. Permission Prompt Widget

**Base:**
```
Claude wants to run: rm -rf node_modules
Allow? [y/n/a/r]:
```

**Enhanced:**
```ansi
\x1b[1mClaude wants to run:\x1b[0m \x1b[93mrm -rf node_modules\x1b[0m

  \x1b[32m(y)\x1b[0m Allow once
  \x1b[32m(a)\x1b[0m Allow always
  \x1b[31m(n)\x1b[0m Reject once
  \x1b[31m(r)\x1b[0m Reject always

Choice:
```

**With Clam code:**
```
\x1b]77;{"t":"permission","id":"perm-789","command":"rm -rf node_modules","options":["allow_once","allow_always","reject_once","reject_always"]}\x07
```

**Clam interpretation:**
- Render as button row with proper styling
- Click → inject selection to stdin
- Keyboard shortcuts (y/n/a/r) still work
- Visual feedback on selection

#### 4.3.5 Architecture for Progressive Enhancement

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Application (clam-acp CLI)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  OutputWriter Interface                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  toolStatus(id, status, progress?)                                  ││
│  │  diff(id, path, additions, deletions, preview?)                     ││
│  │  permission(id, command, options)                                   ││
│  │  codeBlock(language, code)                                          ││
│  │  error(message, stack?)                                             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Renderer (selected by CLAM_TERMINAL env or capability query)       ││
│  │                                                                      ││
│  │  PlainTextRenderer      - Just text, works everywhere               ││
│  │  AnsiRenderer           - Colors, OSC 8 links, basic formatting     ││
│  │  ClamRenderer           - Full Clam codes with KUI events           ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│                              ▼                                           │
│                         stdout (sequential, no cursor positioning)       │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Terminal Emulator                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Standard Terminal (iTerm, Kitty, Alacritty, etc.)                      │
│  - Shows text + ANSI colors                                              │
│  - OSC 77 codes ignored (unknown sequence)                               │
│  - Full scrollback preserved                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Clam Terminal                                                           │
│  - Shows text + ANSI colors (same base)                                  │
│  - Parses OSC 77 codes, stores overlay metadata                          │
│  - Renders overlays on hover/click:                                      │
│    • Progress bars for tool status                                       │
│    • Diff viewer popovers                                                │
│    • Permission button rows                                              │
│    • Code block copy buttons                                             │
│  - Full scrollback preserved (overlays are additive)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.3.6 Key Design Principles

1. **Text is authoritative**: The text content must make sense on its own.
   Clam codes are metadata that enhance, not replace.

2. **Sequential output only**: Never use cursor repositioning for content output.
   This preserves true scrollback.
   (Input editing can use cursor positioning.)

3. **Graceful degradation**: Every feature must have a text-only fallback.
   Users on standard terminals or SSH get a complete (if less rich) experience.

4. **SSH-first**: Clam codes are just bytes in the stream.
   They flow through SSH, and the local Clam terminal interprets them.

5. **Overlays are additive**: Text scrollback remains native terminal scrollback.
   Clam overlays are rendered on top, don’t modify the underlying text.

6. **Anchors by line**: Overlays anchor to specific lines in scrollback.
   When the user scrolls, overlays move with their anchored lines.

#### 4.3.7 Capability Detection

The CLI should detect terminal capabilities:

```typescript
function detectRenderer(): Renderer {
  // Check for Clam terminal
  if (process.env.CLAM_TERMINAL === '1') {
    return new ClamRenderer();
  }

  // Query terminal for capabilities (XTGETTCAP or similar)
  // For now, check common env vars
  if (process.env.TERM_PROGRAM === 'Clam') {
    return new ClamRenderer();
  }

  // Check for color support
  if (supportsColor.stdout.has256 || process.env.COLORTERM) {
    return new AnsiRenderer();
  }

  // Fallback to plain text
  return new PlainTextRenderer();
}
```

#### 4.3.8 Clam Code Protocol Sketch

Building on the KUI types from the earlier research:

```typescript
// Events emitted by CLI via OSC 77
type ClamEvent =
  // Block lifecycle
  | { t: 'block.start'; id: string; kind: BlockKind; summary: string }
  | { t: 'block.update'; id: string; patch: Partial<BlockData> }
  | { t: 'block.end'; id: string; status: 'complete' | 'error' | 'cancelled' }

  // Tool-specific
  | { t: 'tool.status'; id: string; status: ToolStatus; progress?: number }
  | { t: 'tool.output'; id: string; stream: 'stdout' | 'stderr'; chunk: string }

  // Diff
  | { t: 'diff'; id: string; path: string; oldContent?: string; newContent?: string }

  // Permissions
  | { t: 'permission.request'; id: string; resource: string; action: string; options: PermissionOption[] }
  | { t: 'permission.response'; id: string; choice: string }

  // Anchoring
  | { t: 'anchor'; id: string; line: 'current' | number; col?: [number, number] }

  // Actions (buttons that inject input)
  | { t: 'action'; id: string; label: string; inject: string };

type BlockKind = 'tool' | 'diff' | 'code' | 'thinking' | 'error' | 'message';
type ToolStatus = 'pending' | 'running' | 'complete' | 'error';

type PermissionOption = {
  id: string;           // 'allow_once', 'allow_always', etc.
  label: string;        // 'Allow once'
  shortcut?: string;    // 'y'
  inject: string;       // What to inject to stdin when selected
};
```

#### 4.3.9 Migration Path

1. **Phase 1 (Now)**: Implement sequential text output with basic ANSI formatting.
   Emit Clam codes that will be ignored by non-Clam terminals.

2. **Phase 2 (Clam 0.3)**: Implement Clam code parser in terminal.
   Render simple overlays (tooltips, status badges).

3. **Phase 3 (Clam 0.4)**: Rich overlays - diff viewer, permission prompts, collapsible
   sections.

4. **Phase 4 (Clam 1.0)**: Full interactive experience - draggable panels, persistent
   overlays, custom widgets.

The key insight: **we can emit Clam codes today**, even before Clam supports them.
This prepares the protocol and allows testing without breaking non-Clam users.

* * *

## Part 5: Redesigning Terminal Features (With Full Control)

The previous sections analyzed how to work within existing terminal constraints.
But Clam *is* the terminal.
This section explores: **what would we build differently if we had 100% control?**

### 5.1 Why Current Terminals Make This Hard

The fundamental constraints come from 1970s-era VT100 design:

| Constraint | Why It Exists | Impact |
| --- | --- | --- |
| **Immutable scrollback** | Scrollback is just a buffer of past output | Can't update tool status after it scrolls |
| **Character grid only** | Designed for text, not GUI elements | Progress bars = ASCII art |
| **Cursor-based updates** | Only one cursor, moves sequentially | Can't update multiple regions simultaneously |
| **No semantics** | Terminal sees characters, not structure | Can't distinguish "tool card" from "message" |
| **One-way protocol** | App → terminal (mostly) | Terminal can't notify app of clicks/hovers |
| **No layers** | Single plane of characters | Overlays require hacks |

### 5.2 What Clam Could Add: A New Terminal Protocol Layer

Clam can maintain full ANSI compatibility while adding a **semantic layer** on top.
The key insight: **text remains authoritative, semantics are additive**.

#### 5.2.1 Semantic Regions (Blocks)

Instead of just a character grid, Clam tracks **semantic regions**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Standard scrollback (ANSI text)                                 │
│  ─────────────────────────────────────────────────────────────── │
│  > User: Fix the tests                                           │
│  ┌─ block:msg-1 ─────────────────────────────────────────────┐   │
│  │ Claude: I'll run the tests first...                       │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌─ block:tool-1 (type=tool, status=running) ────────────────┐   │
│  │ ⟳ Running npm test...                                     │   │
│  │   [Clam renders: progress bar overlay, expandable output] │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌─ block:tool-2 (type=tool, status=complete) ───────────────┐   │
│  │ ✓ Edited src/index.ts                                     │   │
│  │   [Clam renders: diff preview overlay, copy button]       │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key capability:** Blocks can be **updated after creation**, even in scrollback:
```typescript
// App emits block marker
\x1b]77;{"t":"block.start","id":"tool-1","kind":"tool"}\x07
⟳ Running npm test...
\x1b]77;{"t":"block.end","id":"tool-1"}\x07

// Later, app emits update (tool completed)
\x1b]77;{"t":"block.update","id":"tool-1","status":"complete","duration":"3.2s"}\x07

// Clam updates the overlay on block tool-1
// Text remains "⟳ Running npm test..." but overlay shows ✓
```

#### 5.2.2 Overlay Layer

Clam maintains a separate **overlay layer** rendered on top of scrollback:

```
┌─────────────────────────────────────────────────────────────────┐
│                        OVERLAY LAYER                             │
│  (rendered on top, can update independently)                     │
├─────────────────────────────────────────────────────────────────┤
│  [Progress: ████████░░ 80%]  anchored to line 15                 │
│  [✓ Complete 3.2s]           anchored to line 18                 │
│  [Copy] [View Diff]          anchored to line 20                 │
├─────────────────────────────────────────────────────────────────┤
│                        TEXT LAYER                                │
│  (standard scrollback, immutable once written)                   │
├─────────────────────────────────────────────────────────────────┤
│  Line 15: ⟳ Running npm test...                                  │
│  Line 18: ⟳ Editing src/index.ts...                              │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Overlays update without modifying text (no cursor positioning)
- Overlays scroll with their anchor lines
- Overlays can be interactive (buttons, inputs)
- Text layer remains valid scrollback (copy/paste works)

#### 5.2.3 Bidirectional Event System

Current terminals are mostly one-way (app → terminal).
Clam adds **terminal → app**:

```typescript
// User clicks "View Diff" button on tool-2
// Clam sends to app's stdin (or separate channel):
{"t":"event.click","block":"tool-2","action":"view_diff"}

// App responds with content for popover
\x1b]77;{"t":"popover.show","anchor":"tool-2","content":{...}}\x07
```

**Events Clam could send:**
- `click` - User clicked overlay element
- `hover.enter` / `hover.leave` - Mouse over block
- `expand` / `collapse` - User toggled section
- `scroll` - Viewport scroll position changed
- `resize` - Terminal resized

#### 5.2.4 Native Widget Primitives

Instead of rendering widgets as characters, Clam provides **native widgets**:

| Widget | Character Rendering | Native Clam Widget |
| --- | --- | --- |
| **Progress bar** | `[████░░░░] 40%` | Smooth animated bar, percentage, ETA |
| **Spinner** | `-\|/-\|/` cycling | Smooth animation, multiple styles |
| **Button** | `[OK]` or `(y)` | Clickable, hover state, keyboard shortcut |
| **Diff** | `+line` / `-line` | Side-by-side view, syntax highlighting |
| **Code block** | Indented text | Syntax highlighting, copy button, line numbers |
| **Collapsible** | `▶ Summary` | Animated expand/collapse, lazy content |

#### 5.2.5 Virtual/Lazy Content

Some content shouldn’t exist in scrollback until requested:

```typescript
// App marks region as collapsible with lazy content
\x1b]77;{"t":"collapse","id":"thinking-1","summary":"Thinking...","lazy":true}\x07

// Clam shows only "▶ Thinking..." in scrollback
// Full content stored in overlay manager, not text buffer
// On expand: content rendered in popover or inline
```

**Benefits:**
- Long tool outputs don’t flood scrollback
- “Thinking” sections hidden by default
- Large diffs shown as summary until expanded
- Memory efficient for long sessions

### 5.3 Clam’s Internal Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clam Terminal                            │
├─────────────────────────────────────────────────────────────────┤
│  Text Buffer (standard scrollback)                               │
│  - Character grid, ANSI styling                                  │
│  - Copy/paste source, immutable once written                     │
├─────────────────────────────────────────────────────────────────┤
│  Block Registry                                                  │
│  - Map<id, {kind, startLine, endLine, metadata}>                 │
│  - Tracks semantic structure, updated via OSC 77                 │
├─────────────────────────────────────────────────────────────────┤
│  Overlay Manager                                                 │
│  - List<{anchor, widget, state}>                                 │
│  - Renders on top of text, handles events                        │
├─────────────────────────────────────────────────────────────────┤
│  Event Router                                                    │
│  - Routes clicks/hovers to overlays                              │
│  - Sends events to app via stdin or side channel                 │
├─────────────────────────────────────────────────────────────────┤
│  Render Pipeline                                                 │
│  1. Render text buffer (standard terminal)                       │
│  2. For each visible block: render overlay                       │
│  3. Render input area (special handling)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Comparison: With vs Without Terminal Control

| Capability | Standard Terminal | Clam Terminal |
| --- | --- | --- |
| **Update scrollback** | ❌ Impossible | ✅ Via overlay updates |
| **Progress bars** | ⚠️ ASCII art, cursor tricks | ✅ Native widget |
| **Concurrent tool status** | ⚠️ Cursor repositioning | ✅ Independent overlay updates |
| **Collapsible sections** | ❌ Not possible | ✅ Native collapse widget |
| **Click handlers** | ⚠️ OSC 8 links only | ✅ Any element clickable |
| **Diff viewer** | ⚠️ Print to scrollback | ✅ Side-by-side popover |
| **Input during streaming** | ⚠️ Complex cursor management | ✅ Separate input area |
| **SSH compatibility** | ✅ Native | ✅ Protocol flows through |

### 5.5 What This Enables for AI Coding Agents

With these terminal features, a Clam-native AI agent could provide:

1. **Real-time tool dashboard** - Multiple tools with live progress bars, collapsible
   outputs, all updating smoothly without cursor tricks

2. **Inline diff review** - Click file reference → popover with syntax-highlighted diff,
   approve/reject buttons

3. **Permission prompts as buttons** - Native button row instead of `[y/n]`, visual
   feedback on selection

4. **Expandable reasoning** - “Thinking” sections collapsed by default, expand to see
   full reasoning

5. **Context-aware copy** - Click code block → copy code (not surrounding text)

6. **Session persistence** - Blocks with IDs enable session save/restore with semantic
   structure

7. **Smooth scrollback** - Scroll up during streaming, overlays update in background

### 5.6 Protocol Design Principles

1. **Text is always valid** - Strip OSC 77 codes → valid terminal output
2. **Overlays are hints** - App suggests overlays, terminal decides rendering
3. **Graceful degradation** - Non-Clam terminals ignore codes, show text fallback
4. **Stateless updates** - Each update contains full state, no complex sync
5. **SSH-transparent** - OSC 77 codes are just bytes, flow through SSH unchanged

### 5.7 Implementation Phases

| Phase | Features | Clam Version |
| --- | --- | --- |
| **Phase 1** | OSC 77 parser, block registry, simple overlays (badges) | 0.3 |
| **Phase 2** | Click events, button widgets, popover system | 0.4 |
| **Phase 3** | Collapsible sections, lazy content, diff viewer | 0.5 |
| **Phase 4** | Full widget library, rich input, session save/restore | 1.0 |

**Key insight:** We can start emitting OSC 77 codes **now** from the CLI. Non-Clam
terminals ignore them.
When Clam adds support, features light up automatically.

* * *

## Next Steps

- [ ] Implement status bar approach for immediate use
- [ ] Design Clam UI protocol specification (kui events)
- [ ] Prototype viewport tracking for Option C
- [ ] Study Claude Code’s exact terminal handling (if source available)
- [ ] Benchmark terminal update performance (how often can we update?)
- [ ] Design overlay infrastructure for Clam Phase 2
- [ ] Implement OutputWriter interface with renderer abstraction
- [ ] Define initial Clam code schema (start with tool.status, diff, permission)
- [ ] Create test harness for Clam code parsing

* * *

## References

### Related Clam Research

- [ACP + Clam Terminal UI](research-2026-02-02-acp-clam-terminal-ui.md) - Foundational
  research on scrollback-first ACP client
- [Richer Terminal UIs](research-2026-02-03-richer-terminal-shell-uis.md) - Hybrid
  NL/command UX patterns
- [Terminal UI Libraries](research-2026-02-03-terminal-ui-libraries-for-typescript.md) -
  Survey of TypeScript terminal libraries
- [Shell UX TypeScript](research-2026-02-04-shell-ux-typescript.md) - Shell frameworks
  and performance
- [Streaming Markdown](research-2026-02-04-streaming-markdown-rendering.md) - Streaming
  markdown rendering patterns

### Terminal Protocols

- [OSC 8 Hyperlinks](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
  \- Terminal hyperlink standard
- [Kitty Graphics Protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/) - Image
  protocol
- [Kitty Keyboard Protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) -
  Enhanced keyboard handling
- [iTerm2 Inline Images](https://iterm2.com/documentation-images.html) - OSC 1337

### AI Coding Agents

- [OpenCode](https://github.com/opencode-ai/opencode) - Go TUI coding agent (now Crush)
- [Aider](https://github.com/Aider-AI/aider) - Python AI pair programming (40k+ stars)
- [Toad](https://github.com/batrachianai/toad) - Textual-based ACP client
- [Wave Terminal](https://github.com/wavetermdev/waveterm) - Rich GUI terminal
- [Amp Code](https://ampcode.com) - Sourcegraph’s AI coding agent (alternate screen)
- [pi-mono](https://github.com/badlogic/pi-mono) - AI agent toolkit with pi-tui
  differential rendering library
  ([technical write-up](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/))

### Reverse Engineering Resources

- [claude-code-reverse](https://github.com/Yuyz0112/claude-code-reverse) - API
  interception and visualization (~1.7k stars)
- [ShareAI Lab Report](https://www.blog.brightcoding.dev/2025/07/17/inside-claude-code-a-deep-dive-reverse-engineering-report/)
  \- 50k+ lines deobfuscated, Apache 2.0
- [Reid Barber Analysis](https://www.reidbarber.com/blog/reverse-engineering-claude-code)
  \- Architecture breakdown
- [Peter Steinberger - The Signature Flicker](https://steipete.me/posts/2025/signature-flicker)
  \- Differential renderer analysis

### TUI Frameworks

- [Ink](https://github.com/vadimdemedes/ink) - React for CLI (destroys scrollback on
  tall output)
- [fullscreen-ink](https://www.npmjs.com/package/fullscreen-ink) - Alternate screen
  wrapper for Ink
- [OpenTUI](https://github.com/sst/opentui) - TypeScript + Zig differential renderer (in
  development)
- [Textual](https://github.com/Textualize/textual) - Python TUI framework
- [Bubble Tea](https://github.com/charmbracelet/bubbletea) - Go TUI framework
- [Rich](https://github.com/Textualize/rich) - Python terminal formatting
- [ansi-diff](https://github.com/mafintosh/ansi-diff) - Simple line-based diffing (~200
  LOC)

### ANSI Escape Codes

- [ANSI Escape Codes Reference](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797)
  \- Comprehensive guide
- [XTerm Control Sequences](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html) -
  Official XTerm documentation
