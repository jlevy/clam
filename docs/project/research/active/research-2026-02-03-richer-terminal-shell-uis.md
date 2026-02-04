# Research: Richer Terminal Shell UIs for Hybrid Natural Language and Commands

**Date:** 2026-02-03

**Author:** Joshua Levy with Claude assistance

**Status:** In Progress

## Overview

Terminal interfaces have traditionally been command-focused, requiring users to learn
specific syntax and commands.
With the rise of AI assistants like Claude Code, there’s an opportunity to blend the
precision of shell commands with the flexibility of natural language.
This research explores how to create a seamless hybrid experience that:

- Preserves the efficiency of traditional shell completion and command execution
- Adds natural language as a first-class input mode
- Uses visual cues (prompt changes) to indicate current mode
- Leverages semantic matching for intelligent auto-completion of common questions

## Questions to Answer

1. What are the key UX patterns for hybrid shell/natural language interfaces?
2. How can we distinguish between command mode and natural language mode?
3. What completion strategies work best in each mode?
4. How can we handle Enter vs multi-line input gracefully?
5. What are the technical constraints around modifier key detection in terminals?

## Scope

**Included:**

- Hybrid input mode design patterns
- Tab completion for commands, files, slash commands, and natural language
- Prompt visual feedback for mode indication
- Multi-line input handling
- Semantic/embedding-based completion

**Excluded:**

- Full LLM response generation
- Specific Claude Code implementation details
- Voice input or other modalities

---

## Findings

### 1. Kash Shell: A Working Implementation

The [kash shell](repos/kash) provides a mature implementation of many of these concepts,
built on xonsh and prompt_toolkit. Key architectural insights:

#### Mode Detection and Switching

**Automatic mode detection** based on input pattern:

- `is_assist_request_str(text)` - detects `?` prefix or suffix
- `looks_like_nl(text)` - heuristic check for natural language vs code
  - NL: mostly alphanumeric + basic punctuation, no pipes/operators/URLs
  - Commands: recognized shell commands, operators like `|`, `>`, `=`

