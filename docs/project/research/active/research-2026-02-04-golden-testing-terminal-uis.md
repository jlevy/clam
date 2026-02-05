---
title: Research Brief - Golden Testing for Terminal Applications
description: A layered framework for testing terminal applications, from plain CLIs to interactive TUIs
author: Joshua Levy with LLM assistance
---
# Research: Golden Testing for Terminal Applications

**Date:** 2026-02-04 (last updated 2026-02-04)

**Author:** Joshua Levy with LLM assistance

**Status:** In Progress

## Overview

Terminal applications span a wide spectrum of complexity, from simple command-line tools
to rich interactive TUIs.
Testing strategies must match this spectrum.

This research establishes a **layered framework for terminal application testing**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Testing Terminal Applications                         │
│                        ═════════════════════════════                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Layer 4: Full TUI (Alternate Screen)                    ← HARDEST        │
│   ─────────────────────────────────────                                     │
│   Cursor control, screen repainting, stateful grid.                         │
│   Requires PTY emulation or terminal emulator libraries.                    │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Layer 3: Event/API Layer Testing                                          │
│   ────────────────────────────────                                          │
│   Design testable interfaces behind the text rendering.                     │
│   Test interactivity, state, and behavior without touching terminal output. │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Layer 2: Scroll-Friendly Interactive Apps                                 │
│   ─────────────────────────────────────────                                 │
│   Sequential output (no cursor repositioning).                              │
│   Visual history becomes testable via stdout capture.                       │
│   Input/interactivity still needs separate handling.                        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Layer 1: Plain CLI (Non-Interactive)                    ← EASIEST        │
│   ────────────────────────────────────                    (SOLVED)         │
│   Command → output. No interactivity.                                       │
│   Well-covered by tryscript, tbd guidelines, standard golden testing.       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

Each layer builds on the one below.
The goal is to help developers:

1. Understand what’s testable at each layer
2. Design applications for testability
3. Choose appropriate testing strategies
4. Know when existing solutions (tryscript, etc.)
   apply

**Case study:** [clam](../specs/active/plan-2026-02-03-clam-acp-client-spike.md)
demonstrates Layer 2 + Layer 3 patterns as a scroll-friendly ACP client with semantic
event interfaces.

## Scope

**This research covers:** Testing strategies for terminal applications across all
complexity levels.

**Structure:**

- Layer 1 (Plain CLI) - Reference existing solutions
- Layer 2 (Scroll-Friendly) - New patterns for interactive apps
- Layer 3 (Event/API) - Design for testability
- Layer 4 (Full TUI) - Strategies for complex UIs

* * *

## Layer 1: Plain CLI (Non-Interactive)

### What This Covers

Command-line tools that take input and produce output without interactivity:

- `grep`, `ls`, `cat`, `jq`
- Build tools, linters, formatters
- CLI utilities with `--help`, `--version`
- One-shot commands

### Characteristics

| Aspect | Description |
| --- | --- |
| **Input** | Arguments, stdin, files |
| **Output** | Stdout, stderr, exit codes |
| **Interactivity** | None |
| **State** | Stateless (single invocation) |

### This Is a Solved Problem

Plain CLI testing is well-established.
**Use existing tools:**

#### tryscript

Markdown-based golden testing for console output:

```markdown
---
patterns:
  VERSION: '\\d+\\.\\d+\\.\\d+'
---

# CLI Tests

## Help output

$ my-tool --help
my-tool - Does useful things

USAGE:
  my-tool [options] <input>
...

## Version

$ my-tool --version
my-tool [VERSION]

## Error handling

$ my-tool --invalid-flag
? 1
Error: Unknown flag --invalid-flag
```

