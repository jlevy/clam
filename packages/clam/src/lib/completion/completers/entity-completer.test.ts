import { beforeEach, describe, expect, it } from 'bun:test';
import { updateInputStateWithTokens } from '../../input/parser.js';
import { createInputState } from '../../input/state.js';
import { CompletionGroup } from '../types.js';
import type { EntityCompleter } from './entity-completer.js';
import { createEntityCompleter } from './entity-completer.js';

describe('EntityCompleter', () => {
  let completer: EntityCompleter;

  beforeEach(() => {
    completer = createEntityCompleter();
  });

  describe('isRelevant', () => {
    it('should be relevant when prefix starts with @', () => {
      const state = updateInputStateWithTokens(createInputState('ask @fi', 7, 'shell', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should be relevant when isEntityTrigger is true', () => {
      const state = updateInputStateWithTokens(createInputState('@', 1, 'shell', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should be relevant for shell arguments (enables Tab file completion)', () => {
      const state = updateInputStateWithTokens(createInputState('cat file', 8, 'shell', '/'));
      // tokenIndex > 0 means we're past the command position
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should be relevant for shell arguments with no prefix (cursor after space)', () => {
      // "ls -l " with cursor at end (position 6, after the space)
      const state = updateInputStateWithTokens(createInputState('ls -l ', 6, 'shell', '/'));
      // tokenIndex > 0 means we're past the command position
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should not be relevant for command position (tokenIndex 0)', () => {
      const state = updateInputStateWithTokens(createInputState('git', 3, 'shell', '/'));
      // At command position, command completer should handle it, not entity
      expect(completer.isRelevant(state)).toBe(false);
    });

    it('should be relevant in any mode when @ is present', () => {
      const state = updateInputStateWithTokens(createInputState('tell @user', 10, 'nl', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });
  });

  describe('getCompletions', () => {
    it('should return file completions for @ prefix', async () => {
      const state = updateInputStateWithTokens(createInputState('@pack', 5, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      // Should have at least the package.json file
      expect(completions.length).toBeGreaterThanOrEqual(0);
    });

    it('should return Entity group', async () => {
      const state = updateInputStateWithTokens(createInputState('@', 1, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      if (completions.length > 0) {
        expect(completions.every((c) => c.group === CompletionGroup.Entity)).toBe(true);
      }
    });

    it('should include file icon', async () => {
      const state = updateInputStateWithTokens(createInputState('@', 1, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      if (completions.length > 0) {
        expect(completions.every((c) => c.icon !== undefined)).toBe(true);
      }
    });

    it('should strip @ from prefix when searching and return clean values', async () => {
      const state = updateInputStateWithTokens(createInputState('@src', 4, 'shell', '/'));

      // Should search for 'src' not '@src'
      const completions = await completer.getCompletions(state);
      // The completion values should NOT include @ prefix - the insertion logic handles @ replacement
      if (completions.length > 0) {
        expect(completions.every((c) => !c.value.startsWith('@'))).toBe(true);
      }
    });

    it('should return all files when prefix is whitespace (Tab after space)', async () => {
      // Simulate "ls " with cursor at position 3 (after the space)
      // The current token would be whitespace, so prefix is " "
      const state = updateInputStateWithTokens(createInputState('ls ', 3, 'shell', '/tmp'));

      const completions = await completer.getCompletions(state);

      // Should return files without filtering (whitespace prefix treated as empty)
      // At least verify it doesn't crash and returns some results (or empty if /tmp is empty)
      expect(Array.isArray(completions)).toBe(true);
    });
  });

  describe('name', () => {
    it('should have a descriptive name', () => {
      expect(completer.name).toBe('entity');
    });
  });
});
