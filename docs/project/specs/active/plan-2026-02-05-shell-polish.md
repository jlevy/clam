# Feature: Shell Polish - Modern Tool Integration and Interactive Command Handling

**Date:** 2026-02-05 (last updated 2026-02-05, reorganized)

**Author:** Claude (with research from kash/xonsh codebase)

**Status:** Draft

## Overview

A collection of shell convenience features to make Clam feel more polished and modern.
Includes detecting and leveraging modern CLI tools, command aliasing/rewriting, login
status display, and proper handling of interactive subprocesses.

## Goals

- Fix critical bug: interactive commands (`bash`, `vim`) cause terminal corruption
- Properly save/restore terminal state to prevent “jammed” terminals
- Detect installed modern CLI tools and display status at startup
- Automatically alias/rewrite commands to use modern alternatives (e.g., `ls` -> `eza`)
- Implement shell conveniences: auto-cd, typo prevention, exit code display, command
  timing
- Unified command history with persistence and standard readline keybindings
- Provide configuration options for users who prefer traditional tool behavior

## Non-Goals

- Full PTY emulation for all terminal features (beyond scope)
- Windows conpty support (future consideration)
- Replacing all traditional Unix tools (some users prefer originals)
- Shell plugin/extension system (separate feature)
- Rich prompt features (deferred - see Future section)
- AI-powered features beyond Claude Code delegation (deferred - see Future section)

## Background

### Modern CLI Tools

Kash (built on xonsh) has a system for detecting and leveraging modern CLI tools.
The `clideps` library provides tool detection, and aliases are conditionally created
when tools are found.
This creates a seamless experience where users get modern tools automatically if
installed.

**Recommended tools** (from kash):
- `eza` - Modern `ls` replacement with better output and icons
- `bat` - Modern `cat` with syntax highlighting
- `ripgrep` (`rg`) - Fast grep replacement
- `zoxide` - Smart `cd` that learns your directories
- `dust` - Modern `du` with better visualization
- `duf` - Modern `df` with better output
- `hexyl` - Modern hex viewer
- `fd` - Modern `find` replacement

### Interactive Command Bug (Critical)

Currently, running interactive commands like `bash` from within Clam causes serious
problems:

1. **Interleaved output**: Parent shell and child shell output gets mixed
2. **Spurious suspension**: Jobs get suspended (Stopped) without pressing Ctrl+Z
3. **Terminal corruption**: Terminal enters “jammed” state requiring `reset`
4. **Persistent corruption**: Terminal state remains broken even after quitting Clam

**Example of the bug:**
```
clam ▪ An unusually intelligent shell
▶ bash
bash-5.2$
[3]+  Stopped                 pnpm clam
bash-5.2$ spud10:clam levy$    # Interleaved prompts!
```

**How xonsh solves this** (detailed code analysis):

The xonsh codebase has a sophisticated TTY management system.
Here are the exact code locations and mechanisms:

#### 1. TTY State Save/Restore (`attic/xonsh/xonsh/procs/posix.py`)

```python
# Lines 410-440: _enable_cbreak_stdin / _disable_cbreak_stdin
def _enable_cbreak_stdin(self):
    # Save current terminal state
    self.stdin_mode = xli.termios.tcgetattr(self.stdin_fd)[:]
    # Modify for cbreak mode (disable ECHO and ICANON)
    new = self.stdin_mode[:]
    new[xp.LFLAG] &= ~(xli.termios.ECHO | xli.termios.ICANON)
    new[xp.CC][xli.termios.VMIN] = 1
    new[xp.CC][xli.termios.VTIME] = 0
    xli.termios.tcsetattr(self.stdin_fd, xli.termios.TCSANOW, new)

def _disable_cbreak_stdin(self):
    # Restore saved terminal state
    new = self.stdin_mode[:]
    new[xp.LFLAG] |= xli.termios.ECHO | xli.termios.ICANON
    xli.termios.tcsetattr(self.stdin_fd, xli.termios.TCSANOW, new)

# Lines 363-386: VSUSP (Ctrl+Z) key binding save/restore
def _disable_suspend_keybind(self):
    mode = xli.termios.tcgetattr(0)
    self._tc_cc_vsusp = mode[xp.CC][xli.termios.VSUSP]  # Save ^Z binding
    mode[xp.CC][xli.termios.VSUSP] = b"\x00"            # Disable it
    xli.termios.tcsetattr(0, xli.termios.TCSANOW, mode)
```

