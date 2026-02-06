/**
 * BlockAwareStreamRenderer - Main streaming markdown renderer.
 *
 * Processes streaming text chunks and emits formatted output when
 * block boundaries are detected.
 *
 * Based on the block-boundary heuristic approach from research:
 * - Buffer incoming text until block boundaries are detected
 * - Emit formatted blocks when the next block begins or stream ends
 * - Handle inline formatting speculatively within paragraphs
 */

import pc from 'picocolors';

import { createBlockDetector, type BlockDetector } from './block-detector.js';
import { highlightCode as cliHighlightCode } from './code-highlighter.js';
import { formatInline } from './inline-formatter.js';
import type { BlockType, StreamRenderer } from './types.js';

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
 */
function formatBlock(
  content: string,
  type: BlockType,
  language: string | undefined,
  highlightCode: (code: string, language: string) => string
): string {
  switch (type) {
    case 'header':
      return formatHeader(content);

    case 'code_fence':
      return formatCodeFence(content, language, highlightCode);

    case 'table':
      return formatTable(content);

    case 'list':
      return formatList(content);

    case 'blockquote':
      return formatBlockquote(content);

    case 'paragraph':
    default:
      return formatParagraph(content);
  }
}

/**
 * Format a header line.
 */
function formatHeader(content: string): string {
  // Extract header level and text
  const match = /^(#{1,6})\s+(.+)$/m.exec(content);
  if (!match?.[1] || !match[2]) {
    return formatInline(content);
  }

  const level = match[1].length;
  const text = match[2].trim();

  // Format with bold and level-appropriate styling
  // H1-H2: bold blue, H3-H4: bold cyan, H5-H6: bold
  let formatted: string;
  if (level <= 2) {
    formatted = pc.bold(pc.blue(text));
  } else if (level <= 4) {
    formatted = pc.bold(pc.cyan(text));
  } else {
    formatted = pc.bold(text);
  }

  return formatted + '\n';
}

/**
 * Format a fenced code block.
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

  return `${border}${langIndicator}\n${highlighted}\n${border}\n`;
}

/**
 * Format a table.
 */
function formatTable(content: string): string {
  const lines = content
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return content;

  // Parse table rows
  const rows = lines.map((line) =>
    line
      .split('|')
      .slice(1, -1) // Remove empty strings from leading/trailing |
      .map((cell) => cell.trim())
  );

  // Find separator row (contains only -, :, spaces, |)
  const separatorIndex = rows.findIndex((row) => row.every((cell) => /^[-:\s]*$/.test(cell)));

  // Calculate column widths
  const columnWidths: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      const cellWidth = cell !== undefined ? cell.length : 0;
      columnWidths[i] = Math.max(columnWidths[i] ?? 0, cellWidth);
    }
  }

  // Format rows
  const formattedRows: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const isHeader = separatorIndex > 0 && i === 0;
    const isSeparator = i === separatorIndex;

    if (isSeparator) {
      // Format separator row
      const separatorCells = columnWidths.map((width) => '-'.repeat(width + 2));
      formattedRows.push(pc.gray(`|${separatorCells.join('|')}|`));
    } else {
      // Format data row
      const cells = columnWidths.map((width, j) => {
        const cell = row[j] ?? '';
        const padded = ` ${cell.padEnd(width)} `;
        return isHeader ? pc.bold(padded) : formatInline(padded);
      });
      formattedRows.push(`${pc.gray('|')}${cells.join(pc.gray('|'))}${pc.gray('|')}`);
    }
  }

  return formattedRows.join('\n') + '\n';
}

/**
 * Format a list.
 */
function formatList(content: string): string {
  const lines = content.split('\n');
  const formattedLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Check for unordered list item
    const unorderedMatch = /^(\s*)([-*])\s+(.+)$/.exec(line);
    if (unorderedMatch?.[1] !== undefined && unorderedMatch[3] !== undefined) {
      const indent = unorderedMatch[1];
      const text = unorderedMatch[3];
      formattedLines.push(`${indent}${pc.cyan('\u2022')} ${formatInline(text)}`);
      continue;
    }

    // Check for ordered list item
    const orderedMatch = /^(\s*)(\d+)\.\s+(.+)$/.exec(line);
    if (
      orderedMatch?.[1] !== undefined &&
      orderedMatch[2] !== undefined &&
      orderedMatch[3] !== undefined
    ) {
      const indent = orderedMatch[1];
      const num = orderedMatch[2];
      const text = orderedMatch[3];
      formattedLines.push(`${indent}${pc.cyan(num + '.')} ${formatInline(text)}`);
      continue;
    }

    // Continuation line (indented text)
    formattedLines.push(formatInline(line));
  }

  return formattedLines.join('\n') + '\n';
}

/**
 * Format a blockquote.
 */
function formatBlockquote(content: string): string {
  const lines = content.split('\n');
  const formattedLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Remove > prefix and format
    const match = /^>\s?(.*)/.exec(line);
    if (match?.[1] !== undefined) {
      const text = match[1];
      formattedLines.push(`${pc.gray('\u2502')} ${pc.italic(pc.dim(formatInline(text)))}`);
    } else {
      formattedLines.push(formatInline(line));
    }
  }

  return formattedLines.join('\n') + '\n';
}

/**
 * Format a paragraph.
 */
function formatParagraph(content: string): string {
  // Apply inline formatting to the paragraph
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return '\n';
  }

  return formatInline(trimmed) + '\n\n';
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
