/**
 * Token Parser - Tokenizes input text for completion and syntax highlighting.
 *
 * This parser breaks input into tokens (command, arguments, options, etc.)
 * and updates InputState with parsed structure and cursor context.
 */

import type { InputState, Token, TokenType } from './state.js';

/**
 * Shell operators that should be tokenized separately.
 */
const OPERATORS = ['|', '>', '>>', '<', '<<', '&&', '||', ';', '&'];

/**
 * Check if a character is whitespace.
 */
function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t';
}

/**
 * Check if a string looks like a file path.
 */
function isPath(value: string): boolean {
  return (
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.includes('/')
  );
}

/**
 * Determine the token type based on its value and position.
 */
function getTokenType(value: string, isFirst: boolean): TokenType {
  // Check for operators
  if (OPERATORS.includes(value)) {
    return 'operator';
  }

  // Check for options
  if (value.startsWith('-')) {
    return 'option';
  }

  // Check for entity references
  if (value.startsWith('@')) {
    return 'entity';
  }

  // Check for paths (but not if it's a command position for slash commands)
  if (isPath(value) && !isFirst) {
    return 'path';
  }

  // First non-whitespace token is the command
  if (isFirst) {
    return 'command';
  }

  // Default to argument
  return 'argument';
}

/**
 * Tokenize input text into an array of tokens.
 *
 * Handles:
 * - Whitespace separation
 * - Quoted strings (single and double quotes)
 * - Shell operators (|, >, etc.)
 * - Options (-f, --flag)
 * - Entity references (@file)
 * - File paths
 */
export function tokenize(input: string): Token[] {
  if (!input) {
    return [];
  }

  const tokens: Token[] = [];
  let pos = 0;
  let isFirstNonWhitespace = true;

  while (pos < input.length) {
    const char = input[pos];

    // Handle whitespace
    if (isWhitespace(char!)) {
      const start = pos;
      while (pos < input.length && isWhitespace(input[pos]!)) {
        pos++;
      }
      tokens.push({
        type: 'whitespace',
        value: input.slice(start, pos),
        start,
        end: pos,
      });
      continue;
    }

    // Handle quoted strings
    if (char === '"' || char === "'") {
      const quote = char;
      const start = pos;
      pos++; // Skip opening quote

      while (pos < input.length && input[pos] !== quote) {
        // Handle escape sequences
        if (input[pos] === '\\' && pos + 1 < input.length) {
          pos += 2;
        } else {
          pos++;
        }
      }

      if (pos < input.length) {
        pos++; // Skip closing quote
      }

      tokens.push({
        type: 'string',
        value: input.slice(start, pos),
        start,
        end: pos,
      });
      isFirstNonWhitespace = false;
      continue;
    }

    // Check for multi-character operators first
    let foundOperator = false;
    for (const op of OPERATORS) {
      if (input.slice(pos, pos + op.length) === op) {
        tokens.push({
          type: 'operator',
          value: op,
          start: pos,
          end: pos + op.length,
        });
        pos += op.length;
        foundOperator = true;
        // Reset first token flag after operators (next word is a new command)
        isFirstNonWhitespace = true;
        break;
      }
    }
    if (foundOperator) {
      continue;
    }

    // Handle regular words
    const start = pos;
    while (
      pos < input.length &&
      !isWhitespace(input[pos]!) &&
      input[pos] !== '"' &&
      input[pos] !== "'" &&
      !OPERATORS.some((op) => input.slice(pos, pos + op.length) === op)
    ) {
      pos++;
    }

    const value = input.slice(start, pos);
    if (value) {
      tokens.push({
        type: getTokenType(value, isFirstNonWhitespace),
        value,
        start,
        end: pos,
      });
      isFirstNonWhitespace = false;
    }
  }

  return tokens;
}

/**
 * Find the token index that contains the given cursor position.
 */
function findTokenIndex(tokens: Token[], cursorPos: number): number {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (cursorPos >= token.start && cursorPos <= token.end) {
      return i;
    }
  }

  // Cursor is past all tokens - return last token index or 0
  return Math.max(0, tokens.length - 1);
}

/**
 * Update an InputState with tokenized structure.
 *
 * This populates:
 * - tokens: The parsed token array
 * - tokenIndex: Index of token containing cursor
 * - currentToken: The token being edited
 * - prefix: Text before cursor in current token
 * - isEntityTrigger: Whether current token is an entity reference
 */
export function updateInputStateWithTokens(state: InputState): InputState {
  const tokens = tokenize(state.rawText);

  // Find which token contains the cursor
  const tokenIndex = tokens.length > 0 ? findTokenIndex(tokens, state.cursorPos) : 0;
  const currentToken = tokens[tokenIndex] ?? null;

  // Calculate prefix (text in current token before cursor)
  let prefix = '';
  if (currentToken && state.cursorPos >= currentToken.start) {
    prefix = currentToken.value.slice(0, state.cursorPos - currentToken.start);
  }

  // Detect entity trigger
  const isEntityTrigger = currentToken?.type === 'entity' || prefix.startsWith('@');

  return {
    ...state,
    tokens,
    tokenIndex,
    currentToken,
    prefix,
    isEntityTrigger,
  };
}
