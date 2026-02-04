---
title: Research Brief - Terminal UI Libraries
description: Survey of rich terminal libraries for TypeScript and bindable languages
author: Joshua Levy with Claude assistance
---

# Research: Terminal UI Libraries for Modern TypeScript CLIs

**Date:** 2026-02-03 (last updated 2026-02-03)

**Author:** Joshua Levy with Claude assistance

**Status:** Complete

## Overview

A comprehensive survey of terminal UI libraries available for TypeScript/Node.js
applications, including libraries in other languages (Rust, Go) with Node.js bindings.
Special focus on:

1. **Scrollback compatibility** - Does it work with native terminal scrollback?
2. **Autocomplete/completion** - Tab completion, inline suggestions, fuzzy matching
3. **Modern feel** - Ghost text, syntax highlighting, rich prompts
4. **Maintenance status** - Active development, community size

This research informs the clam-code project’s input handling strategy.

## Questions to Answer

1. What TypeScript/Node.js terminal libraries exist for rich input?
2. Which libraries are scrollback-compatible (no alternate screen)?
3. What Rust/Go libraries have Node.js bindings?
4. What are the trade-offs between different approaches?
5. Which libraries are actively maintained in 2025-2026?

## Scope

**Included:**

- Node.js/TypeScript terminal input libraries
- Rust libraries with napi-rs or neon bindings
- Go libraries with wasm or cgo bindings
- Python libraries (for pattern reference)
- Autocomplete, completion, and rich prompt features
- TUI frameworks (for comparison)

**Excluded:**

- Web-based terminal emulators (xterm.js, etc.)
- Full terminal multiplexers (tmux, screen)
- GUI toolkits

---

## Findings

### Category 1: Node.js Readline Extensions

These extend Node’s built-in readline with additional features.

#### 1.1 readline (Node.js built-in)

**What it is:** Node.js standard library for line-by-line input.

**Scrollback compatible:** Yes (native, no cursor tricks)

**Features:**

- Basic Tab completion via `completer` option
- History navigation (up/down arrows)
- Full Emacs-style line editing (see keybindings below)
- Signal handling (SIGINT)

**Built-in Emacs keybindings (work automatically):**

| Category       | Keybinding        | Action                           |
| -------------- | ----------------- | -------------------------------- |
| **Navigation** | `Ctrl+A`          | Beginning of line                |
|                | `Ctrl+E`          | End of line                      |
|                | `Ctrl+B`          | Back one character               |
|                | `Ctrl+F`          | Forward one character            |
|                | `Alt+B`           | Back one word                    |
|                | `Alt+F`           | Forward one word                 |
| **Editing**    | `Ctrl+K`          | Kill to end of line              |
|                | `Ctrl+U`          | Kill to beginning of line        |
|                | `Ctrl+W`          | Kill previous word               |
|                | `Alt+D`           | Kill next word                   |
|                | `Ctrl+Y`          | Yank (paste) killed text         |
|                | `Ctrl+T`          | Transpose characters             |
|                | `Alt+T`           | Transpose words                  |
|                | `Ctrl+H`          | Delete backward (backspace)      |
|                | `Ctrl+D`          | Delete forward (or EOF if empty) |
| **History**    | `Up` / `Ctrl+P`   | Previous history                 |
|                | `Down` / `Ctrl+N` | Next history                     |
| **Other**      | `Ctrl+L`          | Clear screen                     |
|                | `Ctrl+C`          | SIGINT (interrupt)               |
|                | `Tab`             | Completion (via completer)       |

**Note:** `Alt+*` keybindings use escape sequences and may not work in all terminals,
especially over SSH or in certain terminal emulators.
`Ctrl+R` (reverse search) is **NOT** built-in to Node.js readline.

**Limitations:**

- No inline suggestions (ghost text)
- No fuzzy matching
- Basic completion display (just lists options)
- No colors in completion menu
- No `Ctrl+R` reverse search (would need custom implementation)
- No Vi mode (Emacs only)

**Example:**

```typescript
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => {
    const commands = ['/help', '/quit', '/status'];
    const hits = commands.filter((c) => c.startsWith(line));
    return [hits, line];
  },
});
```