#### 2. Process Group Management (`attic/xonsh/xonsh/procs/specs.py`)

```python
# Lines 288-293: preexec function for child processes
def no_pg_xonsh_preexec_fn():
    os.setpgrp()  # Create new process group
    signal.signal(signal.SIGTSTP, default_signal_pauser)

# Lines 598-618: prep_preexec_fn - sets up process groups
def prep_preexec_fn(self, kwargs, pipeline_group=None):
    if pipeline_group is None:
        xonsh_preexec_fn = no_pg_xonsh_preexec_fn
    else:
        def xonsh_preexec_fn():
            os.setpgid(0, pipeline_group)  # Join existing process group
            signal.signal(signal.SIGTSTP, default_signal_pauser)
    kwargs["preexec_fn"] = xonsh_preexec_fn
```

#### 3. Terminal Control Handoff (`attic/xonsh/xonsh/procs/jobs.py`)

```python
# Lines 304-329: give_terminal_to - transfers terminal control
def give_terminal_to(pgid):
    if pgid is None:
        return False
    # Block signals during handoff to prevent race conditions
    oldmask = _pthread_sigmask(signal.SIG_BLOCK, _block_when_giving)
    try:
        os.tcsetpgrp(FD_STDERR, pgid)  # Give terminal to process group
        return True
    except ProcessLookupError:
        return False
    finally:
        _pthread_sigmask(signal.SIG_SETMASK, oldmask)

# Lines 258-267: Signals to block during terminal handoff
_block_when_giving = (signal.SIGTTOU, signal.SIGTTIN, signal.SIGTSTP, signal.SIGCHLD)
```

#### 4. Alternate Mode Detection (`attic/xonsh/xonsh/procs/posix.py`)

```python
# Lines 24-41: xterm escape codes for alternate screen
MODE_NUMS = ("1049", "47", "1047")
START_ALTERNATE_MODE = frozenset(f"\x1b[?{i}h".encode() for i in MODE_NUMS)
END_ALTERNATE_MODE = frozenset(f"\x1b[?{i}l".encode() for i in MODE_NUMS)

# Lines 246-278: _alt_mode_switch - detect vim/less entering fullscreen
def _alt_mode_switch(self, chunk, membuf, stdbuf):
    i, flag = xt.findfirst(chunk, ALTERNATE_MODE_FLAGS)
    if flag is None:
        self._alt_mode_writer(chunk, membuf, stdbuf)
    else:
        alt_mode = flag in START_ALTERNATE_MODE
        if alt_mode:
            self.in_alt_mode = alt_mode
            self._enable_cbreak_stdin()   # Enable raw input for vim/less
        else:
            self.in_alt_mode = alt_mode
            self._disable_cbreak_stdin()  # Restore normal input
```

#### 5. Signal Forwarding (`attic/xonsh/xonsh/procs/posix.py`)

```python
# Lines 86-93: Signal handler setup in PopenThread.__init__
self.old_int_handler = signal.signal(signal.SIGINT, self._signal_int)
self.old_tstp_handler = signal.signal(signal.SIGTSTP, self._signal_tstp)
self.old_quit_handler = signal.signal(signal.SIGQUIT, self._signal_quit)
self.old_winch_handler = signal.signal(signal.SIGWINCH, self._signal_winch)

# Lines 347-361: SIGTSTP handler (Ctrl+Z)
def _signal_tstp(self, signum, frame):
    self.suspended = True
    self.send_signal(signum)  # Forward to child
    self._restore_sigtstp(frame=frame)
```

#### 6. Terminal Sanity Restoration (`attic/xonsh/xonsh/shells/readline_shell.py`)

