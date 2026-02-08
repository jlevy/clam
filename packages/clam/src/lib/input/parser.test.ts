import { describe, expect, it } from 'bun:test';
import { tokenize, updateInputStateWithTokens } from './parser.js';
import { createInputState } from './state.js';

describe('Token Parser', () => {
  describe('tokenize', () => {
    it('should tokenize a simple command', () => {
      const tokens = tokenize('ls');

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'command',
        value: 'ls',
        start: 0,
        end: 2,
      });
    });

    it('should tokenize command with arguments', () => {
      const tokens = tokenize('ls -la /home');

      expect(tokens).toHaveLength(5); // command, whitespace, option, whitespace, path
      expect(tokens[0]).toEqual({ type: 'command', value: 'ls', start: 0, end: 2 });
      expect(tokens[1]).toEqual({ type: 'whitespace', value: ' ', start: 2, end: 3 });
      expect(tokens[2]).toEqual({ type: 'option', value: '-la', start: 3, end: 6 });
      expect(tokens[3]).toEqual({ type: 'whitespace', value: ' ', start: 6, end: 7 });
      expect(tokens[4]).toEqual({ type: 'path', value: '/home', start: 7, end: 12 });
    });

    it('should identify options starting with -', () => {
      const tokens = tokenize('grep -r --color');

      expect(tokens.filter((t) => t.type === 'option')).toHaveLength(2);
      expect(tokens[2]?.type).toBe('option');
      expect(tokens[2]?.value).toBe('-r');
      expect(tokens[4]?.type).toBe('option');
      expect(tokens[4]?.value).toBe('--color');
    });

    it('should identify entity references starting with @', () => {
      const tokens = tokenize('tell @file.ts about');

      const entityToken = tokens.find((t) => t.type === 'entity');
      expect(entityToken).toBeDefined();
      expect(entityToken?.value).toBe('@file.ts');
    });

    it('should identify paths', () => {
      const tokens = tokenize('cat ./file.txt ../other /absolute');

      const pathTokens = tokens.filter((t) => t.type === 'path');
      expect(pathTokens).toHaveLength(3);
      expect(pathTokens[0]?.value).toBe('./file.txt');
      expect(pathTokens[1]?.value).toBe('../other');
      expect(pathTokens[2]?.value).toBe('/absolute');
    });

    it('should identify shell operators', () => {
      const tokens = tokenize('cat file | grep foo > out');

      const operatorTokens = tokens.filter((t) => t.type === 'operator');
      expect(operatorTokens).toHaveLength(2);
      expect(operatorTokens[0]?.value).toBe('|');
      expect(operatorTokens[1]?.value).toBe('>');
    });

    it('should handle quoted strings', () => {
      const tokens = tokenize('echo "hello world"');

      const stringToken = tokens.find((t) => t.type === 'string');
      expect(stringToken).toBeDefined();
      expect(stringToken?.value).toBe('"hello world"');
    });

    it('should handle single-quoted strings', () => {
      const tokens = tokenize("echo 'hello world'");

      const stringToken = tokens.find((t) => t.type === 'string');
      expect(stringToken).toBeDefined();
      expect(stringToken?.value).toBe("'hello world'");
    });

    it('should handle empty input', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const tokens = tokenize('   ');

      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.type).toBe('whitespace');
    });

    it('should identify slash commands', () => {
      const tokens = tokenize('/help');

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual({
        type: 'command',
        value: '/help',
        start: 0,
        end: 5,
      });
    });
  });

  describe('updateInputStateWithTokens', () => {
    it('should populate tokens in input state', () => {
      const state = createInputState('ls -la', 6, 'shell', '/home');
      const updated = updateInputStateWithTokens(state);

      expect(updated.tokens.length).toBeGreaterThan(0);
      expect(updated.tokens[0]?.type).toBe('command');
    });

    it('should set correct tokenIndex for cursor position', () => {
      const state = createInputState('ls -la', 4, 'shell', '/home');
      const updated = updateInputStateWithTokens(state);

      // Cursor at position 4 is in the middle of '-la' option
      expect(updated.tokenIndex).toBe(2); // third token (0=command, 1=whitespace, 2=option)
    });

    it('should set currentToken correctly', () => {
      const state = createInputState('git status', 5, 'shell', '/repo');
      const updated = updateInputStateWithTokens(state);

      expect(updated.currentToken).toBeDefined();
      expect(updated.currentToken?.value).toBe('status');
    });

    it('should compute prefix correctly', () => {
      const state = createInputState('git sta', 7, 'shell', '/repo');
      const updated = updateInputStateWithTokens(state);

      expect(updated.prefix).toBe('sta');
    });

    it('should handle cursor at whitespace', () => {
      const state = createInputState('ls  ', 3, 'shell', '/');
      const updated = updateInputStateWithTokens(state);

      expect(updated.currentToken?.type).toBe('whitespace');
    });

    it('should detect entity trigger', () => {
      const state = createInputState('ask @fi', 7, 'shell', '/');
      const updated = updateInputStateWithTokens(state);

      expect(updated.isEntityTrigger).toBe(true);
    });

    it('should set prefix for partial entity', () => {
      const state = createInputState('ask @file', 9, 'shell', '/');
      const updated = updateInputStateWithTokens(state);

      expect(updated.prefix).toBe('@file');
    });
  });
});
