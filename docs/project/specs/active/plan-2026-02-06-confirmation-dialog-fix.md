# Feature: Confirmation Dialog and Input Field Fixes

**Date:** 2026-02-06

**Author:** Claude (with user direction)

**Status:** Draft

## Overview

Fix the broken confirmation dialog for permission prompts.
Currently typing ‘a’, ‘A’, ‘d’, etc.
doesn’t work - the input is not being captured correctly due to input stream handling
issues. Redesign to match Claude Code’s approach with a numbered menu and arrow key
navigation.

Additionally, establish a clean, pluggable architecture for all input/output components
so alternative implementations (Ink, Inquirer, etc.)
can be swapped in.

## Goals

- Fix permission dialog input handling so keys are properly captured
- Implement Claude Code-style confirmation UI with numbered options and arrow key
  navigation
- Make the confirmation pattern reusable for other prompts (shell command confirmation,
  etc.)
- Create a pluggable architecture for input/output components

## Non-Goals

- Full migration to Ink/React (that’s a separate, larger effort)
- Changes to the permission system itself (just the UI for responding)
- Supporting all possible CLI input patterns upfront

## Background

### Current Problem

The current implementation has issues with input capture during permission prompts:

1. `setWaitingForPermission(true)` is called to enable a special keypress capture mode
2. The keypress handler in [input.ts:563](packages/clam/src/lib/input.ts#L563) tries to
   capture a/A/d/D/Enter
3. When a valid key is pressed, it attempts to write to readline with
   `this.rl.write(response + '\n')`
4. The flow doesn’t complete - the input is not being properly delivered to the
   `onPrompt` callback

Root cause analysis:
- The keypress handler captures the key but the readline write may not be processed
  correctly
- There may be conflicts between raw mode capture and readline’s normal processing
- The `setImmediate` + `write` pattern is fragile

### Claude Code’s Approach

Claude Code uses a much simpler and more robust pattern:
```
 Edit file
╌╌╌╌╌╌╌╌╌
 packages/clam/src/bin.ts
 [diff content shown here]
╌╌╌╌╌╌╌╌╌
 Do you want to make this edit to bin.ts?
 ❯ 1. Yes
   2. Yes, allow all edits during this session (shift+tab)
   3. No
```

Key features:
- Numbered options (1, 2, 3, etc.)
- Arrow key navigation with visual indicator (❯)
- Enter to select current option
- Can also type the number directly
- Clean, box-drawn UI

## Research: CLI Input Libraries

### What Claude Code Uses

Claude Code is built with **TypeScript, React, and Ink**. Ink is a library that renders
React components to the terminal, providing:
- Component-based UI building (same patterns as React)
- `useInput` hook for keyboard handling
- `useFocus` for focus management
- Yoga (Flexbox) for layouts

From the Ink ecosystem:
- **ink-select-input**: Select component with arrow/j-k navigation + number keys
- **ink-confirm-input**: Yes/no confirmation with customizable defaults

The team’s philosophy: “We try to make the UI as minimal as possible.”

### OpenCode’s Approach

OpenCode (Go) uses **Bubble Tea**, based on The Elm Architecture:
- Model-Update-View pattern
- Central message channel for async communication
- Nested models for complex UIs

### Node.js Library Options

| Library | Pros | Cons |
| --- | --- | --- |
| **Ink** | React patterns, Claude Code uses it, component composition | Adds React dependency, bigger refactor |
| **@inquirer/prompts** | Modular, well-tested, lightweight individual prompts | Not React-based, less composable |
| **Enquirer** | Fast (4ms load), single dependency, extensible | Less popular than Inquirer |
| **Raw readline** | No dependencies, full control | More work, error-prone (current state) |

### Recommendation

**Hybrid approach with pluggable architecture:**

1. Define abstract interfaces for input components (SelectMenu, Confirm, TextInput,
   etc.)
2. Implement lightweight native versions using raw stdin (no dependencies)
3. Structure code so we can swap in Inquirer, Ink, or other implementations later
4. Keep the native implementation simple and Claude Code-like

This gives us:
- Working solution now
- No new dependencies required
- Clean upgrade path to Ink if desired
- Testable through interface abstraction

## Design

### Architecture: Pluggable UI Components

Per TypeScript rules: avoid duplicate filenames like `types.ts` and `index.ts`. Use
descriptive, unique names.

```
lib/ui/
├── ui-types.ts                    # Abstract interfaces (UIProvider, SelectOption, etc.)
├── ui-provider.ts                 # Factory that returns current implementation
├── native/                        # Native implementations (raw stdin)
│   ├── native-ui-provider.ts      # Provider class combining components
│   ├── native-select-menu.ts      # Select menu implementation
│   ├── native-confirm.ts          # Yes/no confirmation
│   └── native-text-input.ts       # Text input (if needed)
├── inquirer/                      # (Future) Inquirer adapter
│   └── inquirer-ui-provider.ts
└── ink/                           # (Future) Ink adapter
    └── ink-ui-provider.ts
```

**Rationale**: Subdirectories group related implementations while descriptive filenames
(not `index.ts`) make imports clear and avoid collisions.

**Key principle**: All UI components are accessed through the factory in
`ui-provider.ts`, never directly.
This allows swapping implementations without changing calling code.

### Interface Definitions

```typescript
// lib/ui/ui-types.ts

/**
 * Result of a UI prompt - either a value or cancellation.
 */
export type PromptResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'cancelled' | 'timeout' };

/**
 * Option for select menu prompts.
 */
export interface SelectOption<T = string> {
  /** Display text shown to user */
  label: string;
  /** Value returned when this option is selected */
  value: T;
  /** Optional hint text shown after label (e.g., "(shift+tab)") */
  description?: string;
  /** When true, option is shown but not selectable */
  disabled?: boolean;
}

/**
 * Configuration for select menu prompts.
 */
export interface SelectMenuConfig<T = string> {
  /** Question or prompt text shown above options */
  message: string;
  /** Available options to choose from */
  options: SelectOption<T>[];
  /** Index of initially selected option (0-based, default: 0) */
  defaultIndex?: number;
  /** Max visible options before scrolling (default: 7) */
  pageSize?: number;
}

/**
 * Configuration for yes/no confirmation prompts.
 */
export interface ConfirmConfig {
  /** Question text to display */
  message: string;
  /** Default value when user presses Enter without choosing (default: false) */
  default?: boolean;
}

/**
 * Configuration for text input prompts.
 */
export interface TextInputConfig {
  /** Prompt text to display */
  message: string;
  /** Pre-filled value */
  default?: string;
  /** Placeholder shown when input is empty */
  placeholder?: string;
  /** Validation function - returns error message or true if valid */
  validate?: (value: string) => string | true;
}

/**
 * Pluggable provider for terminal UI prompts.
 * Implementations handle rendering and input capture.
 */
export interface UIProvider {
  /**
   * Show a select menu and return the selected value.
   */
  select<T = string>(config: SelectMenuConfig<T>): Promise<PromptResult<T>>;

  /**
   * Show a yes/no confirmation prompt.
   */
  confirm(config: ConfirmConfig): Promise<PromptResult<boolean>>;

  /**
   * Show a text input prompt.
   */
  input(config: TextInputConfig): Promise<PromptResult<string>>;

  /**
   * Clean up resources (raw mode, event listeners, etc.).
   */
  dispose(): void;
}
```

### Factory Pattern

```typescript
// lib/ui/ui-provider.ts

import type { UIProvider } from './ui-types.js';
import { NativeUIProvider } from './native/native-ui-provider.js';

export type UIProviderType = 'native' | 'inquirer' | 'ink';

let currentProvider: UIProvider | null = null;

/**
 * Get or create the UI provider.
 */
export function getUIProvider(type: UIProviderType = 'native'): UIProvider {
  if (!currentProvider) {
    switch (type) {
      case 'native':
        currentProvider = new NativeUIProvider();
        break;
      case 'inquirer':
        throw new Error('Inquirer provider not yet implemented');
      case 'ink':
        throw new Error('Ink provider not yet implemented');
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown provider type: ${_exhaustive}`);
      }
    }
  }
  return currentProvider;
}