```python
# Lines 693-711: restore_tty_sanity - emergency terminal reset
def restore_tty_sanity(self):
    stty, _ = XSH.commands_cache.lazyget("stty", (None, None))
    if stty is None:
        return
    # Use os.system because subprocess redirects hide the real TTY
    os.system(stty + " sane")
```

#### 7. Pipeline Terminal Return (`attic/xonsh/xonsh/procs/pipelines.py`)

```python
# Lines 502-515: _return_terminal - give terminal back to shell
def _return_terminal(self):
    pgid = os.getpgid(0)
    if self.term_pgid is None or pgid == self.term_pgid:
        return
    if xj.give_terminal_to(pgid):
        self.term_pgid = pgid
        if XSH.shell is not None:
            XSH.shell.shell.restore_tty_sanity()  # Reset terminal state
```

### Clam’s Current Problem (`packages/clam/src/lib/input.ts`)

The bug occurs because:

1. **Line 523**: `readline.emitKeypressEvents(process.stdin)` puts stdin in raw mode
2. **Lines 548-816**: Keypress handler processes all input, even during subprocess
3. **Line 911**: `shell.exec(command, { captureOutput: false })` spawns subprocess
4. The keypress handler remains active and interferes with subprocess stdin
5. No TTY state is saved before spawning
6. No terminal handoff occurs (`tcsetpgrp` not called)
7. No terminal restoration on exit

**The fix requires pausing the keypress handler and properly managing TTY state around
subprocess execution.**

## Design

### Approach

#### Part 1: Modern Tool Detection and Aliasing

1. **Tool detection module**: Create a system to detect installed CLI tools
2. **Alias system**: Conditionally register aliases when tools are found
3. **Startup display**: Show which tools are available at shell startup
4. **Configuration**: Allow users to disable specific aliases or the whole system

#### Part 2: Interactive Command Handling (Critical Fix)

1. **TTY state management**: Save/restore terminal attributes around subprocess
   execution
2. **Process group management**: Create proper process groups for subprocesses
3. **Terminal control handoff**: Give terminal control to foreground process
4. **Alternate mode detection**: Detect full-screen apps and handle appropriately
5. **Cleanup on exit**: Always restore terminal state, even on abnormal exit

### Components

```
packages/clam/src/lib/
├── shell/
│   ├── modern-tools.ts       # Tool detection and aliasing
│   ├── modern-tools.test.ts  # Tests
│   ├── tool-display.ts       # Startup display formatting
│   └── index.ts              # Re-exports
├── tty/
│   ├── tty-state.ts          # TTY state save/restore (tcgetattr/tcsetattr)
│   ├── process-group.ts      # Process group management
│   ├── terminal-control.ts   # Terminal control handoff (tcsetpgrp)
│   ├── alternate-mode.ts     # Detect vim/less alternate mode
│   └── index.ts              # Re-exports
└── input.ts                  # Update to use tty module for subprocess handling
```

### Tool Detection API

```typescript
// lib/shell/modern-tools.ts

export interface ToolInfo {
  name: string;
  command: string;           // The actual command to run
  replaces?: string;         // Traditional command it replaces
  flags?: string[];          // Default flags to add
  description: string;
}

export const MODERN_TOOLS: ToolInfo[] = [
  { name: 'eza', command: 'eza', replaces: 'ls',
    flags: ['--group-directories-first', '-F'], description: 'Modern ls' },
  { name: 'bat', command: 'bat', replaces: 'cat', description: 'Cat with syntax highlighting' },
  { name: 'ripgrep', command: 'rg', replaces: 'grep', description: 'Fast grep' },
  { name: 'zoxide', command: 'z', replaces: 'cd', description: 'Smart cd' },
  { name: 'dust', command: 'dust', replaces: 'du', description: 'Modern du' },
  { name: 'duf', command: 'duf', replaces: 'df', description: 'Modern df' },
  { name: 'hexyl', command: 'hexyl', description: 'Hex viewer' },
  { name: 'fd', command: 'fd', replaces: 'find', description: 'Modern find' },
];

export async function detectInstalledTools(): Promise<Map<string, boolean>>;
export function getToolAliases(installed: Map<string, boolean>, config: ToolConfig): Map<string, string[]>;
export function formatToolStatus(installed: Map<string, boolean>): string;
```

