---
title: Input Coloring Bugfixes
description: Fix bugs in real-time input coloring and mode detection
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Input Coloring Bugfixes

**Date:** 2026-02-05

**Author:** Joshua Levy

**Status:** Done

## Overview

Fix various bugs in the real-time input coloring system that handles mode detection
(shell vs natural language vs slash commands) as users type.

## Goals

- Fix color inconsistencies during typing
- Fix @ completion behavior
- Improve prompt visual feedback based on mode

## Non-Goals

- Major refactoring of mode detection system
- Adding new input modes

## Bugs

### Bug 1: Backspace causes color/mode mismatch

**Description:** When typing in white (shell mode), pressing backspace turns text pink,
but pressing Enter still executes as shell command.

**Expected:** Mode should update correctly after backspace to reflect what will actually
be executed.

**Root Cause:** TBD - likely the backspace handling in keypress doesn’t properly sync
mode with actual line content.

### Bug 2: @ completion includes @ in result

**Description:** When typing `ls -l @` and pressing Tab, the completion fills in
`ls -l @package.json` instead of `ls -l package.json`. The @ is a trigger shortcut that
should not be part of the final command.

**Expected:** After completion, the @ should be stripped, leaving just the filename.

**Root Cause:** The `createCompleter()` function in input.ts preserves the @ prefix when
building completions.

### Bug 3: Completion list shows in wrong color

**Description:** When showing file completions (after @), the completion list appears in
pink (NL mode color) instead of a neutral color, because the current input color bleeds
into the output.

**Expected:** Completion suggestions should have a consistent color (e.g., yellow)
regardless of current input mode.

**Root Cause:** Need to reset terminal color before showing completions.

### Bug 4: “how are you” color inconsistency

**Description:** When typing “how are you” letter by letter:
- “how a” - all pink (correct)
- “how ar” - turns white (incorrect!)
- “how are” - pink again (correct)

**Expected:** Once the first word “how” is typed with a space after it, the line should
stay pink (NL mode) because “how” is not a shell command.

**Root Cause:** The `question-sentence` rule requires the rest of the words to be in
NL_ONLY_WORDS. When typing “ar” (partial “are”), it’s not in the set, so it falls
through to `command-like` pattern which matches “how” → shell mode.

**Fix:** Simplify the rule: if first word is a question word (how, what, why, when) and
there’s any text after it, treat as NL. These words are never shell commands.

## Feature: Mode-based Prompt Character

**Description:** Change the input prompt character based on the current mode:
- Natural Language mode: `▶` (pink)
- Shell mode: `$` (bold white)
- Slash command mode: `▶` (blue)

This provides immediate visual feedback about what mode the user is in.

## Design

### Core Architecture: Input Mode System

The input system has three concerns that must work together:

1. **Mode Detection** - Classify input as shell, NL, slash, ambiguous, or nothing
2. **Visual State** - Prompt character and colors that reflect the mode
3. **UI Overlays** - Menus and completions that don’t affect mode

**Key Principle: Mode detection is the SINGLE source of truth.**

Visual state always derives from mode.
Never set visual state independently of mode.

### State Model

**Input Mode** - what kind of input is being typed:

```
┌─────────────────────────────────────────────────────────────────┐
│                         InputMode                               │
├─────────────────────────────────────────────────────────────────┤
│  'nl'       │ Natural language to Claude    │ ▶ pink           │
│  'shell'    │ Execute as shell command      │ $ bold white     │
│  'slash'    │ Slash command (/help, etc.)   │ ▶ blue           │
│  'ambiguous'│ Could be shell or NL (prompt) │ ▶ yellow         │
│  'nothing'  │ Invalid/unrecognized          │ ▶ red            │
└─────────────────────────────────────────────────────────────────┘
```

**Display State** - whether input is active or submitted (in scroll history):

```
┌─────────────────────────────────────────────────────────────────┐
│                       DisplayState                              │
├─────────────────────────────────────────────────────────────────┤
│  'active'    │ Currently being edited       │ Bright colors    │
│  'submitted' │ In scroll history            │ Dimmed colors    │
└─────────────────────────────────────────────────────────────────┘
```

**Combined State**: The visual appearance is determined by both mode AND display state:

```
Mode × DisplayState → Visual Appearance

nl + active     → ▶ (bold magenta) + magenta text
nl + submitted  → ▶ (dim magenta) + dim magenta text

shell + active     → $ (bold white) + white text
shell + submitted  → $ (dim white) + dim white text

slash + active     → ▶ (blue) + blue text
slash + submitted  → ▶ (dim blue) + dim blue text
```

### State Transitions

```
Empty line ("") ────────────────────────────────────────→ nl (pink ▶)
                                                          │
"/" at start ───────────────────────────────────────────→ slash (blue ▶)
                                                          │
"!" at start (explicit shell) ──────────────────────────→ shell (white $)
                                                          │
"?" at start (explicit NL) ─────────────────────────────→ nl (pink ▶)
                                                          │
Command-like word (ls, git, etc.) ──────────────────────→ shell (white $)
                                                          │
Question word + text (how are you) ─────────────────────→ nl (pink ▶)
                                                          │
Ambiguous word (who, date) ─────────────────────────────→ ambiguous (yellow ▶)
                                                          │
Invalid command with operators ─────────────────────────→ nothing (red ▶)
```

### Visual Feedback Loop

After EVERY keypress (except return/navigation):

```
1. [readline processes key]
2. [setImmediate callback]
3. Get actual line content from readline
4. Detect mode from line content (ModeDetector.detectModeSync)
5. Update currentInputMode state
6. Recolor entire line with correct prompt + text color
7. (Optional) Show/hide UI overlays like menus
```

