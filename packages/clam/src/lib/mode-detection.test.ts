/**
 * Unit tests for Mode Detection.
 *
 * Tests verify:
 * - Slash command detection
 * - Shell mode detection (operators, env vars, builtins)
 * - Natural language fallback
 * - Explicit shell trigger (!)
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  createModeDetector,
  hasShellOperators,
  isExplicitShell,
  isExplicitNL,
  stripShellTrigger,
  stripNLTrigger,
  suggestCommand,
  type ModeDetector,
} from './mode-detection.js';
import type { ShellModule } from './shell.js';

/**
 * Create a mock shell module for testing.
 */
function createMockShell(commands: Set<string>): ShellModule {
  let cwd = '/home/user';
  return {
    which: vi.fn((cmd: string) => Promise.resolve(commands.has(cmd) ? `/usr/bin/${cmd}` : null)),
    isCommand: vi.fn((word: string) => Promise.resolve(commands.has(word))),
    exec: vi.fn(),
    getCompletions: vi.fn(() => Promise.resolve([])),
    clearCache: vi.fn(),
    getCwd: vi.fn(() => cwd),
    setCwd: vi.fn((path: string) => {
      cwd = path;
    }),
  };
}

describe('ModeDetection', () => {
  let detector: ModeDetector;
  let mockShell: ShellModule;

  beforeEach(() => {
    mockShell = createMockShell(new Set(['ls', 'git', 'npm', 'node', 'cat', 'grep', 'echo']));
    detector = createModeDetector({ shell: mockShell });
  });

  describe('detectModeSync', () => {
    it('should detect slash commands', () => {
      expect(detector.detectModeSync('/help')).toBe('slash');
      expect(detector.detectModeSync('/quit')).toBe('slash');
      expect(detector.detectModeSync('/commit message')).toBe('slash');
      // Unknown slash commands are still treated as slash (not shell)
      expect(detector.detectModeSync('/unknown')).toBe('slash');
    });

    it('should detect absolute paths as shell, not slash', () => {
      // Absolute paths like /bin/ls are shell commands, not slash commands
      expect(detector.detectModeSync('/bin/ls')).toBe('shell');
      expect(detector.detectModeSync('/usr/bin/grep foo')).toBe('shell');
      expect(detector.detectModeSync('/home/user/script.sh')).toBe('shell');
    });

    it('should detect explicit shell trigger', () => {
      expect(detector.detectModeSync('!ls')).toBe('shell');
      expect(detector.detectModeSync('!echo hello')).toBe('shell');
    });

    it('should detect shell operators', () => {
      expect(detector.detectModeSync('cat file | grep foo')).toBe('shell');
      expect(detector.detectModeSync('echo hello > file.txt')).toBe('shell');
      expect(detector.detectModeSync('cmd1 && cmd2')).toBe('shell');
      expect(detector.detectModeSync('cmd1 || cmd2')).toBe('shell');
      expect(detector.detectModeSync('echo $(whoami)')).toBe('shell');
    });

    it('should detect environment variables', () => {
      expect(detector.detectModeSync('echo $HOME')).toBe('shell');
      expect(detector.detectModeSync('cd $PATH')).toBe('shell');
    });

    it('should detect shell builtins', () => {
      expect(detector.detectModeSync('cd /home')).toBe('shell');
      expect(detector.detectModeSync('export FOO=bar')).toBe('shell');
      expect(detector.detectModeSync('alias ll=ls')).toBe('shell');
    });

    it('should return nl for space-at-start', () => {
      expect(detector.detectModeSync(' how do I list files?')).toBe('nl');
      expect(detector.detectModeSync('  explain this')).toBe('nl');
    });

    it('should return nl for empty input', () => {
      expect(detector.detectModeSync('')).toBe('nl');
      expect(detector.detectModeSync('   ')).toBe('nl');
    });

    it('should tentatively detect command-like words as shell', () => {
      // Sync detection guesses shell for command-like words
      expect(detector.detectModeSync('ls -la')).toBe('shell');
      expect(detector.detectModeSync('git status')).toBe('shell');
    });

    it('should detect explicit NL trigger', () => {
      expect(detector.detectModeSync('?how do I list files')).toBe('nl');
      expect(detector.detectModeSync('?ls')).toBe('nl');
    });

    it('should detect natural language words as NL', () => {
      // Single NL words
      expect(detector.detectModeSync('yes')).toBe('nl');
      expect(detector.detectModeSync('no')).toBe('nl');
      expect(detector.detectModeSync('ok')).toBe('nl');
      // Multiple NL words
      expect(detector.detectModeSync('yes please')).toBe('nl');
      expect(detector.detectModeSync('ok thanks')).toBe('nl');
      expect(detector.detectModeSync('sure thing')).toBe('nl');
    });

    it('should detect ambiguous commands with NL words as NL', () => {
      // "test" alone is ambiguous, treated as NL for safety
      expect(detector.detectModeSync('test')).toBe('nl');
      // "test this" has NL word, so it's NL
      expect(detector.detectModeSync('test this out')).toBe('nl');
      // But "test -f file.txt" looks like shell (no NL words after)
      expect(detector.detectModeSync('test -f file.txt')).toBe('shell');
    });

    it('should return ambiguous for prompt-worthy commands', () => {
      // Commands that users might actually want to run - prompt them
      expect(detector.detectModeSync('who')).toBe('ambiguous');
      expect(detector.detectModeSync('date')).toBe('ambiguous');
      expect(detector.detectModeSync('time')).toBe('ambiguous');
      expect(detector.detectModeSync('man')).toBe('ambiguous');
      // But with NL words after, it's NL
      expect(detector.detectModeSync('who is this')).toBe('nl');
      expect(detector.detectModeSync('date of birth')).toBe('nl');
    });

    it('should detect request patterns as NL', () => {
      // "can you..." patterns
      expect(detector.detectModeSync('can you give me an overview')).toBe('nl');
      expect(detector.detectModeSync('can you help me')).toBe('nl');
      expect(detector.detectModeSync('could you explain this')).toBe('nl');
      expect(detector.detectModeSync('would you fix this')).toBe('nl');
      expect(detector.detectModeSync('will you help')).toBe('nl');
      // "please..." patterns
      expect(detector.detectModeSync('please help me')).toBe('nl');
      expect(detector.detectModeSync('please explain this code')).toBe('nl');
    });

    it('should handle incremental typing of questions correctly', () => {
      // Bug 4: "how are you" incremental typing
      // Pure question words (how, what, why, when) + any text = NL
      expect(detector.detectModeSync('how a')).toBe('nl');
      expect(detector.detectModeSync('how ar')).toBe('nl');
      expect(detector.detectModeSync('how are')).toBe('nl');
      expect(detector.detectModeSync('how are you')).toBe('nl');

      // Same for other pure question words
      expect(detector.detectModeSync('what i')).toBe('nl');
      expect(detector.detectModeSync('what is')).toBe('nl');
      expect(detector.detectModeSync('what is this')).toBe('nl');

      expect(detector.detectModeSync('why d')).toBe('nl');
      expect(detector.detectModeSync('why does')).toBe('nl');

      expect(detector.detectModeSync('when w')).toBe('nl');
      expect(detector.detectModeSync('when will')).toBe('nl');
    });

    it('should detect single characters as potential shell commands', () => {
      // Single characters could be the start of commands
      expect(detector.detectModeSync('l')).toBe('shell');
      expect(detector.detectModeSync('g')).toBe('shell');
      expect(detector.detectModeSync('n')).toBe('shell');

      // Command-like words
      expect(detector.detectModeSync('ls')).toBe('shell');
      expect(detector.detectModeSync('git')).toBe('shell');
    });
  });

  describe('detectMode (async)', () => {
    it('should detect slash commands', async () => {
      expect(await detector.detectMode('/help')).toBe('slash');
    });

    it('should detect shell commands via which', async () => {
      expect(await detector.detectMode('ls -la')).toBe('shell');
      expect(await detector.detectMode('git status')).toBe('shell');
    });

    it('should return nl for non-commands', async () => {
      // "hello" is not in our mock command set
      expect(await detector.detectMode('hello world')).toBe('nl');
    });

    it('should detect explicit shell trigger', async () => {
      expect(await detector.detectMode('!echo hello')).toBe('shell');
    });

    it('should detect shell operators with valid first command', async () => {
      // shell operators + valid first command → shell
      expect(await detector.detectMode('cat | grep')).toBe('shell');
    });

    it('should return nothing for invalid shell commands with operators', async () => {
      // Invalid command with shell operators → clearly trying to run shell but command doesn't exist
      expect(await detector.detectMode('xyzzy | grep foo')).toBe('nothing');
      expect(await detector.detectMode('asdfas > output.txt')).toBe('nothing');
      expect(await detector.detectMode('qwerty && echo done')).toBe('nothing');
    });

    it('should return nothing for typos in commands', async () => {
      // Typos in common commands - first word not valid, rest doesn't look like NL
      expect(await detector.detectMode('gti status')).toBe('nothing');
      expect(await detector.detectMode('nmp install')).toBe('nothing');
    });

    it('should return nothing for gibberish', async () => {
      // Random gibberish that looks command-like
      expect(await detector.detectMode('asdfghjkl')).toBe('nothing');
      expect(await detector.detectMode('qqqqq')).toBe('nothing');
    });

    it('should return nl for invalid command with NL-like rest', async () => {
      // First word not valid, but rest has NL words → probably NL, not typo
      expect(await detector.detectMode('fix this bug')).toBe('nl');
      expect(await detector.detectMode('update the code')).toBe('nl');
    });
  });

  describe('disabled mode', () => {
    it('should always return nl when disabled', () => {
      const disabledDetector = createModeDetector({ shell: mockShell, enabled: false });
      expect(disabledDetector.detectModeSync('ls -la')).toBe('nl');
      expect(disabledDetector.detectModeSync('/help')).toBe('nl');
    });

    it('should always return nl async when disabled', async () => {
      const disabledDetector = createModeDetector({ shell: mockShell, enabled: false });
      expect(await disabledDetector.detectMode('ls -la')).toBe('nl');
    });
  });

  describe('hasShellOperators', () => {
    it('should detect pipe operator', () => {
      expect(hasShellOperators('cat file | grep foo')).toBe(true);
    });

    it('should detect redirect operators', () => {
      expect(hasShellOperators('echo > file')).toBe(true);
      expect(hasShellOperators('cat < file')).toBe(true);
    });

    it('should detect logical operators', () => {
      expect(hasShellOperators('a && b')).toBe(true);
      expect(hasShellOperators('a || b')).toBe(true);
    });

    it('should detect subshell syntax', () => {
      expect(hasShellOperators('$(whoami)')).toBe(true);
      expect(hasShellOperators('`whoami`')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(hasShellOperators('hello world')).toBe(false);
      expect(hasShellOperators('ls -la')).toBe(false);
    });
  });

  describe('isExplicitShell', () => {
    it('should detect ! prefix', () => {
      expect(isExplicitShell('!ls')).toBe(true);
      expect(isExplicitShell('!echo hello')).toBe(true);
    });

    it('should handle whitespace', () => {
      expect(isExplicitShell('  !ls')).toBe(true);
    });

    it('should return false without prefix', () => {
      expect(isExplicitShell('ls')).toBe(false);
      expect(isExplicitShell('hello!')).toBe(false);
    });
  });

  describe('stripShellTrigger', () => {
    it('should remove ! prefix', () => {
      expect(stripShellTrigger('!ls')).toBe('ls');
      expect(stripShellTrigger('!echo hello')).toBe('echo hello');
    });

    it('should handle whitespace', () => {
      expect(stripShellTrigger('  !ls')).toBe('ls');
    });

    it('should return unchanged if no prefix', () => {
      expect(stripShellTrigger('ls')).toBe('ls');
    });
  });

  describe('isExplicitNL', () => {
    it('should detect ? prefix', () => {
      expect(isExplicitNL('?how do I')).toBe(true);
      expect(isExplicitNL('?ls')).toBe(true);
    });

    it('should handle whitespace', () => {
      expect(isExplicitNL('  ?query')).toBe(true);
    });

    it('should return false without prefix', () => {
      expect(isExplicitNL('how do I')).toBe(false);
      expect(isExplicitNL('what?')).toBe(false);
    });
  });

  describe('stripNLTrigger', () => {
    it('should remove ? prefix', () => {
      expect(stripNLTrigger('?how do I')).toBe('how do I');
      expect(stripNLTrigger('?ls')).toBe('ls');
    });

    it('should handle whitespace', () => {
      expect(stripNLTrigger('  ?query')).toBe('query');
    });

    it('should return unchanged if no prefix', () => {
      expect(stripNLTrigger('how do I')).toBe('how do I');
    });
  });

  describe('suggestCommand', () => {
    it('should suggest git for gti', () => {
      expect(suggestCommand('gti')).toBe('git');
    });

    it('should suggest ls for sl', () => {
      expect(suggestCommand('sl')).toBe('ls');
    });

    it('should suggest npm for nmp', () => {
      expect(suggestCommand('npm')).toBe(null); // npm is correct, so no suggestion
      expect(suggestCommand('nmp')).toBe('npm');
    });

    it('should suggest docker for dockre', () => {
      expect(suggestCommand('dockre')).toBe('docker');
    });

    it('should return null for gibberish', () => {
      expect(suggestCommand('asdfghjkl')).toBe(null);
      expect(suggestCommand('qqqqq')).toBe(null);
    });

    it('should return null for very short input', () => {
      expect(suggestCommand('a')).toBe(null);
    });

    it('should be case insensitive', () => {
      expect(suggestCommand('GTI')).toBe('git');
      expect(suggestCommand('SL')).toBe('ls');
    });
  });
});