### TTY Management API

```typescript
// lib/tty/tty-state.ts

export interface TtyState {
  // Raw termios data
  iflag: number;
  oflag: number;
  cflag: number;
  lflag: number;
  cc: number[];
}

export function saveTtyState(fd: number): TtyState | null;
export function restoreTtyState(fd: number, state: TtyState): boolean;
export function resetTerminal(): void;  // Emergency reset

// lib/tty/process-group.ts
export function createProcessGroup(pid: number): boolean;
export function giveTerminalTo(pgid: number): boolean;
export function returnTerminalToShell(): boolean;

// lib/tty/alternate-mode.ts
export function isAlternateModeEnter(chunk: Buffer): boolean;
export function isAlternateModeExit(chunk: Buffer): boolean;
```

### Node.js Implementation Approach

Node.js does not have native `tcgetattr`/`tcsetattr`/`tcsetpgrp` APIs.
Here are the options:

#### Option A: Simple Approach (Recommended First)

Use `stty sane` for terminal restoration (like xonsh does), and pause keypress handling:

```typescript
// In input.ts, around shell.exec():

async function runInteractiveCommand(command: string): Promise<void> {
  // 1. Remove keypress listener temporarily
  process.stdin.removeListener('keypress', keypressHandler);

  // 2. Disable raw mode if it was enabled
  if (process.stdin.isTTY && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }

  try {
    // 3. Run command with inherited stdio
    await shell.exec(command, { captureOutput: false });
  } finally {
    // 4. Restore terminal with stty sane (handles edge cases)
    execSync('stty sane', { stdio: 'inherit' });

    // 5. Re-enable raw mode for keypress detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // 6. Re-attach keypress listener
    process.stdin.on('keypress', keypressHandler);
  }
}
```

#### Option B: Using node-termios (For Full Control)

```typescript
import termios from 'node-termios';

function saveTtyState(): any {
  try {
    return termios.getattr(process.stdin.fd);
  } catch {
    return null;
  }
}

function restoreTtyState(state: any): void {
  if (state) {
    try {
      termios.setattr(process.stdin.fd, state);
    } catch {
      // Fallback to stty sane
      execSync('stty sane', { stdio: 'inherit' });
    }
  }
}
```

#### Option C: Using node-pty (For Full PTY Support)

```typescript
import { spawn as spawnPty } from 'node-pty';

async function runWithPty(command: string): Promise<void> {
  return new Promise((resolve) => {
    const pty = spawnPty('bash', ['-c', command], {
      name: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: process.cwd(),
      env: process.env,
    });

    // Forward output
    pty.onData((data) => process.stdout.write(data));

    // Forward input (in raw mode)
    process.stdin.setRawMode(true);
    process.stdin.on('data', (data) => pty.write(data));

    // Handle resize
    process.stdout.on('resize', () => {
      pty.resize(process.stdout.columns || 80, process.stdout.rows || 24);
    });

    pty.onExit(({ exitCode }) => {
      process.stdin.setRawMode(false);
      resolve();
    });
  });
}
```

### Exit Handler for Terminal Restoration

Always restore terminal on exit, even on crash:

```typescript
// In main entry point (bin.ts or similar)

function setupTerminalCleanup(): void {
  const cleanup = () => {
    try {
      // Reset terminal to sane state
      execSync('stty sane 2>/dev/null || true', { stdio: 'inherit' });
    } catch {
      // Ignore errors during cleanup
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
}
```

### Subprocess Execution Changes

