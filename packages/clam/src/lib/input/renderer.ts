/**
 * Input Renderer - Syntax coloring for shell input.
 *
 * Uses the tokenized InputState to apply ANSI colors to different
 * parts of the input: commands, options, paths, strings, etc.
 *
 * Color scheme follows common shell conventions:
 * - Commands: bold
 * - Options: cyan (like flags)
 * - Paths: underline (like URLs)
 * - Entities: magenta (special)
 * - Operators: yellow (like separators)
 * - Strings: green (like string literals)
 */

import pc from 'picocolors';
import type { InputState, TokenType } from './state.js';

/**
 * Color function type (from picocolors).
 */
type ColorFn = (text: string) => string;

/**
 * Identity function for whitespace (no coloring).
 */
const identity: ColorFn = (text: string) => text;

/**
 * Color mapping for each token type.
 */
export const TOKEN_COLORS: Record<TokenType, ColorFn> = {
  command: pc.bold,
  option: pc.cyan,
  argument: identity, // Default text color
  path: pc.underline,
  entity: pc.magenta,
  operator: pc.yellow,
  string: pc.green,
  whitespace: identity,
};

/**
 * Get the color function for a token type.
 */
export function getTokenColor(type: TokenType): ColorFn {
  return TOKEN_COLORS[type];
}

/**
 * Render input with syntax coloring.
 *
 * Takes a tokenized InputState and returns a colored string
 * suitable for terminal display.
 *
 * @param state - InputState with tokens populated
 * @returns Colored string
 */
export function renderInput(state: InputState): string {
  if (state.tokens.length === 0) {
    return state.rawText;
  }

  // Build colored output from tokens
  const parts: string[] = [];

  for (const token of state.tokens) {
    const colorFn = getTokenColor(token.type);
    parts.push(colorFn(token.value));
  }

  return parts.join('');
}
