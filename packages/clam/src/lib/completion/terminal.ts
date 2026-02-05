/**
 * Terminal utilities for completion menu rendering.
 *
 * Provides ANSI escape sequences for:
 * - Cursor save/restore (prevents scrollback corruption)
 * - Cursor visibility control
 * - Line clearing
 * - Cursor movement
 *
 * Using these ensures the completion menu doesn't corrupt terminal scrollback
 * by properly managing cursor position during rendering.
 */

/**
 * ANSI escape sequence constants.
 */
export const ANSI = {
  /** Save cursor position */
  SAVE_CURSOR: '\x1b[s',
  /** Restore cursor position */
  RESTORE_CURSOR: '\x1b[u',
  /** Hide cursor */
  HIDE_CURSOR: '\x1b[?25l',
  /** Show cursor */
  SHOW_CURSOR: '\x1b[?25h',
  /** Clear entire line */
  CLEAR_LINE: '\x1b[2K',
  /** Clear from cursor to end of line */
  CLEAR_TO_END: '\x1b[K',
} as const;

/**
 * Save cursor position.
 */
export function saveCursor(): string {
  return ANSI.SAVE_CURSOR;
}

/**
 * Restore cursor position.
 */
export function restoreCursor(): string {
  return ANSI.RESTORE_CURSOR;
}

/**
 * Hide cursor (reduces flicker during updates).
 */
export function hideCursor(): string {
  return ANSI.HIDE_CURSOR;
}

/**
 * Show cursor.
 */
export function showCursor(): string {
  return ANSI.SHOW_CURSOR;
}

/**
 * Clear entire current line.
 */
export function clearLine(): string {
  return ANSI.CLEAR_LINE;
}

/**
 * Clear from cursor to end of line.
 */
export function clearToEndOfLine(): string {
  return ANSI.CLEAR_TO_END;
}

/**
 * Move cursor up n lines.
 */
export function moveUp(n: number): string {
  if (n <= 0) return '';
  return `\x1b[${n}A`;
}

/**
 * Move cursor down n lines.
 */
export function moveDown(n: number): string {
  if (n <= 0) return '';
  return `\x1b[${n}B`;
}

/**
 * Options for wrapping menu render.
 */
export interface WrapMenuOptions {
  /** Hide cursor during render to reduce flicker */
  hideCursorDuringRender?: boolean;
}

/**
 * Wrap menu content with cursor save/restore to prevent scrollback corruption.
 *
 * The wrapped output:
 * 1. Saves cursor position
 * 2. Optionally hides cursor
 * 3. Outputs menu content
 * 4. Optionally shows cursor
 * 5. Restores cursor position
 *
 * This ensures the terminal scrollback is not affected by the menu.
 *
 * @param content - The menu content to render
 * @param lineCount - Number of lines in the menu (for tracking)
 * @param options - Wrap options
 */
export function wrapMenuRender(
  content: string,
  lineCount: number,
  options: WrapMenuOptions = {}
): string {
  if (!content || lineCount === 0) {
    return '';
  }

  const { hideCursorDuringRender = false } = options;

  let output = saveCursor();

  if (hideCursorDuringRender) {
    output += hideCursor();
  }

  output += content;

  if (hideCursorDuringRender) {
    output += showCursor();
  }

  output += restoreCursor();

  return output;
}

/**
 * Generate sequence to clear a previously rendered menu.
 *
 * Moves up line by line, clearing each, then returns to original position.
 * Call this before rendering new content or when dismissing the menu.
 *
 * @param lineCount - Number of lines to clear
 */
export function clearMenu(lineCount: number): string {
  if (lineCount <= 0) {
    return '';
  }

  let output = '';

  // Clear each line by moving up and clearing
  for (let i = 0; i < lineCount; i++) {
    output += moveUp(1) + clearLine();
  }

  return output;
}
