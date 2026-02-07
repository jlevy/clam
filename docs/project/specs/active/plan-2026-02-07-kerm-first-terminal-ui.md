# Feature: Kerm-First Terminal UI Architecture

**Date:** 2026-02-07

**Author:** Claude (with user direction)

**Status:** Draft

## Overview

A “Kerm-first” approach to terminal UI where the text layer is simple, stable
scaffolding designed to be overlaid with web UI elements via Kerm codes.
Instead of building a sophisticated text-based UI and then upgrading it, we build a
**minimal text foundation** that’s trivially overlayable.

The real user experience comes from the GUI overlay.
The text layer exists to:
1. Bootstrap the application before Kerm is active
2. Provide anchor points for web UI elements
3. Remain functional (but basic) if Kerm isn’t available

## Goals

- **Simple text layer**: Predictable text output that’s easy to overlay
- **Self-sizing components**: Each widget declares its own line count
- **Kerm-native design**: Every UI element designed with overlay in mind from day one
- **Minimal text complexity**: No differential rendering, no fancy ANSI tricks
- **Clean async backend**: Tool execution runs independently; text layer just shows
  status
- **Pluggable architecture**: Same abstraction for text and GUI, different
  implementations

## Non-Goals

- Beautiful pure-text UI (decent is fine, Kerm provides the beauty)
- Complex pi-tui style differential rendering in text mode
- Mouse support in text mode
- Scrolling tool output in text mode (Kerm overlay handles this)

## Background

### New Insight

The primary value proposition is the **GUI experience in Clam terminal**. Users choosing
Clam want the rich overlay, not a better text UI. So:

1. Text layer = stable scaffolding (simple, predictable)
2. Kerm layer = the actual UI (rich, interactive)

This inverts the priority: design for Kerm first, text as fallback.

### What Needs Live Text Scrolling

Only two things need live text interaction:
1. **Input box**: User types here, needs readline
2. **Tab completions**: Dynamic menu during input

Everything else can be static text with Kerm overlays.

## Design

### Architecture: Self-Sizing Component Model

The core abstraction: **harness provides optional constraints, component decides the
rest**.

```typescript
/**
 * Layout constraints from harness. null = component decides.
 */
interface LayoutConstraints {
  width: number | null;   // null = component picks (e.g., GUI mode)
  lines: number | null;   // null = component picks its height
}

/**
 * Actual dimensions used by the component.
 */
interface Layout {
  width: number;
  lines: number;
}

/**
 * A self-sizing UI component.
 */
interface UIComponent<T> {
  /** Determine dimensions given constraints. */
  layout(data: T, constraints: LayoutConstraints): Layout;

  /** Render to text lines. Must return exactly layout.lines strings. */
  renderText(data: T, layout: Layout): string[];

  /** Kerm payload for GUI overlay (optional). */
  kermPayload?(data: T, layout: Layout): KermPayload;
}
```

**Authority model:**
- **Harness specifies** what it cares about (terminal width, user prefs, space limits)
- **Component decides** what harness leaves unspecified (`null`)
- **Harness can override** by specifying non-null values

This is powerful because:
- **Text and GUI share the same slot** - GUI knows exactly which rows to overlay
- **Components are self-describing** - harness doesn’t need type-specific knowledge
- **GUI can choose different dimensions** - when harness passes `null`, component picks
- **User preferences flow through harness** - settings become constraints
- **Clean separation** - rendering logic lives in components, not harness

### Visual Model

```
┌─────────────────────────────────────────────────────────────┐
│  COMPONENT: message.user (lines=2)                          │
│  ─────────────────────────────────────────────────────────  │
│  TEXT:  > User: Fix the tests                               │
│         >                                                   │
│  KERM:  {"t":"message","id":"m1","role":"user",...}         │
│  GUI:   [styled bubble with avatar, overlays 2 rows]        │
├─────────────────────────────────────────────────────────────┤
│  COMPONENT: tool.call (lines=3)                             │
│  ─────────────────────────────────────────────────────────  │
│  TEXT:  Tool: bash                                          │
│         Command: npm test                                   │
│         Status: Running...                                  │
│  KERM:  {"t":"tool","id":"tc1","name":"bash",...}           │
│  GUI:   [progress bar, expand button, overlays 3 rows]      │
├─────────────────────────────────────────────────────────────┤
│  COMPONENT: permission (lines=4)                            │
│  ─────────────────────────────────────────────────────────  │
│  TEXT:  Allow edit to bin.ts?                               │
│         1. Yes                                              │
│         2. Yes, allow all                                   │
│         3. No                                               │
│  KERM:  {"t":"permission","id":"p1","options":[...]}        │
│  GUI:   [clickable buttons, overlays 4 rows]                │
├─────────────────────────────────────────────────────────────┤
│  COMPONENT: input (lines=1)                                 │
│  ─────────────────────────────────────────────────────────  │
│  TEXT:  ▶ [readline active]                                 │
│  KERM:  (none - input is special)                           │
│  GUI:   [enhanced input box, overlays 1 row]                │
└─────────────────────────────────────────────────────────────┘
```

