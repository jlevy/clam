/**
 * Mode Detection Test Cases
 *
 * This file defines all expected mode detection behaviors in one place.
 * Used for both documentation and testing.
 *
 * Modes:
 * - 'shell'     : Execute as shell command directly
 * - 'nl'        : Send to Claude as natural language
 * - 'slash'     : Handle as local slash command
 * - 'ambiguous' : Prompt user to confirm (suggest shell or send to Claude)
 * - 'nothing'   : Clearly invalid input - show error, don't execute
 */

import type { InputMode } from './mode-detection.js';

/**
 * Extended mode type including ambiguous and nothing for test cases.
 * The actual InputMode type doesn't include these yet.
 */
export type ExpectedMode = InputMode | 'ambiguous' | 'nothing';

/**
 * A single test case for mode detection.
 */
export interface ModeTestCase {
  input: string;
  expected: ExpectedMode;
  reason?: string;
}

/**
 * A category of test cases.
 */
export interface TestCategory {
  name: string;
  description: string;
  cases: ModeTestCase[];
}

// =============================================================================
// TEST CASES BY CATEGORY
// =============================================================================

/**
 * 1. EXPLICIT PREFIXES
 * User explicitly indicates intent with !, ?, or /
 */
export const EXPLICIT_PREFIX_CASES: TestCategory = {
  name: 'Explicit Prefixes',
  description: 'User explicitly indicates intent with special prefix characters',
  cases: [
    // ! forces shell mode
    { input: '!ls', expected: 'shell', reason: '! prefix forces shell' },
    { input: '!echo hello', expected: 'shell', reason: '! prefix forces shell' },
    { input: '!yes', expected: 'shell', reason: '! forces shell even for NL words' },
    { input: '!who', expected: 'shell', reason: '! forces shell for ambiguous commands' },

    // ? forces natural language mode
    { input: '?how do I list files', expected: 'nl', reason: '? prefix forces NL' },
    { input: '?ls', expected: 'nl', reason: '? forces NL even for commands' },
    { input: '?git status', expected: 'nl', reason: '? forces NL even for valid commands' },

    // Space at start suggests NL (user is thinking)
    { input: ' how do I', expected: 'nl', reason: 'Leading space suggests NL' },
    { input: '  explain this', expected: 'nl', reason: 'Leading spaces suggest NL' },
  ],
};

/**
 * 2. SLASH COMMANDS
 * Local commands handled by clam, not shell
 */
export const SLASH_COMMAND_CASES: TestCategory = {
  name: 'Slash Commands',
  description: 'Local commands starting with / that clam handles directly',
  cases: [
    // Known slash commands
    { input: '/help', expected: 'slash', reason: 'Known slash command' },
    { input: '/quit', expected: 'slash', reason: 'Known slash command' },
    { input: '/exit', expected: 'slash', reason: 'Known slash command' },
    { input: '/clear', expected: 'slash', reason: 'Known slash command' },
    { input: '/status', expected: 'slash', reason: 'Known slash command' },
    { input: '/config', expected: 'slash', reason: 'Known slash command' },
    { input: '/history', expected: 'slash', reason: 'Known slash command' },
    { input: '/shell ls', expected: 'slash', reason: 'Slash command with args' },
    { input: '/edit file.txt', expected: 'slash', reason: 'Slash command with args' },

    // Unknown slash commands (still treated as slash to show error)
    {
      input: '/unknown',
      expected: 'slash',
      reason: 'Unknown slash shows error, not sent to shell',
    },
    { input: '/hepl', expected: 'slash', reason: 'Typo shows error, not sent to shell' },
  ],
};

/**
 * 3. ABSOLUTE PATHS
 * /bin/ls is shell, but /unknown/path is ambiguous
 */
