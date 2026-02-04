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
  type ModeDetector,
} from './mode-detection.js';
import type { ShellModule } from './shell.js';

/**
 * Create a mock shell module for testing.
 */
function createMockShell(commands: Set<string>): ShellModule {
  return {
    which: vi.fn((cmd: string) => Promise.resolve(commands.has(cmd) ? `/usr/bin/${cmd}` : null)),
    isCommand: vi.fn((word: string) => Promise.resolve(commands.has(word))),
    exec: vi.fn(),
    getCompletions: vi.fn(() => Promise.resolve([])),
    clearCache: vi.fn(),
  };
}

describe('ModeDetection', () => {
  let detector: ModeDetector;
  let mockShell: ShellModule;

  beforeEach(() => {
    mockShell = createMockShell(new Set(['ls', 'git', 'npm', 'node']));
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

    it('should detect shell operators without which lookup', async () => {
      expect(await detector.detectMode('cat | grep')).toBe('shell');
      // which should not be called for operator-based detection
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
});