```typescript
// Updated subprocess handling pseudocode

async function runInteractiveCommand(cmd: string, args: string[]): Promise<void> {
  const ttyState = saveTtyState(process.stdin.fd);

  try {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',  // Full pass-through for interactive
      detached: true,    // Create new process group
    });

    // Give terminal to child
    giveTerminalTo(proc.pid);

    // Wait for completion
    await waitForProcess(proc);

  } finally {
    // Always restore terminal
    returnTerminalToShell();
    if (ttyState) {
      restoreTtyState(process.stdin.fd, ttyState);
    }
  }
}
```

## Implementation Plan

### Phase 1: Critical Bug Fix - Interactive Command Handling

Priority: **HIGH** - This causes terminal corruption

Start with Option A (simple approach using `stty sane`):

- [ ] Pause keypress handler before spawning interactive subprocess
- [ ] Disable raw mode before spawn: `process.stdin.setRawMode(false)`
- [ ] Run `stty sane` after subprocess exits to restore terminal
- [ ] Re-enable raw mode and keypress handler after subprocess
- [ ] Add emergency `stty sane` on Clam exit (process.on('exit'), SIGINT, SIGTERM)
- [ ] Test with `bash`, `vim`, `less`, `htop`
- [ ] Handle Ctrl+C during subprocess (don’t let it kill Clam)

### Phase 1b: Working Directory State Management

Priority: **HIGH** - Basic shell usability

The shell’s working directory must persist across commands and sync with Claude Code.

- [ ] Track current working directory in shell state (not just `process.cwd()`)
- [ ] Update shell cwd after `cd` commands complete
- [ ] Persist cwd across shell command executions (don’t reset to startup dir)
- [ ] Pass current cwd to Claude Code session on each invocation
- [ ] When Claude Code changes directory (via tool), sync back to shell state

**Sync with Claude Code:**
- On NL input → always prepend “Working directory: /path/to/dir” to give Claude context
- If Claude Code runs `cd` or changes directory → update shell’s cwd
- Shell `cd` command → no Claude Code involvement, just update shell state

### Phase 1c: Input Mode Detection Fixes

Priority: **HIGH** - Correct routing of input

**Slash commands vs absolute paths:**
- [ ] `/context`, `/help`, `/model` → slash commands (check against known command list
  first)
- [ ] `/usr/bin/ls`, `/tmp/script.sh` → shell commands (absolute paths)
- [ ] Detection order: if input starts with `/` and matches a registered slash command →
  run it
- [ ] Otherwise treat as potential shell command (check if path exists or let shell
  handle it)

### Phase 2: Modern Tool Detection and Display

- [ ] Implement `modern-tools.ts` with tool detection
- [ ] Add `which` or `command -v` based detection
- [ ] Implement `formatToolStatus()` for startup display
- [ ] Add startup message showing detected tools:
  ```
  Modern tools: ✔ eza ✔ bat ✔ rg ✔ zoxide ✗ dust ✗ duf
  ```
- [ ] Write tests for tool detection

### Phase 3: Command Aliasing/Rewriting

- [ ] Implement alias registry mapping original command to replacement
- [ ] Add command rewriting hook in shell execution path (before spawn)
- [ ] Implement these aliases (only if tool detected in Phase 2):
  - `ls` -> `eza --group-directories-first -F`
  - `ll` -> `eza --group-directories-first -F -l`
  - `cat` -> `bat --paging=never` (disable pager for non-interactive use)
- [ ] Pass through original command if replacement tool not found

### Phase 4: Zoxide Integration

- [ ] Detect zoxide installation (via `which zoxide`)
- [ ] Add `z` as alias for `zoxide query --exclude $PWD --`
- [ ] Call `zoxide add $PWD` after each successful `cd` to update frecency database
- [ ] Add `zi` for interactive selection (`zoxide query -i`)

### Phase 5: Shell Convenience Features

Based on kash/xonsh research, these features improve shell usability.

#### Auto-cd

- [ ] If input is a valid directory path (absolute or relative), cd to it automatically
- [ ] Check with `fs.statSync(input).isDirectory()` before attempting cd

#### Typo Prevention

- [ ] On Enter: if first word looks like a command but `which` fails, don’t execute
- [ ] Instead show completion menu with similar command names
- [ ] Use Levenshtein distance to find close matches from PATH commands

