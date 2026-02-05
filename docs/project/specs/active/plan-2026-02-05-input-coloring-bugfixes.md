---
title: Input Coloring Bugfixes
description: Fix bugs in real-time input coloring and mode detection
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Input Coloring Bugfixes

**Date:** 2026-02-05

**Author:** Joshua Levy

**Status:** Implemented

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

### Approach

1. **Bug 4 Fix:** Add a new detection rule `question-word-with-text` that treats any
   question word + additional text as NL, without requiring the rest to match
   NL_ONLY_WORDS. This is the “simplest sensible rule.”

2. **Bug 1 Fix:** Ensure backspace handling properly calculates the new line and updates
   mode synchronously before visual feedback.

3. **Bug 2 Fix:** Modify `createCompleter()` to strip the @ prefix from completed paths.

4. **Bug 3 Fix:** Reset terminal color to a neutral completion color before displaying
   completion suggestions.

5. **Prompt Feature:** Update `recolorLine()` and prompt handling to change the prompt
   character based on mode.

### Components

- `mode-detection.ts` - Detection rules
- `mode-detection.test.ts` - Test cases
- `input.ts` - Input handling, completion, prompt display
- `formatting.ts` - Color definitions

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
