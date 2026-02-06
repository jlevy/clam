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
 *
 * - 'shell'     : Execute as shell command directly
 * - 'nl'        : Send to Claude as natural language
 * - 'slash'     : Handle as local slash command
 * - 'ambiguous' : Prompt user to confirm (could be shell or NL)
 * - 'nothing'   : Invalid input - show error, don't execute
 */
export type InputMode = 'shell' | 'nl' | 'slash' | 'ambiguous' | 'nothing';

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
/**
 * Words that return 'ambiguous' when used ALONE - prompt user to confirm.
 * These are common shell commands that users might actually want to run.
 */
const PROMPT_AMBIGUOUS_COMMANDS = new Set([
  'who', // /usr/bin/who - commonly run to see logged-in users
  'date', // /usr/bin/date - commonly run to see current date
  'time', // /usr/bin/time - commonly run to time commands
  'man', // /usr/bin/man - but also "man, this is..."
]);

/**
 * Words that return 'nl' when used ALONE for safety - unlikely to be intentional commands.
 * User can use ! prefix to force shell mode.
 */
const SAFE_NL_COMMANDS = new Set([
  'yes', // /usr/bin/yes - dangerous to run unintentionally (infinite output)
  'test', // Shell builtin - more commonly "test this" in NL
  'true', // Shell builtin - more commonly adjective
  'false', // Shell builtin - more commonly adjective
  'wait', // Shell builtin - more commonly "wait a moment"
  'read', // Shell builtin - more commonly "read this"
  'let', // Shell keyword - more commonly "let me..."
  'type', // Shell builtin - more commonly "type of..."
  'set', // Shell builtin - more commonly "set this up"
  'make', // /usr/bin/make - more commonly "make this work"
  'watch', // /usr/bin/watch - more commonly "watch out"
  'which', // /usr/bin/which - more commonly "which one"
  'where', // zsh builtin - more commonly "where is"
  'what', // zsh alias sometimes - more commonly "what is"
]);

/**
 * All ambiguous commands (union of both sets).
 */
const AMBIGUOUS_COMMANDS = new Set([...PROMPT_AMBIGUOUS_COMMANDS, ...SAFE_NL_COMMANDS]);

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
  'world', // "hello world" - classic test phrase
]);

/**
 * Strip trailing punctuation from a word for NL word matching.
 * Handles: . , ! ? ; : ' "
 */
