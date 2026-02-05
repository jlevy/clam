/**
 * Trigger detection for completion system.
 *
 * Detects special characters that should immediately trigger completion:
 * - @ for entity references (files, URLs, etc.)
 * - / at start for slash commands
 * - First token position for command completion
 */

import type { InputState } from '../input/state.js';

/**
 * Types of triggers that can activate completion.
 */
export enum TriggerType {
  /** No trigger detected */
  None = 'none',
  /** @ entity trigger for file/URL references */
  Entity = 'entity',
  /** / slash command trigger */
  SlashCommand = 'slash',
  /** Command name completion (first token) */
  Command = 'command',
}

/**
 * Result of trigger detection.
 */
export interface TriggerResult {
  /** Whether a trigger was detected */
  triggered: boolean;
  /** Type of trigger detected */
  type: TriggerType;
  /** Position of trigger character in input */
  position: number;
  /** Prefix after trigger character (e.g., "file" in "@file") */
  prefix: string;
}

/**
 * Check if a position is inside a quoted string.
 */
function isInsideQuotes(text: string, position: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < position; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';

    // Skip escaped quotes
    if (prevChar === '\\') {
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
  }

  return inSingleQuote || inDoubleQuote;
}

/**
 * Check if character at position is preceded by whitespace or is at start.
 */
function isPrecededByWhitespaceOrStart(text: string, position: number): boolean {
  if (position === 0) {
    return true;
  }
  const prevChar = text[position - 1];
  return prevChar === ' ' || prevChar === '\t' || prevChar === '\n';
}

/**
 * Find the @ trigger position near cursor.
 * Returns -1 if no valid @ trigger found.
 */
function findEntityTriggerPosition(text: string, cursorPos: number): number {
  // Look backwards from cursor to find @
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i];

    // Found @
    if (char === '@') {
      // Check if it's a valid trigger position (preceded by whitespace or start)
      if (isPrecededByWhitespaceOrStart(text, i)) {
        // Check not inside quotes
        if (!isInsideQuotes(text, i)) {
          return i;
        }
      }
      // Found @ but it's not a valid trigger (e.g., email)
      return -1;
    }

    // Stop if we hit whitespace (no @ found before whitespace)
    if (char === ' ' || char === '\t' || char === '\n') {
      break;
    }
  }

  return -1;
}

/**
 * Extract prefix after a trigger position.
 */
function extractPrefix(text: string, triggerPos: number, cursorPos: number): string {
  // Prefix is everything between trigger+1 and cursor
  return text.slice(triggerPos + 1, cursorPos);
}

/**
 * Check if input starts with / for slash command.
 */
function detectSlashCommand(state: InputState): TriggerResult | null {
  const { rawText, cursorPos } = state;

  // Must start with /
  if (!rawText.startsWith('/')) {
    return null;
  }

  // Cursor must be within the slash command (first token)
  // Find end of first token
  let endOfFirstToken = rawText.length;
  for (let i = 1; i < rawText.length; i++) {
    if (rawText[i] === ' ' || rawText[i] === '\t') {
      endOfFirstToken = i;
      break;
    }
  }

  // Cursor must be within first token
  if (cursorPos > endOfFirstToken) {
    return null;
  }

  return {
    triggered: true,
    type: TriggerType.SlashCommand,
    position: 0,
    prefix: rawText.slice(1, cursorPos),
  };
}

/**
 * Check if cursor is at command position (first token).
 */