export const ABSOLUTE_PATH_CASES: TestCategory = {
  name: 'Absolute Paths',
  description: 'Paths starting with / - distinguished from slash commands',
  cases: [
    // Valid executable paths
    { input: '/bin/ls', expected: 'shell', reason: 'Known system path' },
    { input: '/usr/bin/grep foo', expected: 'shell', reason: 'Known system path with args' },
    { input: '/home/user/script.sh', expected: 'shell', reason: 'User script path' },
    { input: '/usr/local/bin/node', expected: 'shell', reason: 'Local bin path' },

    // Unknown/ambiguous paths (might not exist)
    { input: '/aaa/bbb/ccc', expected: 'ambiguous', reason: 'Unknown path - could be invalid' },
    { input: '/foo/bar', expected: 'ambiguous', reason: 'Unknown path - could be invalid' },

    // Single segment paths are slash commands, not paths
    { input: '/command', expected: 'slash', reason: 'No internal slash = slash command' },
  ],
};

/**
 * 4. SHELL OPERATORS
 * Pipes, redirects, logical operators definitively indicate shell
 */
export const SHELL_OPERATOR_CASES: TestCategory = {
  name: 'Shell Operators',
  description: 'Operators that definitively indicate shell mode',
  cases: [
    // Pipes
    { input: 'cat file | grep foo', expected: 'shell', reason: 'Pipe operator' },
    { input: 'ls | head', expected: 'shell', reason: 'Pipe operator' },
    { input: 'ps aux | grep node', expected: 'shell', reason: 'Pipe chain' },

    // Redirects
    { input: 'echo hello > file.txt', expected: 'shell', reason: 'Output redirect' },
    { input: 'cat < input.txt', expected: 'shell', reason: 'Input redirect' },
    { input: 'cmd >> log.txt', expected: 'shell', reason: 'Append redirect' },

    // Logical operators
    { input: 'cmd1 && cmd2', expected: 'shell', reason: 'AND operator' },
    { input: 'cmd1 || cmd2', expected: 'shell', reason: 'OR operator' },
    { input: 'make && make test', expected: 'shell', reason: 'Chained commands' },

    // Semicolons
    { input: 'cd dir; ls', expected: 'shell', reason: 'Semicolon separator' },

    // Subshells
    { input: 'echo $(whoami)', expected: 'shell', reason: 'Command substitution' },
    { input: 'echo `date`', expected: 'shell', reason: 'Backtick substitution' },
  ],
};

/**
 * 5. ENVIRONMENT VARIABLES
 * $VAR syntax definitively indicates shell
 */
export const ENV_VARIABLE_CASES: TestCategory = {
  name: 'Environment Variables',
  description: '$VAR syntax indicates shell mode',
  cases: [
    { input: 'echo $HOME', expected: 'shell', reason: 'Env var reference' },
    { input: 'cd $PATH', expected: 'shell', reason: 'Env var reference' },
    { input: '$EDITOR file.txt', expected: 'shell', reason: 'Env var as command' },
    { input: 'export FOO=$BAR', expected: 'shell', reason: 'Env var assignment' },
  ],
};

/**
 * 6. SHELL BUILTINS
 * Commands that are always shell (cd, export, alias, etc.)
 */
export const SHELL_BUILTIN_CASES: TestCategory = {
  name: 'Shell Builtins',
  description: 'Commands built into the shell itself',
  cases: [
    { input: 'cd /home', expected: 'shell', reason: 'cd is shell builtin' },
    { input: 'cd ..', expected: 'shell', reason: 'cd with relative path' },
    { input: 'cd', expected: 'shell', reason: 'cd alone goes to home' },
    { input: 'pwd', expected: 'shell', reason: 'pwd is shell builtin' },
    { input: 'export FOO=bar', expected: 'shell', reason: 'export is shell builtin' },
    { input: 'alias ll="ls -la"', expected: 'shell', reason: 'alias is shell builtin' },
    { input: 'unalias ll', expected: 'shell', reason: 'unalias is shell builtin' },
    { input: 'source .bashrc', expected: 'shell', reason: 'source is shell builtin' },
    { input: '. .bashrc', expected: 'shell', reason: '. is source alias' },
    { input: 'echo hello', expected: 'shell', reason: 'echo is shell builtin' },
    { input: 'printf "%s" foo', expected: 'shell', reason: 'printf is shell builtin' },
    { input: 'jobs', expected: 'shell', reason: 'jobs is shell builtin' },
    { input: 'fg', expected: 'shell', reason: 'fg is shell builtin' },
    { input: 'bg', expected: 'shell', reason: 'bg is shell builtin' },
    { input: 'pushd /tmp', expected: 'shell', reason: 'pushd is shell builtin' },
    { input: 'popd', expected: 'shell', reason: 'popd is shell builtin' },
    { input: 'history', expected: 'shell', reason: 'history is shell builtin' },
    { input: 'ulimit -n', expected: 'shell', reason: 'ulimit is shell builtin' },
  ],
};