**Space-at-beginning shortcut**
([xonsh_keybindings.py:172-182](repos/kash/src/kash/xonsh_custom/xonsh_keybindings.py#L172-L182)):

```python
@custom_bindings.add(" ", filter=whitespace_only)
def _(event):
    buf = event.app.current_buffer
    if buf.text == " " or buf.text == "":
        buf.delete_before_cursor(len(buf.text))
        buf.insert_text("? ")  # Convert space to ? prefix
```

**Typo detection**: If user types an unrecognized command + space, auto-prefix with `?`
to signal NL mode.

#### Prompt Visual Feedback

The prompt changes to indicate mode:

- `>` for command mode (default)
- `?` prefix visible when in natural language mode

Uses `FormattedText` for rich terminal rendering with:

- Semantic colors
- Hover tooltips
- Workspace context

#### Two-Level Completion System

**First Tab**: Fast lexical matching

- Command completions (shell builtins, executables in PATH)
- File path completions
- Prefix matching against help docs

**Second Tab**: Semantic search via embeddings

- Query embedded using `text-embedding-3-small`
- Compared against pre-computed help doc embeddings (cached in `~/.cache/kash/`)
- Returns top 10 docs above similarity threshold (0.25)
- Results merged with lexical results

Key files:

- [shell_completions.py](repos/kash/src/kash/shell/completions/shell_completions.py) -
  Scoring/ranking logic
- [xonsh_completers.py](repos/kash/src/kash/xonsh_custom/xonsh_completers.py) -
  Contextual completers
- [help_embeddings.py](repos/kash/src/kash/help/help_embeddings.py) - Semantic indexing

#### Command Routing

```
User Input
    |
    v
is_assist_request_str() ---> YES: shell_context_assistance() -> LLM
    |
    NO
    v
default_custom() -> xonsh command execution
```

---

### 2. Multi-Line Input Patterns

#### The Problem

AI assistants handle long prompts well, but instant-submit on Enter is inconvenient for
multi-line input. Traditional shells submit immediately on Enter.

#### Proposed Solution: Mode-Aware Enter Behavior

| Mode                  | Enter Behavior       | Rationale                           |
| --------------------- | -------------------- | ----------------------------------- |
| Command mode          | Single Enter submits | Commands are typically one-line     |
| Natural language mode | Double Enter submits | Allows multi-line questions/prompts |

**Implementation considerations:**

- Track time between Enter presses, or use a continuation character
- Visual indicator showing “press Enter again to submit”
- Could show a soft preview of what will be submitted

#### Alternative: Shift+Enter for Newlines

Shift+Enter is the standard “newline without submit” in many chat interfaces.
However, terminal support is complicated (see Section 4).

---

### 3. Slash Command Completion

Slash commands (`/help`, `/commit`, `/config`) are a natural fit for AI terminals.
They bridge commands and conversation.

#### Proposed UX

1. Typing `/` triggers slash command completion menu
2. Menu shows: command name + brief description
3. Tab/arrow to navigate, Enter to select
4. Should fuzzy-match on both name and description

Example completion display:

```
/help        Show available commands and documentation
/commit      Run pre-commit checks and create a git commit
/review      Code review for uncommitted changes
/config      Open configuration settings
```

#### Top Questions/Snippets Auto-Complete

For natural language mode, maintain a curated set of 100-500 common questions:

- “How do I …”
- “What is …”
- “Show me …”
- “Fix the …”

Match semantically via embeddings, display as completions.
Kash already implements this pattern.

---

### 4. Terminal Modifier Key Detection

#### The Core Problem

**Traditional terminals cannot reliably distinguish Shift+Enter from Enter.**

This is because:

- ANSI terminal interface assumes specific keyboard behavior
- Modifier key state is often lost
- `Ctrl+a` produces the same byte as `Ctrl+Shift+a`
- Many key combinations map to identical escape codes

#### Solutions

**1. Kitty Keyboard Protocol** (Best modern solution)

A backward-compatible protocol that enables full modifier detection:

```
CSI unicode-key-code ; modifiers u
```

Modifier bits: shift (1), alt (2), ctrl (4), super (8), hyper (16), meta (32)

**Terminal support:**

- Alacritty, Ghostty, Foot, iTerm2, WezTerm, Rio, kitty

**Application opt-in:**

```
CSI > 1 u  # Enable protocol
```

Programs with support: Vim, Neovim, Emacs, Helix, Fish shell, Textual, Crossterm

**2. IDE-Level Workarounds** (VS Code, etc.)

Configure keybindings to send escape sequence:

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001B\u000A" },
  "when": "terminalFocus"
}
```

**3. Alternative Key Bindings**

- macOS: `Ctrl+J` is literal newline character
- Double-Enter pattern avoids the issue entirely
- `Ctrl+Enter` may work in some terminals

#### Recommendation

For maximum compatibility:

1. **Primary**: Use double-Enter for multi-line submit in NL mode
2. **Enhanced**: Detect Kitty protocol support at runtime, use Shift+Enter if available
3. **IDE integration**: Document keybinding configuration for VS Code/terminals

---

### 5. Design Patterns Summary

#### Mode Indication

| Pattern          | Description                  | Example                        |
| ---------------- | ---------------------------- | ------------------------------ |
| Prompt character | Different char for each mode | `>` vs `?`                     |
| Prompt color     | Semantic coloring            | Blue for command, green for NL |
| Background       | Subtle background change     | Slight tint difference         |
| Cursor style     | Block vs underline           | Block for command, bar for NL  |

#### Mode Switching

| Trigger                   | Behavior                           |
| ------------------------- | ---------------------------------- |
| Space at start            | Switch to NL mode immediately      |
| `?` prefix                | Explicit NL mode                   |
| `/` prefix                | Slash command mode                 |
| First word passes `which` | Stay in command mode (white text)  |
| First word fails `which`  | Auto-switch to NL mode (pink text) |

**Corner case:** Some English words are also commands (e.g., "which", "time", "test").
Initial implementation accepts this ambiguity.
Future: add heuristics like checking for sentence structure, question words, or multiple
spaces to disambiguate.

#### Partial Command Rejection (Kash Pattern)

A nice UX feature from kash: **reject incomplete/invalid commands instead of executing
or treating as NL.**

**The problem:**

- User types `l` and presses Enter
- `l` is not a valid command (will error)
- But it's also not clearly natural language (too short, no spaces, no question words)
- Traditional shells would execute and show "command not found"
- Our NL mode would send it to Claude, which is also wrong

**The solution:**

- If input looks like a partial command (short, no spaces, alphanumeric), don't submit
- Instead, keep the cursor on the line and let user continue typing
- This prevents accidental submissions and guides user toward valid input

**Detection heuristics:**

- Single word, no spaces
- Fails `which` lookup (not a valid command)
- Too short to be meaningful NL (< 3 chars, or no sentence structure)
- No question marks or NL indicators

**Behavior:**

```
User types: l<Enter>
  → "l" is not a command, not NL either
  → Don't submit, keep cursor after "l"
  → User can continue: "ls" or "look at this file"

User types: ls<Enter>
  → "ls" is a valid command
  → Execute it

User types: how<Enter>
  → "how" looks like start of NL (common question word)
  → Could submit to NL mode, or wait for more
  → Safest: wait for space or more words
```

**Implementation:**

```typescript
function shouldRejectSubmission(input: string): boolean {
  const trimmed = input.trim();

  // Allow empty (no-op)
  if (!trimmed) return false;

  // Allow explicit modes
  if (trimmed.startsWith('/') || trimmed.startsWith(' ') || trimmed.startsWith('?')) {
    return false;
  }

  // Single word, no spaces
  if (!trimmed.includes(' ')) {
    const isCommand = await shell.isCommand(trimmed);
    if (!isCommand && trimmed.length < 10) {
      // Too short to be meaningful NL, not a command
      return true; // Reject submission
    }
  }

  return false;
}
```

This creates a "gentle guardrail" that prevents accidental submissions while still
allowing intentional short inputs.

#### Completion Sources by Mode

| Mode             | Sources                                   |
| ---------------- | ----------------------------------------- |
| Command          | Executables, builtins, aliases, files     |
| Slash commands   | Command list with descriptions            |
| Natural language | FAQ snippets, semantic matches, help docs |
| File paths       | Directory contents, glob patterns         |

---

## Options Considered

### Option A: Minimal Enhancement (Recommended for v1)

**Description:** Add mode switching and visual indicators without semantic completion.

- Space-at-start → NL mode
- Prompt changes to show mode
- Double-Enter for NL submission
- Slash command completion

**Pros:**

- Simple to implement
- No API dependencies
- Works in all terminals

**Cons:**

- No semantic matching
- Limited NL completion options

### Option B: Full Kash-Style Implementation

**Description:** Full semantic completion with embeddings, caching, two-stage
completion.

**Pros:**

- Rich, intelligent completions
- Semantic FAQ matching
- Production-proven in kash

**Cons:**

- Requires embedding API calls
- More complex caching/state
- Higher latency for semantic stage

### Option C: Hybrid with Lazy Semantics

**Description:** Option A baseline with optional semantic completion (second Tab).

**Pros:**

- Fast default experience
- Semantic available when wanted
- Graceful degradation without API

**Cons:**

- More complex UX to explain
- Two-stage Tab behavior may confuse users

---

## Recommendations

1. **Start with Option A** for initial implementation:
   - Mode switching via space/question mark
   - Visual prompt feedback
   - Double-Enter for NL mode
   - Slash command completion with descriptions

2. **Plan for Option C** in subsequent iteration:
   - Add lexical FAQ matching first (no API needed)
   - Enable semantic search as optional enhancement
   - Cache embeddings aggressively

3. **Use Kitty protocol** where available:
   - Feature-detect at startup
   - Fall back to double-Enter gracefully
   - Document VS Code keybinding workaround

4. **Curate a starter FAQ list** (50-100 common questions):
   - “How do I commit changes?”
   - “What files are staged?”
   - “Fix the last error”
   - Make completions discoverable

5. **Implement `which`-based auto-mode detection** (Phase 2, after tab completion):
   - Check first word of input against system commands via `which` lookup
   - If command exists: stay in command mode (white text, `>` prompt)
   - If command doesn’t exist: auto-switch to NL mode (pink/magenta text, `?` prompt)
   - Similar to kash’s typo detection but simpler
   - Can be enabled/disabled via config flag (`--two-mode` or `twoModeEnabled`)

   **Architecture: Keep as a separate, optional module**
   - Implement in a dedicated file (e.g., `lib/mode-detection.ts`)
   - Clean interface: `detectInputMode(text: string): 'command' | 'nl'`
   - Should not be conflated with input.ts or other core modules
   - Enable via config, disabled by default
   - Input handler calls mode detection but doesn’t embed the logic

   **Implementation approach:**
   - Use `child_process.execSync('which <word>')` for fast lookup
   - Cache results in a simple Map to avoid repeated lookups
   - Detect mode on first space after first word (when using raw input)
   - Or detect on submission and re-color the line (simpler with readline)

---

## Next Steps

### Phase 1: Basic Completion

- [x] Implement double-Enter detection for NL mode (done: two-enters mode)
- [ ] Add slash command completion with descriptions
- [ ] Basic tab completion for slash commands

### Phase 2: Mode Detection

- [ ] Prototype `which`-based auto-mode detection
- [ ] Add config flag to enable/disable two-mode
- [ ] Design prompt visual feedback for mode indication (white vs pink)
- [ ] Cache `which` results for performance

### Phase 3: Semantic Completion

- [ ] Create initial FAQ/snippet list for lexical completion
- [ ] Investigate Kitty protocol detection and Shift+Enter support
- [ ] Add semantic search via embeddings (optional)

---

## References

- [Kash Shell Source](repos/kash) - Working implementation of hybrid shell
- [Kitty Keyboard Protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) - Modern
  terminal keyboard handling
- [prompt_toolkit](https://python-prompt-toolkit.readthedocs.io/) - Python library for
  terminal UIs
- [xonsh](https://xon.sh/) - Python-powered shell
- [VS Code Terminal Keybindings Fix](https://kane.mx/posts/2025/vscode-remote-ssh-claude-code-keybindings/)
  \- Shift+Enter workaround
