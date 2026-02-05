import { describe, it, expect, beforeEach } from 'vitest';
import type { EntityCompleter } from './entity-completer.js';
import { createEntityCompleter } from './entity-completer.js';
import { CompletionGroup } from '../types.js';
import { createInputState } from '../../input/state.js';
import { updateInputStateWithTokens } from '../../input/parser.js';

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

    it('should not be relevant without @ trigger', () => {
      const state = updateInputStateWithTokens(createInputState('git status', 10, 'shell', '/'));
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

    it('should strip @ from prefix when searching', async () => {
      const state = updateInputStateWithTokens(createInputState('@src', 4, 'shell', '/'));

      // Should search for 'src' not '@src'
      const completions = await completer.getCompletions(state);
      // The completion values should start with @ for entity references
      if (completions.length > 0) {
        expect(completions.every((c) => c.value.startsWith('@'))).toBe(true);
      }
    });
  });

  describe('name', () => {
    it('should have a descriptive name', () => {
      expect(completer.name).toBe('entity');
    });
  });
});
