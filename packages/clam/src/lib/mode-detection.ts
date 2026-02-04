/**
 * Mode Detection - Input mode detection for clam.
 *
 * DESIGN PHILOSOPHY:
 * We do NOT try to enumerate all of English. That's impossible and unnecessary.
 * Instead, we rely on two layers:
 *
 * 1. SYNC DETECTION (detectModeSync) - For real-time coloring UX
 *    - Definitive patterns: shell operators (|, >, &&), builtins (cd, export), $vars
 *    - Conflict words: AMBIGUOUS_COMMANDS (words that ARE shell commands AND English)
 *    - Common NL: NL_ONLY_WORDS (obvious NL phrases like "yes please")
 *    - Fallback: command-like pattern → tentatively shell
 *
 * 2. ASYNC DETECTION (detectMode) - For accuracy before execution
 *    - Uses `which` to verify if first word is actually a command
 *    - If `which` returns null → NL (not a command)
 *    - This catches everything sync detection misses
 *
 * MANAGING COMPLEXITY:
 * - Word lists are TEST-DRIVEN: add words only when tests require them
 * - Test cases live in mode-detection-cases.ts and mode-detection.test.ts
 * - When a phrase is misclassified, add a test case FIRST, then fix
 * - Some sync flicker is acceptable - async validation ensures correctness
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

// =============================================================================
// CONFLICT WORDS: Shell commands that are also common English words
// =============================================================================
//
// PHILOSOPHY: We do NOT try to enumerate all of English. That's impossible.
// Instead, we ONLY handle words that create ACTUAL CONFLICTS:
// - Words that ARE valid shell commands (verified by `which`)
// - AND are commonly used in natural language
//
// For everything else, async `which` validation handles it:
// - "hello" → `which hello` returns null → NL
// - "ls" → `which ls` returns path → shell
//
// The sync detection is just for real-time coloring. Some flicker is acceptable.
// Final mode is determined by async validation before execution.
// =============================================================================

/**
 * Words that are BOTH valid shell commands AND common English words.
 * These need special handling because `which` would find them.
 *
 * KEEP THIS LIST MINIMAL - only add words that:
 * 1. Actually exist as shell commands (test with `which <word>`)
 * 2. Are commonly used at the START of natural language sentences
 *
 * Do NOT add:
 * - Words that aren't shell commands (they'll be handled by `which` returning null)
 * - Rare English words (not worth the complexity)
 */
const AMBIGUOUS_COMMANDS = new Set([
  // Actual shell commands that conflict with English
  'yes', // /usr/bin/yes - also "yes" as a response
  'test', // Shell builtin - also "test this"
  'time', // /usr/bin/time - also "time to..."
  'man', // /usr/bin/man - also "man, this is..."
  'make', // /usr/bin/make - also "make this work"
  'watch', // /usr/bin/watch - also "watch out"
  'who', // /usr/bin/who - also "who is..."
  'date', // /usr/bin/date - also "date" as noun
  'which', // /usr/bin/which - also "which one"
  'where', // zsh builtin - also "where is"
  'what', // zsh alias sometimes - also "what is"

  // Shell builtins that conflict with English
  'true', // Shell builtin - also "true" as adjective
  'false', // Shell builtin - also "false" as adjective
  'wait', // Shell builtin - also "wait a moment"
  'read', // Shell builtin - also "read this"
  'let', // Shell keyword - also "let me..."
  'type', // Shell builtin - also "type of..."
  'set', // Shell builtin - also "set this up"
]);

// =============================================================================
// COMMON NL WORDS: For sync detection of obvious natural language
// =============================================================================
//
// PURPOSE: Improve real-time coloring UX for common phrases.
//
// HOW IT WORKS:
// - If ALL words in input are from this set → definitely NL
// - Used for phrases like "yes please", "ok thanks", "how are you"
// - Prevents flicker for obvious NL that would otherwise look command-like
//
// WHY NOT ENUMERATE ALL ENGLISH?
// - Impossible to be complete
// - Async `which` validation catches everything we miss
// - Sync detection is just for UX - final mode is async-validated
//
// WHAT TO ADD:
// - Only words needed to pass specific test cases
// - Common responses, greetings, question words, pronouns, auxiliaries
// - Do NOT add obscure words - let `which` handle them
// =============================================================================

/**
 * Words that are definitely NOT shell commands.
 * If ALL words in input are from this set, it's NL without needing `which`.
 *
 * This list should be TEST-DRIVEN: add words only when tests require them.
 */