**Verdict:** Good baseline for scrollback-safe completion.
Use for slash commands.

---

#### 1.2 Google’s zx

**What it is:** Tool for writing shell scripts in JavaScript/TypeScript.

**Scrollback compatible:** Yes (wraps readline)

**Features:**

- `question()` function wraps readline for user input
- Comes with chalk, minimist, fetch, fs-extra built-in
- TypeScript support out of the box
- Cross-platform

**Example:**

```typescript
import { question } from 'zx';
let answer = await question('What is your name? ');
```

**Limitations:**

- Just a readline wrapper, no additional completion features
- Designed for scripts, not interactive REPLs

**Source:** https://github.com/google/zx

**Verdict:** Good for scripts, but no advantage over raw readline for our use case.

---

#### 1.3 readline-sync

**What it is:** Synchronous readline for Node.js.

**Scrollback compatible:** Yes

**Status:** Maintenance mode (last update 2020)

**Verdict:** Avoid - synchronous API is problematic, unmaintained.

---

### Category 2: Interactive Prompt Libraries

Full-featured prompt libraries with rich UX.

#### 2.1 Inquirer.js / @inquirer/prompts

**What it is:** The most popular interactive prompt library for Node.js.

**Scrollback compatible:** Partial - depends on prompt type

| Prompt Type  | Scrollback Safe? | Notes                           |
| ------------ | ---------------- | ------------------------------- |
| input        | Yes              | Basic text input                |
| confirm      | Yes              | y/n prompt                      |
| list         | No               | Uses cursor positioning         |
| checkbox     | No               | Uses cursor positioning         |
| autocomplete | No               | Renders menu with cursor tricks |

**Features:**

- Extensive prompt types
- Theming support
- Validation
- Transformers

**Key insight:** The `@inquirer/autocomplete` package uses cursor positioning to render
the completion menu inline.
Not scrollback-safe.

**Source:** https://github.com/SBoudrias/Inquirer.js

**Verdict:** Use for simple prompts (input, confirm).
Avoid for autocomplete.

---

#### 2.2 prompts

**What it is:** Lightweight alternative to Inquirer.

**Scrollback compatible:** Partial - same issues as Inquirer

**Features:**

- Simpler API than Inquirer
- Autocomplete with fuzzy search
- Multi-select
- Toggle, date, number inputs

**Autocomplete behavior:**

- Renders dropdown menu using cursor positioning
- Clears menu when selection made
- Not scrollback-safe

**Source:** https://github.com/terkelg/prompts

**Verdict:** Same trade-offs as Inquirer.
Not for clam-code autocomplete.

---

#### 2.3 Enquirer

**What it is:** Stylish, intuitive prompts.

**Scrollback compatible:** No - uses alternate screen for complex prompts

**Features:**

- Beautiful default styling
- Autocomplete with highlighting
- Snippet prompts
- Scale/slider prompts

**Source:** https://github.com/enquirer/enquirer

**Verdict:** Not suitable - uses cursor positioning extensively.

---

### Category 3: TUI Frameworks

Full terminal UI frameworks (typically NOT scrollback-compatible).

#### 3.1 Ink (React for CLI)

**What it is:** React-based terminal UI framework.

**Scrollback compatible:** No - uses cursor positioning for layout

**Features:**

- React component model
- Flexbox-like layout
- Full-screen apps
- Rich text (colors, bold, etc.)

**How it works:**

- Renders to a virtual screen buffer
- Uses ANSI cursor positioning to update regions
- Clears screen on exit

**Used by:** Gatsby CLI, Prisma CLI, Cloudflare Wrangler

**Source:** https://github.com/vadimdemedes/ink

**Verdict:** Great for full TUI apps.
Not for scrollback-safe CLI.

---

#### 3.2 Blessed / Blessed-contrib

**What it is:** Curses-like terminal UI for Node.js.

**Scrollback compatible:** No - full alternate screen TUI

**Features:**

- Widgets (boxes, lists, tables)
- Mouse support
- Event system
- Dashboards, charts

**Status:** Unmaintained (last update 2017), but forks exist (neo-blessed)