### Harness Responsibilities

The harness orchestrates components, providing constraints based on context:

```typescript
function renderComponent<T>(
  component: UIComponent<T>,
  data: T,
  constraints: LayoutConstraints
): void {
  // 1. Component determines its dimensions given constraints
  const layout = component.layout(data, constraints);

  // 2. Render text lines (component guarantees exactly layout.lines strings)
  const textLines = component.renderText(data, layout);

  // 3. Print text to terminal
  for (const line of textLines) {
    console.log(line);
  }

  // 4. Emit Kerm code if available (terminal overlays GUI on those rows)
  const payload = component.kermPayload?.(data, layout);
  if (payload && isKermTerminal()) {
    emitKerm({ ...payload, ...layout });
  }
}

// Text mode: harness specifies terminal width, component picks height
renderComponent(toolComponent, data, { width: 80, lines: null });

// GUI mode: harness defers to component for both dimensions
renderComponent(toolComponent, data, { width: null, lines: null });

// User pref "compact mode": harness constrains height
renderComponent(toolComponent, data, { width: 80, lines: 2 });
```
````

### Component Layout Strategies

Components adapt to constraints, using sensible defaults when unconstrained:

| Component | Constrained (text mode) | Unconstrained (GUI mode) | Rationale |
|-----------|-------------------------|--------------------------|-----------|
| `tool.call` | 3 lines, full width | 1 line, compact | GUI has popover |
| `permission` | 4 lines, full width | 2 lines, button width | GUI has buttons |
| `diff` | 5 lines, full width | 1 line, compact | GUI expands on hover |
| `message` | Variable, full width | Variable, content width | Wraps to fit |
| `error` | 3 lines, full width | 1 line, compact | GUI has popover |

Example implementation:

```typescript
class ToolCallComponent implements UIComponent<ToolCallData> {
  layout(data: ToolCallData, constraints: LayoutConstraints): Layout {
    // Width: use constraint if provided, otherwise content-based
    const width = constraints.width ?? Math.max(40, data.command.length + 10);

    // Lines: use constraint if provided, otherwise mode-based default
    const lines = constraints.lines ?? (isKermTerminal() ? 1 : 3);

    return { width, lines };
  }

  renderText(data: ToolCallData, layout: Layout): string[] {
    if (layout.lines === 1) {
      return [truncate(`Tool: ${data.name} - ${data.status}`, layout.width)];
    }
    if (layout.lines === 2) {
      return [
        truncate(`Tool: ${data.name}`, layout.width),
        truncate(`Status: ${data.status}`, layout.width),
      ];
    }
    return [
      truncate(`Tool: ${data.name}`, layout.width),
      truncate(`Command: ${data.command}`, layout.width),
      truncate(`Status: ${data.status}`, layout.width),
    ];
  }

  kermPayload(data: ToolCallData, layout: Layout): KermPayload {
    return {
      t: 'tool',
      id: data.id,
      ...layout,  // Include dimensions for overlay
      name: data.name,
      command: data.command,
      status: data.status,
      output: data.output,  // Full output for GUI popover
    };
  }
}
````

**Key pattern**: Component respects constraints when provided, uses smart defaults when
not. This allows:
- Text mode harness: `{ width: terminalWidth, lines: null }` → component picks height
- GUI mode harness: `{ width: null, lines: null }` → component picks compact dimensions
- User “verbose” pref: `{ width: 80, lines: 5 }` → component uses exactly that

### Kerm Protocol: Region-Based

Each Kerm payload includes layout dimensions so the terminal knows the overlay region:

```
\x1b]77;{"t":"tool","id":"tc-1","lines":3,"width":80,"name":"bash","status":"running"}\x07
```

The terminal tracks:
- Current row when Kerm code received
- Dimensions from payload (`lines`, `width`)
- Overlay region = rows [current_row - lines, current_row), width as specified

The `width` field enables:
- Centered or right-aligned overlays (component uses less than terminal width)
- Horizontal positioning within the terminal viewport
- Future: multi-column layouts

### Text Layer Principles

1. **Self-sizing**: Each component declares its line count
2. **Stable output**: Components return exactly the lines they declare
3. **Sequential print**: No cursor movement, just print lines
4. **Unique IDs**: Each element has an ID for Kerm targeting
5. **Minimal formatting**: Basic ANSI colors, readable without GUI

### Input Handling

Input is special - it’s the only component that needs live interaction in text mode:

```
┌─────────────────────────────────────────────────────────────┐
│  TEXT MODE INPUT                                            │
│  ─────────────────────────────────────────────────          │
│  ✓ Readline for main input (keep current)                   │
│  ✓ Raw mode for permission menu (fix current bug)           │
│  ✓ Tab completion menu (keep current)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  KERM MODE INPUT                                            │
│  ─────────────────────────────────────────────────          │
│  ✓ Keyboard events passed through to CLI                    │
│  ✓ GUI overlays enhance but don't replace text input        │
│  ✓ Clickable permission buttons send responses via Kerm     │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Fix Broken Permission Input