/**
 * Set a custom UI provider (for testing or custom implementations).
 */
export function setUIProvider(provider: UIProvider): void {
  if (currentProvider) {
    currentProvider.dispose();
  }
  currentProvider = provider;
}
```

### Native SelectMenu Implementation

The native implementation will:
1. Put stdin in raw mode
2. Render the menu with ANSI escape codes
3. Handle keypress events directly
4. Clean up and return result

```typescript
// lib/ui/native/native-select-menu.ts (simplified)

export async function selectMenu<T>(config: SelectMenuConfig<T>): Promise<PromptResult<T>> {
  const { message, options, defaultIndex = 0 } = config;
  let selectedIndex = defaultIndex;

  // Render initial state
  renderMenu(message, options, selectedIndex);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    const handleKey = (data: Buffer) => {
      const key = data.toString();

      // Arrow up or k
      if (key === '\x1b[A' || key === 'k') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        renderMenu(message, options, selectedIndex);
      }
      // Arrow down or j
      else if (key === '\x1b[B' || key === 'j') {
        selectedIndex = (selectedIndex + 1) % options.length;
        renderMenu(message, options, selectedIndex);
      }
      // Number keys 1-9
      else if (key >= '1' && key <= '9') {
        const idx = parseInt(key) - 1;
        if (idx < options.length) {
          cleanup();
          resolve({ ok: true, value: options[idx].value });
        }
      }
      // Enter
      else if (key === '\r' || key === '\n') {
        cleanup();
        resolve({ ok: true, value: options[selectedIndex].value });
      }
      // Escape or Ctrl+C
      else if (key === '\x1b' || key === '\x03') {
        cleanup();
        resolve({ ok: false, reason: 'cancelled' });
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', handleKey);
      if (stdin.isTTY && !wasRaw) {
        stdin.setRawMode(false);
      }
      clearMenu(options.length);
    };

    stdin.on('data', handleKey);
  });
}