**Critical: Always recolor after every keypress.**

This ensures visual state always matches mode, even when:
- Mode doesn’t change but readline reset colors (backspace)
- User is typing quickly
- Edge cases in terminal state

### Color Definitions (Semantic)

All colors are defined semantically in `formatting.ts`. This allows changing the color
scheme in one place.

**Design: Use logical names, not literal colors.**

```typescript
// ═══════════════════════════════════════════════════════════════════
// PROMPT CHARACTERS (by mode)
// ═══════════════════════════════════════════════════════════════════
promptChars = {
  nl: '▶',       // Natural language mode
  shell: '$',    // Shell command mode
  slash: '▶',    // Slash command mode
}

// ═══════════════════════════════════════════════════════════════════
// SEMANTIC COLOR FUNCTIONS (picocolors wrappers)
// ═══════════════════════════════════════════════════════════════════

// Active state (currently editing)
colors.inputPrompt      // NL prompt: bold magenta
colors.shellPrompt      // Shell prompt: bold white
colors.slashPrompt      // Slash prompt: blue

// Submitted state (in scroll history)
colors.inputPromptDim   // NL prompt dimmed: dim magenta
colors.shellPromptDim   // Shell prompt dimmed: dim white (to add)
colors.slashPromptDim   // Slash prompt dimmed: dim blue (to add)

// Text colors (for input content)
colors.userPrompt       // NL text: magenta
colors.shellCommand     // Shell text: bold white
colors.slashCommand     // Slash text: blue

// ═══════════════════════════════════════════════════════════════════
// RAW ANSI CODES (for mid-line coloring without reset)
// ═══════════════════════════════════════════════════════════════════
inputColors = {
  naturalLanguage: '\x1b[35m',     // magenta
  shell: '\x1b[1;37m',             // bold white
  slashCommand: '\x1b[1;34m',      // bold blue
  ambiguous: '\x1b[33m',           // yellow
  nothing: '\x1b[31m',             // red
  reset: '\x1b[0m',                // reset all
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// Get visual appearance for a mode + display state combination
getPromptForMode(mode: InputMode): { char, colorFn, rawColor }
getColorForMode(mode: InputMode): (s: string) => string
```

**Changing colors:** To change the color scheme, update the semantic definitions in
`formatting.ts`. All components derive their colors from these definitions.

### UI Overlays

Menus (like slash command menu) are overlays that don’t affect mode:

1. Menu display is triggered by specific keys (/ at start)
2. Menu navigation (arrow keys) doesn’t change mode
3. Menu selection updates the line, then mode detection runs normally
4. Closing menu doesn’t change mode

### History Navigation

When user navigates history (up/down arrows to recall previous commands):

1. Readline changes the line content to the history entry
2. Mode detection re-evaluates the recalled line
3. Visual state updates to match the mode

**Example:**
```
History contains: ["ls -la", "how are you", "/help"]

Press ↑ → recalls "how are you" → detects NL → pink ▶
Press ↑ → recalls "ls -la" → detects shell → white $
Press ↓ → recalls "how are you" → detects NL → pink ▶
```

**Implementation:** History navigation is just another keypress that changes the line.
The standard visual feedback loop handles it:
1. Keypress fires (up/down arrow)
2. Readline processes and changes line to history entry
3. setImmediate: detect mode, update state, recolor

No special handling needed because mode detection is always re-evaluated after any line
change.

### Edge Cases

| Scenario | Expected Behavior |
| --- | --- |
| Type "ls " then backspace | Stay white (shell mode) - "ls" is still command-like |
| Type "/" then continue typing | Blue (slash mode) - "/help" is slash command |
| Type "/" then backspace to empty | Pink (nl mode) - empty line is NL |
| Type "how ar" | Pink (nl mode) - "how" + any text = NL |
| Navigate history to "ls" | White (shell mode) - re-evaluated |
| Navigate history to "how are you" | Pink (nl mode) - re-evaluated |

### Components

- `mode-detection.ts` - Detection rules (pure functions, no side effects)
- `mode-detection.test.ts` - Comprehensive test cases
- `input.ts` - Keypress handling, visual updates, UI overlays
- `formatting.ts` - Semantic color definitions

## Implementation Plan

### Phase 1: Mode Detection Fixes

- [x] Add test cases for “how ar”, “how are”, “how are you” sequence
- [x] Fix question-sentence rule to not require NL words in rest (added
  PURE_QUESTION_WORDS)
- [x] Verify all incremental typing scenarios

### Phase 2: Input Handling Fixes

- [x] Fix @ completion to strip @ from result
- [x] Fix completion list color (reset before showing completions)
- [x] Fix backspace mode sync (defer to setImmediate for actual buffer state)
- [x] Fix shell mode color (use pc.white explicitly, not identity function)

### Phase 3: Prompt Character Feature

- [x] Add mode-based prompt character to formatting.ts (getPromptForMode)
- [x] Update recolorLine() to change prompt based on mode ($ for shell, ▶ for NL/slash)
- [x] Shell mode: $ (bold white), NL mode: ▶ (pink), Slash mode: ▶ (blue)

### Future Enhancement (Out of Scope)

- [ ] Bug 6: Shell command completions (l+Tab shows ls, git, etc.)
  - Requires shell module integration
  - Consider for plan-2026-02-04-automatic-input-suggestions.md

## Testing Strategy

- Unit tests for mode detection covering incremental typing
- Manual testing of @ completion
- Manual testing of prompt character changes

## Open Questions

- Should completion color be yellow or another color?
- Should the prompt character change animate smoothly or instant?

## References

- Related: plan-2026-02-04-automatic-input-suggestions.md (@ completion feature)
