import { describe, expect, it } from 'bun:test';
import { createInputState } from './state.js';

describe('InputState', () => {
  describe('createInputState', () => {
    it('should create state with correct raw text values', () => {
      const state = createInputState('ls -la', 3, 'shell', '/home/user');

      expect(state.rawText).toBe('ls -la');
      expect(state.cursorPos).toBe(3);
      expect(state.textBeforeCursor).toBe('ls ');
      expect(state.textAfterCursor).toBe('-la');
    });

    it('should initialize with empty tokens', () => {
      const state = createInputState('git status', 0, 'shell', '/repo');

      expect(state.tokens).toEqual([]);
      expect(state.tokenIndex).toBe(0);
      expect(state.currentToken).toBeNull();
      expect(state.prefix).toBe('');
    });

    it('should detect slash commands', () => {
      const slashState = createInputState('/help', 5, 'slash', '/home');
      expect(slashState.isSlashCommand).toBe(true);

      const shellState = createInputState('ls', 2, 'shell', '/home');
      expect(shellState.isSlashCommand).toBe(false);
    });

    it('should preserve mode and environment', () => {
      const history = [{ command: 'ls', timestamp: new Date() }];
      const state = createInputState('echo hello', 4, 'nl', '/var/log', history);

      expect(state.mode).toBe('nl');
      expect(state.cwd).toBe('/var/log');
      expect(state.history).toBe(history);
    });

    it('should handle empty input', () => {
      const state = createInputState('', 0, 'shell', '/');

      expect(state.rawText).toBe('');
      expect(state.cursorPos).toBe(0);
      expect(state.textBeforeCursor).toBe('');
      expect(state.textAfterCursor).toBe('');
    });

    it('should handle cursor at end of input', () => {
      const state = createInputState('cat file.txt', 12, 'shell', '/');

      expect(state.textBeforeCursor).toBe('cat file.txt');
      expect(state.textAfterCursor).toBe('');
    });
  });
});
