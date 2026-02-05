import { describe, it, expect, beforeEach } from 'vitest';
import type { CompletionIntegration } from './integration.js';
import { createCompletionIntegration } from './integration.js';

describe('CompletionIntegration', () => {
  let integration: CompletionIntegration;

  beforeEach(() => {
    integration = createCompletionIntegration({
      enableCommands: true,
      enableSlashCommands: true,
      enableEntities: false, // Disable to avoid filesystem access in tests
      cwd: '/test',
    });
  });

  describe('updateCompletions', () => {
    it('should populate completions for command prefix', async () => {
      await integration.updateCompletions('g', 1, 'shell');

      const state = integration.getState();
      expect(state.isVisible).toBe(true);
      expect(state.completions.length).toBeGreaterThan(0);
      expect(state.completions.some((c) => c.value === 'git')).toBe(true);
    });

    it('should populate completions for slash command prefix', async () => {
      await integration.updateCompletions('/h', 2, 'slash');

      const state = integration.getState();
      expect(state.isVisible).toBe(true);
      expect(state.completions.some((c) => c.value === '/help')).toBe(true);
    });

    it('should clear completions when no trigger', async () => {
      // First populate
      await integration.updateCompletions('g', 1, 'shell');
      expect(integration.isActive()).toBe(true);

      // Then clear (argument position - no trigger)
      await integration.updateCompletions('git status', 10, 'shell');
      expect(integration.isActive()).toBe(false);
    });
  });

  describe('handleKeypress', () => {
    beforeEach(async () => {
      // Set up some completions
      await integration.updateCompletions('g', 1, 'shell');
    });

    it('should handle Tab to navigate to next', () => {
      const initialSelected = integration.getState().selected?.value;

      const result = integration.handleKeypress('Tab');

      expect(result.handled).toBe(true);
      expect(result.suppress).toBe(true);
      expect(integration.getState().selected?.value).not.toBe(initialSelected);
    });

    it('should handle Shift+Tab to navigate to previous', () => {
      // Move forward first
      integration.handleKeypress('Tab');
      integration.handleKeypress('Tab');
      const afterTwoTabs = integration.getState().selected?.value;

      // Move back
      const result = integration.handleKeypress('Tab', { shift: true });

      expect(result.handled).toBe(true);
      expect(integration.getState().selected?.value).not.toBe(afterTwoTabs);
    });

    it('should handle ArrowDown to navigate', () => {
      const result = integration.handleKeypress('ArrowDown');

      expect(result.handled).toBe(true);
      expect(result.suppress).toBe(true);
    });

    it('should handle ArrowUp to navigate', () => {
      integration.handleKeypress('Tab'); // Move off first item
      const result = integration.handleKeypress('ArrowUp');

      expect(result.handled).toBe(true);
      expect(result.suppress).toBe(true);
    });

    it('should handle Enter to accept selection', () => {
      const selected = integration.getState().selected?.value;

      const result = integration.handleKeypress('Enter');

      expect(result.handled).toBe(true);
      expect(result.insertText).toBe(selected);
      expect(integration.isActive()).toBe(false); // Menu closed
    });

    it('should handle Escape to dismiss', () => {
      const result = integration.handleKeypress('Escape');

      expect(result.handled).toBe(true);
      expect(result.suppress).toBe(true);
      expect(integration.isActive()).toBe(false);
    });

    it('should not handle keys when menu is not active', () => {
      integration.reset();

      const result = integration.handleKeypress('Tab');

      expect(result.handled).toBe(false);
    });
  });

  describe('renderMenu', () => {
    it('should return empty when no completions', () => {
      integration.reset();
      const output = integration.renderMenu();
      expect(output).toBe('');
    });

    it('should return ANSI output when completions exist', async () => {
      await integration.updateCompletions('g', 1, 'shell');

      const output = integration.renderMenu();

      expect(output.length).toBeGreaterThan(0);
      // Should contain save cursor sequence
      expect(output).toContain('\x1b[s');
      // Should contain some completion text
      expect(output).toContain('git');
    });
  });

  describe('clearMenuOutput', () => {
    it('should return empty when no menu shown', () => {
      const output = integration.clearMenuOutput();
      expect(output).toBe('');
    });

    it('should return clear sequence after rendering', async () => {
      await integration.updateCompletions('g', 1, 'shell');
      integration.renderMenu(); // This sets menuLinesShown

      const output = integration.clearMenuOutput();

      expect(output.length).toBeGreaterThan(0);
      // Should contain clear line sequences
      expect(output).toContain('\x1b[2K');
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      await integration.updateCompletions('g', 1, 'shell');
      expect(integration.isActive()).toBe(true);

      integration.reset();

      expect(integration.isActive()).toBe(false);
      expect(integration.getState().completions).toHaveLength(0);
    });
  });
});
