/**
 * BlockAwareStreamRenderer - Main streaming markdown renderer.
 *
 * Processes streaming text chunks and emits formatted output when
 * block boundaries are detected.
 *
 * Uses marked-terminal for rendering all block types except code fences
 * (which use cli-highlight for better syntax highlighting).
 *
 * Based on the block-boundary heuristic approach from research:
 * - Buffer incoming text until block boundaries are detected
 * - Emit formatted blocks when the next block begins or stream ends
 * - Pass each complete block to marked-terminal for rendering
 */

import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import pc from 'picocolors';

import { createBlockDetector, type BlockDetector } from './block-detector.js';
import { highlightCode as cliHighlightCode } from './code-highlighter.js';
import { formatInline } from './inline-formatter.js';
import type { BlockType, StreamRenderer } from './types.js';

/**
 * Get the terminal width, falling back to 80 columns.
 */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Render a markdown block using marked-terminal.
 *
 * Creates a fresh marked instance configured with marked-terminal
 * and renders the given markdown content. Used for all block types
 * except code fences (which use cli-highlight for better syntax
 * highlighting).
 */
export function renderMarkdownBlock(markdown: string): string {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return '\n';
  }

  const markedInstance = new Marked();

  // Configure marked-terminal with type cast (@types/marked-terminal is outdated for v7)
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
  markedInstance.use(
    (markedTerminal as any)({
      width: getTerminalWidth(),
      reflowText: true,
      showSectionPrefix: true,
      tab: 2,
    })
  );
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

  const rendered = markedInstance.parse(trimmed) as string;

  // Normalize to double newline for proper spacing between blocks
  return rendered.replace(/\n+$/, '\n\n');
}

/**
 * Options for creating a BlockAwareStreamRenderer.
 */
export interface BlockRendererOptions {
  /** Custom code highlighter (optional, defaults to basic coloring) */
  codeHighlighter?: (code: string, language: string) => string;
}

/**
 * Create a BlockAwareStreamRenderer instance.
 */
export function createBlockRenderer(options: BlockRendererOptions = {}): StreamRenderer {
  let buffer = '';
  const detector: BlockDetector = createBlockDetector();
  const highlightCode = options.codeHighlighter ?? defaultCodeHighlight;

  return {
    /**
     * Process an incoming chunk of text.
     * Returns formatted output for any completed blocks.
     */
    processChunk(text: string): string {
      buffer += text;
      let output = '';

      // Process all complete blocks in the buffer
      while (true) {
        const boundary = detector.findBoundary(buffer);
        if (!boundary) break;

        // Extract the completed block
        const completedBlock = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index);

        // Format and emit the block
        output += formatBlock(completedBlock, boundary.type, boundary.language, highlightCode);

        // Exit the block state
        detector.exitBlock();
      }

      return output;
    },

    /**
     * Flush remaining buffer at stream end.
     * Formats any remaining content as a final block.
     */
    flush(): string {
      if (buffer.length === 0) {
        return '';
      }

      // Determine the type of remaining content
      const blockType = detector.detectBlockType(buffer);
      const state = detector.getState();

      let output: string;

      if (state === 'in_code_fence') {
        // Unclosed code fence - format as code anyway
        output = formatBlock(buffer, 'code_fence', detector.getCodeLanguage(), highlightCode);
      } else if (blockType) {
        output = formatBlock(buffer, blockType, undefined, highlightCode);
      } else {
        // Plain text fallback
        output = formatInline(buffer);
      }

      buffer = '';
      detector.reset();

      return output;
    },

    /**
     * Reset state for a new stream.
     */
    reset(): void {
      buffer = '';
      detector.reset();
    },
  };
}

/**
 * Format a completed block based on its type.
 *
 * Code fences use cli-highlight for better syntax highlighting.
 * All other block types use marked-terminal for rendering.
 */
function formatBlock(
  content: string,
  type: BlockType,
  language: string | undefined,
  highlightCode: (code: string, language: string) => string
): string {
  switch (type) {
    case 'code_fence':
      return formatCodeFence(content, language, highlightCode);

    case 'header':
    case 'table':
    case 'list':
    case 'blockquote':
    case 'paragraph':
    default:
      return renderMarkdownBlock(content);
  }
}

/**
 * Format a fenced code block using cli-highlight.
 *
 * Kept separate from marked-terminal because cli-highlight provides
 * better syntax highlighting for code blocks.
 */
function formatCodeFence(
  content: string,
  language: string | undefined,
  highlightCode: (code: string, language: string) => string
): string {
  const lines = content.split('\n');

  // Extract language from opening fence if not provided
  const openingLine = lines[0] ?? '';
  const langMatch = /^```(\w*)/.exec(openingLine);
  const lang = language ?? langMatch?.[1] ?? '';

  // Find code content (between opening and closing fence)
  const codeStart = 1;
  let codeEnd = lines.length;

  // Find closing fence
  for (let i = lines.length - 1; i > 0; i--) {
    const line = lines[i];
    if (line?.trim() === '```') {
      codeEnd = i;
      break;
    }
  }

  const codeLines = lines.slice(codeStart, codeEnd);
  const code = codeLines.join('\n');

  // Apply syntax highlighting
  const highlighted = highlightCode(code, lang);

  // Format with language indicator
  const langIndicator = lang ? pc.gray(`[${lang}]`) : '';
  const border = pc.gray('```');

  return `${border}${langIndicator}\n${highlighted}\n${border}\n\n`;
}

/**
 * Default code highlighting using cli-highlight.
 * Falls back to cyan coloring for unsupported languages.
 */
function defaultCodeHighlight(code: string, language: string): string {
  // Try cli-highlight first
  const highlighted = cliHighlightCode(code, language);

  // If no language or highlighting returned unchanged, use basic cyan
  if (!language || highlighted === code) {
    return pc.cyan(code);
  }

  return highlighted;
}

export type BlockRenderer = ReturnType<typeof createBlockRenderer>;
