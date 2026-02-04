# Feature: PR #1 Review Issues

**Date:** 2026-02-04

**Author:** Claude (code review)

**Status:** In Progress

## Overview

This spec captures all issues identified during the code review of PR #1 (feat: Set up
clam shell-like interface for Claude Code).
These issues range from critical security/data-integrity problems to test coverage gaps
and code quality improvements.

## Goals

- Fix all critical and high-severity issues before merging PR #1
- Improve test coverage for untested modules
- Address medium and low severity issues as time permits

## Non-Goals

- Complete refactoring of working code
- Adding new features beyond issue fixes

## Issues by Severity

### Critical (Must Fix)

#### 1. Silent file read/write errors in ACP client

**Location:** `packages/clam/src/lib/acp.ts:371-393`

**Problem:** `readTextFile` returns empty string on error, `writeTextFile` returns
success on error. The agent will think:

- Empty files are actually empty (not inaccessible)
- Writes succeeded when they failed

**Impact:** Potential data loss if agent overwrites files it couldn’t read.

**Fix:** Propagate errors to caller instead of swallowing them.

#### 2. Shell injection vulnerability in editor spawn

**Location:** `packages/clam/src/lib/input.ts:224-228`

**Problem:** Uses `shell: true` with user-controlled `EDITOR` environment variable.

```typescript
const editorProcess = spawn(editor, [tempFile], {
  stdio: 'inherit',
  shell: true, // DANGEROUS
});
```

**Impact:** Arbitrary command execution via malicious EDITOR value.

**Fix:** Set `shell: false` and handle editor path resolution separately.

### High (Should Fix)

#### 3. Async cleanup not awaited before exit

**Location:** `packages/clam/src/bin.ts:335-345`

**Problem:** SIGINT handler calls `cleanup()` then immediately `process.exit(0)` without
awaiting async operations.

**Impact:** May orphan child processes or leave resources in inconsistent state.

**Fix:** Use async SIGINT handling or make cleanup synchronous.

#### 4. Potential infinite loop on EOF

**Location:** `packages/clam/src/lib/permissions.ts:157-158`

**Problem:** `promptForPermission` loops forever if stdin is closed (EOF returns empty
string repeatedly).

**Impact:** Process hangs on piped/closed input.

**Fix:** Check for EOF condition and exit gracefully.

#### 5. Temp file not cleaned up on error

**Location:** `packages/clam/src/lib/input.ts:253`

**Problem:** If `readFileSync` fails after creating temp file, the file is not deleted.

**Impact:** Orphan temp files accumulate in `/tmp`.

**Fix:** Use try/finally to ensure cleanup.

### Medium (Nice to Fix)

#### 6. No runtime validation of config values

**Location:** `packages/clam/src/lib/config.ts:92,106`

**Problem:** JSON.parse result cast without validation; parseInt on env var can produce
NaN.

**Fix:** Add schema validation or explicit checks.

#### 7. ANSI escape sequences without TTY check

**Location:** Multiple files (`input.ts`, `output.ts`)

**Problem:** Terminal escape codes written even when stdout is not a TTY.

**Impact:** Corrupted output when piped.

**Fix:** Check `process.stdout.isTTY` before writing escape sequences.

#### 8. Temp directory not cleaned up

**Location:** `packages/clam/src/lib/input.ts:211`

**Problem:** `mkdtempSync` creates directory but only the file inside is deleted.

**Fix:** Remove directory after removing file.

### Low (Optional)

#### 9. Hardcoded version number

**Location:** `packages/clam/src/bin.ts:100-103`

**Problem:** Version is hardcoded as “0.1.0” with TODO comment.

**Fix:** Read from package.json at build time or runtime.

#### 10. Unused variables in output.ts

**Location:** `packages/clam/src/lib/output.ts:108-115`

**Problem:** `_inCodeBlock` and `_streamBuffer` are set but never read.

**Fix:** Remove or implement markdown parsing.

#### 11. Unused promptForPermission function

**Location:** `packages/clam/src/lib/permissions.ts:147-182`

**Problem:** Exported function appears unused (permission prompting handled in bin.ts).

**Fix:** Remove function or document why it’s kept.

#### 12. Non-null assertions in ACP client

**Location:** `packages/clam/src/lib/acp.ts:128-129`

**Problem:** Uses `!` assertions on stdin/stdout which may not exist if spawn fails.

**Fix:** Add proper null checks with clear error messages.

## Test Coverage Gaps

| File | Current Coverage | Needed |
| --- | --- | --- |
| `bin.ts` | None | Basic CLI argument parsing tests |
| `config.ts` | None | Config loading, env var handling |
| `formatting.ts` | None | Color functions, truncation |
| `acp.ts` | Basic only | connect(), prompt(), error cases |
| `input.ts` | Command registration only | /edit command, multi-line input |

## Implementation Plan

### Phase 1: Critical Security/Data Issues

- [ ] Fix silent file operation errors (acp.ts)
- [ ] Fix shell injection in editor spawn (input.ts)

### Phase 2: High Priority Issues

- [ ] Fix async cleanup on exit (bin.ts)
- [ ] Fix potential infinite loop (permissions.ts)
- [ ] Fix temp file cleanup (input.ts)

### Phase 3: Medium Priority

- [ ] Add config validation (config.ts)
- [ ] Add TTY checks for escape sequences
- [ ] Clean up temp directory

### Phase 4: Low Priority & Cleanup

- [ ] Read version from package.json
- [ ] Remove unused variables
- [ ] Remove unused function
- [ ] Fix non-null assertions

### Phase 5: Test Coverage

- [ ] Add tests for bin.ts
- [ ] Add tests for config.ts
- [ ] Add tests for formatting.ts
- [ ] Expand acp.ts tests
- [ ] Expand input.ts tests

## UX Improvements

### 13. Arrow key navigation for completion menu

**Location:** `packages/clam/src/lib/input.ts`

**Problem:** When pressing `/` or Tab to show slash command completions, only Tab cycles
through options. Down Arrow should also work to navigate the menu.

**Expected:** Down Arrow (and Up Arrow) should navigate through completion options,
similar to shell autocomplete behavior.

**Fix:** Add keypress handlers for Up/Down arrows in the completion menu state.

## References

- PR #1: https://github.com/jlevy/clam/pull/1
- Main spec: `docs/project/specs/active/plan-2026-02-03-clam-acp-client-spike.md`
