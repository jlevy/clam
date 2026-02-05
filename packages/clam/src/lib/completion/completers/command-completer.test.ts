import { describe, it, expect, beforeEach } from 'vitest';
import type { CommandCompleter } from './command-completer.js';
import { createCommandCompleter } from './command-completer.js';
import { CompletionGroup } from '../types.js';
import { createInputState } from '../../input/state.js';
import { updateInputStateWithTokens } from '../../input/parser.js';

describe('CommandCompleter', () => {
  let completer: CommandCompleter;

  beforeEach(() => {
    completer = createCommandCompleter();
  });

  describe('isRelevant', () => {
    it('should be relevant when cursor is at first token', () => {
      const state = updateInputStateWithTokens(createInputState('gi', 2, 'shell', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should be relevant for empty input', () => {
      const state = updateInputStateWithTokens(createInputState('', 0, 'shell', '/'));
      expect(completer.isRelevant(state)).toBe(true);
    });

    it('should not be relevant when cursor is past first token', () => {
      const state = updateInputStateWithTokens(createInputState('git sta', 7, 'shell', '/'));
      // Cursor is on second token (argument position)
      expect(completer.isRelevant(state)).toBe(false);
    });

    it('should not be relevant in nl mode', () => {
      const state = updateInputStateWithTokens(createInputState('gi', 2, 'nl', '/'));
      expect(completer.isRelevant(state)).toBe(false);
    });

    it('should not be relevant in slash mode', () => {
      const state = updateInputStateWithTokens(createInputState('/he', 3, 'slash', '/'));
      expect(completer.isRelevant(state)).toBe(false);
    });
  });

  describe('getCompletions', () => {
    it('should return recommended commands matching prefix', async () => {
      const state = updateInputStateWithTokens(createInputState('gi', 2, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      const gitCompletion = completions.find((c) => c.value === 'git');
      expect(gitCompletion).toBeDefined();
      expect(gitCompletion?.group).toBe(CompletionGroup.RecommendedCommand);
    });

    it('should return multiple matching commands', async () => {
      const state = updateInputStateWithTokens(createInputState('g', 1, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      // Should match git, grep, go, gunzip, gzip, etc.
      expect(completions.length).toBeGreaterThan(1);
    });

    it('should return empty for non-matching prefix', async () => {
      const state = updateInputStateWithTokens(createInputState('xyz', 3, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      expect(completions).toHaveLength(0);
    });

    it('should include icons for commands', async () => {
      const state = updateInputStateWithTokens(createInputState('gi', 2, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      const gitCompletion = completions.find((c) => c.value === 'git');
      expect(gitCompletion?.icon).toBeDefined();
    });

    it('should score exact prefix matches higher', async () => {
      const state = updateInputStateWithTokens(createInputState('git', 3, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      const gitCompletion = completions.find((c) => c.value === 'git');
      const gitAnnexCompletion = completions.find((c) => c.value?.startsWith('git-'));

      if (gitCompletion && gitAnnexCompletion) {
        expect(gitCompletion.score).toBeGreaterThan(gitAnnexCompletion.score);
      }
    });

    it('should return all recommended commands for empty prefix', async () => {
      const state = updateInputStateWithTokens(createInputState('', 0, 'shell', '/'));

      const completions = await completer.getCompletions(state);

      // Should return recommended commands
      expect(completions.length).toBeGreaterThan(0);
    });
  });

  describe('name', () => {
    it('should have a descriptive name', () => {
      expect(completer.name).toBe('command');
    });
  });
});