function stripTrailingPunctuation(word: string): string {
  return word.replace(/[.,!?;:'"]+$/, '');
}

// =============================================================================
// STRUCTURAL NL DETECTION (ported from kash)
// =============================================================================
// Uses multi-factor heuristics to detect natural language without needing
// exhaustive word lists. This catches phrases like "add a file" that aren't
// in any word list but are structurally NL.
//
// Reference: repos/kash/src/kash/xonsh_custom/command_nl_utils.py
// =============================================================================

/** Pattern for text containing only word characters, spaces, and inner punctuation
 * Inner punctuation chars: hyphen, straight/curly apostrophes, en/em dash */
const ONLY_WORDS_RE = /^[\w\s\-'\u2019\u2018\u2013\u2014]*$/;

/** Outer punctuation: sentence-level, gets stripped for word analysis */
const OUTER_PUNCT_RE = /[.,'""\u201C\u201D\u2018\u2019:;!?()]/g;

/**
 * Strip all outer punctuation from text for word analysis.
 */
function stripAllPunct(text: string): string {
  return text.replace(OUTER_PUNCT_RE, '');
}

/**
 * Check if input looks like natural language based on structural heuristics.
 * Ported from kash's `looks_like_nl()` algorithm.
 *
 * Criteria:
 * 1. At least one word > 3 characters
 * 2. 3+ words (stricter than kash's 2-word relaxation to avoid false positives
 *    like "git status" which looks structurally similar to "hello world")
 * 3. Only word chars, spaces, and inner punctuation (no shell-like tokens)
 * 4. No words starting with - (flags like -f, --verbose)
 * 5. No words containing . (filenames like file.txt, path.js)
 * 6. No words containing = (assignments like FOO=bar)
 *
 * For 2-word phrases, existing detection rules (all-nl-words, question-sentence,
 * etc.) handle them. The structural check adds value for 3+ word phrases that
 * don't match existing word lists (e.g., "add a file", "fix this bug").
 */
function looksLikeNl(text: string): boolean {
  // Strip outer punctuation first (?, !, ., quotes, etc.)
  const withoutPunct = stripAllPunct(text);

  // After stripping outer punct, must be only word characters
  // (no shell operators, dots, equals, etc.)
  const isOnlyWordChars = ONLY_WORDS_RE.test(withoutPunct);
  if (!isOnlyWordChars) return false;

  const words = withoutPunct.split(/\s+/).filter((w) => w.length > 0);

  // Skip if any word looks like a flag (-f, --verbose)
  if (words.some((w) => w.startsWith('-'))) return false;

  const oneLongerWord = words.some((w) => w.length > 3);

  return oneLongerWord && words.length >= 3;
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
 * Note: "who", "which", "where" are also shell commands on some systems,
 * but when followed by any text they're clearly questions.
 * TEST-DRIVEN: only add words that tests require.
 */
const QUESTION_WORDS = new Set(['what', 'how', 'why', 'when', 'where', 'who', 'which']);

/**
 * Pure question words that are NEVER shell commands.
 * If these start a multi-word input, it's definitely NL.
 * Simpler rule: any text after these = NL (no need to check if rest are NL words).
 */
const PURE_QUESTION_WORDS = new Set(['what', 'how', 'why', 'when']);

/**
 * Check if input looks like a natural language question.
 * e.g., "what does this do", "how do I list files"
 *
 * Simplified rule for pure question words (what, how, why, when):
 * - These are NEVER shell commands
 * - Any text after them = definitely NL
 * - Handles partial typing like "how ar" → "how are you"
 *
 * For ambiguous question words (who, which, where):
 * - These ARE shell commands, so require rest to have NL words
 */
function looksLikeQuestion(trimmed: string, firstWord: string): boolean {
  const words = trimmed.split(/\s+/);
  // Must have multiple words and start with a question word
  if (words.length < 2) return false;

  const lowerFirst = firstWord.toLowerCase();
  if (!QUESTION_WORDS.has(lowerFirst)) return false;

  // Pure question words (never shell commands): any text after = NL
  // This handles partial typing like "how ar" → NL
  if (PURE_QUESTION_WORDS.has(lowerFirst)) {
    return true;
  }

  // Ambiguous question words (who, which, where are shell commands):
  // Require rest to have NL words to distinguish from shell usage
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
    // Has shell operators like |, >, &&, etc. - likely shell, but validate first word async
    test: (_input, trimmed) => (SHELL_OPERATORS.test(trimmed) ? 'shell' : null),
    definitive: false, // Validate first word is a real command
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
    name: 'single-prompt-ambiguous',
    // Single words like "who", "date", "time" - prompt user to confirm
    // Must come before all-nl-words since "who" is in NL_ONLY_WORDS
    test: (_input, trimmed, firstWord) => {
      const words = trimmed.split(/\s+/);
      if (words.length !== 1) return null;
      return PROMPT_AMBIGUOUS_COMMANDS.has(firstWord.toLowerCase()) ? 'ambiguous' : null;
    },
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
    // Single ambiguous commands → either 'ambiguous' (prompt) or 'nl' (safe default)
    test: (_input, trimmed, firstWord) => {
      const lowerFirst = firstWord.toLowerCase();
      if (!AMBIGUOUS_COMMANDS.has(lowerFirst)) return null;
      const words = trimmed.split(/\s+/);
      if (words.length === 1) {
        // Single word - check which category it belongs to
        if (PROMPT_AMBIGUOUS_COMMANDS.has(lowerFirst)) {
          // Commands like "who", "date" - prompt user to confirm
          return 'ambiguous';
        }
        // Commands like "test", "yes" - treat as NL for safety
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
    name: 'structural-nl',
    // Structural NL detection (ported from kash): multi-word input that looks like
    // natural language based on word count, word length, and character set analysis.
    // Catches: "add a file", "fix this bug", "hello world", "don't do that"
    // Skips: "ls -la" (words too short), "cd .." (too few words)
    //
    // Definitive for sync (shows NL coloring), but async validation can override
    // if first word IS a valid command (e.g., "git push origin main" → shell).
    // Some brief NL-colored flicker for real commands is acceptable - async handles it.
    test: (_input, trimmed) => (looksLikeNl(trimmed) ? 'nl' : null),
    definitive: false,
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

    const { mode, definitive, rule } = applyRules(input);

    // If detection is definitive, return immediately
    if (definitive) return mode;

    // Non-definitive detection (command-like or absolute-path) needs which validation
    if (mode === 'shell') {
      const trimmed = input.trim();
      const words = trimmed.split(/\s+/);
      const firstWord = words[0] ?? '';
      const isCmd = await shell.isCommand(firstWord);

      if (isCmd) {
        return 'shell';
      }

      // Command not found - determine if this is 'nothing' (invalid) or 'nl' (natural language)
      // If has shell operators → clearly trying to run shell, so 'nothing'
      if (SHELL_OPERATORS.test(trimmed)) {
        return 'nothing';
      }

      // If has env var syntax → clearly trying to run shell, so 'nothing'
      if (trimmed.includes('$')) {
        return 'nothing';
      }

      // Check if rest of words look like NL (suggests user query, not typo)
      // e.g., "fix this bug" → rest has NL words → 'nl'
      // e.g., "gti status" → rest has no NL words → 'nothing'
      if (words.length > 1) {
        const restWords = words.slice(1);
        const restLooksLikeNL = restWords.some((w) =>
          NL_ONLY_WORDS.has(stripTrailingPunctuation(w.toLowerCase()))
        );
        if (restLooksLikeNL) {
          return 'nl';
        }
      }

      // Single word or no NL words in rest → likely typo or unknown command → 'nothing'
      // Exception: if the single word is in NL_ONLY_WORDS (sync should have caught this, but just in case)
      if (words.length === 1 && NL_ONLY_WORDS.has(firstWord.toLowerCase())) {
        return 'nl';
      }

      return 'nothing';
    }

    // For structural-nl rule, check if first word is actually a command
    // This handles "git push origin main" → looks like NL structurally but `git` is a command
    if (rule === 'structural-nl' && mode === 'nl') {
      const trimmed = input.trim();
      const firstWord = trimmed.split(/\s+/)[0] ?? '';
      const isCmd = await shell.isCommand(firstWord);
      if (isCmd) {
        return 'shell';
      }
      return 'nl';
    }

    // For absolute-path rule, check if path exists and is executable
    if (rule === 'absolute-path') {
      const trimmed = input.trim();
      const firstWord = trimmed.split(/\s+/)[0] ?? '';
      const isCmd = await shell.isCommand(firstWord);
      return isCmd ? 'shell' : 'ambiguous';
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

// =============================================================================
// COMMAND SUGGESTIONS
// =============================================================================

/**
 * Common shell commands for typo suggestions.
 * These are frequently used commands that users might mistype.
 */
const COMMON_COMMANDS = [
  'ls',
  'cd',
  'git',
  'npm',
  'pnpm',
  'node',
  'cat',
  'grep',
  'find',
  'rm',
  'cp',
  'mv',
  'mkdir',
  'rmdir',
  'echo',
  'curl',
  'wget',
  'docker',
  'kubectl',
  'python',
  'python3',
  'pip',
  'brew',
  'apt',
  'yum',
  'ssh',
  'scp',
  'tar',
  'unzip',
  'zip',
  'make',
  'gcc',
  'go',
  'cargo',
  'rust',
  'vim',
  'nano',
  'code',
  'man',
  'which',
  'where',
  'whoami',
  'date',
  'time',
  'history',
  'clear',
  'pwd',
  'env',
  'export',
  'source',
  'chmod',
  'chown',
  'ps',
  'kill',
  'top',
  'htop',
  'df',
  'du',
  'head',
  'tail',
  'less',
  'more',
  'sort',
  'uniq',
  'wc',
  'diff',
  'sed',
  'awk',
  'xargs',
  'tee',
];

/**
 * Calculate Levenshtein distance between two strings.
 * Used for typo detection and command suggestions.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create a 2D matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Suggest a command based on a mistyped word.
 * Returns the closest matching command if within a reasonable distance.
 *
 * @param typo - The mistyped command
 * @returns The suggested command, or null if no good match found
 */
export function suggestCommand(typo: string): string | null {
  const lower = typo.toLowerCase();

  // Don't suggest for very short or very long inputs
  if (lower.length < 2 || lower.length > 20) {
    return null;
  }

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  // Maximum distance threshold based on typo length
  // Allow more edits for longer words, but always allow at least 2
  // This catches common transposition typos (gti → git, sl → ls)
  const maxDistance = Math.max(2, Math.floor(lower.length / 2));

  for (const cmd of COMMON_COMMANDS) {
    // Skip if the exact command is typed (not a typo)
    if (lower === cmd) {
      return null;
    }

    const distance = levenshteinDistance(lower, cmd);
    if (distance < bestDistance && distance <= maxDistance) {
      bestDistance = distance;
      bestMatch = cmd;
    }
  }

  return bestMatch;
}