**Goal**: Get permission dialogs working.
Minimal changes, no new abstractions yet.

**The bug**: `readline.write()` doesn’t reliably trigger the question callback.
The `setImmediate` + `write` pattern is fundamentally fragile.

**The fix**: Bypass readline for dialogs.
Use raw mode input capture directly.

#### 1.1 Create Simple Select Menu

**Target UI** (matching Claude Code’s style):

```
 Do you want to make this edit to bin.ts?
 ❯ 1. Yes
   2. Yes, allow all edits this session (shift+tab)
   3. No
```

Key features:
- Numbered options (type `1`, `2`, `3` for direct selection)
- `❯` indicates current selection (cyan colored)
- Arrow keys or `j`/`k` to navigate
- Enter confirms current selection
- Escape cancels

```
lib/ui/
└── select-menu.ts    # selectMenu() function - standalone, no abstractions
```

```typescript
interface SelectOption {
  label: string;
  value: string;
  hint?: string;  // e.g., "(shift+tab)" shown after label
}

interface SelectResult {
  ok: boolean;
  value?: string;
  cancelled?: boolean;
}

async function selectMenu(
  message: string,
  options: SelectOption[]
): Promise<SelectResult>;
```

- [ ] Create `select-menu.ts` with `selectMenu()` function
- [ ] Raw mode input capture (bypass readline entirely)
- [ ] Arrow up/down and j/k navigation
- [ ] Number keys for direct selection (1-9)
- [ ] Enter to confirm, Escape to cancel
- [ ] Simple ANSI rendering with `❯` indicator
- [ ] Proper cleanup (restore raw mode state)

#### 1.2 Wire to Permission System

- [ ] Update `onPermission` in bin.ts to call `selectMenu()` directly
- [ ] Remove `waitingForPermission` mode from input.ts
- [ ] Remove broken permission keypress handling from input.ts
- [ ] Test with actual Claude permission prompts

#### 1.3 Handle Edge Cases

- [ ] Non-TTY fallback (simple numbered prompt with readline)
- [ ] Ctrl+C during dialog (clean exit)
- [ ] Terminal resize during dialog (re-render)

### Phase 2: Component Abstraction

**Goal**: Refactor into the self-sizing component model for future extensibility.

#### 2.1 Core Interfaces

```
lib/ui/
├── component-types.ts      # LayoutConstraints, Layout, UIComponent
├── component-harness.ts    # renderComponent() function
└── kerm.ts                 # isKermTerminal(), emitKerm()
```

- [ ] Create `LayoutConstraints` and `Layout` types
- [ ] Create `UIComponent<T>` interface
- [ ] Create `renderComponent()` harness
- [ ] Implement `isKermTerminal()` detection

#### 2.2 Refactor Select Menu into Component

- [ ] Create `PermissionComponent` implementing `UIComponent<PermissionData>`
- [ ] Wrap existing `selectMenu()` for input handling
- [ ] Add `kermPayload()` for future GUI overlay

#### 2.3 Tool Call Component

- [ ] Create `ToolCallComponent` implementing `UIComponent<ToolCallData>`
- [ ] Standardize tool output format (fixed line count)
- [ ] Update output.ts to use this component

### Phase 3: Kerm Protocol

Add Kerm codes to all components.

#### 2.1 Payload Types

- [ ] Define `KermPayload` union type for all component types
- [ ] Add `lines` field to all payloads
- [ ] Add unique ID generation

#### 2.2 Message Component

- [ ] Create `MessageComponent` for user/assistant messages
- [ ] `lines()`: variable based on content wrapping
- [ ] `kermPayload()`: full message content for styled rendering

#### 2.3 Diff Component

- [ ] Create `DiffComponent` for file changes
- [ ] `lines()`: 5 in text mode (summary), 1 in GUI mode
- [ ] `kermPayload()`: full diff content for side-by-side viewer

### Phase 3: Clam Terminal Integration

Implement Kerm code parsing and overlay rendering.

#### 3.1 Kerm Parser