const NL_ONLY_WORDS = new Set([
  // Common responses (tested: "yes please", "ok thanks")
  'yes',
  'no',
  'ok',
  'okay',
  'sure',
  'thanks',
  'please',

  // Greetings (tested: "hi", "hello")
  'hi',
  'hello',
  'hey',
  'bye',

  // Pronouns (needed for "can you...", "how do I...")
  'you',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'it',
  'this',
  'that',

  // Question words (tested: "what does this do", "how are you")
  'what',
  'how',
  'why',
  'when',
  'where',
  'which',
  'who',

  // Auxiliaries (needed for "can you help", "do you know")
  'do',
  'does',
  'did',
  'is',
  'are',
  'was',
  'were',
  'be',
  'have',
  'has',
  'had',
  'can',
  'could',
  'would',
  'will',
  'should',

  // Common prepositions/articles (needed for multi-word NL)
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',

  // Common verbs/words that appear in NL phrases
  'help',
  'give',
  'tell',
  'show',
  'know',
  'think',
  'want',
  'need',
  'about',
  'out',
  'up',
  'just',
  'more',
  'some',
  'all',
  'thing',
]);

/**
 * Strip trailing punctuation from a word for NL word matching.
 * Handles: . , ! ? ; : ' "
 */
function stripTrailingPunctuation(word: string): string {
  return word.replace(/[.,!?;:'"]+$/, '');
}

/**
 * Check if all words in input are natural language words.
 * Strips trailing punctuation to handle "do?" matching "do".
 */
function isAllNaturalLanguageWords(trimmed: string): boolean {
  const words = trimmed.toLowerCase().split(/\s+/);
  return words.length > 0 && words.every((w) => NL_ONLY_WORDS.has(stripTrailingPunctuation(w)));
}

/**
 * Question words at start of multi-word input → NL.
 * Note: "who", "which", "where", "what" are also shell commands on some systems,
 * but when followed by NL words they're clearly questions.
 * TEST-DRIVEN: only add words that tests require.
 */
const QUESTION_WORDS = new Set(['what', 'how', 'why', 'when', 'where', 'who', 'which']);

/**
 * Check if input looks like a natural language question.
 * e.g., "what does this do", "how do I list files"
 */
function looksLikeQuestion(trimmed: string, firstWord: string): boolean {
  const words = trimmed.split(/\s+/);
  // Must have multiple words and start with a question word
  if (words.length < 2) return false;
  if (!QUESTION_WORDS.has(firstWord.toLowerCase())) return false;
  // Check if any of the other words look like NL
  const restWords = words.slice(1);
  return restWords.some((w) => NL_ONLY_WORDS.has(stripTrailingPunctuation(w.toLowerCase())));
}

/**
 * Request patterns: modal verb + pronoun → NL.
 * "can you...", "could you...", "please help...", etc.
 * TEST-DRIVEN: only add patterns that tests require.
 */
const REQUEST_STARTERS = new Set(['can', 'could', 'would', 'will', 'should', 'please']);
const REQUEST_PRONOUNS = new Set(['you', 'we', 'i']);

/**
 * Check if input looks like a natural language request.
 * e.g., "can you give me an overview", "please help me", "could you explain"
 */
function looksLikeRequest(trimmed: string): boolean {
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length < 2) return false;

  const firstWord = words[0] ?? '';
  const secondWord = words[1] ?? '';

  // "can you...", "could you...", etc.
  if (REQUEST_STARTERS.has(firstWord) && REQUEST_PRONOUNS.has(secondWord)) {
    return true;
  }

  // "please ..." at the start
  if (firstWord === 'please' && words.length >= 2) {
    return true;
  }

  return false;
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
    name: 'question-sentence',
    // Questions starting with what/how/why/when/where/who followed by NL words
    // e.g., "what does this codebase do", "how do I list files"
    test: (_input, trimmed, firstWord) => (looksLikeQuestion(trimmed, firstWord) ? 'nl' : null),
    definitive: true,
  },
  {
    name: 'request-sentence',
    // Requests starting with modal verbs + pronouns
    // e.g., "can you give me an overview", "please help me", "could you explain"
    test: (_input, trimmed) => (looksLikeRequest(trimmed) ? 'nl' : null),
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
      const restLooksLikeNL = restWords.some((w) =>
        NL_ONLY_WORDS.has(stripTrailingPunctuation(w.toLowerCase()))
      );
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
