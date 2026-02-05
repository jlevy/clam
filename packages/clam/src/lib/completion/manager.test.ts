import { describe, expect, it } from 'bun:test';
import { updateInputStateWithTokens } from '../input/parser.js';
import { createInputState } from '../input/state.js';
import { CompletionManager } from './manager.js';
import { type Completer, type Completion, CompletionGroup } from './types.js';

describe('CompletionManager', () => {
  // Helper to create a simple completer
  function createTestCompleter(
    name: string,
    relevantFor: (prefix: string) => boolean,
    completions: Completion[]
  ): Completer {
    return {
      name,
      isRelevant: (state) => relevantFor(state.prefix),
      getCompletions: () => Promise.resolve(completions),
    };
  }

  describe('registerCompleter', () => {
    it('should register a completer', () => {
      const manager = new CompletionManager();
      const completer = createTestCompleter('test', () => true, []);

      manager.registerCompleter(completer);

      expect(manager.getCompleters()).toContain(completer);
    });

    it('should not register duplicate completers', () => {
      const manager = new CompletionManager();
      const completer = createTestCompleter('test', () => true, []);

      manager.registerCompleter(completer);
      manager.registerCompleter(completer);

      expect(manager.getCompleters().filter((c) => c.name === 'test')).toHaveLength(1);
    });
  });

  describe('getCompletions', () => {
    it('should return completions from relevant completers', async () => {
      const manager = new CompletionManager();

      const gitCompletion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'test',
      };

      manager.registerCompleter(
        createTestCompleter('git', (prefix) => prefix === 'g', [gitCompletion])
      );

      const state = updateInputStateWithTokens(createInputState('g', 1, 'shell', '/'));

      const completions = await manager.getCompletions(state);

      expect(completions).toHaveLength(1);
      expect(completions[0]?.value).toBe('git');
    });

    it('should skip irrelevant completers', async () => {
      const manager = new CompletionManager();

      const gitCompletion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'git',
      };

      manager.registerCompleter(
        createTestCompleter('git', (prefix) => prefix === 'g', [gitCompletion])
      );

      const state = updateInputStateWithTokens(createInputState('ls', 2, 'shell', '/'));

      const completions = await manager.getCompletions(state);

      expect(completions).toHaveLength(0);
    });

    it('should merge completions from multiple completers', async () => {
      const manager = new CompletionManager();

      const gitCompletion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'git',
      };

      const grepCompletion: Completion = {
        value: 'grep',
        group: CompletionGroup.RecommendedCommand,
        score: 85,
        source: 'grep',
      };

      manager.registerCompleter(
        createTestCompleter('git', (prefix) => prefix.startsWith('g'), [gitCompletion])
      );
      manager.registerCompleter(
        createTestCompleter('grep', (prefix) => prefix.startsWith('g'), [grepCompletion])
      );

      const state = updateInputStateWithTokens(createInputState('g', 1, 'shell', '/'));

      const completions = await manager.getCompletions(state);

      expect(completions).toHaveLength(2);
    });

    it('should sort completions by group then score', async () => {
      const manager = new CompletionManager();

      const lowPriorityCompletion: Completion = {
        value: 'gitk',
        group: CompletionGroup.OtherCommand,
        score: 95,
        source: 'other',
      };

      const highPriorityCompletion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 80,
        source: 'recommended',
      };

      manager.registerCompleter(createTestCompleter('other', () => true, [lowPriorityCompletion]));
      manager.registerCompleter(
        createTestCompleter('recommended', () => true, [highPriorityCompletion])
      );

      const state = updateInputStateWithTokens(createInputState('g', 1, 'shell', '/'));

      const completions = await manager.getCompletions(state);

      // Higher priority group (lower number) comes first
      expect(completions[0]?.value).toBe('git');
      expect(completions[1]?.value).toBe('gitk');
    });

    it('should handle empty input', async () => {
      const manager = new CompletionManager();

      manager.registerCompleter(
        createTestCompleter('test', () => true, [
          {
            value: 'ls',
            group: CompletionGroup.RecommendedCommand,
            score: 50,
            source: 'test',
          },
        ])
      );

      const state = updateInputStateWithTokens(createInputState('', 0, 'shell', '/'));

      const completions = await manager.getCompletions(state);

      expect(completions.length).toBeGreaterThan(0);
    });

    it('should limit number of completions', async () => {
      const manager = new CompletionManager();

      const manyCompletions: Completion[] = Array.from({ length: 100 }, (_, i) => ({
        value: `cmd${i}`,
        group: CompletionGroup.OtherCommand,
        score: 50,
        source: 'test',
      }));

      manager.registerCompleter(createTestCompleter('test', () => true, manyCompletions));

      const state = updateInputStateWithTokens(createInputState('c', 1, 'shell', '/'));

      const completions = await manager.getCompletions(state, { maxResults: 10 });

      expect(completions).toHaveLength(10);
    });
  });

  describe('unregisterCompleter', () => {
    it('should remove a completer by name', () => {
      const manager = new CompletionManager();
      const completer = createTestCompleter('test', () => true, []);

      manager.registerCompleter(completer);
      manager.unregisterCompleter('test');

      expect(manager.getCompleters()).not.toContain(completer);
    });
  });
});
