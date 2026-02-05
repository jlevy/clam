/**
 * Block detector for streaming markdown.
 *
 * Detects block types and their boundaries as text streams in.
 * Implements a simple state machine to track context.
 */

import type { BlockBoundary, BlockState, BlockType } from './types.js';

/**
 * Regex patterns for block detection.
 */
const PATTERNS = {
  // Headers: # through ######
  header: /^#{1,6}\s+.+$/m,

  // Code fence: ``` optionally followed by language
  codeFenceStart: /^```(\w*)\s*$/m,
  codeFenceEnd: /^```\s*$/m,

  // Table row: | cell | cell |
  tableRow: /^\|.+\|$/m,
  // Table separator: |---|---|
  tableSeparator: /^\|[\s:-]+\|$/m,

  // Unordered list item: - item or * item
  unorderedListItem: /^[-*]\s+.+$/m,

  // Ordered list item: 1. item, 2. item, etc.
  orderedListItem: /^\d+\.\s+.+$/m,

  // Blockquote: > text
  blockquote: /^>\s*.*/m,
};

/**
 * Create a block detector instance.
 */
export function createBlockDetector() {
  let state: BlockState = 'normal';
  let codeLanguage = '';
  let listType: 'ordered' | 'unordered' | null = null;

  return {
    /**
     * Get the current block state.
     */
    getState(): BlockState {
      return state;
    },

    /**
     * Get the current code language (if in code fence).
     */
    getCodeLanguage(): string {
      return codeLanguage;
    },

    /**
     * Get the current list type (if in list).
     */
    getListType(): 'ordered' | 'unordered' | null {
      return listType;
    },

    /**
     * Reset the detector state.
     */
    reset(): void {
      state = 'normal';
      codeLanguage = '';
      listType = null;
    },

    /**
     * Detect the type of block starting at the beginning of the text.
     */
    detectBlockType(text: string): BlockType | null {
      const trimmed = text.trimStart();

      // Check for code fence
      const codeFenceMatch = PATTERNS.codeFenceStart.exec(trimmed);
      if (codeFenceMatch) {
        return 'code_fence';
      }

      // Check for header
      if (PATTERNS.header.test(trimmed)) {
        return 'header';
      }

      // Check for table (must have | at start and end)
      const firstTrimmedLine = trimmed.split('\n')[0] ?? '';
      if (PATTERNS.tableRow.test(firstTrimmedLine)) {
        return 'table';
      }

      // Check for unordered list
      if (PATTERNS.unorderedListItem.test(trimmed)) {
        return 'list';
      }

      // Check for ordered list
      if (PATTERNS.orderedListItem.test(trimmed)) {
        return 'list';
      }

      // Check for blockquote
      if (PATTERNS.blockquote.test(trimmed)) {
        return 'blockquote';
      }

      // Default to paragraph
      if (trimmed.length > 0) {
        return 'paragraph';
      }

      return null;
    },

    /**
     * Find the next block boundary in the buffer.
     *
     * Returns null if no complete block is detected yet.
     */
    findBoundary(buffer: string): BlockBoundary | null {
      // Handle different states
      switch (state) {
        case 'in_code_fence':
          return findCodeFenceEnd(buffer, codeLanguage);

        case 'in_table':
          return findTableEnd(buffer);

        case 'in_list':
          return findListEnd(buffer, listType!);

        case 'in_blockquote':
          return findBlockquoteEnd(buffer);

        case 'normal':
        default:
          return findNormalBlockEnd(buffer, this);
      }
    },

    /**
     * Update state when entering a new block type.
     */
    enterBlock(type: BlockType, language?: string): void {
      switch (type) {
        case 'code_fence':
          state = 'in_code_fence';
          codeLanguage = language ?? '';
          break;
        case 'table':
          state = 'in_table';
          break;
        case 'list':
          state = 'in_list';
          break;
        case 'blockquote':
          state = 'in_blockquote';
          break;
        default:
          state = 'normal';
      }
    },

    /**
     * Update state when exiting a block.
     */
    exitBlock(): void {
      state = 'normal';
      codeLanguage = '';
      listType = null;
    },

    /**
     * Set the list type for list detection.
     */
    setListType(type: 'ordered' | 'unordered'): void {
      listType = type;
    },
  };
}

/**
 * Find the end of a code fence block.
 */
function findCodeFenceEnd(buffer: string, language: string): BlockBoundary | null {
  // Look for closing ``` on its own line
  // Skip the opening fence (first line)
  const lines = buffer.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line?.trim() === '```') {
      // Found closing fence - include it in the boundary
      const index = lines.slice(0, i + 1).join('\n').length + 1; // +1 for trailing newline
      return {
        index: Math.min(index, buffer.length),
        type: 'code_fence',
        language,
      };
    }
  }
  return null;
}

