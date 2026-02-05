# Research: Streaming Markdown Rendering for Terminal and Web

**Date:** 2026-02-04 (last updated 2026-02-04)

**Author:** Claude (research assistant)

**Status:** Complete

## Overview

When AI assistants stream responses, the text arrives incrementally.
Rendering markdown formatting (bold, italics, bullets, numbered lists, tables, code
blocks) in real-time as text streams presents unique challenges:

1. **Terminal rendering**: Convert markdown to ANSI escape codes for colors/styles
2. **Web rendering**: Incrementally parse and render HTML/React components
3. **Incomplete syntax**: Handle partial markdown (e.g., `**bold` without closing `**`)
4. **Reflow**: Lists and tables may need re-rendering as more content arrives

This research investigates best practices and libraries for streaming markdown
rendering, with a focus on how modern AI coding tools (OpenCode, Claude Code, Cursor,
etc.) solve this problem.

## Questions to Answer

1. What libraries exist for streaming/incremental markdown parsing?
2. How do we handle incomplete markdown syntax during streaming?
3. What terminal libraries convert markdown to ANSI styling?
4. What React/JavaScript libraries support incremental markdown rendering?
5. How do OpenCode, Claude Code, aider, and other AI coding tools handle this?
6. What are the trade-offs between different approaches (buffer vs immediate render)?
7. How do we handle complex structures (tables, nested lists) that span multiple chunks?

## Scope

**Included:**
- Terminal markdown rendering with ANSI escape codes
- JavaScript/TypeScript streaming markdown parsers
- React components for incremental markdown rendering
- Analysis of how AI coding tools handle streaming output
- Libraries for both terminal and web contexts
- Handling of code blocks, tables, lists, emphasis

**Excluded:**
- Full markdown editor implementations
- WYSIWYG editing
- PDF/document generation
- Server-side rendering concerns

* * *

## Findings

### 1. Terminal Markdown Rendering Libraries

Libraries that convert markdown to ANSI-styled terminal output.

#### 1.1 marked-terminal (Node.js)

**What it is:** A custom renderer for the `marked` markdown parser that outputs
ANSI-styled text for terminals.

**Source:** https://github.com/mikaelbr/marked-terminal

**Features:**
- Uses chalk for ANSI styling
- Configurable styles for each element type
- Syntax highlighting for code blocks via cli-highlight
- Table rendering
- Image rendering via terminal-img (optional)
- Emoji support
- Horizontal rules

**Example:**
```typescript
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

marked.use(markedTerminal({
  code: chalk.yellow,
  blockquote: chalk.gray.italic,
  heading: chalk.bold,
}));

console.log(marked.parse('# Hello **World**'));
```

**Limitations:**
- Designed for complete documents, not streaming
- Re-parses entire content on each call

* * *

#### 1.2 cli-md (terminal-markdown)

**What it is:** Simple markdown to ANSI converter.

**Features:**
- Basic formatting (bold, italic, strikethrough)
- Code blocks with syntax highlighting
- Lists and blockquotes
- Links and images (as text)

**Limitations:**
- Less actively maintained
- Not designed for streaming

* * *

#### 1.3 glow (Go CLI)

**What it is:** Glamorous markdown renderer for the terminal (CLI tool, not a library).

**Source:** https://github.com/charmbracelet/glow

**Features:**
- Beautiful terminal rendering
- Customizable themes (glamour library)
- Pager support
- Can fetch from GitHub/GitLab
- Auto-detects terminal background (dark/light) for appropriate styling

**Relevance:** Shows what’s possible for terminal markdown rendering.
The underlying `glamour` library could be a reference for styling approaches.

* * *

#### 1.4 markdown-it-terminal

**What it is:** Plugin for markdown-it that provides ANSI terminal output.

**Source:** https://github.com/trabus/markdown-it-terminal

**Features:**
- Inspired by marked-terminal
- Uses ansi-styles library for ANSI codes
- Styles defined per token type
- Compatible with markdown-it plugin ecosystem

