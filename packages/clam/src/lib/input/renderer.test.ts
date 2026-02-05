import { describe, it, expect } from 'vitest';
import { renderInput, getTokenColor, TOKEN_COLORS } from './renderer.js';
import { createInputState } from './state.js';
import { updateInputStateWithTokens } from './parser.js';

describe('InputRenderer', () => {
  describe('getTokenColor', () => {
    it('should return color function for each token type', () => {
      expect(getTokenColor('command')).toBeDefined();
      expect(getTokenColor('option')).toBeDefined();
      expect(getTokenColor('argument')).toBeDefined();
      expect(getTokenColor('path')).toBeDefined();
      expect(getTokenColor('entity')).toBeDefined();
      expect(getTokenColor('operator')).toBeDefined();
      expect(getTokenColor('string')).toBeDefined();
      expect(getTokenColor('whitespace')).toBeDefined();
    });

    it('should return identity function for whitespace', () => {
      const colorFn = getTokenColor('whitespace');
      expect(colorFn(' ')).toBe(' ');
    });
  });

  describe('TOKEN_COLORS', () => {
    it('should have colors for all token types', () => {
      expect(TOKEN_COLORS.command).toBeDefined();
      expect(TOKEN_COLORS.option).toBeDefined();
      expect(TOKEN_COLORS.argument).toBeDefined();
      expect(TOKEN_COLORS.path).toBeDefined();
      expect(TOKEN_COLORS.entity).toBeDefined();
      expect(TOKEN_COLORS.operator).toBeDefined();
      expect(TOKEN_COLORS.string).toBeDefined();
      expect(TOKEN_COLORS.whitespace).toBeDefined();
    });
  });

  describe('renderInput', () => {
    it('should render simple command', () => {
      const state = updateInputStateWithTokens(createInputState('ls', 2, 'shell', '/'));

      const rendered = renderInput(state);

      expect(rendered).toContain('ls');
    });

    it('should preserve text content', () => {
      const state = updateInputStateWithTokens(
        createInputState('git status --short', 17, 'shell', '/')
      );

      const rendered = renderInput(state);

      // Strip ANSI codes for content check
      // eslint-disable-next-line no-control-regex
      const stripped = rendered.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe('git status --short');
    });

    it('should render command with arguments', () => {
      const state = updateInputStateWithTokens(createInputState('cat file.txt', 12, 'shell', '/'));

      const rendered = renderInput(state);

      expect(rendered).toContain('cat');
      expect(rendered).toContain('file.txt');
    });

    it('should handle empty input', () => {
      const state = updateInputStateWithTokens(createInputState('', 0, 'shell', '/'));

      const rendered = renderInput(state);

      expect(rendered).toBe('');
    });

    it('should handle slash commands', () => {
      const state = updateInputStateWithTokens(createInputState('/help', 5, 'slash', '/'));

      const rendered = renderInput(state);

      expect(rendered).toContain('/help');
    });

    it('should render options differently from arguments', () => {
      const state = updateInputStateWithTokens(createInputState('ls -la file', 11, 'shell', '/'));

      const rendered = renderInput(state);

      // Both should be present in the output
      expect(rendered).toContain('-la');
      expect(rendered).toContain('file');
    });

    it('should render entity references', () => {
      const state = updateInputStateWithTokens(createInputState('tell @file.ts', 13, 'shell', '/'));

      const rendered = renderInput(state);

      expect(rendered).toContain('@file.ts');
    });

    it('should render paths', () => {
      const state = updateInputStateWithTokens(createInputState('cd /home/user', 13, 'shell', '/'));

      const rendered = renderInput(state);

      expect(rendered).toContain('/home/user');
    });

    it('should render operators', () => {
      const state = updateInputStateWithTokens(
        createInputState('cat file | grep foo', 19, 'shell', '/')
      );

      const rendered = renderInput(state);

      expect(rendered).toContain('|');
    });

    it('should render quoted strings', () => {
      const state = updateInputStateWithTokens(
        createInputState('echo "hello world"', 18, 'shell', '/')
      );

      const rendered = renderInput(state);

      expect(rendered).toContain('"hello world"');
    });
  });
});
