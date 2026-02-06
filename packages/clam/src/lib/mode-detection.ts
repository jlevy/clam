/**
 * Mode Detection - Input mode detection for clam.
 *
 * DESIGN PHILOSOPHY:
 * Sync and async detection produce the SAME result. Both use cached `which` lookups
 * to check if a command exists. The cache is populated on first lookup (sync uses
 * spawnSync, async uses spawn). This ensures coloring matches execution behavior.
 *
 * If `which` lookups prove too slow during typing, we could preload the cache with
 * common commands on startup. But `which` is typically <10ms, so this is likely unnecessary.
 *
 * KEY RULES (in priority order):
 * - Definitive patterns: shell operators (|, >, &&), builtins (cd, export), $vars
 * - AMBIGUOUS_COMMANDS: words that are both commands AND English (go, make, test)
 *   - With NL words after → NL ("go to the store")
 *   - Alone or with non-NL words → shell or ambiguous
 * - `which` lookup: if first word is a real command → shell
 * - Structural NL: 3+ word phrases that don't start with a command → NL
 * - Fallback: command-like pattern → tentative shell (catches typos)
 *
 * MANAGING COMPLEXITY:
 * - Word lists are TEST-DRIVEN: add words only when tests require them
 * - Test cases live in mode-detection-cases.ts and mode-detection.test.ts
 * - When a phrase is misclassified, add a test case FIRST, then fix
 */

import { spawnSync } from 'child_process';

import { isShellBuiltin, type ShellModule } from './shell.js';

// =============================================================================
// CACHED `which` LOOKUP
// =============================================================================

/** Cache for `which` results: command -> exists */
const whichCache = new Map<string, boolean>();

/**
 * Check if a command exists using `which`, with caching.
 * Uses spawnSync for synchronous lookup. Fast (~5-10ms) and cached.
 *
 * TODO: Could preload cache at shell startup by scanning PATH directories.
 * Probably not necessary since `which` is fast enough.
 */
function isShellCommand(command: string): boolean {
  const cached = whichCache.get(command);
  if (cached !== undefined) {
    return cached;
  }

  const result = spawnSync('which', [command], {
    encoding: 'utf8',
    timeout: 1000, // 1 second timeout, just in case
  });

  const isCmd = result.status === 0;
  whichCache.set(command, isCmd);
  return isCmd;
}

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
  'go', // Go language - but also "go to the store"
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
      // /bin/ls, /usr/bin/grep, etc. - treat as shell command
      // Note: `which` doesn't work for absolute paths. We assume if it looks like
      // an absolute path to an executable, the user wants to run it. Execution
      // will fail with a proper error if the file doesn't exist.
      if (trimmed.startsWith('/') && ABSOLUTE_PATH_PATTERN.test(firstWord)) {
        return 'shell';
      }
      return null;
    },
    definitive: true,
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
    // Has shell operators like |, >, &&, etc. - check if first word is a real command
    test: (_input, trimmed, firstWord) => {
      if (!SHELL_OPERATORS.test(trimmed)) return null;
      // If first word is a command, it's shell. Otherwise it's invalid (nothing).
      return isShellCommand(firstWord) ? 'shell' : 'nothing';
    },
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
    name: 'which-lookup',
    // Check if first word is a real command using cached `which` lookup.
    // This is the primary way we detect shell commands - accurate and fast with caching.
    test: (_input, _trimmed, firstWord) => {
      if (!COMMAND_LIKE_PATTERN.test(firstWord)) return null;
      return isShellCommand(firstWord) ? 'shell' : null;
    },
    definitive: true, // `which` is authoritative
  },
  {
    name: 'structural-nl',
    // Structural NL detection: multi-word input that looks like natural language.
    // Only fires if first word is NOT a real command (checked above via `which`).
    // Catches: "add a file", "fix this bug", "hello world", "don't do that"
    test: (_input, trimmed) => (looksLikeNl(trimmed) ? 'nl' : null),
    definitive: true, // If it's not a command and looks like NL, it's NL
  },
  {
    name: 'command-like',
    // Fallback: first word looks like a command but `which` didn't find it.
    // Could be a typo (gti → git) or a command not in PATH.
    // Treat as 'nothing' so we can show a helpful error with suggestions.
    test: (_input, _trimmed, firstWord) =>
      COMMAND_LIKE_PATTERN.test(firstWord) ? 'nothing' : null,
    definitive: true,
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
  const { enabled = true } = options;

  function detectModeSync(input: string): InputMode {
    // If disabled, always return natural language
    if (!enabled) return 'nl';

    const { mode } = applyRules(input);
    return mode;
  }

  function detectMode(input: string): Promise<InputMode> {
    // Sync and async now produce identical results (both use cached `which` lookups).
    // Async version kept for API compatibility.
    return Promise.resolve(detectModeSync(input));
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
 * Common shell commands for typo suggestions and sync detection.
 * These are frequently used commands that users might mistype.
 * Also used by 'known-command' rule to sync-detect commands like "git", "npm", etc.
 *
 * TODO: Replace with cached `which` results for better accuracy.
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
