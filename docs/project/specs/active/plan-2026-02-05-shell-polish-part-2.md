---
title: Shell Polish Part 2
description: Mode-aware scrollback prompts and additional shell UX improvements
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Shell Polish Part 2

**Date:** 2026-02-05

**Author:** Joshua Levy

**Status:** Draft

## Overview

Continue polishing the clam shell UX with four focus areas:
1. Mode-aware scrollback prompts - display original mode-appropriate prompt styling when
   commands scroll into history
2. Fix completion selection rendering - selecting a completion should replace the
   current line, not create duplicate prompts
3. Fix @ entity trigger - the @ should be a hotkey that gets replaced, not kept as
   prefix
4. Fix permission confirmation input - currently broken, doesn’t capture keypresses
5. Improve permission prompt visual format - cleaner box, pretty YAML for command
6. Non-zero exit codes should be styled as warnings (yellow)
7. Fix mode detection for phrases like “add a file” (incorrectly detected as shell)
8. Add configurable double-enter behavior for NL submissions
9. Reduce default output truncation to 5 lines (configurable)
10. Truncation indicator “... (N more lines)” should be gray/dimmed

## Goals

- Scrollback prompts mirror the original input mode with appropriate styling (dimmed)
- Shell commands show dimmed bold `$` in scrollback (not `▶`)
- NL prompts show dimmed `▶` in scrollback
- Slash commands show dimmed blue `▶` in scrollback
- All colors remain logical and centralized via `modeVisualConfig`
- Selecting a completion replaces the current input line cleanly (no duplicate prompts)
- @ entity trigger is fully replaced when selecting (e.g., `ls @` → `ls README.md`, not
  `ls @README.md`)
- Permission confirmation prompts work correctly (capture single keypress, have sensible
  default)
- Permission prompt has cleaner visual format (no right border, minimal spacing)
- Permission command displayed as pretty colorized YAML instead of raw JSON
- Non-zero exit codes displayed with warning styling (yellow, like other warnings)
- Mode detection correctly classifies NL phrases like “add a file” (not as shell)
- Mode detection logic is clearer and less error-prone
- Double-enter NL submit behavior is configurable via `DOUBLE_ENTER_NL_SUBMIT` setting
- Output truncation defaults to 5 lines, configurable via `DEFAULT_TRUNCATE_LINES`
  setting
- Truncation indicator “... (N more lines)” is gray/dimmed, not white

## Non-Goals

- Changing the active prompt behavior (already works correctly)
- Adding new input modes

## Background

### Current Behavior

When input is submitted and goes into scrollback, ALL modes display with
`inputPromptDim`
+ `▶` (dimmed magenta), regardless of the original mode:

```
▶ ls -l         # Was shell mode, but shows ▶ instead of $
▶ how are you   # NL mode, correctly shows ▶
```

### Desired Behavior

Scrollback should mirror the original mode-specific prompt:

```
$ ls -l         # Shell mode: bold dimmed $
▶ how are you   # NL mode: dimmed magenta ▶
▶ /help         # Slash mode: dimmed blue ▶
```

### Architecture Analysis

The infrastructure is already in place:

1. **`modeVisualConfig`** in `formatting.ts` already defines `submittedPromptColor` for
   each mode
2. **`historyModes`** Map in `input.ts` already tracks which mode each command was
   executed in
3. The scrollback rendering logic (lines 1164-1221 in `input.ts`) just needs to use
   mode-specific prompts instead of always using `inputPromptDim` + `▶`

Key files:
- `packages/clam/src/lib/formatting.ts` - Color definitions and `modeVisualConfig`
- `packages/clam/src/lib/input.ts` - Scrollback rendering logic (~lines 1164-1221)

### Issue 2: Completion Selection Duplicates Prompt

**Current Behavior:**

When completions are displayed and user selects one with Enter:

```
$ l
> ▸ ls                        List directory contents
  ▸ ln                        Create links between files

[User presses Enter to select 'ls']

$ l                           ← Old partial input still visible (BUG)
$ ls                          ← New line with completion
```

**Expected Behavior:**

```
$ l
> ▸ ls                        List directory contents

[User presses Enter]

$ ls                          ← Single line, replaced in-place
```

**Root Cause Analysis:**

The issue is in the Enter key handling flow (`input.ts` lines 672-728 and 1137-1161):

