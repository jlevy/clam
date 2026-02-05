import { describe, it, expect } from 'vitest';
import { CompletionMenu, renderCompletionItem, renderCompletionMenu } from './menu.js';
import { CompletionGroup, COMPLETION_ICONS, type Completion } from './types.js';

describe('CompletionMenu', () => {
  describe('renderCompletionItem', () => {
    it('should render a basic completion item', () => {
      const completion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'test',
      };

      const rendered = renderCompletionItem(completion, false);

      expect(rendered).toContain('git');
    });

    it('should highlight selected item', () => {
      const completion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'test',
      };

      const normal = renderCompletionItem(completion, false);
      const selected = renderCompletionItem(completion, true);

      // Selected should have different styling (inverse or highlight)
      expect(selected).not.toBe(normal);
    });

    it('should include icon when available', () => {
      const completion: Completion = {
        value: 'git',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'test',
        icon: COMPLETION_ICONS.command,
      };

      const rendered = renderCompletionItem(completion, false);

      expect(rendered).toContain(COMPLETION_ICONS.command);
    });

    it('should include description when available', () => {
      const completion: Completion = {
        value: 'git',
        description: 'version control',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'test',
      };

      const rendered = renderCompletionItem(completion, false);

      expect(rendered).toContain('version control');
    });

    it('should use display text when provided', () => {
      const completion: Completion = {
        value: 'git-status',
        display: 'git status',
        group: CompletionGroup.RecommendedCommand,
        score: 90,
        source: 'test',
      };

      const rendered = renderCompletionItem(completion, false);

      expect(rendered).toContain('git status');
    });
  });

  describe('renderCompletionMenu', () => {
    it('should render multiple items', () => {
      const completions: Completion[] = [
        { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
        { value: 'grep', group: CompletionGroup.RecommendedCommand, score: 85, source: 'test' },
        { value: 'go', group: CompletionGroup.RecommendedCommand, score: 80, source: 'test' },
      ];

      const rendered = renderCompletionMenu(completions, 0);

      expect(rendered).toContain('git');
      expect(rendered).toContain('grep');
      expect(rendered).toContain('go');
    });

    it('should highlight selected index', () => {
      const completions: Completion[] = [
        { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
        { value: 'grep', group: CompletionGroup.RecommendedCommand, score: 85, source: 'test' },
      ];

      const menu0 = renderCompletionMenu(completions, 0);
      const menu1 = renderCompletionMenu(completions, 1);

      // Different item should be highlighted
      expect(menu0).not.toBe(menu1);
    });

    it('should handle empty completions', () => {
      const rendered = renderCompletionMenu([], 0);
      expect(rendered).toBe('');
    });

    it('should respect maxVisible option', () => {
      const completions: Completion[] = Array.from({ length: 20 }, (_, i) => ({
        value: `cmd${i}`,
        group: CompletionGroup.OtherCommand,
        score: 50,
        source: 'test',
      }));

      const rendered = renderCompletionMenu(completions, 0, { maxVisible: 5 });
      const lines = rendered.split('\n').filter((l) => l.trim());

      expect(lines.length).toBeLessThanOrEqual(5);
    });
  });

  describe('CompletionMenu class', () => {
    it('should track selection state', () => {
      const menu = new CompletionMenu();
      const completions: Completion[] = [
        { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
        { value: 'grep', group: CompletionGroup.RecommendedCommand, score: 85, source: 'test' },
      ];

      menu.setCompletions(completions);

      expect(menu.getSelectedIndex()).toBe(0);
      expect(menu.getSelectedCompletion()?.value).toBe('git');
    });

    it('should navigate up and down', () => {
      const menu = new CompletionMenu();
      const completions: Completion[] = [
        { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
        { value: 'grep', group: CompletionGroup.RecommendedCommand, score: 85, source: 'test' },
        { value: 'go', group: CompletionGroup.RecommendedCommand, score: 80, source: 'test' },
      ];

      menu.setCompletions(completions);

      menu.selectNext();
      expect(menu.getSelectedIndex()).toBe(1);

      menu.selectNext();
      expect(menu.getSelectedIndex()).toBe(2);

      menu.selectPrevious();
      expect(menu.getSelectedIndex()).toBe(1);
    });

    it('should wrap around at boundaries', () => {
      const menu = new CompletionMenu();
      const completions: Completion[] = [
        { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
        { value: 'grep', group: CompletionGroup.RecommendedCommand, score: 85, source: 'test' },
      ];

      menu.setCompletions(completions);

      menu.selectPrevious(); // Should wrap to last
      expect(menu.getSelectedIndex()).toBe(1);

      menu.selectNext(); // Should wrap to first
      expect(menu.getSelectedIndex()).toBe(0);
    });

    it('should clear completions', () => {
      const menu = new CompletionMenu();
      const completions: Completion[] = [
        { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
      ];

      menu.setCompletions(completions);
      menu.clear();

      expect(menu.getCompletions()).toHaveLength(0);
      expect(menu.getSelectedIndex()).toBe(0);
    });
  });
});
