# Implementation Roadmap: clam v0.1

**Date:** 2026-02-04

**Author:** Claude (consolidated from specs and PR review)

**Status:** Shell Support Complete - Ready for Testing

## Overview

This document consolidates all remaining work for clam v0.1, organized into phases with dependencies and priorities. Work is tracked via tbd beads linked throughout.

## Current State

**Completed:**

- Phase 0: Critical Bug Fixes ✅
- Phase 1: Minimal Viable Client ✅
- Phase 2: Usable UX Polish ✅ (partial - TTY checks, config validation done)
- Phase 3: Shell Support ✅ (shell module, mode detection, input integration)
- Phase 4: Code Cleanup ✅
- Local slash commands (/help, /quit, /status, /config, /clear) ✅
- Slash command tab completion ✅
- CI/CD, changesets, git hooks, development docs ✅

**Ready for Testing:**

- Core ACP client connects to Claude Code
- Natural language prompts routed to Claude
- Shell commands executed directly (bypass ACP)
- Mode detection with input coloring
- Permission handling

**Remaining Work (P1-P2):**

- ACP command routing (/commit, /review, /model)
- npm publishing
- History persistence
- Arrow key navigation
- Test coverage expansion

---

## Phase 0: Critical Bug Fixes (P0) ✅ COMPLETE

**Goal:** Fix security and data integrity issues before any feature work.

**Status:** All critical issues resolved.

### 0.1 Silent File Operation Errors ✅

**Bead:** `clam-q3p0` (CLOSED)
**Location:** `packages/clam/src/lib/acp.ts:371-393`

**Problem:** `readTextFile` returns empty string on error, `writeTextFile` returns success on error. Agent thinks operations succeeded.

**Resolution:** Fixed - now throws errors with descriptive messages.

**Fix:**

```typescript
async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
  output.debug(`Read file: ${params.path}`);
  const { readFileSync } = await import('node:fs');
  // Let errors propagate - don't swallow them
  const content = readFileSync(params.path, 'utf-8');
  return { content };
}

async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
  output.debug(`Write file: ${params.path}`);
  const { writeFileSync } = await import('node:fs');
  // Let errors propagate
  writeFileSync(params.path, params.content, 'utf-8');
  return {};
}
```

### 0.2 Shell Injection in Editor Spawn ✅

**Bead:** `clam-kiod` (CLOSED)
**Location:** `packages/clam/src/lib/input.ts:224-228`

**Problem:** `shell: true` with user-controlled EDITOR env var allows arbitrary command execution.

**Resolution:** Removed /edit command entirely - it was not useful and added complexity/risk.

---

## Phase 1: High Priority Bug Fixes (P1) - Mostly Complete

**Goal:** Fix issues that affect reliability and user experience.

### 1.1 Async Cleanup Not Awaited ✅

**Bead:** `clam-pz34` (CLOSED)
**Location:** `packages/clam/src/bin.ts:335-345`

**Problem:** SIGINT handler calls `cleanup()` then immediately `process.exit(0)`.

**Resolution:** Verified cleanup() is synchronous - no async operations to await.

**Fix:** Make cleanup synchronous or use `process.on('beforeExit')`:

```typescript
// Option A: Synchronous cleanup
process.on('SIGINT', () => {
  output.newline();
  output.info('Interrupted. Cleaning up...');
  acpClient.disconnectSync(); // Add sync method
  process.exit(0);
});

// Option B: Async-friendly exit
let isExiting = false;
process.on('SIGINT', async () => {
  if (isExiting) process.exit(1); // Force on second Ctrl+C
  isExiting = true;
  output.newline();
  output.info('Interrupted. Cleaning up...');
  await cleanup();
  process.exit(0);
});
```

### 1.2 Infinite Loop on EOF ✅

**Bead:** `clam-oxkg` (CLOSED)
**Location:** `packages/clam/src/lib/permissions.ts:157-158`

**Problem:** `promptForPermission` loops forever if stdin is closed.

**Resolution:** Removed unused `promptForPermission` function entirely.

### 1.3 Temp File Cleanup on Error ✅

**Bead:** `clam-tuef` (CLOSED)
**Location:** `packages/clam/src/lib/input.ts:253`

**Resolution:** No longer applicable - /edit command was removed.

### 1.4 ACP Command Routing

**Bead:** `clam-76um`
**Spec Location:** Main spec, "S.1 Slash Command Framework"

**Task:** Route ACP commands (`/commit`, `/review`, `/model`, etc.) to Claude Code.

**Implementation:**

1. Parse `available_commands_update` events in `acp.ts` (already received)
2. Store available commands in session state
3. Display in `/help` output
4. Add to tab completion
5. Route commands through ACP session