1. User presses Enter with completion menu open
2. `completionIntegration.handleKeypress('Enter')` processes it
3. Menu is cleared, completion text stored in `completionAcceptedText`
4. But **readline still processes the Enter key**, which:
   - Adds a newline
   - Triggers a new prompt to be shown
5. Then `prompt()` runs and tries to fix it by:
   - Moving up one line (`\x1b[1A`)
   - Clearing that line (`\x1b[2K`)
   - Writing the completion text via `rl.write()`
6. But the old partial input line is now **two lines up**, so it’s never cleared

The fix needs to either:
- Prevent readline from processing the Enter when a completion is accepted
- Or properly clear the original input line before/during the fixup

Key files:
- `packages/clam/src/lib/input.ts` - Enter handling (~~line 672-728) and prompt fixup
  (~~line 1137-1161)
- `packages/clam/src/lib/completion/integration.ts` - Completion acceptance logic

### Issue 3: @ Entity Trigger Should Be Fully Replaced

**Current Behavior:**

When using @ to trigger entity completion:

```
$ ls @
  □ LICENSE
> □ README.md

[User selects README.md]

$ ls @                        ← Duplicate prompt (same as Issue 2)
$ ls @README.md               ← @ kept as prefix (BUG)
```

**Expected Behavior:**

The @ is a hotkey/trigger character that should be completely replaced by the selected
entity:

```
$ ls @
> □ README.md

[User selects]

$ ls README.md                ← @ replaced, single clean line
```

**Analysis:**

The @ character serves as a trigger to open the entity completion menu, similar to how
many editors use @ for mentions.
Once the user selects an entity, the `@` (and any prefix after it) should be replaced
entirely with the selected value.

This is likely in the same code path as Issue 2, in the completion text construction
logic (`input.ts` ~lines 700-722).

### Issue 4: Permission Confirmation Input Broken

**Current Behavior:**

When a permission prompt appears:

```
┌─ Permission Required ────────────────────────────────────────
│
│  Tool:    Write /path/to/file.md
│  Command: {"file_path":...}
│
│  [A] Always Allow
│  [a] Allow
│  [d] Deny
│
└─────────────────────────────────────────────────────────────┘
Choice (A/a/d):
```

Pressing ‘a’ does NOT work inline - instead it shows:

```
▶ a
```

The keypress is being captured by the main input loop, not the confirmation prompt.
The confirmation doesn’t work at all.

**Expected Behavior:**

1. Single keypress (a/A/d) should be captured immediately by the confirmation prompt
2. Should have a sensible default so pressing Enter works (e.g., default to Allow)
3. Input should not leak to the main prompt

**Root Cause Analysis:**

This is a critical bug.
The confirmation system has a fundamental flaw:

1. **Permission prompts are just text output** (`output.ts` line 369) - no input capture
2. **Readline’s keypress handler is ALWAYS active** (`input.ts` lines 552-860)
3. **No permission confirmation state tracking** - no flag like `waitingForPermission`
4. **Keypresses trigger full mode detection** even during confirmation
5. **Input must go through Enter** before reaching the permission handler (`bin.ts` line
   260\)

When you press ‘a’ during permission:
1. Readline’s keypress handler fires first
2. ‘a’ is added to readline’s line buffer
3. Mode detection recolors line (shows `▶ a`)
4. Only after Enter does input reach permission handler
5. But by then, readline state is contaminated

**Fix approach options:**

A. **Track permission state in InputReader** and skip keypress handler logic:
- Add `waitingForPermission` flag
- In keypress handler, if waiting, only capture a/A/d/D and submit immediately

B. **Pause readline during confirmation** and use raw mode:
- Disable readline keypress listener
- Read single character directly from stdin
- Resume readline after confirmation

Key files:
- `packages/clam/src/lib/input.ts` - keypress handler (~line 552)
- `packages/clam/src/lib/output.ts` - permission prompt (~line 269)
- `packages/clam/src/bin.ts` - permission handling (~line 155)

### Issue 5: Permission Prompt Visual Improvements

**Current Format:**

```
┌─ Permission Required ────────────────────────────────────────
│
│  Tool:    Write /path/to/file.md
│  Command: {"file_path":"/path/to/file.md","content":"...long JSON..."}
│
│  [A] Always Allow
│  [a] Allow
│  [d] Deny
│
└─────────────────────────────────────────────────────────────┘
```

Problems:
- Right border makes formatting brittle (line length issues)
- Extra blank lines waste vertical space
- Raw JSON is hard to read, especially for long content

