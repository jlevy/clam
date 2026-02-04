# Implementation Roadmap: clam v0.1

**Date:** 2026-02-04

**Author:** Claude (consolidated from specs and PR review)

**Status:** Planning Complete - Ready for Implementation

## Overview

This document consolidates all remaining work for clam v0.1, organized into phases with dependencies and priorities. Work is tracked via tbd beads linked throughout.

## Current State

**Completed:**

- Phase 1: Minimal Viable Client ✅
- Phase 2: Usable UX Polish ✅
- Local slash commands (/help, /quit, /status, /config, /edit, /clear) ✅
- Slash command tab completion ✅
- CI/CD, changesets, git hooks, development docs ✅

**In Progress:**

- PR #1 review issues (security, data integrity)
- Repository setup completion

**Not Started:**

- ACP command routing
- npm publishing
- Phase 3: Shell Support
- Phase 4: Automation

---

## Phase 0: Critical Bug Fixes (P0)

**Goal:** Fix security and data integrity issues before any feature work.

**Blocking:** All other work should wait for these.

### 0.1 Silent File Operation Errors

**Bead:** `clam-q3p0`
**Location:** `packages/clam/src/lib/acp.ts:371-393`

**Problem:** `readTextFile` returns empty string on error, `writeTextFile` returns success on error. Agent thinks operations succeeded.

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

### 0.2 Shell Injection in Editor Spawn

**Bead:** `clam-kiod`
**Location:** `packages/clam/src/lib/input.ts:224-228`

**Problem:** `shell: true` with user-controlled EDITOR env var allows arbitrary command execution.

**Fix:**

```typescript
const editorProcess = spawn(editor, [tempFile], {
  stdio: 'inherit',
  shell: false, // SAFE - no shell interpretation
});
```

**Additional:** May need to handle editors with spaces in path separately on Windows.

---

## Phase 1: High Priority Bug Fixes (P1)

**Goal:** Fix issues that affect reliability and user experience.

### 1.1 Async Cleanup Not Awaited

**Bead:** `clam-pz34`
**Location:** `packages/clam/src/bin.ts:335-345`

**Problem:** SIGINT handler calls `cleanup()` then immediately `process.exit(0)`.

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

### 1.2 Infinite Loop on EOF

**Bead:** `clam-oxkg`
**Location:** `packages/clam/src/lib/permissions.ts:157-158`

**Problem:** `promptForPermission` loops forever if stdin is closed.

**Fix:**

```typescript
const answer = await rl.question('');
if (answer === null || answer === undefined) {
  // EOF - stdin closed
  rl.close();
  throw new Error('Input stream closed');
}
```

### 1.3 Temp File Cleanup on Error

**Bead:** `clam-tuef`
**Location:** `packages/clam/src/lib/input.ts:253`

**Fix:**

```typescript
try {
  content = readFileSync(tempFile, 'utf-8');
} finally {
  try {
    unlinkSync(tempFile);
  } catch {}
  try {
    rmdirSync(tempDir);
  } catch {}
}
```

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

## Phase 2: UX Improvements (P2)

**Goal:** Polish the user experience with commonly expected features.

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

### 2.5 TTY Checks for Escape Sequences

**Bead:** `clam-t8sy`
**Location:** Multiple files

**Task:** Check `process.stdout.isTTY` before writing ANSI escape sequences.

```typescript
function writeEscape(code: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write(code);
  }
}
```

### 2.6 Config Value Validation

**Bead:** `clam-xz1a`
**Location:** `packages/clam/src/lib/config.ts:92,106`

**Task:** Validate JSON.parse results and parseInt values.

```typescript
const parsed = JSON.parse(content);
if (typeof parsed.truncateAfter === 'number') {
  config.truncateAfter = parsed.truncateAfter;
}

const envTruncate = process.env.CLAM_CODE_TRUNCATE_AFTER;
if (envTruncate) {
  const num = Number.parseInt(envTruncate, 10);
  if (!Number.isNaN(num) && num > 0) {
    config.truncateAfter = num;
  }
}
```

### 2.7 Temp Directory Cleanup

**Bead:** `clam-rcy2`
**Location:** `packages/clam/src/lib/input.ts:211`

See Phase 1.3 fix - remove both file and directory.

### 2.8 Test Coverage Expansion

**Bead:** `clam-67aa`