function detectCommandTrigger(state: InputState): TriggerResult | null {
  const { rawText, cursorPos, mode } = state;

  // Command completion only in shell mode
  if (mode !== 'shell') {
    return null;
  }

  // Empty input - command position
  if (rawText.length === 0) {
    return {
      triggered: true,
      type: TriggerType.Command,
      position: 0,
      prefix: '',
    };
  }

  // Find first non-whitespace character
  let firstNonWhitespace = 0;
  while (firstNonWhitespace < rawText.length && /\s/.test(rawText[firstNonWhitespace] ?? '')) {
    firstNonWhitespace++;
  }

  // Find end of first token
  let endOfFirstToken = firstNonWhitespace;
  while (endOfFirstToken < rawText.length && !/\s/.test(rawText[endOfFirstToken] ?? '')) {
    endOfFirstToken++;
  }

  // Check if cursor is within first token
  if (cursorPos >= firstNonWhitespace && cursorPos <= endOfFirstToken) {
    // Check if first token starts with / (that's a slash command, not a regular command)
    if (rawText[firstNonWhitespace] === '/') {
      return null;
    }

    return {
      triggered: true,
      type: TriggerType.Command,
      position: firstNonWhitespace,
      prefix: rawText.slice(firstNonWhitespace, cursorPos),
    };
  }

  return null;
}

/**
 * Check if cursor is in argument position (after first token).
 * In this position, Tab should trigger file/entity completion.
 * Only triggers when cursor is at the end of a word (not in the middle).
 */
function detectArgumentTrigger(state: InputState): TriggerResult | null {
  const { rawText, cursorPos, mode } = state;

  // Argument completion only in shell mode
  if (mode !== 'shell') {
    return null;
  }

  // Need at least some content
  if (rawText.length === 0) {
    return null;
  }

  // Find first non-whitespace character
  let firstNonWhitespace = 0;
  while (firstNonWhitespace < rawText.length && /\s/.test(rawText[firstNonWhitespace] ?? '')) {
    firstNonWhitespace++;
  }

  // Find end of first token (the command)
  let endOfFirstToken = firstNonWhitespace;
  while (endOfFirstToken < rawText.length && !/\s/.test(rawText[endOfFirstToken] ?? '')) {
    endOfFirstToken++;
  }

  // Cursor must be AFTER the first token (in argument position)
  if (cursorPos <= endOfFirstToken) {
    return null;
  }

  // Cursor must be at the end of a word or in whitespace (not in the middle of a word)
  // This prevents triggering when cursor is inside "hello" in "echo hello @"
  const charAfterCursor = rawText[cursorPos];
  if (charAfterCursor && !/\s/.test(charAfterCursor)) {
    // There's a non-whitespace char after cursor, meaning cursor is in middle of a word
    return null;
  }

  // Find the start of the current argument (word being typed)
  let argStart = cursorPos;
  while (argStart > endOfFirstToken && !/\s/.test(rawText[argStart - 1] ?? '')) {
    argStart--;
  }

  // Extract the prefix being typed
  const prefix = rawText.slice(argStart, cursorPos);

  return {
    triggered: true,
    type: TriggerType.Entity,
    position: argStart,
    prefix,
  };
}

/**
 * Detect if input should trigger completion.
 *
 * Priority:
 * 1. @ entity trigger (anywhere valid)
 * 2. / slash command (at start)
 * 3. Command completion (first token in shell mode)
 * 4. Argument/file completion (after first token in shell mode)
 */
export function detectTrigger(state: InputState): TriggerResult {
  const { rawText, cursorPos } = state;

  // 1. Check for @ entity trigger
  const entityPos = findEntityTriggerPosition(rawText, cursorPos);
  if (entityPos !== -1) {
    return {
      triggered: true,
      type: TriggerType.Entity,
      position: entityPos,
      prefix: extractPrefix(rawText, entityPos, cursorPos),
    };
  }

  // 2. Check for / slash command trigger
  const slashResult = detectSlashCommand(state);
  if (slashResult) {
    return slashResult;
  }

  // 3. Check for command trigger (first token)
  const commandResult = detectCommandTrigger(state);
  if (commandResult) {
    return commandResult;
  }

  // 4. Check for argument trigger (after command, for file completion)
  const argumentResult = detectArgumentTrigger(state);
  if (argumentResult) {
    return argumentResult;
  }

  // No trigger
  return {
    triggered: false,
    type: TriggerType.None,
    position: -1,
    prefix: '',
  };
}