- [ ] Parse OSC 77 codes from terminal output stream
- [ ] Extract JSON payloads
- [ ] Track row positions for overlay regions

#### 3.2 Overlay Manager

- [ ] Map element IDs to screen regions
- [ ] Handle scroll position tracking
- [ ] Clean up overlays when scrolled off screen

#### 3.3 Overlay Components

- [ ] Tool overlay: expand button, scrollable output, timing
- [ ] Permission overlay: clickable buttons with keyboard shortcuts
- [ ] Diff overlay: side-by-side viewer with syntax highlighting
- [ ] Message overlay: styled bubbles, copy button

## Kerm Protocol Specification

### OSC 77 Format

```
ESC ] 77 ; <json-payload> BEL
\x1b]77;{...}\x07
```

### Payload Structure

All payloads include:
- `t`: element type
- `id`: unique identifier
- `lines`: number of text rows this element occupies
- `width`: width in columns this element occupies

```typescript
/** Base layout fields included in all payloads */
interface KermLayout {
  lines: number;
  width: number;
}

type KermPayload =
  | { t: 'tool.start'; id: string; name: string; command: string } & KermLayout
  | { t: 'tool.end'; id: string; status: 'success' | 'error'; output: string } & KermLayout
  | { t: 'permission'; id: string; message: string; options: string[] } & KermLayout
  | { t: 'permission.response'; id: string; choice: number }  // Response, no layout
  | { t: 'message'; id: string; role: 'user' | 'assistant'; content: string } & KermLayout
  | { t: 'diff'; id: string; file: string; diff: string } & KermLayout;
```

### Bidirectional Communication

For permissions, Clam sends response back via stdin or Kerm channel:

```
# CLI emits permission request (with full layout)
\x1b]77;{"t":"permission","id":"p-1","lines":4,"width":60,"message":"Allow edit?","options":["Yes","No"]}\x07

# User clicks "Yes" in overlay
# Clam sends response (no layout needed):
\x1b]77;{"t":"permission.response","id":"p-1","choice":0}\x07
```

## Testing Strategy

### Phase 1 Testing

1. **Select menu unit tests**:
   - Arrow up/down navigates options
   - `j`/`k` navigates options
   - Number keys select directly (1, 2, 3 …)
   - Enter confirms current selection
   - Escape cancels and returns `{ ok: false, cancelled: true }`
   - Raw mode is properly restored on exit

2. **Integration tests**:
   - Permission prompts from Claude work end-to-end
   - User can select “Yes”, “Yes to all”, “No”
   - Selection is properly communicated back to ACP client

3. **Manual testing**:
   - Test in different terminals (iTerm, Terminal.app, VS Code)
   - Verify no visual glitches during navigation
   - Verify Ctrl+C handling

### Phase 2 Testing

1. **Component contract tests**:
   - `renderText()` returns exactly `layout.lines` strings
   - `layout()` respects constraints when provided
   - Output is valid (no unexpected control chars)

2. **Kerm emission**:
   - OSC 77 codes are well-formed
   - JSON payloads validate against schema

### Phase 3 Testing

1. **Overlay rendering**:
   - Overlays appear at correct positions
   - Scroll tracking works
   - Click handlers fire correctly

2. **Non-Kerm fallback**:
   - Codes don’t display as garbage in plain terminals
   - Text-only mode remains fully functional

## Open Questions

1. **Kerm detection**: Env var (`CLAM_TERMINAL=1`) or capability query?
2. **Response channel**: Inject via stdin or separate IPC?
3. **Terminal resize**: How do we handle re-layout when terminal resizes?
   - Option A: Components re-render with new constraints
   - Option B: Overlays adapt independently (GUI layer handles)
4. **Overlay cleanup**: When are overlays destroyed (scroll distance, timeout,
   explicit)?
5. **Future LayoutConstraints fields**: What else might we need?
   - `minLines`, `maxLines` for bounds?
   - `alignment` for horizontal positioning?
   - `padding` for margins?

## References

### Codebase

- Previous spec:
  [plan-2026-02-06-terminal-ui-overhaul.md](plan-2026-02-06-terminal-ui-overhaul.md)
- Research:
  [research-2026-02-06-async-terminal-ui-concurrent-tools.md](../research/active/research-2026-02-06-async-terminal-ui-concurrent-tools.md)
- Current permission handling:
  [input.ts:563-599](../../../packages/clam/src/lib/input.ts#L563-L599)
- Current output: [output.ts](../../../packages/clam/src/lib/output.ts)

### External

- [iTerm2 Proprietary Escape Codes](https://iterm2.com/documentation-escape-codes.html)
  \- OSC pattern reference
- [Kitty Graphics Protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/) - Prior
  art for rich terminal content
