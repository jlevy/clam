/**
 * InputState - The central data model for the input system.
 *
 * InputState is the single source of truth for the current input. It's updated by
 * keystrokes and drives both rendering and completion.
 *
 * Updated by: Keystroke handler (updateInputState)
 * Used by: InputRenderer (for coloring), CompletionManager (for completers)
 *
 * This follows the pattern used by xonsh's CompletionContext, which provides
 * parsed command structure and cursor position to all completers.
 */
export interface InputState {
  // === Raw Input ===

  /** The complete raw input text */
  rawText: string;

  /** Cursor position (0 = before first char) */
  cursorPos: number;

  /** Text before the cursor */
  textBeforeCursor: string;

  /** Text after the cursor */
  textAfterCursor: string;

  // === Parsed Structure ===

  /** Tokenized input (command + arguments) */
  tokens: Token[];

  /** Index of the token containing the cursor (0 = command position) */
  tokenIndex: number;

  /** The token currently being edited (at cursor) */
  currentToken: Token | null;

  /** The prefix being typed (current token text before cursor) */
  prefix: string;

  // === Mode Detection ===

  /** Current input mode */
  mode: InputMode;

  /** True if current token starts with @ (entity reference) */
  isEntityTrigger: boolean;

  /** True if input starts with / (slash command) */
  isSlashCommand: boolean;

  /** True if input looks like natural language (not a command) */
  isNaturalLanguage: boolean;

  // === Environment ===

  /** Current working directory */
  cwd: string;

  /** Recent command history (for recency scoring) */
  history: HistoryEntry[];
}

/** Input mode determines how the input is interpreted */
export type InputMode = 'shell' | 'nl' | 'slash';

/**
 * A parsed token from the input text.
 *
 * Tokens represent meaningful units of input (commands, arguments, options, etc.)
 * and are used for both syntax highlighting and completion context.
 */
export interface Token {
  /** Token type for rendering */
  type: TokenType;

  /** Token text */
  value: string;

  /** Start position in rawText */
  start: number;

  /** End position in rawText */
  end: number;
}

/** Token types for syntax highlighting and completion context */
export type TokenType =
  | 'command' // First token (the command)
  | 'argument' // Regular argument
  | 'option' // Starts with - or --
  | 'entity' // Starts with @
  | 'path' // Looks like a file path
  | 'string' // Quoted string
  | 'operator' // |, >, >>, etc.
  | 'whitespace'; // Spaces between tokens

/** A command history entry for recency scoring */
export interface HistoryEntry {
  command: string;
  timestamp: Date;
}

/**
 * Create a new InputState with default values.
 */
export function createInputState(
  rawText: string,
  cursorPos: number,
  mode: InputMode,
  cwd: string,
  history: HistoryEntry[] = []
): InputState {
  return {
    rawText,
    cursorPos,
    textBeforeCursor: rawText.slice(0, cursorPos),
    textAfterCursor: rawText.slice(cursorPos),
    tokens: [],
    tokenIndex: 0,
    currentToken: null,
    prefix: '',
    mode,
    isEntityTrigger: false,
    isSlashCommand: rawText.startsWith('/'),
    isNaturalLanguage: false,
    cwd,
    history,
  };
}