**Files needing tests:**
| File | Tests to Add |
|------|--------------|
| `bin.ts` | Argument parsing, version display |
| `config.ts` | Config loading, env vars, defaults |
| `formatting.ts` | Color functions, truncation, timestamps |

---

## Phase 3: Shell Support (P3)

**Status:** Design complete in main spec. Not started.

**Dependencies:** Phases 0-1 should be complete first.

### 3.1 Shell Module

**Bead:** `clam-dfmq`
**Spec Location:** Main spec, "Architecture: Shell Module"

**Create:** `src/lib/shell.ts`

**Interface:**

```typescript
export interface ShellModule {
  which(command: string): Promise<string | null>;
  isCommand(word: string): Promise<boolean>;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  getCompletions(partial: string, cursorPos: number): Promise<string[]>;
}
```

**Implementation details in main spec lines 1371-1503.**

### 3.2 Mode Detection

**Bead:** `clam-oe1z`
**Spec Location:** Main spec, "Mode Detection"

**Create:** `src/lib/mode-detection.ts`

**Interface:**

```typescript
export type InputMode = 'shell' | 'nl' | 'slash';

export interface ModeDetector {
  detectMode(input: string): Promise<InputMode>;
  detectModeSync(input: string): InputMode;
  shouldRejectSubmission(input: string): Promise<boolean>;
}
```

**Detection rules in main spec lines 1529-1541.**

### 3.3 Input Integration

**Bead:** `clam-qe2g`
**Spec Location:** Main spec, "Shell Command Execution Flow"

**Tasks:**

1. Add `shellOutput()` to OutputWriter
2. Update InputReader to detect mode on submission
3. Route shell commands to `shell.exec()` instead of ACP
4. Add post-submission input coloring
5. Update tab completion to route based on mode

### 3.4 Partial Command Rejection

**Bead:** `clam-5stt`
**Spec Location:** Main spec, "Partial Command Rejection"

**Behavior:** Reject single short words that aren't valid commands.

**Decision:** Silent stay (no feedback) for v0.1.

---

## Phase 4: Code Cleanup (P3)

### 4.1 Read Version from package.json

**Bead:** `clam-y0a0`
**Location:** `packages/clam/src/bin.ts:100-103`

```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

function showVersion(output: OutputWriter): void {
  output.writeLine(`clam ${version}`);
}
```

### 4.2 Remove Unused Variables

**Bead:** `clam-15x5`
**Location:** `packages/clam/src/lib/output.ts:108-115`

Remove `_inCodeBlock` and `_streamBuffer` (or implement markdown parsing).

### 4.3 Remove Unused Function

**Bead:** `clam-pqzp`
**Location:** `packages/clam/src/lib/permissions.ts:147-182`

Remove `promptForPermission` or document why it's kept.

### 4.4 Fix Non-null Assertions

**Bead:** `clam-1et9`
**Location:** `packages/clam/src/lib/acp.ts:128-129`

```typescript
if (!this.process.stdin || !this.process.stdout) {
  throw new Error('Failed to spawn claude-code-acp: stdin/stdout not available');
}
const input = Writable.toWeb(this.process.stdin);
const stdout = Readable.toWeb(this.process.stdout) as ReadableStream<Uint8Array>;
```

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

**Total:** 25 open beads

| Priority | Count | Categories                |
| -------- | ----- | ------------------------- |
| P0       | 2     | Security, data integrity  |
| P1       | 7     | Epic, bugs, core features |
| P2       | 8     | UX, tests, validation     |
| P3       | 8     | Shell mode, cleanup       |

---

## Recommended Implementation Order

1. **Day 1:** Phase 0 critical fixes (P0 bugs)
2. **Day 2:** Phase 1 high priority (P1 bugs + ACP routing)
3. **Day 3:** npm publish + Phase 2 UX (history, completions)
4. **Day 4:** Phase 2 continued (tests, validation)
5. **Day 5+:** Phase 3 Shell Support (if time permits)

Phase 4 cleanup can be done incrementally alongside other work.

---

## References

- Main spec: `docs/project/specs/active/plan-2026-02-03-clam-acp-client-spike.md`
- PR review issues: `docs/project/specs/active/plan-2026-02-04-pr1-review-issues.md`
- Repo setup: `docs/project/specs/active/plan-2026-02-04-repo-setup-completion.md`