See: [tryscript](https://github.com/jlevy/tryscript)

#### tbd Guidelines

Comprehensive coverage of CLI testing patterns:

- `tbd guidelines golden-testing-guidelines` - Core golden testing principles
- `tbd guidelines typescript-cli-tool-rules` - CLI tool patterns
- `tbd guidelines cli-agent-skill-patterns` - Agent-integrated CLIs

Key patterns from the guidelines:

- **Stable vs unstable fields** - Timestamps, paths, durations
- **Normalization pipelines** - Strip ANSI, replace patterns
- **Exit code testing** - Verify error handling
- **Pipeline compatibility** - `tool | cat` should work

#### Standard Testing Patterns

```typescript
// Capture and compare output
const result = await exec('my-tool --help');
expect(result.stdout).toMatchSnapshot();
expect(result.exitCode).toBe(0);

// With normalization
const normalized = normalizeOutput(result.stdout);
expect(normalized).toMatchFileSnapshot('golden/help.txt');
```

### When to Use Layer 1

- Non-interactive tools
- Commands that complete in one invocation
- `--help`, `--version`, error messages
- Batch processing tools

### What Layer 1 Can’t Test

- Interactive prompts
- Real-time updates
- User input handling
- Stateful sessions

**For interactive applications, continue to Layer 2.**

* * *

## Layer 2: Scroll-Friendly Interactive Applications

### What This Covers

Interactive applications that maintain sequential output:

- REPLs and shells
- Chat interfaces (like clam)
- Log viewers
- Interactive CLIs with prompts

### The Key Constraint

**Never reposition the cursor.** All output appends sequentially to stdout.

This constraint unlocks testability: output becomes a deterministic byte stream that can
be captured, diffed, and golden-tested—just like Layer 1, but with interactivity.

### Characteristics

| Aspect | Description |
| --- | --- |
| **Screen model** | Main screen buffer (scrollback preserved) |
| **Output model** | Sequential append only |
| **ANSI codes** | Colors and styles only—no cursor movement |
| **Scrollback** | Fully preserved after exit |
| **State** | Append-only log |

### What Becomes Testable

| Capability | Why It Works Now |
| --- | --- |
| **Visual history golden tests** | Stdout is deterministic stream |
| **Scrollback verification** | History preserved after exit |
| **Output diffing** | Text can be compared line-by-line |
| **Full session capture** | Entire interaction is reproducible |

### What Still Needs Separate Testing

Even with scroll-friendly output, some aspects require special handling:

| Aspect | Challenge | Solution |
| --- | --- | --- |
| **Interactive input** | Readline, key handling | Mock readline or Layer 3 events |
| **Keyboard shortcuts** | Ctrl+C, arrow keys | PTY tests (Layer 4) |
| **Tab completion** | Dynamic completions | Unit test completion logic |
| **Real-time updates** | Spinners, progress | Filter unstable or use Layer 3 |

### Verification: Is Your App Scroll-Friendly?

```bash
# Test 1: Pipe through cat should work
my-app | cat

# Test 2: No cursor codes in output
my-app 2>&1 | grep -E $'\x1b\[(H|2J|[0-9]+A|[0-9]+B)' && echo "FAIL"

# Test 3: Scrollback preserved
my-app   # Run interactively
# Scroll up after exit - history should be there
```

### Testing Approaches

#### Stdout Capture with Input

```typescript
async function captureSession(
  cmd: string,
  args: string[],
  input: string
): Promise<string> {
  const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  let stdout = '';
  proc.stdout.on('data', (d) => (stdout += d));

  // Send input
  proc.stdin.write(input);
  proc.stdin.end();

  await new Promise((resolve) => proc.on('close', resolve));
  return normalizeOutput(stdout);
}

// Test full session
test('prompt flow', async () => {
  const output = await captureSession('my-app', [], 'hello\n\nquit\n');
  expect(output).toMatchSnapshot();
});
```

#### Scrollback Golden Tests

```yaml
# golden/session-flow.yaml
description: Complete interactive session

input: |
  hello

  /quit

expected_output: |
  my-app v1.0.0
  Type /help for commands

  > hello

  Hello! How can I help?

  > /quit
  Goodbye!
```

### Scroll-Friendly Design Patterns

#### Pattern: Append-Only Output

```typescript
// BAD: Cursor repositioning for progress
process.stdout.write('\x1b[2K\rProgress: 50%');

// GOOD: Append-only progress
output.info('Progress: 50%');
// Or: single final summary
```

#### Pattern: Truncation Instead of Scrolling

```typescript
// Instead of scrolling long output, truncate with indicator
output.toolOutput(longContent, { truncateAfter: 10 });
// Shows: "... (47 more lines)"
```

### When to Use Layer 2

- Interactive apps where you control the architecture
- Chat interfaces, REPLs
- Apps where scrollback is valuable to users
- When you want stdout golden tests for visual output

### What Layer 2 Can’t Test

- Complex input flows (tab completion behavior)
- Keyboard shortcut handling
- Internal state transitions
- Protocol-level behavior

**For comprehensive behavioral testing, add Layer 3.**

* * *

## Layer 3: Event/API Layer Testing

### The Key Insight

**Design testable interfaces just behind the text rendering layer.**

Instead of testing terminal output, test the semantic events and state transitions that
*produce* the output.
The text interface becomes a thin rendering layer over a fully testable core.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Terminal Display                                                           │
│  (Tested via Layer 2 patterns - stdout capture)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ ANSI bytes
┌─────────────────────────────────────────────────────────────────────────────┐
│  Rendering Layer (thin)                                                     │
│  - Converts semantic events to ANSI/text                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Semantic events
┌─────────────────────────────────────────────────────────────────────────────┐
│  Event/API Layer (testable core) ← THIS IS WHAT WE TEST                     │
│  ══════════════════════════════════════════════════════                     │
│  - Output events (info, warning, tool_call, stream_chunk)                   │
│  - Input events (prompt_submitted, command_executed)                        │
│  - State transitions (connecting → connected → prompting)                   │
│  - Protocol messages (for apps using ACP/LSP/MCP)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────────┐
│  Application Core / Business Logic                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Becomes Testable

| Capability | How It Works |
| --- | --- |
| **All output behavior** | Test semantic events, not rendered text |
| **All interactivity** | Model as input events → state → output events |
| **State machines** | Test state transitions directly |
| **Error handling** | Inject errors, verify event sequences |
| **Async flows** | Test event ordering without timing sensitivity |
| **Protocol compliance** | Mock protocol layer, verify message sequences |

### The Three Testable Interfaces

#### Interface 1: Semantic Output Events

```typescript
// Define semantic output interface
interface OutputWriter {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  toolHeader(title: string, kind: string, status: string): void;
  toolOutput(content: string): void;
  permissionPrompt(tool: string, command: string, options: Option[]): void;
  streamChunk(text: string): void;
}

// Recording wrapper for testing
function createRecordingOutputWriter(): OutputWriter & { events: OutputEvent[] } {
  const events: OutputEvent[] = [];
  return {
    events,
    info(message) { events.push({ type: 'info', data: { message } }); },
    warning(message) { events.push({ type: 'warning', data: { message } }); },
    // ... etc
  };
}

// Test
test('tool execution events', () => {
  const output = createRecordingOutputWriter();
  const app = createApp({ output });

  app.executeTool({ name: 'bash', command: 'ls' });

  expect(output.events).toEqual([
    { type: 'tool_header', data: { title: 'bash', kind: 'execute', status: 'pending' } },
    { type: 'tool_output', data: { content: 'file1.txt\nfile2.txt\n' } },
    { type: 'tool_header', data: { title: 'bash', kind: 'execute', status: 'completed' } },
  ]);
});
```

#### Interface 2: Input Events

```typescript
// Model user input as injectable events
interface InputHandler {
  onPromptSubmitted(text: string): Promise<void>;
  onCommandExecuted(command: string, args: string): Promise<void>;
  onPermissionResponse(optionId: string): void;
  onCancel(): void;
}

// Test interactivity without readline/terminal
test('permission flow', async () => {
  const output = createRecordingOutputWriter();
  const app = createApp({ output });

  await app.input.onPromptSubmitted('delete files');
  expect(output.events).toContainEqual({
    type: 'permission_prompt',
    data: expect.objectContaining({ tool: 'bash' }),
  });

  app.input.onPermissionResponse('allow_once');
  expect(output.events).toContainEqual({
    type: 'tool_output',
    data: expect.anything(),
  });
});
```

#### Interface 3: State Transitions

```typescript
// Model application state explicitly
type AppState =
  | { state: 'connecting' }
  | { state: 'connected'; sessionId: string }
  | { state: 'prompting' }
  | { state: 'awaiting_permission'; permissionId: string }
  | { state: 'error'; error: Error };

// Test state machine
test('state transitions', async () => {
  const transitions: string[] = [];
  const app = createApp({
    onStateChange: (from, to) => transitions.push(`${from.state} → ${to.state}`),
  });

  await app.connect();
  await app.prompt('hello');

  expect(transitions).toEqual([
    'connecting → connected',
    'connected → prompting',
    'prompting → connected',
  ]);
});
```

### Protocol Layer Testing

For applications using structured protocols (ACP, LSP, MCP):

```typescript
// Mock protocol backend
const mockAgent = createMockAcpAgent({
  responses: {
    initialize: { protocolVersion: '0.1' },
    'session/new': { sessionId: 'test-123' },
    'session/prompt': [
      { method: 'session/update', params: { ... } },
      { result: { stopReason: 'end_turn' } },
    ],
  },
});

test('ACP protocol flow', async () => {
  const app = createApp({ agentCommand: mockAgent.command });

  await app.connect();
  await app.prompt('hello');

  expect(mockAgent.receivedRequests).toContainEqual(
    expect.objectContaining({ method: 'session/prompt' })
  );
});
```

### Golden Files for Events

```yaml
# golden/events/permission-flow.yaml
scenario: Permission request and approval

input_sequence:
  - type: prompt_submitted
    data: { text: 'delete node_modules' }
  - type: permission_response
    data: { optionId: 'allow_once' }

expected_events:
  - type: tool_header
    data: { title: 'bash', status: 'pending' }
  - type: permission_prompt
    data: { tool: 'bash', command: 'rm -rf node_modules' }
  - type: tool_header
    data: { title: 'bash', status: 'completed' }
```

### When to Use Layer 3

- Complex interactive applications
- Applications with state machines
- Protocol-based apps (ACP, LSP, MCP)
- When you need comprehensive behavioral coverage
- When input handling is complex

### What Layer 3 Can’t Test

- Actual terminal rendering
- Real keyboard handling
- Platform-specific terminal behavior

**For those, you need Layer 4 (PTY testing).**

* * *

## Layer 4: Full TUI (Alternate Screen)

### What This Covers

Traditional TUI applications with full terminal control:

- **Frameworks:** Textual, Blessed, ncurses, Ink
- **Full-screen apps:** vim, htop, tmux, less
- **Apps with cursor control:** Progress bars, inline updates

### Characteristics

| Aspect | Description |
| --- | --- |
| **Screen model** | Alternate screen buffer |
| **Output model** | Cursor positioning, screen clearing, repainting |
| **ANSI codes** | Full set: `\x1b[H`, `\x1b[2J`, `\x1b[nA`, etc. |
| **Scrollback** | Lost when app exits |
| **State** | Screen is stateful 2D grid |

### The Fundamental Challenge

Output is not a sequential stream but a series of **mutations to a 2D grid**. The same
bytes mean different things depending on cursor position.

### Testing Approaches

#### PTY-Based Testing

```typescript
import * as pty from 'node-pty';

const term = pty.spawn('my-tui', [], {
  cols: 80,
  rows: 24,
  env: { TERM: 'xterm-256color' },
});

term.write('hello\r');

let output = '';
term.onData((data) => (output += data));

await sleep(100);
expect(output).toContain('expected');
```

#### Terminal Emulator in Tests

```typescript
import { Terminal } from 'xterm-headless';

const term = new Terminal({ cols: 80, rows: 24 });
term.write(capturedOutput);

// Query virtual screen
const line = term.buffer.active.getLine(5)?.translateToString();
expect(line).toContain('expected');
```

### Trade-offs

| Approach | Pros | Cons |
| --- | --- | --- |
| **PTY** | Most realistic | Slow, flaky, platform-specific |
| **Emulator** | Deterministic | Complex, may not match real behavior |
| **Screenshot** | Visual verification | Brittle, large golden files |

### Recommendation

**Minimize Layer 4 testing.** Design your application to maximize Layer 2 and Layer 3
coverage, using Layer 4 only for:

- Keyboard shortcut verification
- Platform-specific edge cases
- Final acceptance testing

* * *

## Semantic Golden Testing for Scroll-Friendly Apps

### The Gap: Between tryscript and Full Event Testing

**tryscript** works beautifully for Layer 1 (plain CLI):

- Capture stdout as text
- Compare against golden files
- Normalize unstable fields

But it struggles with scroll-friendly interactive apps because:

1. **Raw ANSI is noisy** - Colors, styles, escape sequences clutter comparisons
2. **Streaming is lost** - Tryscript sees final output, not incremental rendering
3. **Semantics are opaque** - Can’t distinguish “tool header” from “error message”
4. **Widgets are untestable** - Progress indicators, spinners, formatted blocks

**Full Layer 3 event testing** solves this but requires:

- Recording output interface
- Explicitly designed test harness
- More code per test

### The Idea: Semantic Golden Format

What if we had **tryscript-style simplicity** with **semantic richness**?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  tryscript (Layer 1)          →    Semantic Golden (Layer 2-3)              │
│  ═══════════════════               ═══════════════════════════              │
│                                                                              │
│  Raw text comparison               Semantic event comparison                │
│  "tool output here"                - type: tool_output                       │
│                                      content: "output here"                  │
│                                      truncated: false                        │
│                                                                              │
│  ANSI codes stripped               Formatting preserved as metadata          │
│  (loses styling info)              - type: text                              │
│                                      style: { bold: true, color: "green" }  │
│                                      content: "Success"                      │
│                                                                              │
│  Final snapshot only               Streaming events (consolidated)           │
│                                    - type: stream_chunk                      │
│                                      content: "Thinking..."                  │
│                                    - type: stream_chunk                      │
│                                      content: " here's my response"          │
│                                    # → consolidated in golden comparison     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proposed Architecture

#### 1. Semantic Output Protocol

The terminal app emits structured events instead of raw bytes:

```typescript
// Instead of:
process.stdout.write('\x1b[1m\x1b[32mSuccess:\x1b[0m File saved\n');

// Emit:
output.emit({
  type: 'text',
  style: { bold: true, color: 'green' },
  content: 'Success:',
});
output.emit({
  type: 'text',
  style: {},
  content: ' File saved',
});
output.emit({ type: 'newline' });
```

#### 2. Dual-Mode Output Writer

The same `OutputWriter` interface can:

- **Production mode:** Render to ANSI for terminal display
- **Test/export mode:** Emit YAML/JSON semantic events

```typescript
interface OutputWriter {
  info(message: string): void;
  warning(message: string): void;
  toolHeader(title: string, kind: string, status: string): void;
  toolOutput(content: string, options?: { truncateAfter?: number }): void;
  // ...
}

// Production: renders ANSI
const terminalOutput = createTerminalOutputWriter(process.stdout);

// Testing: records semantic events
const recordingOutput = createRecordingOutputWriter();

// Export: writes YAML event stream
const yamlOutput = createYamlOutputWriter(eventStream);
```

#### 3. Semantic Golden File Format

```yaml
# golden/sessions/tool-execution.yaml
description: Tool execution with truncated output
app_version: ">=1.0.0"

# Optional: input sequence that triggered this output
input:
  - type: prompt
    text: "list files in /usr"

# Expected semantic output (order matters, content normalized)
expected_output:
  - type: tool_header
    title: bash
    kind: execute
    status: pending

  - type: tool_output
    content: |
      bin
      include
      lib
      local
      sbin
      share
    truncated: true
    truncated_count: 47

  - type: tool_header
    title: bash
    kind: execute
    status: completed

# Patterns for unstable fields
patterns:
  TIMESTAMP: '\d{2}:\d{2}:\d{2}'
  DURATION: '\d+(\.\d+)?s'
```

#### 4. Event Consolidation

Streaming events are consolidated for comparison:

```yaml
# Raw captured events (many stream_chunk events):
- type: stream_start
- type: stream_chunk
  content: "I'll "
- type: stream_chunk
  content: "help "
- type: stream_chunk
  content: "you."
- type: stream_end

# Consolidated for golden comparison:
- type: streamed_text
  content: "I'll help you."
```

This lets tests verify the final content without being sensitive to chunk boundaries.

### Widget and Animation Support

Complex UI elements become testable semantic entities:

```yaml
# Progress indicator
- type: widget
  widget_type: progress
  state: active
  # Visual representation not compared, just existence

# Spinner (collapsed from many frames)
- type: widget
  widget_type: spinner
  message: "Loading..."
  duration_range: [0.5, 5.0]  # Acceptable duration

# Permission prompt
- type: permission_prompt
  tool: bash
  command: "rm -rf node_modules"
  options:
    - id: allow_once
      label: "[a] Allow once"
    - id: allow_always
      label: "[A] Allow always"
    - id: reject_once
      label: "[d] Reject once"
    - id: reject_always
      label: "[D] Reject always"

# Code block with syntax highlighting
- type: code_block
  language: typescript
  content: |
    const x = 1;
    console.log(x);
  # Highlighting metadata optional, not in comparison

# Diff block
- type: diff_block
  path: "src/app.ts"
  additions: 5
  deletions: 2
```

### Implementation Sketch

#### Test Harness

```typescript
import { loadGoldenSession, createRecordingOutput, runSession } from './semantic-golden';

test('tool execution flow', async () => {
  const golden = await loadGoldenSession('golden/sessions/tool-execution.yaml');

  const output = createRecordingOutput();
  const app = createApp({ output, agent: mockAgent });

  // Replay input sequence
  for (const input of golden.input) {
    await app.handleInput(input);
  }

  // Compare semantic events
  const events = output.getConsolidatedEvents();
  expect(events).toMatchSemanticGolden(golden.expected_output, {
    patterns: golden.patterns,
  });
});
```

#### Semantic Matcher

```typescript
function matchSemanticGolden(
  actual: SemanticEvent[],
  expected: SemanticEvent[],
  options: { patterns: Record<string, string> }
): MatchResult {
  // 1. Consolidate streaming events
  const consolidated = consolidateStreams(actual);

  // 2. Apply pattern replacements
  const normalized = applyPatterns(consolidated, options.patterns);

  // 3. Deep compare with semantic awareness
  return deepCompareEvents(normalized, expected, {
    ignoreOrder: false,
    ignoreExtraFields: ['timestamp', 'duration'],
    widgetComparison: 'type-only',  // Don't compare visual state
  });
}
```

### Comparison: Testing Approaches

| Approach | Output Format | Streaming | Widgets | Setup Effort |
| --- | --- | --- | --- | --- |
| **tryscript** | Raw text | No | No | Minimal |
| **Stdout capture** | ANSI bytes | No | No | Low |
| **Event recording** | TypeScript | Yes | Yes | Medium |
| **Semantic golden** | YAML | Yes (consolidated) | Yes | Medium |

### When to Use Semantic Golden Testing

**Good fit:**

- Scroll-friendly interactive apps
- Apps with rich formatting (colors, widgets, code blocks)
- Session-based interactions
- When you want readable, maintainable golden files
- When tryscript is too coarse but full event testing is too verbose

**Not ideal for:**

- Simple CLI tools (use tryscript)
- Full TUI apps with cursor control (use PTY tests)
- Performance-critical test suites (parsing overhead)

### Relationship to Semantic Rendering Architectures

Semantic terminal rendering architectures (where apps emit structured events that a
renderer converts to ANSI) align perfectly with this testing approach:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Semantic Rendering Architecture                                             │
│                                                                              │
│  App Logic → Semantic Events → Renderer → ANSI Output                        │
│                    ↓                                                         │
│             Test Capture                                                     │
│                    ↓                                                         │
│             Golden Comparison                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

If your app already uses semantic rendering, golden testing is nearly free:

1. Capture the semantic event stream
2. Serialize to YAML
3. Compare against golden files

* * *

## Combining All Layers

### The Testing Pyramid

```
                    ┌─────────────────┐
                    │  Layer 4        │  ← Few: PTY tests
                    │  Full TUI       │     (keyboard, edge cases)
                    ├─────────────────┤
                    │  Layer 2        │  ← Some: Stdout golden tests
                    │  Stdout Golden  │     (visual output verification)
                    ├─────────────────┤
                    │  Semantic       │  ← Many: Semantic golden tests
                    │  Golden (2-3)   │     (events with YAML format)
                    ├─────────────────┤
                    │  Layer 3        │  ← Many: Event/API unit tests
                    │  Event/State    │     (fast, comprehensive)
                    ├─────────────────┤
                    │  Layer 1        │  ← Many: CLI golden tests
                    │  Plain CLI      │     (--help, --version, errors)
                    ├─────────────────┤
                    │  Unit Tests     │  ← Foundation
                    └─────────────────┘
```

### What to Test at Each Layer

| Layer | What to Test | Speed | Stability |
| --- | --- | --- | --- |
| **1: CLI** | Help, version, errors, non-interactive commands | Fast | High |
| **2: Stdout** | Visual output, full session flows | Medium | Medium |
| **3: Events** | All behavioral logic, state, protocols | Fast | High |
| **4: PTY** | Keyboard handling, real terminal behavior | Slow | Lower |

### Example: Testing a Permission Flow

```typescript
// Layer 3: Event test (comprehensive)
test('permission events', () => {
  const output = createRecordingOutputWriter();
  const app = createTestApp({ output });

  app.handleToolCall({ name: 'bash', command: 'rm -rf /' });
  app.handlePermissionResponse('allow_once');

  expect(output.events).toMatchSnapshot();
});

// Layer 2: Stdout test (visual verification)
test('permission output', async () => {
  const stdout = await captureSession('my-app', [], 'delete files\na\n');
  expect(normalizeOutput(stdout)).toContain('Permission Required');
});

// Layer 1: CLI test (error cases)
test('--help shows permission info', async () => {
  const result = await exec('my-app --help');
  expect(result.stdout).toContain('Permission handling');
});
```

* * *

## Case Study: clam

[clam](../specs/active/plan-2026-02-03-clam-acp-client-spike.md) implements Layers 1-3:

**Layer 1:** `clam --help`, `clam --version` testable via tryscript

**Layer 2:** Scroll-friendly output, no cursor positioning, stdout capturable

**Layer 3:** `OutputWriter` semantic interface, `InputReader` callbacks, `AcpClient`
mockable via `config.agentCommand`

* * *

## Recommendations

### For New Applications

1. **Start with Layer 3:** Design event/API interfaces first
2. **Ensure Layer 2:** Commit to scroll-friendly output
3. **Cover Layer 1:** Use tryscript for CLI basics
4. **Add Layer 4 sparingly:** Only for keyboard-specific features

### Design Principles

1. **Thin rendering layer:** All logic above the ANSI conversion
2. **Observable state:** Make state transitions explicit and testable
3. **Injectable dependencies:** Allow mocking backends, time, randomness
4. **Event-first design:** Model user interaction as events

* * *

## Next Steps

### Potential Implementation Work

1. **Semantic golden library** - Implement the YAML-based semantic golden testing
   framework as a reusable package (could extend tryscript or be standalone)

2. **clam test harness** - Apply these patterns to clam with:
   - `RecordingOutputWriter` for Layer 3 event capture
   - Mock ACP agent for protocol testing
   - Semantic golden files for session flows

3. **Documentation** - Add testing guidelines to tbd for scroll-friendly apps

### Open Questions

- Should semantic golden files support partial matching (subset of events)?
- How to handle non-deterministic event ordering in async flows?
- What’s the right level of detail for widget events?

* * *

## References

### Layer 1 (Plain CLI)

- [tryscript](https://github.com/jlevy/tryscript) - Console output golden testing
- `tbd guidelines golden-testing-guidelines` - Core golden testing principles
- `tbd guidelines typescript-cli-tool-rules` - CLI tool patterns
- `tbd guidelines cli-agent-skill-patterns` - Agent-integrated CLIs

### Layers 2-3

- [Vitest snapshots](https://vitest.dev/guide/snapshot.html) - Snapshot testing
- This document’s patterns and examples

### Layer 4

- [node-pty](https://github.com/microsoft/node-pty) - PTY for terminal testing
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [vhs](https://github.com/charmbracelet/vhs) - Terminal recording

### Protocols

- [ACP Protocol Spec](https://agentclientprotocol.com/protocol/overview) - Agent Client
  Protocol
- [LSP Specification](https://microsoft.github.io/language-server-protocol/) - Language
  Server Protocol
- [MCP Specification](https://modelcontextprotocol.io/) - Model Context Protocol

### Case Studies

- [clam spec](../specs/active/plan-2026-02-03-clam-acp-client-spike.md) - Layers 1-3
  implementation
- [Toad](https://github.com/batrachianai/toad) - Layer 4 TUI (Textual)
