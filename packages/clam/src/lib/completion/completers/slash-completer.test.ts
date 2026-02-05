import { describe, it, expect, beforeEach } from 'vitest';
import type { SlashCompleter } from './slash-completer.js';
import { createSlashCompleter } from './slash-completer.js';
import { CompletionGroup } from '../types.js';
import { createInputState } from '../../input/state.js';
import { updateInputStateWithTokens } from '../../input/parser.js';

describe('SlashCompleter', () => {
  let completer: SlashCompleter;

  beforeEach(() => {
    completer = createSlashCompleter();
  });

  describe('isRelevant', () => {
    it('should be relevant for slash commands', () => {
      const state = updateInputStateWithTokens(createInputState('/he', 3, 'slash', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should be relevant when input starts with /', () => {
      const state = updateInputStateWithTokens(createInputState('/', 1, 'shell', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should not be relevant for regular shell commands', () => {
      const state = updateInputStateWithTokens(createInputState('git', 3, 'shell', '/'));
      expect(completer.isRelevant(state)).toBe(false);
    });

    it('should not be relevant in nl mode', () => {
      const state = updateInputStateWithTokens(createInputState('hello', 5, 'nl', '/'));
      expect(completer.isRelevant(state)).toBe(false);
    });
  });

  describe('getCompletions', () => {
    it('should return slash commands matching prefix', async () => {
      const state = updateInputStateWithTokens(createInputState('/he', 3, 'slash', '/'));

      const completions = await completer.getCompletions(state);

      const helpCompletion = completions.find((c) => c.value === '/help');
      expect(helpCompletion).toBeDefined();
    });

    it('should return all slash commands for bare /', async () => {
      const state = updateInputStateWithTokens(createInputState('/', 1, 'slash', '/'));

      const completions = await completer.getCompletions(state);

      expect(completions.length).toBeGreaterThan(0);
      expect(completions.every((c) => c.value.startsWith('/'))).toBe(true);
    });

    it('should return internal command group', async () => {
      const state = updateInputStateWithTokens(createInputState('/he', 3, 'slash', '/'));

      const completions = await completer.getCompletions(state);

      expect(completions.every((c) => c.group === CompletionGroup.InternalCommand)).toBe(true);
    });

    it('should include descriptions for commands', async () => {
      const state = updateInputStateWithTokens(createInputState('/he', 3, 'slash', '/'));

      const completions = await completer.getCompletions(state);

      const helpCompletion = completions.find((c) => c.value === '/help');
      expect(helpCompletion?.description).toBeDefined();
    });

    it('should include icons', async () => {
      const state = updateInputStateWithTokens(createInputState('/he', 3, 'slash', '/'));

      const completions = await completer.getCompletions(state);

      expect(completions.every((c) => c.icon !== undefined)).toBe(true);
    });

    it('should return empty for non-matching prefix', async () => {
      const state = updateInputStateWithTokens(createInputState('/xyz', 4, 'slash', '/'));

      const completions = await completer.getCompletions(state);

      expect(completions).toHaveLength(0);
    });
  });

  describe('name', () => {
    it('should have a descriptive name', () => {
      expect(completer.name).toBe('slash');
    });
  });
});
