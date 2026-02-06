# Architecture: Shell Implementation

**Date:** 2026-02-06

**Author:** Claude (documentation)

**Status:** Draft

## Overview

Clam is a terminal-based ACP (Agent Client Protocol) client for Claude Code that
combines natural language interaction with direct shell command execution.
Unlike traditional TUI applications, clam uses true terminal scrollback—all output flows
sequentially into the terminal’s native scrollback buffer with no cursor repositioning
or alternate screen.

The shell implementation is the subsystem responsible for:

- Detecting whether user input is a shell command, natural language, or a slash command
- Executing shell commands with proper terminal management
- Providing tab completion and syntax coloring
- Integrating modern CLI tools (eza, bat, rg, zoxide) with automatic aliasing
- Managing working directory state across commands
- Preserving ANSI color output from subprocesses

This document covers the architecture of these subsystems and the key design decisions
behind them.

## Goals

- Execute shell commands directly without delegating to Claude Code
- Properly handle interactive commands (bash, vim, less) without terminal corruption
- Detect input mode (shell vs natural language) accurately with minimal latency
- Provide rich completion with pluggable completers and unified scoring
- Integrate modern CLI tool alternatives transparently
- Maintain clean terminal state under all circumstances (including crashes)

## Non-Goals

- Full PTY emulation (no node-pty dependency)
- Windows conpty support (future consideration)
- Shell plugin/extension system
- AI-powered completion (future—handled by ACP delegation)
- Fish-style ghost text / inline suggestions (future)

## System Context

Clam sits between the user’s terminal and Claude Code (via ACP). User input is
classified and routed to one of three handlers:

```
                          ┌──────────────────────┐
                          │   User's Terminal     │
                          │   (stdin / stdout)    │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │    InputReader        │
                          │  (readline + keypress │
                          │   handler)            │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   Mode Detector       │
                          │  (sync + async)       │
                          └──┬─────┬─────────┬───┘
                             │     │         │
                    ┌────────▼─┐ ┌─▼──────┐ ┌▼──────────┐
                    │  Shell   │ │  NL    │ │  Slash    │
                    │  exec()  │ │  → ACP │ │  command  │
                    └──────────┘ └────────┘ └───────────┘
```

**Key source files:**

| File | Responsibility |
| --- | --- |
| `src/bin.ts` | Entry point, wiring, startup |
| `src/lib/input.ts` | InputReader: readline, keypress, routing |
| `src/lib/mode-detection.ts` | Input classification (shell/NL/slash/ambiguous/nothing) |
| `src/lib/shell.ts` | Shell module: exec, which, cwd tracking |
| `src/lib/tty/tty-manager.ts` | TTY state save/restore, emergency cleanup |
| `src/lib/shell/` | Modern tools, aliases, zoxide, color, conveniences |
| `src/lib/input/` | InputState, token parser, syntax renderer |
| `src/lib/completion/` | Completion manager, completers, scoring, menu |

## Design

### Component 1: Shell Execution (`src/lib/shell.ts`)

**Responsibility:** Execute shell commands, look up commands via `which`, track working
directory state, apply command aliases.

**Interface:** `ShellModule` — created via `createShellModule()`.

```typescript
interface ShellModule {
  which(command: string): Promise<string | null>;
  isCommand(word: string): Promise<boolean>;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  getCompletions(partial: string, cursorPos: number): Promise<string[]>;
  clearCache(): void;
  getCwd(): string;
  setCwd(path: string): void;
  setInstalledTools(tools: Map<string, AbsolutePath>): void;
  setAliasingEnabled(enabled: boolean): void;
}
```

**Command execution flow:**

1. Detect zoxide commands (`z`, `zi`) and rewrite to `cd "$(zoxide query ...)"`.
2. Apply command aliases (`ls` → `eza`, `cat` → `bat`, etc.)
   via `rewriteCommand()`.
