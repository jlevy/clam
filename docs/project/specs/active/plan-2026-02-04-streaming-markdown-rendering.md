# Feature: Streaming Markdown Rendering

**Date:** 2026-02-04 (last updated 2026-02-05, Phase 4 added)

**Author:** Claude (with research assistance)

**Status:** In Progress (Phase 4: Enhanced Table Rendering)

**Research:**
[research-2026-02-04-streaming-markdown-rendering.md](../../research/active/research-2026-02-04-streaming-markdown-rendering.md)

## Overview

Add markdown rendering to Clam’s terminal output during LLM response streaming.
When Claude responds with markdown formatting (bold, italic, code blocks, headers,
lists, tables), the terminal output should render these with appropriate ANSI styling
rather than showing raw markdown syntax.

The key challenge: markdown arrives in chunks during streaming, and formatting syntax
may be incomplete mid-stream.
The solution uses **block-boundary detection** to format completed blocks while
preserving streaming responsiveness.

## Goals

- Render markdown formatting in terminal output with ANSI escape codes
- Maintain streaming responsiveness (format on block completion, not stream completion)
- Handle incomplete syntax gracefully during streaming
- Support common markdown elements: bold, italic, code (inline + fenced), headers, lists
- Buffer tables until complete (column widths require all rows)
- Apply syntax highlighting to completed code blocks

## Non-Goals

- Web view rendering (Phase 2, separate spec)
- Full CommonMark compliance (focus on LLM-common subset)
- Image rendering
- Complex nested structures (deeply nested lists, blockquotes within lists)
- Custom themes or user-configurable styling

## Background

Currently, Clam streams LLM responses directly to the terminal without any markdown
processing. The `OutputWriter.streamChunk()` method writes text with basic color coding
but no formatting.

When Claude includes markdown in responses, users see raw syntax like `**bold**` and
`` `code` `` instead of styled text.
This degrades the reading experience, especially for code-heavy responses.

Research identified the **block-boundary heuristic** approach as optimal for streaming:
format completed blocks immediately rather than waiting for stream completion or
character-by-character rendering.

## Design

### Approach: Block-Boundary Detection

Process streaming chunks through a `BlockAwareStreamRenderer` that:

1. **Buffers incoming text** until block boundaries are detected
2. **Detects block types**: paragraph, fenced code, table, list, header, blockquote
3. **Emits formatted blocks** when the next block begins or stream ends
4. **Handles inline formatting** speculatively within paragraphs

```
LLM Stream → BlockAwareStreamRenderer → Formatted ANSI Output
     ↓                ↓                        ↓
  chunks         buffer + detect          terminal
```

### Block Completion Signals

| Block Type | Completion Signal | Formatting |
| --- | --- | --- |
| Paragraph | Double newline (`\n\n`) | Apply inline styles |
| Fenced code | Closing `` ``` `` | Syntax highlight block |
| Table | Blank line after rows | Format with column widths |
| List | Blank line or non-list line | Render with bullets/nums |
| Header | Newline after `# ...` | Bold + color |
| Blockquote | Line not starting with `>` | Dim + prefix |

### Components

```
packages/clam/src/lib/
├── markdown/
│   ├── index.ts              # Public exports
│   ├── block-renderer.ts     # BlockAwareStreamRenderer class
│   ├── block-detector.ts     # Block type detection logic
│   ├── inline-formatter.ts   # Bold, italic, code, links
│   ├── code-highlighter.ts   # Syntax highlighting for code blocks
│   └── table-formatter.ts    # Table rendering with column widths
└── output.ts                 # Modified to use BlockAwareStreamRenderer
```

### Integration Points