**Source:** https://github.com/chjj/blessed

**Verdict:** Legacy.
Not suitable for new projects.

---

#### 3.3 Terminal-kit

**What it is:** Comprehensive terminal toolkit.

**Scrollback compatible:** Configurable - can work in “inline” mode

**Features:**

- Input fields with autocompletion
- Progress bars
- Menus (but uses cursor positioning)
- Image display
- Markup language

**Inline mode:**

```typescript
import term from 'terminal-kit';

// Single-line input with completion (scrollback-safe)
const input = await term.inputField({
  autoComplete: ['/help', '/quit', '/status'],
  autoCompleteMenu: false, // Disable menu for scrollback safety
});
```

**Source:** https://github.com/cronvel/terminal-kit

**Verdict:** Worth exploring - has inline mode that may be scrollback-safe.

---

### Category 4: Rust Libraries with Node.js Bindings

#### 4.1 Crossterm (Rust)

**What it is:** Cross-platform terminal manipulation library.

**Node.js bindings:** None official, but possible via napi-rs

**Features:**

- Raw mode input
- Cursor control
- Colors, styles
- Event handling (keyboard, mouse, resize)
- Kitty keyboard protocol support

**Source:** https://github.com/crossterm-rs/crossterm

**Verdict:** Would need custom bindings.
Very capable but significant work.

---

#### 4.2 Ratatui (Rust)

**What it is:** TUI framework (successor to tui-rs).

**Node.js bindings:** None

**Scrollback compatible:** No - full TUI framework

**Source:** https://github.com/ratatui-org/ratatui

**Verdict:** Not relevant - full TUI, no Node bindings.

---

#### 4.3 Rustyline (Rust)

**What it is:** Readline implementation in Rust.

**Node.js bindings:** Possible via napi-rs (would need to build)

**Scrollback compatible:** Yes - similar model to readline

**Features:**

- Tab completion with custom completers
- History
- Hints (ghost text!)
- Syntax highlighting
- Vi and Emacs modes
- Multi-line input

**Key feature - Hints:**

```rust
impl Hinter for MyHinter {
    fn hint(&self, line: &str, pos: usize) -> Option<String> {
        // Return ghost text suggestion
        Some("completion suggestion".to_string())
    }
}
```

**Source:** https://github.com/kkawakam/rustyline

**Verdict:** Excellent candidate if we build napi-rs bindings.
Has ghost text!

---

#### 4.4 Reedline (Rust) - Nushell’s Line Editor

**What it is:** Modern line editor created for Nushell, supporting completions, hints,
syntax highlighting, and more.

**Node.js bindings:** None (would need to build with napi-rs)

**Scrollback compatible:** Yes - designed for readline-style usage

**Features:**

- Autocompletion with graphical selection menu OR simple cycling inline
- History with interactive search (optionally persists to file)
- **Hints trait** - responsible for returning hint/ghost text for current line
- Configurable keybindings (emacs and basic vi modes)
- Syntax highlighting
- Multi-line editing

**Key feature - Hints (ghost text):**

```rust
// A trait that's responsible for returning the hint for the current line
pub trait Hinter: Send {
    fn handle(&mut self, line: &str, pos: usize) -> Option<String>;
}
```

**Related crates:**

- `clap-repl` - Combines clap with reedline for easy REPLs
- `reedline-repl-rs` - Interactive tab-completion with graphical selection

**Source:** https://github.com/nushell/reedline

**Verdict:** Excellent modern alternative to rustyline.
Powers Nushell. Would need napi-rs bindings but has superior hint/completion system.

---

#### 4.5 Linenoise (C) - Minimal Readline

**What it is:** Minimal BSD-licensed readline replacement (~800 lines of code).
Used by Redis, MongoDB, Android.

**Node.js bindings:** None official (would need N-API addon)

**Scrollback compatible:** Yes

**Features:**

- Single and multi-line editing
- History
- Completion
- Hints (ghost text!)
- Works everywhere (basic VT100 escape sequences)

**Why it exists:** “readline is 30k lines of code, libedit 20k. linenoise is ~800.”

**Variants:**

- `linenoise-ng` - Adds UTF-8 and Windows support (C++)