/**
 * 7. COMMON SHELL COMMANDS
 * Well-known commands that should execute directly
 */
export const COMMON_COMMAND_CASES: TestCategory = {
  name: 'Common Shell Commands',
  description: 'Well-known commands that are validated via which',
  cases: [
    { input: 'ls', expected: 'shell', reason: 'Common command' },
    { input: 'ls -la', expected: 'shell', reason: 'Command with flags' },
    { input: 'ls -la /tmp', expected: 'shell', reason: 'Command with flags and path' },
    { input: 'git status', expected: 'shell', reason: 'Git command' },
    { input: 'git commit -m "msg"', expected: 'shell', reason: 'Git with args' },
    { input: 'npm install', expected: 'shell', reason: 'npm command' },
    { input: 'pnpm test', expected: 'shell', reason: 'pnpm command' },
    { input: 'node script.js', expected: 'shell', reason: 'Node command' },
    { input: 'python3 script.py', expected: 'shell', reason: 'Python command' },
    { input: 'cat file.txt', expected: 'shell', reason: 'cat command' },
    { input: 'grep pattern file', expected: 'shell', reason: 'grep command' },
    { input: 'find . -name "*.ts"', expected: 'shell', reason: 'find command' },
    { input: 'curl https://example.com', expected: 'shell', reason: 'curl command' },
    { input: 'wget https://example.com', expected: 'shell', reason: 'wget command' },
    { input: 'docker ps', expected: 'shell', reason: 'docker command' },
    { input: 'kubectl get pods', expected: 'shell', reason: 'kubectl command' },
  ],
};

/**
 * 8. NATURAL LANGUAGE - QUESTIONS
 * Questions starting with what/how/why/etc.
 */
export const QUESTION_CASES: TestCategory = {
  name: 'Natural Language Questions',
  description: 'Questions that should be sent to Claude',
  cases: [
    { input: 'what does this codebase do', expected: 'nl', reason: 'Question with NL words' },
    { input: 'how do I list files', expected: 'nl', reason: 'Question with NL words' },
    { input: 'how are you', expected: 'nl', reason: 'Question with NL words' },
    { input: 'how can I use claude code', expected: 'nl', reason: 'Question with NL words' },
    { input: 'why is this failing', expected: 'nl', reason: 'Question with NL words' },
    { input: 'when should I use this', expected: 'nl', reason: 'Question with NL words' },
    { input: 'where are the tests', expected: 'nl', reason: 'Question with NL words' },
    { input: 'who wrote this code', expected: 'nl', reason: 'Question with NL words' },
    { input: 'which file should I edit', expected: 'nl', reason: 'Question with NL words' },
    { input: 'what is git', expected: 'nl', reason: 'Question about a command' },

    // Questions with punctuation
    { input: 'how do you do?', expected: 'nl', reason: 'Question with punctuation' },
    { input: 'what is this?', expected: 'nl', reason: 'Question with punctuation' },
  ],
};

/**
 * 9. NATURAL LANGUAGE - COMMON PHRASES
 * Phrases that are clearly conversational
 */