**Primary integration** in `OutputWriter.streamChunk()` at
[output.ts:397-406](packages/clam/src/lib/output.ts#L397-L406):

```typescript
// Current implementation
streamChunk(text: string): void {
  write(colors.agentText(text));  // Direct write
}

// New implementation
streamChunk(text: string): void {
  const formatted = this.blockRenderer.processChunk(text);
  if (formatted) {
    write(formatted);  // Write formatted blocks
  }
}
```

**Lifecycle hooks** for renderer initialization/cleanup:

- `streamStart()`: Initialize `BlockAwareStreamRenderer`
- `streamEnd()`: Flush remaining buffer with final formatting

### API Changes

**New internal API** (not user-facing):

```typescript
interface BlockAwareStreamRenderer {
  processChunk(text: string): string;  // Returns formatted output or empty
  flush(): string;                     // Format remaining buffer at stream end
  reset(): void;                       // Reset state for new stream
}

interface InlineFormatter {
  format(text: string): string;        // Apply bold, italic, code, links
}

interface CodeHighlighter {
  highlight(code: string, language: string): string;
}
```

## Implementation Plan

### Phase 1: Core Block Renderer ✅

Implement the `BlockAwareStreamRenderer` with basic block detection and inline
formatting.

- [x] Create `packages/clam/src/lib/markdown/` directory structure
- [x] Implement `BlockDetector` class with paragraph/header/code fence detection
- [x] Implement `InlineFormatter` for bold, italic, inline code using picocolors
- [x] Implement `BlockAwareStreamRenderer` coordinating detection and formatting
- [x] Integrate into `OutputWriter.streamChunk()` with feature flag
- [x] Add unit tests for block detection and inline formatting
- [x] Add integration tests with streaming mock

### Phase 2: Code Block Highlighting ✅

Add syntax highlighting for fenced code blocks.

- [x] Add cli-highlight dependency for syntax highlighting
- [x] Implement `CodeHighlighter` wrapping the highlighting library
- [x] Integrate into `BlockAwareStreamRenderer` for code blocks
- [x] Test with common languages (typescript, python, bash, json)

### Phase 3: Lists and Tables ✅

Add support for list and table formatting.
(Note: Implemented as part of Phase 1 core block renderer)

- [x] Implement list detection (unordered `-`/`*`, ordered `1.`)
- [x] Implement list rendering with proper indentation and bullets
- [x] Implement table detection (pipe-delimited rows)
- [x] Implement table buffering until complete (column width calculation)
- [x] Implement table rendering with aligned columns

### Phase 4: Use marked-terminal for All Block Rendering

Replace custom block formatters with `marked-terminal` for all block types.
This matches the rendering approach used in tbd for a consistent, polished terminal
experience.

**Rationale:** Since we’re adding `marked` and `marked-terminal` dependencies, we should
use them for everything - not just tables.
This gives us:

- Professional box-drawing tables
- Consistent header styling
- Proper list rendering with bullets
- Styled blockquotes
- Less custom code to maintain

**Current approach (custom formatters):**

```
| Header 1 | Header 2 |     # Header           - Item 1
|----------|----------|     Some paragraph     - Item 2
| Cell 1   | Cell 2   |
```

**New approach (marked-terminal):**

```
┌───────────┬───────────┐
│ Header 1  │ Header 2  │   # Header (bold/colored)
├───────────┼───────────┤
│ Cell 1    │ Cell 2    │   Some paragraph
└───────────┴───────────┘
                            • Item 1
                            • Item 2
```

**Implementation:**

- [x] Add `marked` and `marked-terminal` dependencies (done - version 15.0.12)
- [ ] Create `renderMarkdownBlock()` utility using marked-terminal (mimic tbd’s
  approach)
- [ ] Configure marked-terminal with `{ width: getTerminalWidth(), reflowText: true }`
- [ ] Handle type casting for `@types/marked-terminal` (outdated types, see tbd
  workaround)
- [ ] Update `formatBlock()` in block-renderer.ts to use `renderMarkdownBlock()` for all
  block types (tables, headers, lists, blockquotes, paragraphs)
- [ ] Keep `cli-highlight` for code blocks (better syntax highlighting than
  marked-terminal)
- [ ] Update tests to expect marked-terminal output format
- [ ] Remove custom formatters that are no longer needed (formatHeader, formatTable,
  formatList, formatBlockquote, formatParagraph)

**Reference:** tbd’s implementation at
[tbd/src/cli/lib/output.ts:196-216](https://github.com/jlevy/tbd/blob/main/packages/tbd/src/cli/lib/output.ts#L196-L216)

## Testing Strategy

**Unit tests** for each component:

- `block-detector.test.ts`: Block type detection from partial text
- `inline-formatter.test.ts`: Bold, italic, code, links
- `block-renderer.test.ts`: Full streaming scenarios

**Integration tests** in `output.test.ts`:

- Streaming with markdown formatting
- Incomplete syntax handling
- Code block with language detection
- Table rendering

**Manual testing**:

- Real LLM output from Claude via clam
- Various markdown patterns from typical AI responses

## Rollout Plan

1. **Feature flag**: Add `--no-markdown` flag to disable rendering (default: enabled)
2. **Initial release**: Phase 1 only (basic formatting)
3. **Iterative improvement**: Add phases 2-3 based on user feedback

## Open Questions

**Original questions:**

- Should we add a configuration option for custom colors/styles?
- Should incomplete inline formatting be rendered speculatively or stripped?
- What’s the right behavior for malformed markdown (unclosed fences, etc.)?

**Questions discovered during implementation:**

- **Buffer leading whitespace**: When blocks end with blank lines (`\n\n`), the trailing
  newline can remain in the buffer, causing next block detection to fail if it starts
  with the leftover newline.
  Current behavior: treats as empty paragraph.
  Should the detector strip leading whitespace before block detection?

- **Multi-block streaming chunk boundaries**: When markdown blocks span multiple
  streaming chunks, proper blank line handling between blocks is critical.
  The renderer assumes each block ends with appropriate boundaries.
  Should we add explicit guidance for LLM prompt formatting to ensure clean block
  boundaries?

- **cli-highlight color support**: The cli-highlight library respects FORCE_COLOR and
  chalk’s color detection.
  In non-TTY environments (CI, tests), colors may be disabled.
  Current tests check behavior (no throw, returns string) rather than exact ANSI output.
  Is this sufficient?

- **Phase 3 scope**: Lists and tables were already implemented as part of Phase 1 core
  block renderer. Phase 3 is marked complete; Phase 4 now adds enhanced table rendering
  using `marked-terminal` for box-drawing table borders.

## References

- [Research: Streaming Markdown Rendering](../../research/active/research-2026-02-04-streaming-markdown-rendering.md)
- [Shopify Sidekick FSM Streaming](https://shopify.engineering/sidekicks-improved-streaming)
- [marked-terminal](https://github.com/mikaelbr/marked-terminal)
- [cli-highlight](https://github.com/felixfbecker/cli-highlight)
- [picocolors](https://github.com/alexeyraspopov/picocolors) (already in clam)