```typescript
// In acp.ts - handle available_commands_update
case 'available_commands_update':
  this.availableCommands = event.commands;
  break;

// In input.ts - check for ACP command
if (acpClient.hasCommand(slashCommand)) {
  await acpClient.sendCommand(slashCommand, args);
} else if (localCommands.has(slashCommand)) {
  localCommands.get(slashCommand).execute(args);
}
```

### 1.5 npm Publishing

**Bead:** `clam-ekdv`

**Steps:**

1. Configure `NPM_TOKEN` secret in GitHub repository
2. Manual first publish: `cd packages/clam && npm publish --access public`
3. Create v0.1.0 tag to trigger release workflow
4. Verify package available on npm

---

## Phase 2: UX Improvements (P2) - Partially Complete

**Goal:** Polish the user experience with commonly expected features.

**Completed:** TTY checks (2.5), Config validation (2.6), Temp cleanup (2.7 - N/A after /edit removal)
**Remaining:** Arrow nav (2.1), History (2.2, 2.3), File completion (2.4), Tests (2.8)

### 2.1 Arrow Key Navigation in Completion Menu

**Bead:** `clam-2vrk`
**Location:** `packages/clam/src/lib/input.ts`

**Task:** Add Up/Down Arrow to navigate slash command completions (currently Tab only).

**Implementation:** Requires tracking completion state and handling arrow key events:

```typescript
interface CompletionState {
  options: string[];
  selectedIndex: number;
  prefix: string;
}

// On keypress:
if (key.name === 'down' && completionState) {
  completionState.selectedIndex =
    (completionState.selectedIndex + 1) % completionState.options.length;
  renderCompletion();
}
```

### 2.2 Command History Persistence

**Bead:** `clam-gr62`
**Spec Location:** Main spec, "Phase 3.5: Unified Command History"

**Task:** Save/load history from `~/.clam/code/history`.

```typescript
// On startup
const historyPath = join(configDir, 'history');
const history = existsSync(historyPath)
  ? readFileSync(historyPath, 'utf-8').split('\n').filter(Boolean)
  : [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  history,
  historySize: 1000,
});

// On exit
process.on('beforeExit', () => {
  writeFileSync(historyPath, rl.history.join('\n'));
});
```

### 2.3 Up/Down Arrow History Navigation

**Bead:** `clam-julx`

**Status:** Should work out of box with readline `history` option - verify and fix if broken.

### 2.4 File Path Tab Completion

**Bead:** `clam-lauj`
**Spec Location:** Main spec, "S.2 Autocomplete System"

**Task:** Tab complete `@path/to/file` mentions.

**Implementation:**

```typescript
// Detect @ prefix in completer
if (currentWord.startsWith('@')) {
  const pathPart = currentWord.slice(1);
  const completions = await glob(`${pathPart}*`);
  return [completions.map((p) => `@${p}`), currentWord];
}
```

### 2.5 TTY Checks for Escape Sequences ✅

**Bead:** `clam-t8sy` (CLOSED)

**Resolution:** Added TTY detection to inputColors in formatting.ts and cursor control in input.ts.

### 2.6 Config Value Validation ✅

**Bead:** `clam-xz1a` (CLOSED)

**Resolution:** Added runtime validation for config values - checks types before assignment.

### 2.7 Temp Directory Cleanup ✅

**Bead:** `clam-rcy2` (CLOSED)

**Resolution:** No longer applicable - /edit command was removed.

### 2.8 Test Coverage Expansion

**Bead:** `clam-67aa`

**Files needing tests:**
| File | Tests to Add |
|------|--------------|
| `bin.ts` | Argument parsing, version display |
| `config.ts` | Config loading, env vars, defaults |
| `formatting.ts` | Color functions, truncation, timestamps |

---

## Phase 3: Shell Support (P3) ✅ COMPLETE

**Status:** Fully implemented and tested.

### 3.1 Shell Module ✅

**Bead:** `clam-dfmq` (CLOSED)
**Location:** `src/lib/shell.ts`

**Implemented:**

- `which()` - Command lookup with caching
- `isCommand()` - Validates shell commands
- `exec()` - Executes commands with capture/inherit stdio
- `getCompletions()` - Bash completion integration
- Shell builtins detection (cd, export, alias, etc.)
- 16 tests passing

### 3.2 Mode Detection ✅

**Bead:** `clam-oe1z` (CLOSED)
**Location:** `src/lib/mode-detection.ts`

**Implemented:**

- `detectModeSync()` - Fast sync detection for real-time coloring
- `detectMode()` - Async detection with `which` verification
- Detection rules: slash → shell operators → env vars → builtins → command lookup
- Helper exports: `hasShellOperators()`, `isExplicitShell()`, `stripShellTrigger()`
- 26 tests passing

### 3.3 Input Integration ✅