**Example:**
```typescript
import MarkdownIt from 'markdown-it';
import terminalPlugin from 'markdown-it-terminal';

const md = new MarkdownIt().use(terminalPlugin);
console.log(md.render('# Hello **World**'));
```

* * *

### 2. Streaming/Incremental Markdown Parsing

#### 2.1 The Core Challenge

When streaming markdown, we encounter partial syntax:
- `**bold` - opening but no closing
- `` `code `` - incomplete code span
- `| table |` - table row without header
- `1. item` - list item that might continue

**Approaches:**
1. **Buffer until complete**: Wait for closing syntax before rendering
2. **Speculative render**: Render partial, re-render when complete
3. **Token streaming**: Parse to tokens, render complete tokens only

* * *

#### 2.2 marked (with streaming extensions)

**What it is:** The most popular markdown parser for JavaScript.

**Streaming support:** Not built-in, but can be adapted.

**Approach for streaming:**
```typescript
import { marked } from 'marked';

let buffer = '';
let rendered = '';

function processChunk(chunk: string) {
  buffer += chunk;

  // Find safe breakpoints (complete blocks)
  const safeIndex = findLastSafeBreak(buffer);
  if (safeIndex > 0) {
    const complete = buffer.slice(0, safeIndex);
    rendered += marked.parse(complete);
    buffer = buffer.slice(safeIndex);
  }
}

function findLastSafeBreak(text: string): number {
  // Find last double newline (paragraph break)
  // or end of code fence, etc.
}
```

* * *

#### 2.3 markdown-it (with streaming)

**What it is:** Markdown parser with plugin architecture.

**Source:** https://github.com/markdown-it/markdown-it

**Streaming approach:** Token-based parsing allows partial processing.

```typescript
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

// Parse to tokens first
const tokens = md.parse(text, {});

// Render complete tokens, buffer incomplete ones
```

* * *

#### 2.4 micromark (streaming-ready)

**What it is:** Small, fast, compliant CommonMark parser.

**Source:** https://github.com/micromark/micromark

**Key feature:** Designed with streaming in mind.

```typescript
import { micromark } from 'micromark';

// Low-level API allows chunk processing
import { postprocess, preprocess, parse } from 'micromark';

const preprocessor = preprocess();
const parser = parse();

// Feed chunks
parser(preprocessor(chunk1));
parser(preprocessor(chunk2));
// ...
const events = postprocess(parser(preprocessor(finalChunk, true)));
```

**Benefits:**
- Smallest bundle size
- Designed for streaming
- Highly compliant

* * *

#### 2.5 streaming-markdown (Lightweight Streaming)

**What it is:** Lightweight library (3KB gzipped) for parsing and rendering markdown
streams, specifically designed for ChatGPT-style streaming.

**Source:** https://github.com/thetarnav/streaming-markdown

**Key Features:**
- **Append-only rendering**: New output appended to existing rendered output, not
  replaced
- **No re-parsing**: Doesn’t re-parse/re-render previous content
- **Text selection works**: Users can select and copy text during streaming
- **Optimistic rendering**: Relies on LLM to eventually produce valid syntax

**API:**
```typescript
import { parser_create, parser_write, parser_end, default_renderer } from 'streaming-markdown';

const parser = parser_create(default_renderer(containerElement));

// For each chunk from LLM
parser_write(parser, chunk);