**Source:** https://github.com/antirez/linenoise

**Verdict:** Interesting minimal option.
Would need N-API bindings.
Simpler than rustyline but fewer features.

---

### Category 5: Go Libraries with Potential Bindings

#### 5.1 Bubbletea (Go)

**What it is:** Elm-inspired TUI framework for Go.

**Node.js bindings:** None (would need WASM or cgo)

**Scrollback compatible:** No - full TUI framework

**Source:** https://github.com/charmbracelet/bubbletea

**Verdict:** Great Go TUI, but not bindable to Node easily.

---

#### 5.2 go-prompt (Go)

**What it is:** Interactive prompt library for Go.

**Scrollback compatible:** No - uses cursor positioning for dropdown

**Features:**

- Autocomplete dropdown
- History
- Syntax highlighting
- Key bindings

**Source:** https://github.com/c-bata/go-prompt

**Verdict:** Not easily bindable, not scrollback-safe anyway.

---

### Category 6: Python Libraries (Pattern Reference)

#### 6.1 prompt_toolkit (Python)

**What it is:** The gold standard for Python terminal input.

**Scrollback compatible:** Configurable

**Features:**

- Completion with descriptions
- Inline suggestions (ghost text via `AutoSuggest`)
- Syntax highlighting
- Multi-line input
- Mouse support
- Emacs/Vi modes

**Key insight - Ghost text without cursor tricks:**

```python
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory

session = PromptSession(auto_suggest=AutoSuggestFromHistory())
```

The ghost text is rendered at the cursor position using standard output, not cursor
positioning. When user types, old text is overwritten naturally.

**Source:** https://github.com/prompt-toolkit/python-prompt-toolkit

**Verdict:** Best-in-class.
Study for patterns, but can’t use directly in Node.

---

#### 6.2 rich (Python)

**What it is:** Rich text formatting for terminals.

**Scrollback compatible:** Yes (for most features)

**Features:**

- Markdown rendering
- Tables
- Syntax highlighting
- Progress bars
- Tree views
- Live updating (uses cursor positioning)

**Source:** https://github.com/Textualize/rich

**Verdict:** Pattern reference for pretty output.
Not input handling.

---

### Category 7: Low-Level Terminal Libraries

#### 7.1 ansi-escapes

**What it is:** ANSI escape codes as functions.

**Scrollback compatible:** Depends on usage

**Features:**

- Cursor movement
- Screen clearing
- Colors
- Links

**Source:** https://github.com/sindresorhus/ansi-escapes

**Verdict:** Building block, not a solution.

---

#### 7.2 picocolors / chalk

**What it is:** Terminal string styling.

**Scrollback compatible:** Yes (just colors/styles)

**Source:** https://github.com/alexeyraspopov/picocolors

**Verdict:** Already using picocolors.
Good choice.

---

### Category 8: Autocomplete-Specific Libraries

#### 8.1 cli-autocomplete

**What it is:** Simple autocomplete for CLI apps.

**Status:** Unmaintained (2019)

**Verdict:** Avoid.

---

#### 8.2 Omelette

**What it is:** Shell autocomplete generator.

**What it does:** Generates shell completion scripts (bash, zsh, fish).

**Not:** Runtime autocomplete in Node.js.

**Source:** https://github.com/f/omelette

**Verdict:** Different use case - generates shell completion files.

---

## Scrollback Compatibility Summary