export const NL_PHRASE_CASES: TestCategory = {
  name: 'Natural Language Phrases',
  description: 'Conversational phrases sent to Claude',
  cases: [
    // Responses
    { input: 'yes', expected: 'nl', reason: 'Common response' },
    { input: 'no', expected: 'nl', reason: 'Common response' },
    { input: 'ok', expected: 'nl', reason: 'Common response' },
    { input: 'okay', expected: 'nl', reason: 'Common response' },
    { input: 'sure', expected: 'nl', reason: 'Common response' },
    { input: 'thanks', expected: 'nl', reason: 'Common response' },
    { input: 'yes please', expected: 'nl', reason: 'Response with NL word' },
    { input: 'ok thanks', expected: 'nl', reason: 'Response with NL word' },
    { input: 'sure thing', expected: 'nl', reason: 'Response with NL word' },

    // Greetings
    { input: 'hi', expected: 'nl', reason: 'Greeting' },
    { input: 'hello', expected: 'nl', reason: 'Greeting' },
    { input: 'hey', expected: 'nl', reason: 'Greeting' },
    { input: 'bye', expected: 'nl', reason: 'Greeting' },
    { input: 'goodbye', expected: 'nl', reason: 'Greeting' },

    // Requests
    { input: 'please help me', expected: 'nl', reason: 'Request with NL words' },
    { input: 'can you explain this', expected: 'nl', reason: 'Request with NL words' },
    { input: 'tell me about this', expected: 'nl', reason: 'Request with NL words' },
    { input: 'I need help', expected: 'nl', reason: 'Request with NL words' },
    { input: 'show me how to do this', expected: 'nl', reason: 'Request with NL words' },

    // Statements
    { input: 'this is great', expected: 'nl', reason: 'Statement with NL words' },
    { input: 'I think we should', expected: 'nl', reason: 'Statement with NL words' },
    { input: 'that looks good', expected: 'nl', reason: 'Statement with NL words' },
  ],
};

/**
 * 10. AMBIGUOUS COMMANDS
 * Commands that could be shell or natural language
 */
export const AMBIGUOUS_CASES: TestCategory = {
  name: 'Ambiguous Commands',
  description: 'Commands that need user confirmation',
  cases: [
    // Single-word commands that are also common words
    { input: 'who', expected: 'ambiguous', reason: 'Unix command but also question word' },
    { input: 'date', expected: 'ambiguous', reason: 'Unix command but also common word' },
    { input: 'time', expected: 'ambiguous', reason: 'Shell keyword but also common word' },
    { input: 'test', expected: 'nl', reason: 'Ambiguous - treated as NL for safety' },
    { input: 'true', expected: 'nl', reason: 'Shell builtin but also common word' },
    { input: 'false', expected: 'nl', reason: 'Shell builtin but also common word' },
    { input: 'wait', expected: 'nl', reason: 'Shell builtin but also common word' },
    { input: 'read', expected: 'nl', reason: 'Shell builtin but also common word' },
    { input: 'let', expected: 'nl', reason: 'Shell keyword but also common word' },
    { input: 'type', expected: 'nl', reason: 'Shell builtin but also common word' },
    { input: 'set', expected: 'nl', reason: 'Shell builtin but also common word' },
    { input: 'man', expected: 'ambiguous', reason: 'Manual command but also common word' },

    // These become NL when followed by NL words
    { input: 'test this out', expected: 'nl', reason: 'Ambiguous + NL words = NL' },
    { input: 'make this work', expected: 'nl', reason: 'Ambiguous + NL words = NL' },
    { input: 'watch out for', expected: 'nl', reason: 'Ambiguous + NL words = NL' },
    { input: 'let me try', expected: 'nl', reason: 'Ambiguous + NL words = NL' },
    { input: 'read this please', expected: 'nl', reason: 'Ambiguous + NL words = NL' },

    // But shell-like args make them shell
    { input: 'test -f file.txt', expected: 'shell', reason: 'Shell-like flags = shell' },
    { input: 'time ls', expected: 'shell', reason: 'time + command = shell' },
    { input: 'man ls', expected: 'shell', reason: 'man + command name = shell' },
  ],
};