**Desired Format:**

```
┌─ Permission Required ────────────────────────────────────────
│  Tool: Write
│  Path: /path/to/file.md
│  Command:
│    file_path: /path/to/file.md
│    content: |
│      # Feature: ...
│      **Date:** 2026-02-05
│      ...
│
│  [A] Always Allow  [a] Allow  [d] Deny
└───────────────────────────────────────────────
```

Changes:
- No right border (avoid brittle formatting)
- Minimal vertical spacing
- Command JSON parsed and displayed as pretty colorized YAML
- Options on single line to save space

**Implementation - adopt tbd patterns:**

Reference: `repos/tbd/packages/tbd/src/cli/lib/output.ts` (lines 194-210)

1. **Use `yaml` package** (v2.8.2) - add as dependency to clam

2. **YAML stringify options** - add to `packages/clam/src/lib/settings.ts`:
```typescript
// YAML formatting options (mimic tbd patterns)
export const YAML_LINE_WIDTH = 88;
export const YAML_DEFAULT_STRING_TYPE = 'PLAIN';
export const YAML_DEFAULT_KEY_TYPE = 'PLAIN';
export const YAML_STRINGIFY_OPTIONS = {
  lineWidth: YAML_LINE_WIDTH,
  defaultStringType: YAML_DEFAULT_STRING_TYPE,
  defaultKeyType: YAML_DEFAULT_KEY_TYPE,
  sortMapEntries: true,       // Deterministic output
};
```

3. **Colorization pattern** (`renderYamlFrontmatter`):
```typescript
function renderYamlFrontmatter(frontmatter: string): string {
  const lines = frontmatter.split('\n');
  const styledLines = lines.map((line) => {
    const match = /^(\s*)([^:]+:)(.*)$/.exec(line);
    if (match) {
      const [, indent, key, value] = match;
      return indent + pc.dim(key) + pc.bold(value);  // dim keys, bold values
    }
    return pc.bold(line);  // continuation lines bold
  });
  return styledLines.join('\n');
}
```

4. **For permission prompt:**
   - Parse command JSON → object
   - `yaml.stringify(obj, YAML_STRINGIFY_OPTIONS)`
   - Apply colorization (dim keys, bold values)
   - Truncate long string values with `...`

### Issue 6: Non-Zero Exit Codes Should Be Yellow

**Current Behavior:**

```
▶ which add
ℹ [exit 1]       ← White (info style)
```

**Expected Behavior:**

```
▶ which add
⚠ [exit 1]       ← Yellow (warning style)
```

Non-zero exit codes indicate something didn’t work as expected - they’re warnings, not
neutral info. Should use the same yellow warning styling as other warnings like
`⚠ "add" is not a recognized command`.

The icon can stay as `ℹ` or change to `⚠` - either way the color should be yellow.

### Issue 7: Mode Detection Misclassifies “add a file” as Shell

**Current Behavior:**

```
▶ how do you do     ← Pink (NL mode) ✓ correct
▶ add a file        ← Bold white (shell mode) ✗ WRONG
                    ← Also submits on single Enter (shell behavior)
```

**Expected Behavior:**

```
▶ how do you do     ← Pink (NL mode) ✓
▶ add a file        ← Pink (NL mode) ✓
                    ← Requires double Enter (NL behavior)
```

**Root Cause Analysis:**

The mode detection in `mode-detection.ts` uses a priority-ordered rule system.
For “add a file”:

1. “add” is NOT in `NL_ONLY_WORDS` (incomplete word list)
2. “add” is NOT in `AMBIGUOUS_COMMANDS` (only known commands like `who`, `date`, `test`)
3. Falls through to `command-like` rule: `/^[a-zA-Z0-9_-]+$/` matches “add”
4. Returns `shell` mode (tentative, but colors immediately)

**Why the current detection is error-prone:**

1. **Wrong use of word lists** - `NL_ONLY_WORDS` is for words that ARE valid shell
   commands but rarely used that way (who, date).
   “add” isn’t a shell command at all.
2. **Permissive fallback** - `command-like` pattern matches ANY alphanumeric word
3. **No multi-word heuristics** - Doesn’t check if input looks like plain English

**Correct fix approach - adopt kash algorithm:**

The kash repository (`repos/kash/src/kash/xonsh_custom/command_nl_utils.py`) has a
robust `looks_like_nl()` function that uses multi-factor detection:

