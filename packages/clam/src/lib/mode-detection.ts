/**
 * Mode Detection - Input mode detection for clam.
 *
 * This module handles:
 * - Detecting whether input is shell, natural language, or slash command
 * - Sync detection for real-time coloring
 * - Async detection with which lookup for accuracy
 *
 * All detection heuristics are consolidated in DETECTION_HEURISTICS below.
 */

import { isShellBuiltin, type ShellModule } from './shell.js';

/**
 * Input mode types.
 */
export type InputMode = 'shell' | 'nl' | 'slash';

/**
 * Mode detector interface.
 */
export interface ModeDetector {
  /** Detect mode synchronously (for real-time coloring) */
  detectModeSync(input: string): InputMode;

  /** Detect mode asynchronously (with which lookup for accuracy) */
  detectMode(input: string): Promise<InputMode>;
}

/**
 * Options for creating a mode detector.
 */
export interface ModeDetectorOptions {
  /** Shell module for command lookups */
  shell: ShellModule;

  /** Whether shell mode detection is enabled */
  enabled?: boolean;
}

// =============================================================================
// CONSOLIDATED DETECTION HEURISTICS
// =============================================================================
// All mode detection rules are defined here for easy adjustment and review.
// Rules are applied in priority order (first match wins).
// =============================================================================

/**
 * Known slash commands (local commands).
 * These are commands that clam handles directly, not shell commands.
 * Add new slash commands here when implementing them.
 */
export const KNOWN_SLASH_COMMANDS = new Set([
  'help',
  'quit',
  'exit',
  'clear',
  'status',
  'config',
  'history',
  'shell',
  'edit',
]);

/**
 * Shell operators and syntax that definitively indicate shell mode.
 * Pattern matches: | > < ; && || $( `
 */
