# Feature: ANSI Color Output for Subprocess Commands

**Date:** 2026-02-05 (last updated 2026-02-05)

**Author:** Claude (with research from xonsh codebase)

**Status:** Implemented (Phase 1)

## Overview

When running shell commands through clam, color output from commands like `ls`, `grep`,
and `git diff` is often lost because the subprocess stdout is piped rather than
connected to a TTY. This feature adds support for preserving ANSI color output in
subprocess commands.

## Goals

- Preserve color output from common CLI commands (ls, grep, git, etc.)
- Provide a consistent, cross-platform approach to color handling
- Minimize complexity and avoid native dependencies where possible
- Support both captured output (for processing) and pass-through output (interactive)

## Non-Goals

- Full PTY emulation for all terminal features (cursor positioning, etc.)
- Windows conpty support (future consideration)
- Supporting commands that only output color via custom mechanisms

## Background

Many CLI commands check `isatty(stdout)` before outputting ANSI color codes.
When a command’s stdout is piped (as is typical when running through a shell wrapper),
they detect it’s not a TTY and disable colors.

**How xonsh solves this:** Xonsh uses `pty.openpty()` on POSIX systems to create real
pseudo-terminals for subprocess stdout/stderr.
This makes commands think they’re running in an interactive terminal.
See `xonsh/procs/specs.py` lines 938-979.

**Environment variable standards:** Two competing de facto standards exist:
- `FORCE_COLOR=1` / `CLICOLOR_FORCE=1` - Force colors on
- `NO_COLOR` - Disable colors

## Design

### Approach

Use a **hybrid approach** that prioritizes simplicity while maintaining compatibility:

1. **Environment variables first** - Set `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` for all
   subprocesses. This works with most modern CLI tools (chalk, supports-color, BSD
   tools).

2. **Command-specific flags** - For known commands that don’t respect env vars, inject
   `--color=always` flags automatically.

3. **Pass-through for interactive** - Use `stdio: 'inherit'` when output goes directly
   to the terminal (not captured).

4. **Future: node-pty** - If env vars prove insufficient, add optional `node-pty`
   support for full PTY emulation.

### Components

```
packages/clam/src/lib/shell/
├── color-env.ts          # Environment variable helpers
├── color-env.test.ts     # Tests for color-env
├── color-commands.ts     # Command-specific flag injection
├── color-commands.test.ts # Tests for color-commands
└── index.ts              # Re-exports all utilities

packages/clam/src/lib/shell.ts  # Updated exec() with forceColor option
```

### API Changes

**New exports from shell module:**

```typescript
// lib/shell/color-env.ts
export const COLOR_FORCING_ENV: Record<string, string>;
export function getColorEnv(): NodeJS.ProcessEnv;

// lib/shell/color-commands.ts
export function addColorFlags(cmd: string, args: string[]): string[];
export function shouldForceColor(cmd: string): boolean;
```

**Subprocess execution updates:**

```typescript
// When spawning subprocesses, automatically include color env
const result = await execa(cmd, addColorFlags(cmd, args), {
  env: getColorEnv(),
});
```

## Implementation Plan

### Phase 1: Environment Variables and Command Flags

- [x] Create `color-env.ts` with `COLOR_FORCING_ENV` constant and `getColorEnv()` helper
- [x] Create `color-commands.ts` with `addColorFlags()` for known commands:
  - `ls`, `grep`, `egrep`, `fgrep` → `--color=always`
  - `diff` → `--color=always`
  - `git` subcommands (diff, log, show, status, branch, stash, grep) → `--color=always`
- [x] Update subprocess execution to use `getColorEnv()` via `forceColor` option
- [ ] Add configuration option to disable color forcing if needed
- [x] Write tests for color flag injection (16 tests)
- [ ] Test with common commands: `ls -la`, `grep pattern`, `git diff`, `git log`

### Phase 2: Documentation and Edge Cases (if needed)

- [ ] Document color behavior in user-facing docs
- [ ] Handle edge cases (commands that break with --color=always)
- [ ] Add allowlist/blocklist for command-specific behavior
- [ ] Consider `node-pty` integration if env vars prove insufficient

## Testing Strategy

**Unit tests:**
- `addColorFlags()` correctly injects flags for known commands
- `addColorFlags()` leaves unknown commands unchanged
- `getColorEnv()` includes all required env vars

**Integration tests:**
- Run `ls --color=always | cat` and verify ANSI codes in output
- Run `git diff --color=always` and verify colored output
- Verify `FORCE_COLOR=1` works with npm/node scripts

**Manual testing:**
```bash
# Verify colors preserved through clam
clam shell
$ ls -la           # Should show colors
$ grep TODO *.ts   # Should show colored matches
$ git diff         # Should show colored diff
```

## Rollout Plan

1. Implement behind a feature flag initially
2. Enable by default after testing
3. Provide `--no-color` override for users who prefer plain output

## Open Questions

- Should we detect terminal color capability (256 color vs truecolor) and set
  `COLORTERM` accordingly?
- Should color forcing be configurable per-command?
- Is `node-pty` worth the native dependency for edge cases?

## References

- [Research: Shell UX and TypeScript Performance](../research/active/research-2026-02-04-shell-ux-typescript.md)
  \- Section 10
- [CLICOLOR Standard](http://bixense.com/clicolors/)
- [FORCE_COLOR](https://force-color.org/)
- [NO_COLOR](https://no-color.org/)
- [node-pty](https://github.com/microsoft/node-pty)
- [xonsh/procs/specs.py](https://github.com/xonsh/xonsh) - PTY implementation reference