/**
 * Find the end of a table block.
 */
function findTableEnd(buffer: string): BlockBoundary | null {
  // Table ends with a blank line or non-table line
  const lines = buffer.split('\n');
  let lastTableLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    // Check if it's a table row or separator
    if (PATTERNS.tableRow.test(line) || PATTERNS.tableSeparator.test(line)) {
      lastTableLine = i;
    } else if (line.trim() === '' && lastTableLine >= 0) {
      // Blank line after table content - table is complete
      const index = lines.slice(0, lastTableLine + 1).join('\n').length + 1;
      return {
        index: Math.min(index, buffer.length),
        type: 'table',
      };
    } else if (line.trim() !== '' && lastTableLine >= 0) {
      // Non-table, non-blank line - table is complete
      const index = lines.slice(0, lastTableLine + 1).join('\n').length + 1;
      return {
        index: Math.min(index, buffer.length),
        type: 'table',
      };
    }
  }

  return null;
}

/**
 * Find the end of a list block.
 */
function findListEnd(buffer: string, type: 'ordered' | 'unordered'): BlockBoundary | null {
  const listPattern = type === 'ordered' ? PATTERNS.orderedListItem : PATTERNS.unorderedListItem;
  const lines = buffer.split('\n');
  let lastListLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    // Check if it's a list item or continuation (indented)
    if (listPattern.test(line) || (lastListLine >= 0 && (/^\s+\S/.exec(line)))) {
      lastListLine = i;
    } else if (line.trim() === '' && lastListLine >= 0) {
      // Blank line after list - list is complete
      const index = lines.slice(0, lastListLine + 1).join('\n').length + 1;
      return {
        index: Math.min(index, buffer.length),
        type: 'list',
      };
    } else if (line.trim() !== '' && lastListLine >= 0 && !listPattern.test(line)) {
      // Non-list, non-blank line - list is complete
      const index = lines.slice(0, lastListLine + 1).join('\n').length + 1;
      return {
        index: Math.min(index, buffer.length),
        type: 'list',
      };
    }
  }

  return null;
}

/**
 * Find the end of a blockquote.
 */
function findBlockquoteEnd(buffer: string): BlockBoundary | null {
  const lines = buffer.split('\n');
  let lastQuoteLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (PATTERNS.blockquote.test(line)) {
      lastQuoteLine = i;
    } else if (line.trim() === '' && lastQuoteLine >= 0) {
      // Blank line after blockquote - complete
      const index = lines.slice(0, lastQuoteLine + 1).join('\n').length + 1;
      return {
        index: Math.min(index, buffer.length),
        type: 'blockquote',
      };
    } else if (line.trim() !== '' && lastQuoteLine >= 0) {
      // Non-quote, non-blank line - blockquote is complete
      const index = lines.slice(0, lastQuoteLine + 1).join('\n').length + 1;
      return {
        index: Math.min(index, buffer.length),
        type: 'blockquote',
      };
    }
  }

  return null;
}

/**
 * Find block end in normal state (not inside a special block).
 */
function findNormalBlockEnd(
  buffer: string,
  detector: ReturnType<typeof createBlockDetector>
): BlockBoundary | null {
  const lines = buffer.split('\n');

  // Check for code fence start
  const firstLine = lines[0] ?? '';
  const codeFenceMatch = PATTERNS.codeFenceStart.exec(firstLine);
  if (codeFenceMatch) {
    detector.enterBlock('code_fence', codeFenceMatch[1]);
    return detector.findBoundary(buffer);
  }

  // Check for header (single line, ends with newline)
  if (PATTERNS.header.test(firstLine) && lines.length > 1) {
    return {
      index: firstLine.length + 1,
      type: 'header',
    };
  }

  // Check for table
  if (PATTERNS.tableRow.test(firstLine)) {
    detector.enterBlock('table');
    return detector.findBoundary(buffer);
  }

  // Check for lists
  if (PATTERNS.unorderedListItem.test(firstLine)) {
    detector.enterBlock('list');
    detector.setListType('unordered');
    return detector.findBoundary(buffer);
  }
  if (PATTERNS.orderedListItem.test(firstLine)) {
    detector.enterBlock('list');
    detector.setListType('ordered');
    return detector.findBoundary(buffer);
  }

  // Check for blockquote
  if (PATTERNS.blockquote.test(firstLine)) {
    detector.enterBlock('blockquote');
    return detector.findBoundary(buffer);
  }

  // Paragraph: ends with double newline
  const doubleNewline = buffer.indexOf('\n\n');
  if (doubleNewline !== -1) {
    return {
      index: doubleNewline + 2,
      type: 'paragraph',
    };
  }

  return null;
}

export type BlockDetector = ReturnType<typeof createBlockDetector>;