const SHELL_OPERATORS = /[|><;]|&&|\|\||\$\(|`/;

/**
 * Pattern for command-like first words (alphanumeric, dash, underscore).
 * Used as a heuristic guess before async validation.
 */
const COMMAND_LIKE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Pattern for absolute paths (starts with / and has multiple path segments).
 * Used to detect /bin/ls, /usr/bin/grep, etc.
 * Must have at least one internal slash (e.g., /bin/ls not /command)
 */
const ABSOLUTE_PATH_PATTERN = /^\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._/-]+$/;

/**
 * Ambiguous commands that look like natural language but are valid shell commands.
 * If these appear alone without arguments, they're ambiguous.
 * With additional NL-looking words, they're treated as natural language.
 */
const AMBIGUOUS_COMMANDS = new Set([
  'yes', // Unix command, but also just "yes"
  'no', // Not a command, but pattern
  'ok', // Not a command, but pattern
  'sure', // Not a command
  'true', // Shell builtin
  'false', // Shell builtin
  'test', // Shell builtin, but also "test this"
  'time', // Shell command, but also "time to..."
  'help', // Common word
  'man', // Manual command, but also "man this is..."
  'make', // Build tool, but also "make this..."
  'watch', // Command, but also "watch out..."
  'wait', // Shell builtin, but also "wait a moment"
  'read', // Shell builtin, but also "read this"
  'let', // Shell keyword, but also "let me..."
  'type', // Shell builtin, but also "type of..."
  'set', // Shell builtin, but also "set this up"
]);

/**
 * Common natural language words that are never shell commands.
 * If ALL words in input are from this set, it's definitely NL.
 */
const NL_ONLY_WORDS = new Set([
  // Responses
  'yes',
  'no',
  'ok',
  'okay',
  'sure',
  'thanks',
  'thank',
  'you',
  'please',
  'hi',
  'hello',
  'hey',
  'bye',
  'goodbye',
  // Common words
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'through',
  'about',
  'that',
  'this',
  'it',
  'what',
  'which',
  'who',
  'how',
  'why',
  'when',
  'where',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'and',
  'or',
  'but',
  'if',
  'then',
  'else',
  'so',
  'not',
  'all',
  'some',
  'any',
  'each',
  'every',
  'both',
  'more',
  'most',
  'other',
  'just',
  'only',
  'also',
  'very',
  'really',
  'now',
  'here',
  'there',
  'up',
  'out',
  'new',
  'good',
  'great',
  'well',
  'thing',
  'things',
  'like',
  'want',
  'need',
  'know',
  'think',
  'see',
  'get',
  'go',
  'come',
  'say',
  'make',
  'take',
  'give',
  'use',
  'find',
  'tell',
  'work',
  'try',
  'ask',
  'seem',
  'feel',
  'look',
  'even',
  'much',
  'back',
  'still',
  'after',
  'again',
  'never',
  'always',
  'often',
  'before',
]);

/**
 * Check if all words in input are natural language words.
 */
function isAllNaturalLanguageWords(trimmed: string): boolean {
  const words = trimmed.toLowerCase().split(/\s+/);
  return words.length > 0 && words.every((w) => NL_ONLY_WORDS.has(w));
}

/**
 * Detection heuristics applied in priority order.
 * Each rule returns a mode or null to continue to next rule.
 */
const DETECTION_RULES: {
  name: string;
  test: (input: string, trimmed: string, firstWord: string) => InputMode | null;
  definitive: boolean; // If true, no async validation needed
}[] = [
  {
    name: 'empty',
    test: (_input, trimmed) => (!trimmed ? 'nl' : null),
    definitive: true,
  },
  {
    name: 'explicit-nl',
    // ? prefix forces natural language mode (safety escape)
    test: (_input, trimmed) => (trimmed.startsWith('?') ? 'nl' : null),
    definitive: true,
  },
  {
    name: 'explicit-shell',
    // ! prefix forces shell mode
    test: (_input, trimmed) => (trimmed.startsWith('!') ? 'shell' : null),
    definitive: true,
  },
  {
    name: 'space-at-start',
    test: (input) => (input.startsWith(' ') ? 'nl' : null),
    definitive: true,
  },
  {
    name: 'known-slash-command',
    test: (_input, trimmed) => {
      if (!trimmed.startsWith('/')) return null;
      // Extract command name: /help → help, /config foo → config
      const afterSlash = trimmed.slice(1).split(/\s+/)[0] ?? '';
      return KNOWN_SLASH_COMMANDS.has(afterSlash) ? 'slash' : null;
    },
    definitive: true,
  },
  {
    name: 'absolute-path',
    test: (_input, trimmed, firstWord) => {
      // /bin/ls, /usr/bin/grep, etc. - treat as shell (will be validated by which)
      if (trimmed.startsWith('/') && ABSOLUTE_PATH_PATTERN.test(firstWord)) {
        return 'shell';
      }
      return null;
    },
    definitive: false, // Needs async validation via which
  },
  {
    name: 'unknown-slash',
    test: (_input, trimmed) => {
      // Anything else starting with / that we don't recognize
      // Could be a typo like /hepl or an unknown slash command
      // Treat as slash so it shows an error rather than being sent to shell
      if (trimmed.startsWith('/')) return 'slash';
      return null;
    },
    definitive: true,
  },
  {
    name: 'shell-operators',
    test: (_input, trimmed) => (SHELL_OPERATORS.test(trimmed) ? 'shell' : null),
    definitive: true,
  },
  {
    name: 'env-variables',
    test: (_input, trimmed) => (trimmed.includes('$') ? 'shell' : null),
    definitive: true,
  },
  {
    name: 'shell-builtin',
    test: (_input, _trimmed, firstWord) => (isShellBuiltin(firstWord) ? 'shell' : null),
    definitive: true,
  },
  {
    name: 'all-nl-words',
    // If every word is a common natural language word, it's definitely NL
    // e.g., "yes please", "ok thanks", "sure thing"
    test: (_input, trimmed) => (isAllNaturalLanguageWords(trimmed) ? 'nl' : null),
    definitive: true,
  },
  {
    name: 'ambiguous-command-with-nl',
    // Ambiguous commands like "yes" or "test" followed by NL words → NL
    // e.g., "yes please" → NL, "test this out" → NL
    test: (_input, trimmed, firstWord) => {
      if (!AMBIGUOUS_COMMANDS.has(firstWord.toLowerCase())) return null;
      const words = trimmed.split(/\s+/);
      if (words.length === 1) {
        // Single ambiguous word - treat as NL for safety
        // User can use ! prefix to force shell
        return 'nl';
      }
      // Multiple words with ambiguous first word - check if rest looks like NL
      const restWords = words.slice(1);
      const restLooksLikeNL = restWords.some((w) => NL_ONLY_WORDS.has(w.toLowerCase()));
      return restLooksLikeNL ? 'nl' : null;
    },
    definitive: true,
  },
  {
    name: 'command-like',
    test: (_input, _trimmed, firstWord) => (COMMAND_LIKE_PATTERN.test(firstWord) ? 'shell' : null),
    definitive: false, // Tentative - needs async which validation
  },
  {
    name: 'fallback-nl',
    test: () => 'nl',
    definitive: true,
  },
];

/**
 * Apply detection rules and return mode with metadata.
 */
function applyRules(input: string): { mode: InputMode; definitive: boolean; rule: string } {
  const trimmed = input.trim();
  const firstWord = trimmed.split(/\s+/)[0] ?? '';

  for (const rule of DETECTION_RULES) {
    const result = rule.test(input, trimmed, firstWord);
    if (result !== null) {
      return { mode: result, definitive: rule.definitive, rule: rule.name };
    }
  }

  // Should never reach here due to fallback rule
  return { mode: 'nl', definitive: true, rule: 'unreachable' };
}

/**
 * Create a mode detector instance.
 */
export function createModeDetector(options: ModeDetectorOptions): ModeDetector {
  const { shell, enabled = true } = options;

  function detectModeSync(input: string): InputMode {
    // If disabled, always return natural language
    if (!enabled) return 'nl';

    const { mode } = applyRules(input);
    return mode;
  }

  async function detectMode(input: string): Promise<InputMode> {
    // If disabled, always return natural language
    if (!enabled) return 'nl';

    const { mode, definitive } = applyRules(input);

    // If detection is definitive, return immediately
    if (definitive) return mode;

    // Non-definitive detection (command-like or absolute-path) needs which validation
    if (mode === 'shell') {
      const trimmed = input.trim();
      const firstWord = trimmed.split(/\s+/)[0] ?? '';
      const isCmd = await shell.isCommand(firstWord);
      return isCmd ? 'shell' : 'nl';
    }

    return mode;
  }

  return {
    detectModeSync,
    detectMode,
  };
}

/**
 * Check if input contains shell operators.
 */
export function hasShellOperators(input: string): boolean {
  return SHELL_OPERATORS.test(input);
}

/**
 * Check if input is an explicit shell trigger (starts with !).
 */
export function isExplicitShell(input: string): boolean {
  return input.trim().startsWith('!');
}

/**
 * Check if input is an explicit NL trigger (starts with ?).
 */
export function isExplicitNL(input: string): boolean {
  return input.trim().startsWith('?');
}

/**
 * Strip explicit shell trigger from input.
 */
export function stripShellTrigger(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('!')) {
    return trimmed.slice(1);
  }
  return input;
}

/**
 * Strip explicit NL trigger from input.
 */
export function stripNLTrigger(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('?')) {
    return trimmed.slice(1);
  }
  return input;
}