| Library                   | Language | Scrollback Safe | Ghost Text | Emacs Keys | Vi Mode | Ctrl+R | Active | Notes                 |
| ------------------------- | -------- | --------------- | ---------- | ---------- | ------- | ------ | ------ | --------------------- |
| **Node.js Native**        |          |                 |            |            |         |        |        |                       |
| Node readline             | TS/JS    | Yes             | No         | Yes        | No      | No     | Yes    | Built-in, basic       |
| Google zx                 | TS/JS    | Yes             | No         | Yes        | No      | No     | Yes    | Readline wrapper      |
| terminal-kit              | TS/JS    | Partial         | No         | Yes        | No      | No     | Yes    | Has inline mode       |
| @inquirer/input           | TS/JS    | Yes             | No         | Yes        | No      | No     | Yes    | Basic input only      |
| prompts                   | TS/JS    | No              | No         | Partial    | No      | No     | Slow   | Dropdown menus        |
| **TUI Frameworks**        |          |                 |            |            |         |        |        |                       |
| Ink                       | TS/JS    | No              | N/A        | N/A        | N/A     | N/A    | Yes    | Full TUI (React)      |
| Blessed                   | JS       | No              | N/A        | N/A        | N/A     | N/A    | No     | Legacy, unmaintained  |
| **Rust (needs bindings)** |          |                 |            |            |         |        |        |                       |
| Rustyline                 | Rust     | Yes             | Yes        | Yes        | Yes     | Yes    | Yes    | Mature, hints support |
| Reedline                  | Rust     | Yes             | Yes        | Yes        | Yes     | Yes    | Yes    | Powers Nushell        |
| Crossterm                 | Rust     | N/A             | N/A        | N/A        | N/A     | N/A    | Yes    | Low-level terminal    |
| **C (needs bindings)**    |          |                 |            |            |         |        |        |                       |
| Linenoise                 | C        | Yes             | Yes        | Yes        | No      | No     | Yes    | Minimal (~800 LOC)    |
| **Python (reference)**    |          |                 |            |            |         |        |        |                       |
| prompt_toolkit            | Python   | Yes             | Yes        | Yes        | Yes     | Yes    | Yes    | Gold standard         |
| rich                      | Python   | Yes             | N/A        | N/A        | N/A     | N/A    | Yes    | Output formatting     |
| **Go (hard to bind)**     |          |                 |            |            |         |        |        |                       |
| Bubbletea                 | Go       | No              | N/A        | N/A        | N/A     | N/A    | Yes    | Full TUI framework    |
| go-prompt                 | Go       | No              | No         | Partial    | No      | No     | Slow   | Dropdown menus        |

---

## Options Considered

### Option A: Enhanced Node.js readline

**Description:** Extend built-in readline with custom completion display.

**Implementation:**

1. Use readline’s `completer` for Tab completion
2. Print completion menu on separate lines (not inline)
3. Re-print prompt after selection
4. No ghost text (limitation)

**Pros:**

- Zero dependencies
- Definitely scrollback-safe
- Simple, maintainable

**Cons:**

- No ghost text / inline suggestions
- Basic UX compared to modern tools
- Manual menu rendering

**Effort:** Low

---

### Option B: terminal-kit Inline Mode

**Description:** Use terminal-kit’s input field with inline autocomplete.

**Implementation:**

1. Configure `inputField` with `autoCompleteMenu: false`
2. Use `autoComplete` for Tab completion
3. May need to disable cursor positioning features

**Pros:**

- Richer features than readline
- Active maintenance
- Good documentation

**Cons:**

- Need to verify scrollback safety
- Larger dependency
- May have edge cases with cursor

**Effort:** Medium

---

### Option C: Rustyline via napi-rs Bindings

**Description:** Build Node.js bindings for Rust’s rustyline.

**Implementation:**

1. Create napi-rs wrapper crate
2. Expose completion and hint interfaces
3. Handle async across FFI boundary

**Pros:**

- Ghost text (hints) support
- Full readline feature set
- Battle-tested in Rust ecosystem

**Cons:**

- Significant development effort
- Native module complexity
- Cross-platform build requirements

**Effort:** High

---

### Option C2: Reedline via napi-rs Bindings

**Description:** Build Node.js bindings for Nushell’s reedline (modern alternative to
rustyline).

**Implementation:**

1. Create napi-rs wrapper crate
2. Expose Hinter, Completer, and Highlighter traits
3. Handle the event loop integration

**Pros:**

- Modern design, powers Nushell
- Superior hint/completion architecture
- Active development
- Better than rustyline for interactive use

**Cons:**

- Same effort as rustyline bindings
- Larger crate (more features)
- Less standalone documentation

**Effort:** High

**Note:** If building Rust bindings, reedline is likely the better choice over rustyline
due to its modern architecture and active Nushell development.

---

### Option D: Hybrid Approach (Recommended)