function renderMenu<T>(message: string, options: SelectOption<T>[], selected: number): void {
  // Clear previous render and redraw
  const lines = [` ${message}`];
  options.forEach((opt, i) => {
    const indicator = i === selected ? '\x1b[36m❯\x1b[0m' : ' ';
    const num = `${i + 1}.`;
    const desc = opt.description ? ` \x1b[90m${opt.description}\x1b[0m` : '';
    lines.push(` ${indicator} ${num} ${opt.label}${desc}`);
  });

  // Move cursor up, clear lines, write new content
  process.stdout.write('\x1b[s'); // Save cursor
  process.stdout.write(lines.join('\n'));
  process.stdout.write('\x1b[u'); // Restore cursor
}
```

### Rendering Format (Claude Code-like)

```
 Do you want to make this edit to bin.ts?
 ❯ 1. Yes
   2. Yes, allow all edits during this session (shift+tab)
   3. No
```

- `❯` indicates current selection (cyan colored)
- Numbers allow direct selection (type 1, 2, or 3)
- Up/Down arrows or j/k to navigate
- Enter confirms current selection
- Escape cancels (returns null/default reject)

## Implementation Plan

### Phase 1: UI Component Architecture

- [ ] Create `lib/ui/ui-types.ts` with interface definitions
- [ ] Create `lib/ui/ui-provider.ts` factory with exhaustiveness checks
- [ ] Create `lib/ui/native/` directory
- [ ] Implement `NativeUIProvider` class in `lib/ui/native/native-ui-provider.ts`
- [ ] Add unit tests (`lib/ui/ui-types.test.ts`, `lib/ui/ui-provider.test.ts`)

### Phase 2: Native SelectMenu Implementation

- [ ] Implement `selectMenu` in `lib/ui/native/native-select-menu.ts` with raw mode
  handling
- [ ] Implement rendering with ANSI escape codes
- [ ] Implement arrow key navigation (up/down wrap around, j/k vim keys)
- [ ] Implement number key selection (1-9)
- [ ] Implement Enter to confirm, Escape to cancel
- [ ] Handle non-TTY fallback (simple numbered prompt)
- [ ] Add comprehensive tests (`lib/ui/native/native-select-menu.test.ts`)

### Phase 3: Integrate with Permission System

- [ ] Update `onPermission` in bin.ts to use `getUIProvider().select()`
- [ ] Remove `waitingForPermission` mode from input.ts
- [ ] Remove old permission keypress handling code (lines 563-599)
- [ ] Update permission prompt options to match new format
- [ ] Test with actual permission prompts

### Phase 4: Additional Input Components

- [ ] Implement `confirm()` in `lib/ui/native/native-confirm.ts` for yes/no prompts
- [ ] Apply confirm to shell command confirmation (ambiguous mode in input.ts)
- [ ] Implement `input()` in `lib/ui/native/native-text-input.ts` (if needed)
- [ ] Ensure colors/styling match rest of UI (use existing `colors` from formatting.ts)

### Phase 5: Cleanup and Documentation

- [ ] Remove deprecated permission prompt code from output.ts
- [ ] Update any relevant tests
- [ ] Document the UI component architecture
- [ ] Add JSDoc comments to public APIs

## Testing Strategy

1. **Unit tests** for UI components:
   - Rendering output matches expected format
   - Key handling (up/down/numbers/enter/escape)
   - Edge cases (single option, many options, disabled options)
   - Non-TTY fallback behavior

2. **Mock provider** for integration tests:
   - Create `MockUIProvider` that auto-responds
   - Use for testing permission flow without real input

3. **Manual testing**:
   - Visual appearance in terminal
   - Works with different terminal sizes
   - Works when piped (non-TTY fallback)
   - Test with actual Claude Code permissions

## Open Questions

1. ~~Should we support mouse clicks for selection?~~ **No** - keep it keyboard-only like
   Claude Code
2. Should we support j/k vim keys in addition to arrows?
   **Yes** - matches `ink-select-input`
3. Should we add a `pageSize` option for scrolling long lists?
   **Yes** - useful for many options
4. Future: Should we consider migrating to Ink entirely?
   **Separate spec** - this is a clean stepping stone

## References

### Codebase

- Current permission handling:
  [input.ts:563-599](packages/clam/src/lib/input.ts#L563-L599)
- Permission prompt rendering:
  [output.ts:273-350](packages/clam/src/lib/output.ts#L273-L350)
- ACP permission callback: [bin.ts:179-188](packages/clam/src/bin.ts#L179-L188)

### External

- [Claude Code Internals: Terminal UI](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016)
  \- Details on Claude Code’s Ink usage
- [How Claude Code is built](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
  \- Tech stack overview
- [Ink GitHub](https://github.com/vadimdemedes/ink) - React for CLIs
- [ink-select-input](https://www.npmjs.com/package/ink-select-input) - Ink’s select
  component
- [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) - Modern modular
  prompts
- [Bubble Tea](https://github.com/charmbracelet/bubbletea) - Go TUI framework (good
  patterns)
- [OpenCode TUI docs](https://opencode.ai/docs/tui/) - Alternative AI coding CLI