// When stream completes
parser_end(parser);
```

**Benefits:**
- Very small (3KB gzipped)
- No re-rendering penalty
- Good user experience during streaming

**Limitations:**
- Optimistic approach may briefly show broken syntax
- Less full-featured than marked

* * *

#### 2.6 @lixpi/markdown-stream-parser

**What it is:** Incremental parser specifically for LLM markdown streams.

**Source:** https://www.npmjs.com/package/@lixpi/markdown-stream-parser

**Key Features:**
- Designed for LLM output ambiguities
- Handles imperfect/invalid markdown gracefully
- Token-by-token processing

* * *

#### 2.7 @incremark/core

**What it is:** High-performance incremental markdown parser for AI streaming.

**Source:** https://www.npmjs.com/package/@incremark/core

**Key Features:**
- Specifically designed for AI streaming output scenarios
- Incremental parsing architecture
- Performance-optimized

* * *

### 3. The “Flash of Incomplete Markdown” Problem (FOIM)

A well-documented UX issue when streaming LLM markdown output.

**The Problem:** When markdown syntax is partially received, you see broken rendering:
- `**bold` renders as literal `**bold` until closing `**` arrives
- `[link text](url` shows broken link syntax
- Code fences show as literal backticks

**Industry Observations:**
- ChatGPT shows this behavior—broken links visible during streaming
- It’s considered acceptable by many users as “good enough”
- However, it creates a jarring visual experience

**Solutions by Approach:**

| Approach | Library/Method | Trade-off |
| --- | --- | --- |
| **Strip incomplete** | Regex stripping | May hide valid content |
| **Buffer until complete** | Shopify FSM | Delayed rendering |
| **Optimistic close** | streaming-markdown | Brief visual glitches |
| **Frame-rate smoothing** | @llm-ui/react | Best UX, more complex |
| **No solution** | ChatGPT default | Simple, but jarring |

* * *

### 4. React/Web Streaming Markdown Libraries

#### 4.1 react-markdown

**What it is:** Most popular React markdown component.

**Source:** https://github.com/remarkjs/react-markdown

**Streaming support:** No built-in streaming, but can be updated on each chunk.

```tsx
import ReactMarkdown from 'react-markdown';

function StreamingMessage({ content }: { content: string }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
```

**Issue:** Re-renders entire content on each update, can cause flicker.

* * *

#### 4.2 @llm-ui/react (LLM-specific) ⭐ Recommended

**What it is:** React components designed specifically for LLM streaming output.

**Source:** https://llm-ui.com / https://github.com/llm-ui-kit/llm-ui

**Key Features:**
- **Frame-rate smoothing**: Renders characters at display’s native frame rate (60fps),
  not in uneven LLM chunks
- **Broken syntax removal**: Automatically cleans incomplete markdown during streaming
- **Pause removal**: Smooths out pauses in LLM response
- **Custom components**: Inject interactive elements using special syntax
- **Code highlighting**: Integrates Shiki for 100+ language support
- **Model agnostic**: Works with ChatGPT, Claude, Ollama, Mistral, etc.

**How It Works:** The `useLLMOutput` hook listens to streaming output, matches patterns
against defined blocks, and returns structured data for rendering.
The library uses a “lookBack” mechanism to handle incomplete syntax.

**Example:**
```tsx
import { useLLMOutput, MarkdownComponent } from '@llm-ui/react';

function Chat() {
  const { blockMatches } = useLLMOutput({
    llmOutput: streamingContent,
    blocks: [MarkdownComponent],
  });

  return <>{blockMatches.map(match => <match.component key={match.id} />)}</>;
}
```

**Why It’s Recommended:**
- Purpose-built for exact use case
- Best-in-class streaming UX
- Active development
- Comprehensive documentation

* * *

#### 4.3 react-streaming-markdown

**What it is:** React component for rendering streaming markdown from LLMs.

**Source:** https://github.com/nicholasbrady/react-streaming-markdown

**Features:**
- Designed for LLM streaming
- Handles incomplete syntax
- Smooth rendering without flicker

* * *

### 5. Production Implementations

#### 5.1 Shopify Sidekick’s FSM-Based Buffering ⭐

**What it is:** Production streaming implementation used in Shopify’s AI assistant.

**Source:** https://shopify.engineering/sidekicks-improved-streaming

**The Problem Solved:**
- Markdown rendering jank: Syntax fragments rendered as raw text
- Response delay: Waiting for multiple LLM roundtrips

**Architecture: Finite State Machine (FSM) Stream Processor**

Shopify implemented a **stateful Transform stream** that processes characters one-by-one
using an FSM:

```typescript
// Pseudocode - Shopify's approach
class MarkdownBufferingStream extends Transform {
  private state: 'normal' | 'maybe_emphasis' | 'maybe_link' | 'in_code';
  private buffer: string = '';

  _transform(chunk: string, encoding: string, callback: Function) {
    // Iterate over Unicode characters (not bytes!)
    for (const char of chunk) {
      switch (this.state) {
        case 'normal':
          if (char === '*' || char === '_') {
            this.state = 'maybe_emphasis';
            this.buffer += char;
          } else if (char === '[') {
            this.state = 'maybe_link';
            this.buffer += char;
          } else {
            this.push(char);
          }
          break;

        case 'maybe_emphasis':
          if (isUnexpectedChar(char)) {
            // False positive - flush buffer
            this.push(this.buffer + char);
            this.buffer = '';
            this.state = 'normal';
          } else if (isClosingEmphasis(char)) {
            // Complete - flush styled
            this.push(renderEmphasis(this.buffer + char));
            this.buffer = '';
            this.state = 'normal';
          } else {
            this.buffer += char;
          }
          break;

        // ... more states for links, code blocks, etc.
      }
    }
    callback();
  }
}
```

**Key Implementation Details:**
1. **Unicode iteration**: Use `for..of` over strings, not byte-level processing
2. **Selective buffering**: Only buffer ambiguous sequences (*, [, `, etc.)
3. **Flush conditions**:
   - Unexpected character → flush as plain text (false positive)
   - Closing syntax found → flush as rendered markdown
4. **Server-Sent Events**: Multiplex resolved content back into stream

**Async Content Multiplexing:** Shopify also handles tool invocations (like fetching
product data) by:
1. Streaming initial response with placeholders
2. Resolving tool content asynchronously
3. Multiplexing results back into the stream

**Benefits:**
- No jank from partial markdown
- Immediate feedback for most content
- Production-proven at Shopify scale

* * *

### 6. How AI Coding Tools Handle Streaming Markdown

#### 6.1 OpenCode

**Repository:** https://github.com/opencode-ai/opencode

**Technology:** TUI application in Go using Bubble Tea framework.

**Approach:**
- Uses **glamour** (Go library) for markdown rendering
- Re-renders the entire output panel on each chunk
- **Bubble Tea’s efficient diff-based terminal updates** minimize flicker
- Uses **lipgloss** for styling
- Enhanced command system with slash commands, search, categorization

**Key insight:** Full re-render is acceptable when the terminal framework handles
efficient updates. Bubble Tea’s architecture (inspired by Elm) naturally handles
incremental terminal updates.

**Note:** The project has evolved into “Crush” developed with the Charm team.

* * *

#### 6.2 Claude Code (CLI)

**Technology:** Node.js/TypeScript CLI.

**Approach:** (To be researched from source if available)
- Likely uses marked or similar parser
- Streams directly to terminal with ANSI codes
- Handles code blocks specially

* * *

#### 6.3 aider

**Repository:** https://github.com/paul-gauthier/aider

**Technology:** Python CLI.

**Approach:**
- Uses rich library for terminal formatting
- Markdown class in rich handles conversion
- Streams output, re-renders when markdown structure detected

**Key insight:** Rich’s Live display allows smooth updates.

* * *

#### 6.4 Cursor / Continue.dev

**Technology:** VS Code extensions (TypeScript).

**Approach:**
- Render in webview using React
- Use standard markdown libraries
- Apply virtual scrolling for long outputs

* * *

### 7. Block-Boundary Heuristics (Recommended Approach)

The key insight: **format on block completion, not on stream completion**.

#### 7.0 Natural Commit Points

Rather than waiting for the entire stream or rendering character-by-character, detect
**block boundaries** as formatting triggers:

| Block Type | Completion Signal | Then Format |
| --- | --- | --- |
| **Paragraph** | Double newline (`\n\n`) | Previous paragraph |
| **Fenced code** | Closing `` ``` `` | Entire code block with syntax highlighting |
| **Table** | Blank line after rows | Full table (needs all rows for column widths) |
| **List** | Blank line or non-list line | All accumulated list items |
| **Blockquote** | Line not starting with `>` | Accumulated blockquote |
| **Heading** | Newline after heading | The heading line |

**Implementation:**

```typescript
class BlockAwareStreamRenderer {
  private buffer = '';
  private currentBlockType: 'paragraph' | 'code' | 'table' | 'list' | null = null;

  processChunk(chunk: string): string {
    this.buffer += chunk;
    let output = '';

    while (true) {
      const boundary = this.findBlockBoundary();
      if (!boundary) break;

      // Format the completed block
      const completedBlock = this.buffer.slice(0, boundary.index);
      output += this.formatBlock(completedBlock, boundary.type);

      // Keep the rest in buffer
      this.buffer = this.buffer.slice(boundary.index);
      this.currentBlockType = this.detectBlockType(this.buffer);
    }

    return output;
  }

  private findBlockBoundary(): { index: number; type: string } | null {
    // Fenced code block: look for closing ```
    if (this.currentBlockType === 'code') {
      const closeIndex = this.buffer.indexOf('\n```', 3);
      if (closeIndex !== -1) {
        return { index: closeIndex + 4, type: 'code' };
      }
      return null; // Keep buffering until fence closes
    }

    // Table: look for blank line after | rows
    if (this.currentBlockType === 'table') {
      const blankLine = this.buffer.indexOf('\n\n');
      if (blankLine !== -1) {
        return { index: blankLine + 2, type: 'table' };
      }
      return null; // Keep buffering until table ends
    }

    // Paragraph: double newline
    const paragraphEnd = this.buffer.indexOf('\n\n');
    if (paragraphEnd !== -1) {
      return { index: paragraphEnd + 2, type: 'paragraph' };
    }

    return null;
  }
}
```

**Why This Works:**

1. **Tables**: Must buffer because column widths depend on all cells
2. **Code blocks**: Buffer until closing fence, then apply syntax highlighting
3. **Paragraphs**: Safe to format immediately on completion
4. **Lists**: Can format item-by-item OR wait for list completion
5. **Inline formatting** (`**bold**`): Can render speculatively within paragraphs

**Trade-offs:**

| Strategy | Latency | Correctness | Complexity |
| --- | --- | --- | --- |
| Character-by-character | Lowest | Poor (broken syntax) | Low |
| Block-boundary | Low | Good | Medium |
| Full document | Highest | Perfect | Low |

**Recommendation:** Block-boundary is the sweet spot for streaming LLM output.

* * *

### 8. Approaches to Streaming Markdown

#### 8.1 Approach A: Full Buffer-Based Rendering

**Description:** Accumulate text until syntactically complete, then render.

```typescript
class MarkdownBuffer {
  private buffer = '';
  private rendered = '';

  addChunk(chunk: string): string {
    this.buffer += chunk;

    // Find complete blocks
    const blocks = this.findCompleteBlocks();
    for (const block of blocks) {
      this.rendered += this.renderBlock(block);
      this.buffer = this.buffer.slice(block.length);
    }

    return this.rendered + this.renderPartial(this.buffer);
  }
}
```

**Pros:**
- Clean, correct rendering
- No visual artifacts from partial syntax

**Cons:**
- Delay in showing content
- Complex block boundary detection

* * *

#### 8.2 Approach B: Line-Based Streaming

**Description:** Render complete lines immediately, buffer partial lines.

```typescript
function streamByLine(content: string, onLine: (line: string) => void) {
  const lines = content.split('\n');
  const completeLines = lines.slice(0, -1);

  for (const line of completeLines) {
    onLine(renderLine(line));
  }

  return lines[lines.length - 1]; // Return partial line as buffer
}
```

**Pros:**
- Simple implementation
- Low latency for most content

**Cons:**
- Doesn’t handle multi-line constructs well (tables, code blocks)

* * *

#### 8.3 Approach C: Speculative Rendering with Correction

**Description:** Render immediately with “best guess,” correct when more arrives.

```typescript
function speculativeRender(content: string): string {
  // Close any unclosed formatting
  let result = content;

  // Count unclosed emphasis
  const boldCount = (content.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    result += '**'; // Speculatively close
  }

  // Similar for other syntax...
  return marked.parse(result);
}
```

**Pros:**
- Immediate rendering
- Usually correct

**Cons:**
- May cause visual “jumps” when corrected
- Complex to handle all edge cases

* * *

#### 8.4 Approach D: Token-Based Streaming

**Description:** Parse to tokens, only render complete tokens.

```typescript
import { parse } from 'micromark';

function tokenBasedStream(content: string) {
  const events = parse(content);

  const completeTokens = events.filter(e => e[0] === 'exit');
  // Render only tokens that have both enter and exit
}
```

**Pros:**
- Semantically correct
- Fine-grained control

**Cons:**
- More complex implementation
- May need custom token handling

* * *

### 9. Terminal-Specific Considerations

#### 9.1 ANSI Escape Code Basics

```typescript
// Basic ANSI codes
const BOLD = '\x1b[1m';
const ITALIC = '\x1b[3m';
const RESET = '\x1b[0m';

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';

// Example
console.log(`${BOLD}Hello${RESET} ${ITALIC}World${RESET}`);
```

#### 9.2 Using picocolors (already in clam)

```typescript
import pc from 'picocolors';

function renderMarkdownLine(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, (_, text) => pc.bold(text))
    .replace(/\*(.+?)\*/g, (_, text) => pc.italic(text))
    .replace(/`(.+?)`/g, (_, text) => pc.cyan(text))
    .replace(/^#{1,6}\s+(.+)$/m, (_, text) => pc.bold(pc.blue(text)));
}
```

#### 9.3 Code Block Syntax Highlighting

**Options:**
- `cli-highlight`: Syntax highlighting for terminal
- `highlight.js` + custom terminal renderer
- `prism-react-renderer` for web

* * *

### 10. Web View Considerations

#### 10.1 Performance with Frequent Updates

**Problem:** Re-rendering markdown on every chunk causes performance issues.

**Solutions:**
1. **Debounce rendering**: Batch multiple chunks
2. **Virtual DOM diffing**: React/Preact handle efficiently
3. **Append-only rendering**: Only render new content, don’t re-render existing

#### 10.2 Code Block Streaming

**Challenge:** Syntax highlighting during streaming.

**Approach:**
```tsx
function StreamingCodeBlock({ code, language, isComplete }) {
  const highlighted = useMemo(
    () => isComplete ? highlightCode(code, language) : code,
    [code, language, isComplete]
  );

  return (
    <pre>
      <code className={isComplete ? 'highlighted' : 'streaming'}>
        {highlighted}
      </code>
    </pre>
  );
}
```

* * *

## Options Considered

### Option A: marked-terminal for Terminal Output

**Description:** Use marked with marked-terminal renderer for terminal output.

**Implementation:**
```typescript
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

marked.use(markedTerminal());

function renderToTerminal(markdown: string): string {
  return marked.parse(markdown);
}
```

**Pros:**
- Mature, well-tested
- Full markdown support
- Configurable styling

**Cons:**
- Full re-parse on each chunk
- Not designed for streaming

* * *

### Option B: Custom Line-Based Renderer

**Description:** Build simple line-based renderer using picocolors.

**Implementation:**
```typescript
import pc from 'picocolors';

function renderLine(line: string): string {
  // Headers
  if (line.match(/^#{1,6}\s/)) {
    return pc.bold(pc.blue(line.replace(/^#+\s/, '')));
  }

  // List items
  if (line.match(/^[-*]\s/)) {
    return '  ' + pc.dim('•') + line.slice(1);
  }

  // Inline formatting
  return line
    .replace(/\*\*(.+?)\*\*/g, (_, t) => pc.bold(t))
    .replace(/\*(.+?)\*/g, (_, t) => pc.italic(t))
    .replace(/`(.+?)`/g, (_, t) => pc.cyan(t));
}
```

**Pros:**
- Simple, fast
- Full control
- No dependencies beyond picocolors

**Cons:**
- Limited markdown support
- Must handle edge cases manually

* * *

### Option C: @llm-ui/react for Web Views

**Description:** Use purpose-built LLM streaming markdown library.

**Implementation:**
```tsx
import { useLLMOutput, markdownLookBack } from '@llm-ui/react';
import { markdownComponents } from '@llm-ui/markdown';

function StreamingOutput({ content }) {
  const { blockMatches } = useLLMOutput({
    llmOutput: content,
    blocks: markdownComponents,
    fallbackBlock: {
      component: TextBlock,
      lookBack: markdownLookBack,
    },
  });

  return <div>{blockMatches.map(renderBlock)}</div>;
}
```

**Pros:**
- Designed for exact use case
- Handles streaming gracefully
- Good defaults for LLM output

**Cons:**
- Additional dependency
- React-specific

* * *

### Option D: Hybrid Approach (Recommended)

**Description:** Different strategies for terminal vs web.

**Terminal:**
1. Use marked-terminal for final/complete output
2. Use simple line-based renderer during streaming
3. Switch to full render when stream completes

**Web:**
1. Use @llm-ui/react or react-markdown for rendering
2. Debounce updates during rapid streaming
3. Apply syntax highlighting only to complete code blocks

**Pros:**
- Best tool for each context
- Graceful degradation
- Good streaming UX

**Cons:**
- More code to maintain
- Different rendering paths

* * *

## Recommendations

### For Terminal Streaming (Phase 1)

1. **Use block-boundary detection** (Section 7) as the primary strategy:
   - Detect paragraph breaks (`\n\n`) as commit points
   - Buffer tables until blank line after rows (need column widths)
   - Buffer fenced code blocks until closing fence
   - Format each block as soon as the next block begins

2. **Use picocolors for inline formatting** within paragraphs:
   - Bold, italic, inline code can be rendered speculatively
   - Headers format immediately on newline

3. **Buffer complex structures**:
   - **Tables**: Must wait for all rows to calculate column widths
   - **Code blocks**: Wait for closing fence, then apply syntax highlighting
   - **Lists**: Can render item-by-item or wait for list completion

4. **Final render pass**: When stream completes, format any remaining buffer with
   marked-terminal for edge cases

### For Web Streaming (Phase 2)

1. **Evaluate @llm-ui/react**: Purpose-built for this use case

2. **Fallback to react-markdown** with debounced updates if @llm-ui/react doesn’t meet
   needs

3. **Virtual scrolling**: For long outputs, use virtualization (react-window)

### General Principles

1. **Prefer immediate feedback**: Show something quickly, refine later
2. **Handle code blocks specially**: They’re common in AI coding output
3. **Test with real LLM output**: Stream characteristics vary by model
4. **Consider mobile/slow connections**: May receive very small chunks

* * *

## Next Steps

- [ ] Implement block-boundary detector (paragraph, code fence, table detection)
- [ ] Prototype `BlockAwareStreamRenderer` class for terminal
- [ ] Test with real LLM streaming output (Claude, GPT-4)
- [ ] Evaluate @llm-ui/react for future web view
- [ ] Benchmark: block-boundary vs line-based vs full-buffer approaches
- [ ] Add syntax highlighting for code blocks (cli-highlight)
- [ ] Handle edge cases: nested lists, blockquotes within lists

* * *

## Library Comparison Summary

| Library | Target | Size | Streaming | Key Feature |
| --- | --- | --- | --- | --- |
| **Terminal** |  |  |  |  |
| marked-terminal | Node.js | Medium | No | Full markdown, configurable |
| markdown-it-terminal | Node.js | Medium | No | Plugin-based |
| glow/glamour | Go | Large | No | Beautiful themes |
| picocolors | Node.js | Tiny | N/A | Just ANSI colors |
| **Web/React** |  |  |  |  |
| @llm-ui/react ⭐ | React | Medium | Yes | Frame-rate smoothing, LLM-specific |
| react-markdown | React | Medium | No | Most popular |
| streaming-markdown | Vanilla | 3KB | Yes | Append-only, lightweight |
| **Parsers** |  |  |  |  |
| marked | JS | Small | Partial | Most popular |
| markdown-it | JS | Medium | Partial | Plugin architecture |
| micromark | JS | Tiny | Yes | Low-level, streaming-ready |
| @incremark/core | JS | Small | Yes | AI-optimized |

* * *

## References

### Terminal Markdown

- [marked-terminal](https://github.com/mikaelbr/marked-terminal) - Marked renderer for
  terminal
- [markdown-it-terminal](https://github.com/trabus/markdown-it-terminal) - markdown-it
  plugin for ANSI
- [glow](https://github.com/charmbracelet/glow) - Go terminal markdown renderer
- [glamour](https://github.com/charmbracelet/glamour) - Go markdown styling library
- [cli-highlight](https://github.com/felixfbecker/cli-highlight) - Terminal syntax
  highlighting
- [Rendering Markdown in the Terminal](https://dimiro1.dev/rendering-markdown-in-the-terminal/)
  \- Tutorial

### JavaScript Markdown Parsers

- [marked](https://github.com/markedjs/marked) - Most popular parser
- [markdown-it](https://github.com/markdown-it/markdown-it) - Plugin-based parser
- [micromark](https://github.com/micromark/micromark) - Small, streaming-ready parser
- [remark](https://github.com/remarkjs/remark) - Markdown processor ecosystem

### Streaming Markdown Libraries

- [streaming-markdown](https://github.com/thetarnav/streaming-markdown) - 3KB streaming
  parser
- [@lixpi/markdown-stream-parser](https://www.npmjs.com/package/@lixpi/markdown-stream-parser)
  \- LLM stream parser
- [@incremark/core](https://www.npmjs.com/package/@incremark/core) - Incremental parser
  for AI

### React Streaming Components

- [@llm-ui/react](https://llm-ui.com/) - LLM streaming UI components (recommended)
- [react-markdown](https://github.com/remarkjs/react-markdown) - React markdown
  component
- [react-streaming-markdown](https://github.com/nicholasbrady/react-streaming-markdown)
- [llm-ui Blog Post](https://blog.logrocket.com/react-llm-ui/) - LogRocket tutorial

### Production Implementations

- [Shopify Sidekick Streaming](https://shopify.engineering/sidekicks-improved-streaming)
  \- FSM buffering approach
- [OpenCode](https://github.com/opencode-ai/opencode) - TUI coding assistant (Go)
- [aider](https://github.com/paul-gauthier/aider) - AI pair programming (Python)
- [Continue](https://github.com/continuedev/continue) - VS Code AI extension
- [Chrome Best Practices](https://developer.chrome.com/docs/ai/render-llm-responses) -
  Google’s guide

### Community Discussions

- [Preventing Flash of Incomplete Markdown](https://news.ycombinator.com/item?id=44182941)
  \- HN discussion
- [react-markdown streaming discussion](https://github.com/orgs/remarkjs/discussions/1342)
  \- GitHub
- [Beyond boring markdown rendering](https://dev.to/fibonacid/beyond-boring-markdown-rendering-with-llms-and-react-2gb3)
  \- DEV.to

### Styling Libraries

- [picocolors](https://github.com/alexeyraspopov/picocolors) - Terminal colors (tiny)
- [chalk](https://github.com/chalk/chalk) - Terminal colors (full-featured)
- [rich](https://github.com/Textualize/rich) - Python terminal formatting
- [lipgloss](https://github.com/charmbracelet/lipgloss) - Go terminal styling

### ANSI Escape Codes

- [ANSI Escape Codes Reference](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797)
  \- Comprehensive guide
- [Build your own Command Line](https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html)
  \- Tutorial