**Description:** Start with readline, enhance incrementally.

**Phase 1 (Now):**

- Use readline `completer` for slash commands
- Print completion menu on separate lines
- No ghost text initially

**Phase 2 (Polish):**

- Add fuzzy matching to completer
- Implement cycling through options with Tab
- Add file path completion

**Phase 3 (Future Clam):**

- When Clam codes available, render completions as overlays
- Overlays provide ghost text effect without cursor positioning

**Pros:**

- Immediate progress
- Incremental complexity
- Stays scrollback-safe
- Natural upgrade path to Clam

**Cons:**

- Delayed ghost text feature
- Multi-phase work

**Effort:** Low → Medium over time

---

## Recommendations

1. **Use Option D (Hybrid Approach)** for clam-code:
   - Start with readline `completer` for slash commands
   - Print completions on separate lines for scrollback safety
   - Plan ghost text as Clam overlay feature

2. **Avoid TUI frameworks** (Ink, Blessed, Bubbletea):
   - They fundamentally conflict with scrollback requirement
   - Right choice for different use cases

3. **Study prompt_toolkit patterns**:
   - Its AutoSuggest system is the model to emulate
   - Could inform future Clam overlay design

4. **Consider terminal-kit exploration**:
   - Its inline mode may provide middle ground
   - Worth a spike to verify scrollback behavior

5. **Rustyline bindings as stretch goal**:
   - If we want native ghost text without Clam
   - Significant investment, consider carefully

---

## Implementation Notes for Option D

### Phase 1: readline Completer

```typescript
// In InputReader constructor
const completer = (line: string): [string[], string] => {
  // Slash command completion
  if (line.startsWith('/')) {
    const commands = Array.from(this.commands.keys()).map((c) => `/${c}`);
    const hits = commands.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commands, line];
  }

  // File path completion for @ mentions
  if (line.includes('@')) {
    // TODO: implement file completion
  }

  return [[], line];
};

this.rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer,
  terminal: process.stdin.isTTY ?? false,
});
```

### Completion Display

When user presses Tab and multiple options exist:

```
> /he<TAB>
/help   /health   /heartbeat
> /he
```

readline handles this automatically - it prints options and re-prompts.

---

## Next Steps

- [ ] Implement readline completer for slash commands
- [ ] Test completion display with multiple options
- [ ] Add file path completion for @ mentions
- [ ] Spike terminal-kit inline mode for scrollback safety
- [ ] Document findings for future ghost text implementation

---

## References

### Node.js / TypeScript

- [Node.js readline docs](https://nodejs.org/api/readline.html)
- [Google zx](https://github.com/google/zx) - Shell scripting in JS/TS
- [terminal-kit](https://github.com/cronvel/terminal-kit) - Comprehensive terminal
  toolkit
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [prompts](https://github.com/terkelg/prompts) - Lightweight prompts
- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs

### Rust

- [rustyline](https://github.com/kkawakam/rustyline) - Readline in Rust
- [reedline](https://github.com/nushell/reedline) - Nushell’s line editor
- [clap-repl](https://github.com/HKalbasi/clap-repl) - REPLs with clap + reedline
- [crossterm](https://github.com/crossterm-rs/crossterm) - Cross-platform terminal
- [napi-rs](https://napi.rs/) - Node.js bindings for Rust

### C

- [linenoise](https://github.com/antirez/linenoise) - Minimal readline (~800 LOC)
- [linenoise-ng](https://github.com/arangodb/linenoise-ng) - UTF-8 + Windows support

### Python (pattern reference)

- [prompt_toolkit](https://github.com/prompt-toolkit/python-prompt-toolkit) - Gold
  standard
- [rich](https://github.com/Textualize/rich) - Rich text formatting

### Go

- [bubbletea](https://github.com/charmbracelet/bubbletea) - TUI framework
- [go-prompt](https://github.com/c-bata/go-prompt) - Interactive prompts

### Related Research

- [Richer Terminal UIs](research-2026-02-03-richer-terminal-uis.md) - Hybrid NL/command
  UX
- [ACP Clam Terminal UI](research-2026-02-02-acp-clam-terminal-ui.md) - ACP client
  research