**Bead:** `clam-qe2g` (CLOSED)
**Location:** `src/lib/input.ts`, `src/lib/output.ts`, `src/bin.ts`

**Implemented:**

- `shellOutput()` method on OutputWriter
- Mode detection integrated with keypress coloring
- Shell commands route through shell module (bypass ACP)
- Colors: shell=white, nl=magenta, slash=blue

### 3.4 Partial Command Rejection ✅

**Bead:** `clam-5stt` (CLOSED)

**Implemented:** Shows helpful message when single-word input looks like a command but isn't recognized:

- `"gi" is not a recognized command. Sending to Claude...`
- Tip: `Use !command to force shell mode`

---

## Phase 4: Code Cleanup (P3) ✅ COMPLETE

### 4.1 Read Version from package.json ✅

**Bead:** `clam-y0a0` (CLOSED)

**Resolution:** Using `createRequire` for ESM-compatible package.json access.

### 4.2 Remove Unused Variables ✅

**Bead:** `clam-15x5` (CLOSED)

**Resolution:** Removed `_inCodeBlock` and `_streamBuffer` from output.ts.

### 4.3 Remove Unused Function ✅

**Bead:** `clam-pqzp` (CLOSED)

**Resolution:** Removed unused `promptForPermission` function from permissions.ts.

### 4.4 Fix Non-null Assertions ✅

**Bead:** `clam-1et9` (CLOSED)

**Resolution:** Added explicit null checks with descriptive error messages.

---

## Dependency Graph

```
Phase 0 (Critical)
├── 0.1 File errors
└── 0.2 Shell injection
        ↓
Phase 1 (High Priority)
├── 1.1 Async cleanup
├── 1.2 EOF loop
├── 1.3 Temp cleanup
├── 1.4 ACP commands
└── 1.5 npm publish
        ↓
Phase 2 (UX)           Phase 4 (Cleanup)
├── 2.1 Arrow nav      ├── 4.1 Version
├── 2.2 History        ├── 4.2 Unused vars
├── 2.3 Up/down        ├── 4.3 Unused func
├── 2.4 File complete  └── 4.4 Assertions
├── 2.5 TTY checks
├── 2.6 Config valid
├── 2.7 Temp dir
└── 2.8 Tests
        ↓
Phase 3 (Shell)
├── 3.1 Shell module
├── 3.2 Mode detect ─→ depends on 3.1
├── 3.3 Input integration ─→ depends on 3.1, 3.2
└── 3.4 Rejection ─→ depends on 3.2
```

---

## Open Questions Requiring Decision

From main spec "Critical Implementation Details":

| #   | Topic                 | Question                                  | Recommendation                   |
| --- | --------------------- | ----------------------------------------- | -------------------------------- |
| 2   | Working Directory     | Should shell `cd` affect ACP session cwd? | Track in clam, pass to both      |
| 5   | Mode Toggle Default   | Enabled or disabled by default?           | Disabled, opt-in via `/shell on` |
| 7   | Prompt Indicator      | How to show current mode?                 | Color only (post-submit)         |
| 8   | Ambiguous Commands    | Handle `test`, `time`, etc.?              | Needs user testing               |
| 9   | Long-Running Commands | Capture vs stream output?                 | Capture for v0.1                 |

---

## Bead Summary

**Total:** 8 open beads (17 closed)

| Priority | Open | Closed | Categories                   |
| -------- | ---- | ------ | ---------------------------- |
| P0       | 0    | 2      | Security, data integrity     |
| P1       | 3    | 4      | Epic, bugs, core features    |
| P2       | 5    | 7      | UX, tests, shell, validation |
| P3       | 0    | 4      | Cleanup                      |

---

## Recommended Next Steps

**Completed:**

- ✅ Day 1: Phase 0 critical fixes (P0 bugs)
- ✅ Day 2: Phase 1 bugs, Phase 4 cleanup
- ✅ Day 3: Phase 3 Shell Support (ahead of schedule)

**Ready for Testing:**
The app is now testable! Run `pnpm dev` in packages/clam to try it.

**Remaining Work:**

1. **P1:** ACP command routing (/commit, /review, /model) - `clam-76um`
2. **P1:** npm publishing - `clam-ekdv`
3. **P2:** History persistence - `clam-gr62`, `clam-julx`
4. **P2:** Arrow navigation - `clam-2vrk`
5. **P2:** File path completion - `clam-lauj`
6. **P2:** Test coverage - `clam-67aa`

---

## References

- Main spec: `docs/project/specs/active/plan-2026-02-03-clam-acp-client-spike.md`
- PR review issues: `docs/project/specs/active/plan-2026-02-04-pr1-review-issues.md`
- Repo setup: `docs/project/specs/active/plan-2026-02-04-repo-setup-completion.md`