3. Build environment (optionally with `FORCE_COLOR=1` and `CLICOLOR_FORCE=1`).
4. Branch on execution mode:
   - **Interactive** (`captureOutput: false`): Use `spawnSync` wrapped in
     `withTtyManagement()`. See [TTY Management](#component-2-tty-management) below.
   - **Captured** (`captureOutput: true`): Use async `spawn` with piped stdio.
5. After execution, update tracked `currentCwd` if the command was `cd` or zoxide.
6. If zoxide is installed, call `zoxide add` in the background to update frecency.

**Working directory tracking:** The shell module maintains a mutable `currentCwd`
variable that persists across commands.
This is necessary because each `spawnSync` or `spawn` runs in a subprocess that cannot
modify the parent’s `process.cwd()`. For `cd` commands:

- In captured mode, `&& pwd` is appended to extract the resulting directory.
- In interactive mode, the target is parsed from the command and resolved separately.

**`which` caching:** Results from `which` lookups are cached in a
`Map<string, string | null>` to avoid repeated subprocess invocations.
Shell builtins (`cd`, `export`, `pwd`, etc.)
are recognized from a hardcoded set and return `'builtin'` without spawning a process.

### Component 2: TTY Management (`src/lib/tty/tty-manager.ts`)

**Responsibility:** Save and restore terminal state around interactive subprocess
execution. Ensure the terminal is never left in a corrupted state, even after crashes.

**The problem:** When clam runs interactive commands like `bash` or `vim`, the child
process calls `tcsetpgrp()` to become the foreground process group.
If Node’s readline is simultaneously reading from stdin (via async event handlers), the
parent process receives `SIGTTIN` and gets suspended.
The terminal also enters raw mode conflicts where neither process properly controls the
TTY.

**The solution (spawnSync + TTY management):**

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ Save TTY    │────▶│ Disable raw  │────▶│ spawnSync      │────▶│ stty sane    │
│ state       │     │ mode         │     │ (blocks event  │     │ + restore    │
│ (wasRawMode)│     │              │     │  loop)         │     │ raw mode     │
└─────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
```

The `withTtyManagement()` wrapper implements this sequence:

1. **Save state** — record whether stdin was in raw mode.
2. **Disable raw mode** — allow the subprocess to control the terminal.
3. **Execute** — run the provided function (which uses `spawnSync`).
4. **Restore** — run `stty sane` to clean up any terminal corruption, then re-enable raw
   mode if it was previously active.

**Why `spawnSync`:** Node.js does not expose `tcsetpgrp()` natively
([nodejs/node#5549](https://github.com/nodejs/node/issues/5549)). The `detached` option
only calls `setsid()`, which creates a new session but does not make the child the
foreground process group.
Using `spawnSync` blocks the entire Node event loop, which prevents readline from
competing for stdin during subprocess execution.
This is a deliberate trade-off:

- **Pro:** No native dependencies, works cross-platform, simple to maintain.
- **Pro:** Appropriate for interactive commands where we’re waiting anyway.
- **Con:** Blocks the event loop (acceptable since user is interacting with the
  subprocess, not clam).

**Emergency cleanup:** `installEmergencyCleanup()` is called once at application startup
(`bin.ts:126`). It registers handlers on `exit`, `SIGINT`, `SIGTERM`,
`uncaughtException`, and `unhandledRejection` that all call `stty sane`. This ensures
the terminal is restored even if clam crashes.
The handlers carefully preserve existing signal listeners by saving and re-emitting
them.

### Component 3: Mode Detection (`src/lib/mode-detection.ts`)

**Responsibility:** Classify user input as `shell`, `nl` (natural language), `slash`,
`ambiguous`, or `nothing`.

**Design philosophy:** The detector does NOT attempt to enumerate all of English.
Instead, it uses two layers:

1. **Sync detection** (`detectModeSync`) — For real-time coloring UX. Uses pattern
   matching and word lists.
   Runs on every keystroke (via `setImmediate` in the keypress handler).
   Some flicker is acceptable since async validation ensures correctness before
   execution.

2. **Async detection** (`detectMode`) — For accuracy before execution.
   Verifies the first word via `which` lookup.
   If `which` returns null, the input is reclassified as `nl` or `nothing`.

**Detection rules (priority order):**

| Rule | Pattern | Mode | Definitive? |
| --- | --- | --- | --- |
| empty | Empty input | `nl` | Yes |
| explicit-nl | Starts with `?` | `nl` | Yes |
| explicit-shell | Starts with `!` | `shell` | Yes |
| space-at-start | Leading space | `nl` | Yes |
| known-slash-command | `/help`, `/quit`, etc. | `slash` | Yes |
| absolute-path | `/bin/ls`, `/usr/bin/grep` | `shell` | No (needs `which`) |
| unknown-slash | Other `/` prefix | `slash` | Yes |
| shell-operators | Contains `\|`, `>`, `&&`, etc. | `shell` | No (validates first word) |
| env-variables | Contains `$` | `shell` | Yes |
| shell-builtin | `cd`, `export`, `pwd`, etc. | `shell` | Yes |
| single-prompt-ambiguous | `who`, `date`, `time` alone | `ambiguous` | Yes |
| all-nl-words | All words are common English | `nl` | Yes |
| question-sentence | `what`, `how`, `why` + text | `nl` | Yes |
| request-sentence | `can you`, `please` + text | `nl` | Yes |
| ambiguous-command-with-nl | `test this`, `yes please` | `nl` | Yes |
| command-like | Alphanumeric first word | `shell` | No (needs `which`) |
| fallback-nl | Everything else | `nl` | Yes |

**The `nothing` mode:** When async validation finds the first word is not a valid
command AND the input doesn’t look like natural language, it returns `nothing`. This
triggers an error message with Levenshtein-based command suggestions (e.g., “gti” → “Did
you mean: git?”).

**Word lists are test-driven:** The `NL_ONLY_WORDS`, `AMBIGUOUS_COMMANDS`, and
`QUESTION_WORDS` sets are minimal.
New words are added only when test cases require them.

### Component 4: Input System (`src/lib/input.ts`, `src/lib/input/`)

**Responsibility:** Handle terminal input, manage readline, route input to the correct
handler, provide visual feedback (syntax coloring, prompt changes).

**Architecture:**

```
┌───────────────────────────────────────────────────────────────────────┐
│                        InputReader                                    │
│                                                                       │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────────┐ │
│  │ readline     │───▶│ keypress    │───▶│ Mode detection +         │ │
│  │ interface    │    │ handler     │    │ recolorLine()            │ │
│  └─────────────┘    └──────────────┘    └──────────────────────────┘ │
│         │                  │                                          │
│         │           ┌──────▼──────────┐                              │
│         │           │ Completion      │                              │
│         │           │ Integration     │                              │
│         │           │ (Tab/@/↑↓/Enter)│                              │
│         │           └─────────────────┘                              │
│         │                                                            │
│  ┌──────▼───────────────────────────────────────────────────────┐    │
│  │                    prompt() loop                              │    │
│  │  • First line: detect mode → submit if shell/slash           │    │
│  │  • Multi-line: blank line submits (two-enter mode for NL)    │    │
│  │  • Completion acceptance: re-prompt with pre-filled text     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│  ┌──────▼─────────────────────────────────────────────────┐         │
│  │  start() main loop: route by mode                       │         │
│  │  • shell → shell.exec() with TTY management             │         │
│  │  • nl → onPrompt callback (→ ACP)                       │         │
│  │  • slash → handleSlashCommand() or ACP command           │         │
│  │  • ambiguous → confirmShellCommand() prompt              │         │
│  │  • nothing → error message + command suggestion          │         │
│  └─────────────────────────────────────────────────────────┘         │
└───────────────────────────────────────────────────────────────────────┘
```

**Submit behavior differs by mode:**

- **Shell mode:** Submit on first Enter (like a shell).
- **Slash commands:** Submit on first Enter.
- **Natural language:** Two-enter mode — Enter adds lines, blank line submits.
  This allows multi-line prompts for Claude.

**Visual feedback:** The keypress handler runs `detectModeSync()` on every keystroke
(via `setImmediate` to run after readline processes the key) and recolors the input
line:

- **NL mode:** Pink `▶` prompt, pink text.
- **Shell mode:** White `$` prompt, white text with syntax coloring.
- **Slash mode:** Blue `▶` prompt, purple text.

**History:** Command history is loaded from/saved to `~/.clam/code/history`. Each
history entry stores its mode so that navigating back to a shell command shows it with
shell colors, not NL pink.

#### InputState Data Model (`src/lib/input/state.ts`)

The `InputState` is the single source of truth for the current input.
It is updated by keystrokes and drives both rendering and completion:

```typescript
interface InputState {
  rawText: string;           // Complete input text
  cursorPos: number;         // Cursor position
  textBeforeCursor: string;  // Text before cursor
  textAfterCursor: string;   // Text after cursor
  tokens: Token[];           // Parsed tokens
  tokenIndex: number;        // Token containing cursor
  currentToken: Token | null;// Token being edited
  prefix: string;            // Text in current token before cursor
  mode: InputMode;           // shell | nl | slash
  isEntityTrigger: boolean;  // Token starts with @
  isSlashCommand: boolean;   // Input starts with /
  isNaturalLanguage: boolean;
  cwd: string;               // Working directory
  history: HistoryEntry[];   // For recency scoring
}
```

This follows the pattern used by xonsh’s `CompletionContext`, providing parsed command
structure and cursor position to all consumers.

#### Token Parser (`src/lib/input/parser.ts`)

Tokenizes input into typed tokens for syntax coloring and completion context:

| Token Type | Example | Color |
| --- | --- | --- |
| `command` | `git` | bold |
| `argument` | `main` | default |
| `option` | `--force` | cyan |
| `entity` | `@file.ts` | magenta |
| `path` | `./src/lib` | underline |
| `string` | `"hello"` | green |
| `operator` | `\|`, `&&` | yellow |
| `whitespace` | spaces | none |

The parser handles quoted strings (with escape sequences), multi-character operators
(`&&`, `||`, `>>`, `<<`), and resets the command position after pipe operators (so
`git log | grep foo` correctly identifies both `git` and `grep` as commands).

### Component 5: Completion System (`src/lib/completion/`)

**Responsibility:** Provide contextual completions for commands, files, slash commands,
and entity references.

**Architecture:**

```
                    ┌────────────────────────────────────────┐
                    │       CompletionIntegration             │
                    │  (wires into InputReader keypress)      │
                    └────────────────┬───────────────────────┘
                                     │
                    ┌────────────────▼───────────────────────┐
                    │       CompletionManager                 │
                    │  1. Filter relevant completers          │
                    │  2. Run in parallel (with timeout)      │
                    │  3. Deduplicate by value                │
                    │  4. Sort by group + score               │
                    └──────┬─────────┬──────────────┬────────┘
                           │         │              │
                ┌──────────▼──┐ ┌────▼────────┐ ┌──▼──────────┐
                │ Command     │ │ Entity      │ │ Slash       │
                │ Completer   │ │ Completer   │ │ Completer   │
                │             │ │             │ │             │
                │ isRelevant: │ │ isRelevant: │ │ isRelevant: │
                │ tokenIdx==0 │ │ @trigger    │ │ starts /    │
                │ mode==shell │ │             │ │             │
                └─────────────┘ └─────────────┘ └─────────────┘
```

**Pluggable completer interface:**

```typescript
interface Completer {
  name: string;
  isRelevant(state: InputState): boolean;
  getCompletions(state: InputState): Promise<Completion[]>;
}
```

Each completer receives the full `InputState` and decides whether to run based on state
properties. The `CompletionManager` runs relevant completers in parallel with a 100ms
timeout for responsive UI.

**Scoring algorithm (`src/lib/completion/scoring.ts`):**

- **Exact prefix match** (score 70-100): Highest priority for direct matches.
- **Fuzzy match** (score 40-70): Subsequence matching for partial input.
- **Description bonus** (+5): Completions with descriptions rank slightly higher.
- Completions are sorted by `CompletionGroup` (primary) then `score` (secondary).

**Completion groups (priority order):**

| Group | Value | Description |
| --- | --- | --- |
| TopSuggestion | 0 | Exact matches |
| InternalCommand | 1 | Slash commands |
| Builtin | 2 | Shell builtins |
| RecommendedCommand | 3 | Curated list (~100 commands) |
| OtherCommand | 4 | PATH commands |
| File | 5 | Local files/dirs |
| GitRef | 6 | Git branches |
| Entity | 7 | @ references |
| Other | 8 | Catch-all |

**Triggers:**

- **Tab:** Opens completion menu with context-appropriate completions.
- **@:** Immediately opens entity (file) completion.
- **/ at start:** Opens slash command menu.
- **Arrow keys:** Navigate menu items.
- **Enter:** Accept selected completion (inserts text, does NOT execute).
- **Escape:** Dismiss menu.

**Menu rendering:** Uses ANSI escape sequences (`\x1b[s` save cursor, `\x1b[u` restore)
to render the menu below the input line without disrupting scrollback.
The menu is ephemeral—cleared on any non-navigation keypress.

### Component 6: Modern Tool Integration (`src/lib/shell/`)

**Responsibility:** Detect installed modern CLI tools at startup and transparently alias
traditional commands to their modern equivalents.

#### Tool Detection (`modern-tools.ts`)

At startup, `detectInstalledTools()` runs `which` checks for all tools in parallel:

| Tool | Replaces | Description |
| --- | --- | --- |
| eza | ls | Modern ls with icons and git integration |
| bat | cat | Syntax highlighting |
| rg | grep | Fast grep (ripgrep) |
| fd | find | Fast find alternative |
| zoxide | cd | Smart directory jumping (frecency) |
| dust | du | Modern disk usage |
| duf | df | Modern disk free |
| hexyl | — | Modern hex viewer |

Returns `Map<string, AbsolutePath>` — only installed tools are in the map (presence =
installed). Other modules consume this map rather than re-detecting.

#### Command Aliasing (`command-aliases.ts`)

When aliasing is enabled (default), `rewriteCommand()` rewrites commands before
execution:

| Input | Rewrites To |
| --- | --- |
| `ls` | `eza --group-directories-first -F` |
| `ll` | `eza --group-directories-first -F -l` |
| `la` | `eza --group-directories-first -F -la` |
| `cat file.ts` | `bat --paging=never file.ts` |
| `grep pattern` | `rg pattern` |
| `find . -name '*.ts'` | `fd . -name '*.ts'` |

Aliasing only applies when the required tool is installed (checked against the
`installedTools` map).

#### Zoxide Integration (`zoxide.ts`)

Provides smart directory jumping:

- `z <query>` → `cd "$(zoxide query --exclude "$CWD" -- <query>)"`
- `zi <query>` → `cd "$(zoxide query -i -- <query>)"` (interactive)
- `z` with no args → `cd ~`

After every successful `cd` (including zoxide jumps), `zoxide add` is called in the
background to update the frecency database.

#### Color Preservation (`color-env.ts`, `color-commands.ts`)

Many commands check `isatty(stdout)` and disable colors when piped.
Clam forces color through two mechanisms:

1. **Environment variables:** `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` in subprocess
   environment. Works with chalk, supports-color, and BSD tools.

2. **Command-specific flags:** `--color=always` injected for known commands (ls, eza,
   grep, rg, diff, and git subcommands like diff/log/show/status/branch).

For interactive commands (`captureOutput: false`), color preservation is automatic since
`stdio: 'inherit'` passes through the real TTY.

### Data Flow

**Shell command execution (interactive):**

```
User types "ls -la" → Enter
    │
    ▼
InputReader.prompt() returns "ls -la"
    │
    ▼
ModeDetector.detectModeSync("ls -la") → 'shell'  (sync, for coloring)
ModeDetector.detectMode("ls -la") → 'shell'      (async, which confirms ls exists)
    │
    ▼
shell.exec("ls -la", { captureOutput: false })
    │
    ├─ rewriteCommand("ls -la") → "eza --group-directories-first -F -la"  (if eza installed)
    │
    ├─ withTtyManagement(() => {
    │     saveTtyState()          → { wasRawMode: true }
    │     disableRawMode()
    │     spawnSync("bash", ["-c", "eza --group-directories-first -F -la"], { stdio: 'inherit' })
    │     restoreTtyState()       → stty sane + setRawMode(true)
    │  })
    │
    └─ Return ExecResult { exitCode: 0, stdout: '', stderr: '' }
    │
    ▼
Display timing/exit code if applicable
    │
    ▼
InputReader.prompt() → wait for next input
```

**Natural language input:**

```
User types "explain this code" → Enter → Enter (blank line submits)
    │
    ▼
ModeDetector.detectMode("explain this code") → 'nl'
    (which("explain") → null → NL words in rest → 'nl')
    │
    ▼
onPrompt("explain this code")
    │
    ▼
formatPromptWithContext(text, { sessionCwd, userCwd })
    │
    ▼
acpClient.prompt(promptWithContext)  → Claude Code via ACP
```

## Trade-offs and Alternatives

### Decision 1: spawnSync for Interactive Commands

**Chosen approach:** `spawnSync` blocks the Node event loop during interactive
subprocess execution.

**Alternatives considered:**

- **Async spawn with keypress listener removal:** Removes readline’s keypress handler
  before spawning. Requires careful coordination between `input.ts` and `shell.ts`.
  Rejected because the race condition between disabling the listener and the child
  calling `tcsetpgrp` is hard to eliminate.

- **node-pty:** Full PTY emulation via native module.
  Would solve the problem completely but adds a native dependency requiring compilation
  on each platform. Rejected to keep clam dependency-free and easy to install.

- **Proper Unix approach (tcsetpgrp):** Create new process group, call `tcsetpgrp()` for
  foreground control, block `SIGTTIN`/`SIGTTOU`. This is what xonsh does.
  Rejected because Node.js does not expose `tcsetpgrp()` natively
  ([nodejs/node#5549](https://github.com/nodejs/node/issues/5549)).

**Rationale:** `spawnSync` is the simplest approach that works reliably.
It requires no native dependencies, works across platforms, and is appropriate for
interactive commands where the user is interacting with the subprocess (not clam)
anyway.

### Decision 2: Two-Layer Mode Detection

**Chosen approach:** Fast sync detection for UX coloring + accurate async detection
before execution.

**Alternatives considered:**

- **Async-only detection:** Would cause visible latency on every keystroke since `which`
  lookups take ~5-50ms. Rejected for poor UX.

- **Comprehensive word lists:** Enumerate all English words to distinguish NL from
  shell. Impossible to be complete and would create a maintenance burden.
  Rejected.

- **ML-based classification:** Use a language model to classify input.
  Would add latency and complexity.
  Rejected—the heuristic approach with `which` validation is sufficient.

**Rationale:** The two-layer approach provides instant visual feedback (sync) while
ensuring correct behavior before execution (async).
Some coloring flicker is an acceptable trade-off for simplicity and reliability.

### Decision 3: InputState as Single Source of Truth

**Chosen approach:** A single `InputState` object drives both rendering and completion.

**Alternatives considered:**

- **Separate contexts for completion and rendering:** Would lead to divergent state and
  inconsistencies.

- **Event-based updates:** Emit events on each keystroke.
  More complex and harder to reason about.

**Rationale:** Following xonsh’s `CompletionContext` pattern, having one state object
that all consumers read from ensures consistency and simplifies debugging.

### Decision 4: No Native PTY Dependency

**Chosen approach:** Use `stty sane` for terminal restoration, `spawnSync` for
interactive commands.

**Alternatives considered:**

- **node-pty:** Full PTY emulation.
  Would handle all terminal edge cases perfectly but requires native compilation
  (problematic for npm distribution).

- **node-termios:** POSIX termios bindings.
  Would give fine-grained terminal control but is another native dependency with
  maintenance burden.

**Rationale:** The pure-JavaScript approach covers the critical use cases (bash, vim,
less work correctly).
`stty sane` is the same recovery mechanism xonsh uses for terminal restoration.
If edge cases arise, node-pty can be added later as an optional dependency.

### Decision 5: Command Aliasing via Rewriting

**Chosen approach:** Rewrite command strings before execution (e.g., `ls` →
`eza --group-directories-first -F`).

**Alternatives considered:**

- **Callable aliases (like xonsh):** Define aliases as functions that receive arguments
  and return modified commands.
  More flexible but more complex.
  Planned for a future functional alias system.

- **Shell-level aliases:** Set aliases in the bash subprocess.
  Would not persist across `spawnSync` calls since each creates a new shell.

**Rationale:** String rewriting is simple and sufficient for the current alias set.
The future functional alias system will consolidate `rewriteCommand()` and
`rewriteZoxideCommand()` into a single `expandAlias()` function.

## File Structure

```
packages/clam/src/
├── bin.ts                          # Entry point, wiring, startup
├── lib/
│   ├── shell.ts                    # Shell module (exec, which, cwd)
│   ├── input.ts                    # InputReader (readline, routing)
│   ├── mode-detection.ts           # Mode detection (sync + async)
│   ├── output.ts                   # OutputWriter (semantic output)
│   ├── acp.ts                      # ACP client wrapper
│   ├── config.ts                   # Configuration loading
│   ├── formatting.ts               # Shared color utilities
│   ├── prompts.ts                  # Prompt formatting with context
│   │
│   ├── tty/
│   │   ├── tty-manager.ts          # TTY state save/restore, stty sane
│   │   └── index.ts                # Re-exports
│   │
│   ├── shell/
│   │   ├── utils.ts                # Shared: execPromise, getCommandPath, AbsolutePath
│   │   ├── modern-tools.ts         # Tool detection registry
│   │   ├── command-aliases.ts      # ls→eza, cat→bat aliasing
│   │   ├── zoxide.ts               # Zoxide z/zi integration
│   │   ├── color-env.ts            # FORCE_COLOR env handling
│   │   ├── color-commands.ts       # --color=always injection
│   │   ├── conveniences.ts         # Auto-cd, exit codes, timing
│   │   ├── bash-executor.ts        # Shell execution for completions
│   │   └── index.ts                # Re-exports
│   │
│   ├── input/
│   │   ├── state.ts                # InputState data model
│   │   ├── parser.ts               # Token parser
│   │   └── renderer.ts             # Syntax coloring
│   │
│   └── completion/
│       ├── types.ts                # Completion, Completer interfaces
│       ├── manager.ts              # CompletionManager (orchestration)
│       ├── scoring.ts              # Prefix + fuzzy scoring
│       ├── menu.ts                 # ANSI menu rendering
│       ├── key-handler.ts          # Keyboard navigation
│       ├── trigger.ts              # Trigger detection (Tab, @, /)
│       ├── terminal.ts             # Terminal output helpers
│       ├── integration.ts          # Wires into InputReader
│       ├── history.ts              # History-based completion
│       ├── recommended-commands.ts # Curated command list (~100)
│       └── completers/
│           ├── command-completer.ts # Shell command completion
│           ├── entity-completer.ts  # File/entity completion
│           └── slash-completer.ts   # Slash command completion
```

## Startup Sequence

The startup sequence in `bin.ts` initializes components in dependency order:

```
1. installEmergencyCleanup()         ← Register stty sane handlers (first!)
2. loadConfig() + parseArgs()        ← Configuration
3. createOutputWriter()              ← Semantic output interface
4. createAcpClient() + connect()     ← Connect to Claude Code
5. createShellModule({ cwd })        ← Shell execution
6. createModeDetector({ shell })     ← Input classification
7. detectInstalledTools()            ← Modern tool detection (parallel which)
8. shell.setInstalledTools(tools)    ← Enable command aliasing
9. createInputReader({               ← Input handling (last, starts main loop)
     shell, modeDetector, ...
   })
10. inputReader.start()              ← Blocks until quit
```

## Signal Handling

| Signal | Behavior |
| --- | --- |
| SIGINT (Ctrl+C) | First: cancel current operation. Second within 2s: quit. |
| SIGTERM | Graceful shutdown: disconnect ACP, stop input, exit. |
| Ctrl+D | If line is empty: quit (EOF). |
| Exit (any) | `stty sane` via emergency cleanup. |
| Uncaught exception | `stty sane` + error log + exit(1). |
| Unhandled rejection | `stty sane` + error log + exit(1). |

## Open Questions

- Should `stty sane` be replaced with `node-termios` for more precise terminal control?
  (Current approach works well in practice.)
- How to handle GNU vs BSD flag differences in command aliases?
- Should color forcing be configurable per-command?
- Should the functional alias system (callable aliases) replace string rewriting?

## References

- [Shell Polish Spec](../project/specs/active/plan-2026-02-05-shell-polish.md) — TTY
  management, modern tool detection
- [Unified Completion Spec](../project/specs/active/plan-2026-02-05-better-shell-completions.md)
  — Completion system architecture
- [ANSI Color Spec](../project/specs/active/plan-2026-02-05-ansi-color-subprocess-output.md)
  — Color preservation
- [Clam ACP Client Spec](../project/specs/active/plan-2026-02-03-clam-acp-client-spike.md)
  — Overall architecture
- [Shell UX Research](../project/research/active/research-2026-02-04-shell-ux-typescript.md)
  — kash and xonsh analysis
- [PR #5](https://github.com/jlevy/clam/pull/5) — Shell polish implementation
- [GNU Job Control](https://www.gnu.org/software/libc/manual/html_node/Job-Control.html)
  — Terminal process group management
- [POSIX termios](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/termios.h.html)
  — Terminal interface specification
- [Node.js #5549](https://github.com/nodejs/node/issues/5549) — Missing tcsetpgrp
- [FORCE_COLOR](https://force-color.org/) — Color forcing standard
- [CLICOLOR](http://bixense.com/clicolors/) — BSD color convention