/**
 * 11. EMPTY AND WHITESPACE
 * Edge cases for empty input
 */
export const EMPTY_CASES: TestCategory = {
  name: 'Empty and Whitespace',
  description: 'Edge cases for empty or whitespace-only input',
  cases: [
    { input: '', expected: 'nl', reason: 'Empty input defaults to NL' },
    { input: '   ', expected: 'nl', reason: 'Whitespace only defaults to NL' },
    { input: '\t', expected: 'nl', reason: 'Tab only defaults to NL' },
  ],
};

/**
 * 12. INVALID/NOTHING
 * Input that looks like shell but is clearly invalid (typos, gibberish)
 * Should show an error message rather than execute or send to Claude
 *
 * TODO: When 'nothing' is detected, offer alternate suggestions:
 * - "Did you mean 'git status'?" for 'gti status'
 * - "Command 'xyzzy' not found. Send to Claude instead? [y/N]"
 * - Use Levenshtein distance to suggest similar commands
 */
export const NOTHING_CASES: TestCategory = {
  name: 'Invalid Input (Nothing)',
  description: 'Shell-like syntax with invalid commands - show error, do nothing',
  cases: [
    // Gibberish with shell operators
    {
      input: 'asdfas /bin/ls > foo',
      expected: 'nothing',
      reason: 'Invalid command with shell syntax',
    },
    { input: 'xyzzy | grep foo', expected: 'nothing', reason: 'Invalid command with pipe' },
    { input: 'aaaaaa && bbbbbb', expected: 'nothing', reason: 'Invalid commands chained' },
    { input: 'qwerty > output.txt', expected: 'nothing', reason: 'Invalid command with redirect' },
    { input: 'foobar $HOME', expected: 'nothing', reason: 'Invalid command with env var' },

    // Typos in common commands (detected via which)
    { input: 'gti status', expected: 'nothing', reason: 'Typo in git' },
    { input: 'sl -la', expected: 'nothing', reason: 'Typo in ls (unless sl is installed)' },
    { input: 'nmp install', expected: 'nothing', reason: 'Typo in npm' },
    { input: 'dockre ps', expected: 'nothing', reason: 'Typo in docker' },

    // Random gibberish that looks command-like
    { input: 'asdfghjkl', expected: 'nothing', reason: 'Random letters, not a command' },
    { input: 'qqqqq', expected: 'nothing', reason: 'Random letters, not a command' },
  ],
};

// =============================================================================
// ALL CATEGORIES
// =============================================================================

export const ALL_TEST_CATEGORIES: TestCategory[] = [
  EXPLICIT_PREFIX_CASES,
  SLASH_COMMAND_CASES,
  ABSOLUTE_PATH_CASES,
  SHELL_OPERATOR_CASES,
  ENV_VARIABLE_CASES,
  SHELL_BUILTIN_CASES,
  COMMON_COMMAND_CASES,
  QUESTION_CASES,
  NL_PHRASE_CASES,
  AMBIGUOUS_CASES,
  EMPTY_CASES,
  NOTHING_CASES,
];

/**
 * Get all test cases as a flat array.
 */
export function getAllTestCases(): ModeTestCase[] {
  return ALL_TEST_CATEGORIES.flatMap((cat) => cat.cases);
}

/**
 * Get total number of test cases.
 */
export function getTestCaseCount(): number {
  return getAllTestCases().length;
}

/**
 * Print a summary of all test cases (for documentation).
 */
export function printTestCaseSummary(): void {
  console.log('Mode Detection Test Cases\n');
  console.log('='.repeat(60));

  for (const category of ALL_TEST_CATEGORIES) {
    console.log(`\n## ${category.name}`);
    console.log(`${category.description}\n`);

    for (const tc of category.cases) {
      const paddedInput = `"${tc.input}"`.padEnd(35);
      const paddedExpected = tc.expected.padEnd(10);
      console.log(`  ${paddedInput} → ${paddedExpected} ${tc.reason ?? ''}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${getTestCaseCount()} test cases`);
}
