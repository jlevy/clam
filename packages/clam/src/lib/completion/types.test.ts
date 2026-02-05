import { describe, it, expect } from 'vitest';
import { CompletionGroup, COMPLETION_ICONS, type Completer } from './types.js';
import { createInputState } from '../input/state.js';

describe('Completion Types', () => {
  describe('CompletionGroup', () => {
    it('should have correct priority ordering', () => {
      // Lower number = higher priority
      expect(CompletionGroup.TopSuggestion).toBeLessThan(CompletionGroup.InternalCommand);
      expect(CompletionGroup.InternalCommand).toBeLessThan(CompletionGroup.Builtin);
      expect(CompletionGroup.Builtin).toBeLessThan(CompletionGroup.RecommendedCommand);
      expect(CompletionGroup.RecommendedCommand).toBeLessThan(CompletionGroup.OtherCommand);
      expect(CompletionGroup.OtherCommand).toBeLessThan(CompletionGroup.File);
      expect(CompletionGroup.File).toBeLessThan(CompletionGroup.GitRef);
      expect(CompletionGroup.GitRef).toBeLessThan(CompletionGroup.Entity);
      expect(CompletionGroup.Entity).toBeLessThan(CompletionGroup.Other);
    });
  });

  describe('COMPLETION_ICONS', () => {
    it('should have all expected icon types', () => {
      expect(COMPLETION_ICONS.command).toBeDefined();
      expect(COMPLETION_ICONS.internal).toBeDefined();
      expect(COMPLETION_ICONS.file).toBeDefined();
      expect(COMPLETION_ICONS.directory).toBeDefined();
      expect(COMPLETION_ICONS.entity).toBeDefined();
      expect(COMPLETION_ICONS.git).toBeDefined();
    });

    it('should have single-character icons', () => {
      // All icons should be single characters for consistent display
      expect(COMPLETION_ICONS.command.length).toBe(1);
      expect(COMPLETION_ICONS.internal.length).toBe(1);
      expect(COMPLETION_ICONS.file.length).toBe(1);
      expect(COMPLETION_ICONS.directory.length).toBe(1);
      expect(COMPLETION_ICONS.entity.length).toBe(1);
      expect(COMPLETION_ICONS.git.length).toBe(1);
    });
  });

  describe('Completer interface', () => {
    it('should allow implementation of a simple completer', async () => {
      // Test that the interface is usable
      const testCompleter: Completer = {
        name: 'test',
        isRelevant: (state) => state.mode === 'shell',
        getCompletions: (state) => {
          if (state.prefix === 'te') {
            return Promise.resolve([
              {
                value: 'test',
                description: 'A test command',
                group: CompletionGroup.RecommendedCommand,
                score: 90,
                source: 'test',
              },
            ]);
          }
          return Promise.resolve([]);
        },
      };

      const shellState = createInputState('te', 2, 'shell', '/');
      expect(testCompleter.isRelevant(shellState)).toBe(true);

      const nlState = createInputState('te', 2, 'nl', '/');
      expect(testCompleter.isRelevant(nlState)).toBe(false);

      // Mock state with prefix
      const stateWithPrefix = { ...shellState, prefix: 'te' };
      const completions = await testCompleter.getCompletions(stateWithPrefix);
      expect(completions).toHaveLength(1);
      expect(completions[0]?.value).toBe('test');
    });
  });
});