1. **Character set analysis** - Only word chars, spaces, inner punctuation (-, ')
2. **Word count threshold** - 3+ words (or 2+ if no outer punctuation)
3. **Word length check** - At least one word > 3 characters
4. **Shell operator absence** - No pipes |, redirects >, assignments =, etc.

For “add a file”:
- Only word characters ✓
- 3 words ✓
- Has word > 3 chars ("file" = 4) ✓
- No shell operators ✓ → Should be detected as NL

This approach doesn’t require maintaining a list of every English word - it uses
structural heuristics that are more robust.

Key files:
- `packages/clam/src/lib/mode-detection.ts` - current detection
- `repos/kash/src/kash/xonsh_custom/command_nl_utils.py` - better algorithm to adopt

### Issue 8: Configurable Double-Enter for NL Submit

Currently, NL mode requires two Enters to submit (to allow multi-line input), while
shell mode submits on single Enter.
This behavior should be configurable.

**Setting:**
```typescript
// In settings.ts
export const DOUBLE_ENTER_NL_SUBMIT = true;  // hard-coded for now
```

**Behavior:**
- `true` (default): NL requires double-Enter, shell requires single-Enter (current)
- `false`: Both NL and shell submit on single Enter

This allows experimentation with the UX to determine which feels better.

### Issue 9: Reduce Default Output Truncation to 5 Lines

Currently output truncation shows too many lines before truncating.
Should default to 5 lines for a cleaner, more compact display.

**Current behavior:**
```
> grep "pattern" /path [search] ○
Found 125 files
tbd/pnpm-lock.yaml
tbd/packages/tbd/tsdown.config.ts
tbd/packages/tbd/tests/workspace.test.ts
tbd/packages/tbd/tests/test-helpers.ts
tbd/packages/tbd/tests/terminal-design-system.test.ts
tbd/packages/tbd/tests/tbd-format.test.ts
tbd/packages/tbd/tests/sort.test.ts
tbd/packages/tbd/tests/setup-hooks.test.ts
tbd/packages/tbd/tests/setup-flows.test.ts
... (116 more lines)
```

**Desired behavior (5 lines):**
```
> grep "pattern" /path [search] ○
Found 125 files
tbd/pnpm-lock.yaml
tbd/packages/tbd/tsdown.config.ts
tbd/packages/tbd/tests/workspace.test.ts
tbd/packages/tbd/tests/test-helpers.ts
... (120 more lines)
```

**Setting:**
```typescript
// In settings.ts
export const DEFAULT_TRUNCATE_LINES = 5;  // was 10 or similar
```

### Issue 10: Truncation Indicator Should Be Gray

**Current behavior:**
```
... (58 more lines)    ← White text
```

**Desired behavior:**
```
... (58 more lines)    ← Gray/dimmed text
```

The truncation indicator is metadata, not content.
It should be visually distinct (dimmed) to not distract from the actual output.

## Design

### Approach

Modify the scrollback rendering logic to:
1. Look up the mode from `historyModes` or current `InputState`
2. Use `modeVisualConfig[mode].submittedPromptColor` for the prompt color
3. Use `modeVisualConfig[mode].char` for the prompt character

### Key Code Changes

In `input.ts`, the scrollback rendering sections (for slash, shell, and NL) should use:

```typescript
const config = modeVisualConfig[mode];
const prompt = config.submittedPromptColor(`${config.char} `);
```

Instead of:

```typescript
colors.inputPromptDim(`${promptChars.input} `)
```

## Implementation Plan

### Phase 1: Mode-Aware Scrollback Prompts

- [ ] Update shell command scrollback rendering to use `modeVisualConfig.shell`
- [ ] Update slash command scrollback rendering to use `modeVisualConfig.slash`
- [ ] Update NL scrollback rendering to use `modeVisualConfig.nl`
- [ ] Verify multi-line NL prompts use correct prompt styling
- [ ] Manual testing of all modes in scrollback

### Phase 2: Fix Completion Selection Duplicate Prompt

- [ ] Investigate the exact sequence of events when Enter is pressed with completion
  menu
- [ ] Fix the cursor/line management to clear the original partial input line
- [ ] Ensure the completion text replaces the line in-place without duplicate prompts
- [ ] Test with various completion types (commands, paths, @ entities)
- [ ] Test edge cases (very long completions, multi-word completions)

### Phase 3: Fix @ Entity Trigger Replacement

- [ ] Review the @ trigger text construction logic in `input.ts` (~lines 700-722)
- [ ] Ensure @ and any prefix after it are fully replaced with the selected entity
- [ ] Test @ completion at various positions (start, middle, end of line)
- [ ] Verify files, directories, and other entity types all work correctly

### Phase 4: Fix Permission Confirmation Input (CRITICAL)

- [ ] Review how confirmation prompts are currently implemented
- [ ] Investigate why keypresses are going to main input instead of confirmation
- [ ] Ensure readline is properly paused/suspended during confirmation
- [ ] Implement proper raw mode keypress capture for confirmation
- [ ] Add default value so Enter works (likely default to Allow)
- [ ] Test all confirmation responses (A/a/d and Enter for default)

### Phase 5: Permission Prompt Visual Improvements

- [ ] Remove right border from permission box
- [ ] Remove extra blank lines (minimal vertical spacing)
- [ ] Add `yaml` package (v2.8.2) as dependency
- [ ] Add YAML settings to `settings.ts`:
  - `YAML_LINE_WIDTH = 88`
  - `YAML_DEFAULT_STRING_TYPE = 'PLAIN'`
  - `YAML_DEFAULT_KEY_TYPE = 'PLAIN'`
  - `YAML_STRINGIFY_OPTIONS` (combined object)
- [ ] Create `renderYaml()` function (port from tbd `renderYamlFrontmatter`)
  - Dim keys (including colon)
  - Bold values
  - Bold continuation lines
- [ ] Parse command JSON → YAML → colorized output
- [ ] Truncate long string values with `...` indicator
- [ ] Put options on single line to save space
- [ ] Test with various tool types (Write, Bash, Read, etc.)

### Phase 6: Non-Zero Exit Code Warning Style

- [ ] Find where exit code display is rendered
- [ ] Change non-zero exit codes to use warning color (yellow)
- [ ] Consider changing icon from `ℹ` to `⚠` for non-zero
- [ ] Test with various commands that return non-zero

### Phase 7: Fix Mode Detection - Adopt kash Algorithm

**Reference:** `repos/kash/src/kash/xonsh_custom/command_nl_utils.py`

The kash `looks_like_nl()` algorithm:
```python
# Inner punct: stays in words (e.g., "don't", "uh-oh", "well—actually")
INNER_PUNCT_CHARS = r"-''–—"        # hyphen, apostrophes (straight/curly), en/em dash

# Outer punct: sentence-level, gets stripped (e.g., "hello, world!")
OUTER_PUNCT_CHARS = r".,'\"" "''':;!?()"  # period, comma, quotes (all types), etc.

ONLY_WORDS_RE = /^[\w\s-''–—]*$/    # word chars + spaces + inner punct

def looks_like_nl(text):
    is_only_word_chars = ONLY_WORDS_RE.fullmatch(text)
    without_punct = strip_all_punct(text)
    words = without_punct.split()
    one_longer_word = any(len(word) > 3 for word in words)

    return one_longer_word and (
        (len(words) >= 3) or
        (is_only_word_chars and len(words) >= 2)
    )
```

**Implementation tasks:**

- [ ] Add `looksLikeNl(text: string): boolean` function to `mode-detection.ts`
  - Port the kash algorithm to TypeScript
  - Define INNER_PUNCT_CHARS: `-''–—`
  - Define OUTER_PUNCT_CHARS: `.,'\"" "''':;!?()`
  - Define ONLY_WORDS_RE: `/^[\w\s\-''–—]*$/`

- [ ] Integrate into detection rule order:
  - Check `looksLikeNl()` BEFORE the `command-like` fallback
  - If `looksLikeNl()` returns true → return ‘nl’
  - Only fall through to `command-like` if it fails

- [ ] Update test cases:
  - NL (should pass): “add a file”, “fix this bug”, “hello world”, “what’s up”
  - Shell (should fail): “ls -la”, “cd ..”, “x=3”, “cmd | grep”, “file.txt”

**Why this works for “add a file”:**
- is_only_word_chars = true (all word chars and spaces)
- words = ["add", “a”, "file"] → 3 words
- one_longer_word = true ("file" has 4 chars)
- Returns true → NL mode ✓

**Why “ls -la” still works as shell:**
- is_only_word_chars = true (hyphen is inner punct)
- words = ["ls", "la"] → 2 words
- one_longer_word = false (both words ≤ 3 chars)
- Returns false → falls through to shell mode ✓

### Phase 8: Configurable Double-Enter NL Submit

- [ ] Add `DOUBLE_ENTER_NL_SUBMIT: boolean = true` to `settings.ts`
- [ ] Find where double-enter logic is implemented for NL mode
- [ ] Wrap that logic with `if (DOUBLE_ENTER_NL_SUBMIT)` check
- [ ] When false, NL submits on single Enter like shell
- [ ] Test both settings work correctly

### Phase 9: Reduce Default Output Truncation + Gray Indicator

- [ ] Find current truncation default (likely in config or settings)
- [ ] Add `DEFAULT_TRUNCATE_LINES = 5` to `settings.ts`
- [ ] Update truncation logic to use the new default
- [ ] Make “... (N more lines)” text gray/dimmed (use `pc.dim()` or similar)
- [ ] Test output truncation shows 5 lines + dimmed indicator

## Testing Strategy

**Scrollback prompts:**
- Manual verification: run clam, execute shell commands, NL prompts, and slash commands
- Verify each shows the correct dimmed prompt character and color in scrollback
- Test multi-line NL input to ensure continuation lines also render correctly

**Completion selection:**
- Type partial command (e.g., `l`), see completion menu
- Press Enter to select - verify single clean line with no duplicate prompts
- Test with Tab-triggered completions
- Verify scrollback looks clean after multiple completions

**@ entity trigger:**
- Type `ls @` and select a file - verify result is `ls filename` not `ls @filename`
- Type `cat @READ` and select README.md - verify @ and prefix are replaced
- Test @ at different positions in the line
- Test with directories (should work the same way)

**Permission confirmation:**
- Trigger a permission prompt (e.g., ask Claude to write a file)
- Press ‘a’ - should allow immediately without showing `▶ a`
- Press ‘A’ - should always allow
- Press ‘d’ - should deny
- Press Enter - should use default (likely Allow)
- Verify input doesn’t leak to main prompt after confirmation

**Permission prompt visuals:**
- Verify no right border on permission box
- Verify minimal vertical spacing (no extra blank lines)
- Verify command JSON is displayed as pretty YAML
- Verify YAML is colorized appropriately
- Verify long content is truncated with `...`
- Test with different tool types (Write, Bash, Read)

**Non-zero exit codes:**
- Run `which nonexistent` - verify `[exit 1]` is yellow
- Run `false` - verify exit code display is yellow
- Run `ls` (success) - verify no exit code shown or it’s neutral

**Mode detection (from kash test cases):**

NL mode (pink, double Enter):
- “add a file” - 3 words, has word > 3 chars
- “hello world” - 2 words, only word chars
- “what’s up” - straight apostrophe is inner punct, 2 words
- “don’t do that” - apostrophe in contraction, 3 words
- “uh-oh, that’s bad” - hyphenated word + apostrophe + comma (outer)
- “is this a question?”
  - outer punct stripped, 4 words
- “git push origin main” - 4 words, has words > 3 chars
- “go to the store (buy milk)” - 6 words after punct strip
- “well—that’s interesting” - em dash is inner punct
- "it’s a “quoted” phrase" - curly quotes are outer punct, stripped

Shell mode (white, single Enter):
- “ls -la” - only 2 words, both ≤ 3 chars
- “cd ..” - only 1 word after punct strip, ≤ 3 chars
- “file_name.txt” - single token
- “x=3” - has = operator
- “cmd | grep pattern” - has pipe operator
- “echo $HOME” - has $ variable
- “a > b” - has redirect operator

## Open Questions

*None currently - awaiting additional issues from user*

## References

- Related spec: [plan-2026-02-05-shell-polish.md](plan-2026-02-05-shell-polish.md)
- Key file: `packages/clam/src/lib/input.ts` (scrollback rendering, keypress handler)
- Key file: `packages/clam/src/lib/formatting.ts` (modeVisualConfig)
- Key file: `packages/clam/src/lib/output.ts` (permission prompt display)
- Key file: `packages/clam/src/bin.ts` (permission handling)
- Key file: `packages/clam/src/lib/mode-detection.ts` (mode classification logic)
- Reference: `repos/tbd/packages/tbd/src/cli/lib/output.ts` (YAML colorization pattern)
- Reference: `repos/tbd/packages/tbd/src/lib/settings.ts` (YAML stringify options)
- Reference: `repos/kash/src/kash/xonsh_custom/command_nl_utils.py` (NL detection
  algorithm)