#### Exit Code Display

- [ ] Show non-zero exit codes in red after command completes: `[exit 1]`
- [ ] Store last exit code for prompt display (future rich prompt work)

#### Command Timing

- [ ] Track execution time for shell commands
- [ ] Display elapsed time after commands taking >2s: `[2.3s]` or `[1m 23s]`

#### Unified Command History

Already implemented: up/down navigation, unified history stream, persistence.

- [ ] Ctrl+R: shell out to `fzf` if available, otherwise show “fzf not installed” hint

#### Standard Readline Keybindings

Most keybindings (Ctrl+A/E/K/U/W/Y, Alt+B/F, etc.)
are built into Node.js readline.

- [ ] Verify standard keybindings still work with our raw mode setup
- [ ] Add Ctrl+L handler: clear screen with `\x1b[2J\x1b[H`, redraw prompt
- [ ] Add Ctrl+D handler: exit cleanly if line is empty

## Testing Strategy

**Unit tests:**
- Tool detection correctly identifies installed/missing tools
- TTY state save/restore works correctly
- Alias generation produces correct command arrays
- Alternate mode detection recognizes escape sequences

**Integration tests:**
- Run `bash` from Clam, execute commands, exit cleanly
- Run `vim` from Clam, edit file, save, exit cleanly
- Ctrl+Z suspends correctly, `fg` resumes
- Terminal state is clean after Clam exits (even after crash)
- Tool aliases work correctly when tools are installed

**Manual testing:**
```bash
# Test interactive command handling
clam
▶ bash
$ echo "test"
$ exit
# Terminal should be clean

# Test vim
▶ vim test.txt
# Edit, save, quit
# Terminal should be clean

# Test tool display at startup
clam
# Should show: Modern tools: ✔ eza ✔ bat ...

# Test aliases
▶ ls   # Should use eza if installed
```

## Rollout Plan

1. **Phase 1** (Critical): Fix interactive command handling (TTY fix)
2. **Phase 1b** (Critical): Working directory state management and Claude Code sync
3. **Phase 1c** (Critical): Input mode detection fixes (slash commands vs paths)
4. **Phase 2**: Tool detection and startup display
5. **Phase 3**: Command aliasing/rewriting for detected tools
6. **Phase 4**: Zoxide integration
7. **Phase 5**: Shell conveniences (auto-cd, typo prevention, exit codes, keybindings)

## Open Questions

### TTY Management

- If `stty sane` proves insufficient, consider `node-termios` for full termios control

### Tool Aliases

- How do we handle GNU vs BSD flag differences?
  (e.g., `ls --color` vs `ls -G`)
- What if user has their own aliases that conflict?

### Performance

- Tool detection at startup: run `which` checks in parallel to minimize delay

## Future/Deferred Features

These features are lower priority and deferred to future planning.

### Rich Prompt Features

Based on kash’s `customize_prompt.py`:

#### Git Integration

- [ ] Show current branch in prompt
- [ ] Show dirty/clean status (*, +, etc.)
- [ ] Show ahead/behind remote counts

#### Smart Path Display

- [ ] Abbreviate home directory as `~`
- [ ] Show last 2 directory components for deep paths

### AI-Powered Shell Features via Claude Code Delegation

Since Clam embeds Claude Code, AI features should delegate to Claude Code rather than
implementing separate AI capabilities.
This provides consistency with Claude Code’s behavior and avoids duplicating AI logic.

#### Error Handling Delegation

- [ ] When command fails, capture error output
- [ ] Offer to delegate to Claude Code: “Command failed.
  Press ? to ask Claude about this”
- [ ] Pass error context (command, exit code, stderr) to Claude Code session
- [ ] Let Claude Code handle explanation and suggestions

#### Context Capture for AI

- [ ] Capture last command output for AI context
- [ ] When user asks “what was that output?”, include it in Claude Code context
- [ ] Maintain command/output history for AI conversation continuity

#### Natural Language Mode Shortcuts

- [ ] Space at start of empty line → converts to “? ” for NL mode (kash does this)
- [ ] If first word is invalid command + user types space, auto-prefix with “? ”
- [ ] Auto-quote questions to prevent syntax errors
- [ ] These shortcuts route directly to Claude Code

#### Command Suggestions (Future)

- [ ] After certain operations, suggest related commands via Claude Code
- [ ] `/explain ls -la` - delegates to Claude Code for explanation
- [ ] Context-aware completions informed by AI

### FAQ and Semantic Completion (Future)

Inspired by kash’s intelligent completion system:

#### FAQ Integration in Completions

- [ ] Tab on empty line shows top FAQ items / common commands
- [ ] Personalized based on user’s command history and context
- [ ] Show “getting started” suggestions for new users
- [ ] Context-aware: different suggestions in git repo vs.
  node project

#### Two-Stage Tab Completion

- [ ] First Tab: fast lexical completions (file paths, command names, flags)
- [ ] Second Tab: semantic completions (slower, AI-informed suggestions)
- [ ] Kash does this via `xonsh_keybindings.py:145-170` with `more_results_requested`
  state
- [ ] Consider visual indicator that more completions are available

#### Embedding-Based Completions

- [ ] Use embeddings to find semantically similar commands/files
- [ ] Kash uses this for matching user intent to available actions
- [ ] Could use a fast/small model (e.g., Haiku) for low-latency suggestions
- [ ] Cache embeddings for common completions to reduce latency
- [ ] Trade-off: accuracy vs.
  speed - may need hybrid approach

### Fish-style Auto-suggestions (Future)

This requires more sophisticated terminal handling:
- [ ] Gray text ahead of cursor showing predicted completion
- [ ] Fish-style history-based suggestions
- [ ] Would require Rust bindings (rustyline/reedline) or Clam overlays

## References

### Related Specs

- [ANSI Color Output Spec](plan-2026-02-05-ansi-color-subprocess-output.md) - Related
  TTY work

### Kash Reference Implementation

- [xonsh_modern_tools.py](../../repos/kash/src/kash/xonsh_custom/xonsh_modern_tools.py)
  \- Tool detection and aliasing
- [xonsh_keybindings.py](../../repos/kash/src/kash/xonsh_custom/xonsh_keybindings.py) -
  Typo prevention, double-tab, NL shortcuts
- [custom_shell.py](../../repos/kash/src/kash/xonsh_custom/custom_shell.py) - Command
  not found AI assistance, xonsh settings
- [customize_prompt.py](../../repos/kash/src/kash/xonsh_custom/customize_prompt.py) -
  Rich prompt with workspace/path info
- [welcome.py](../../repos/kash/src/kash/commands/help/welcome.py) - Welcome message
- [settings.py](../../repos/kash/src/kash/config/settings.py) - RECOMMENDED_PKGS list,
  Nerd icons setting

### Xonsh TTY Management

- [posix.py](../../attic/xonsh/xonsh/procs/posix.py) - PopenThread, TTY state, alternate
  mode detection
- [jobs.py](../../attic/xonsh/xonsh/procs/jobs.py) - Process groups, terminal handoff,
  job control
- [pipelines.py](../../attic/xonsh/xonsh/procs/pipelines.py) - Terminal return, cleanup
- [specs.py](../../attic/xonsh/xonsh/procs/specs.py) - Subprocess spec, preexec_fn
- [readline_shell.py](../../attic/xonsh/xonsh/shells/readline_shell.py) -
  restore_tty_sanity

### External Libraries

- [clideps](https://github.com/jlevy/clideps) - Tool detection library used by kash
- [node-pty](https://github.com/microsoft/node-pty) - Potential PTY solution for Node.js
- [node-termios](https://github.com/Gottox/node-termios) - POSIX termios bindings for
  Node.js

### Documentation

- [GNU Job Control](https://www.gnu.org/software/libc/manual/html_node/Job-Control.html)
- [POSIX Terminal Interface](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/termios.h.html)
- [Fish Shell Features](https://fishshell.com/docs/current/index.html) - Inspiration for
  auto-suggestions
