import { beforeEach, describe, expect, it } from 'bun:test';
import type { CompletionKeyHandler } from './key-handler.js';
import { createCompletionKeyHandler, KeyAction } from './key-handler.js';
import { CompletionMenu } from './menu.js';
import { type Completion, CompletionGroup } from './types.js';

describe('CompletionKeyHandler', () => {
  let handler: CompletionKeyHandler;
  let menu: CompletionMenu;

  const testCompletions: Completion[] = [
    { value: 'git', group: CompletionGroup.RecommendedCommand, score: 90, source: 'test' },
    { value: 'grep', group: CompletionGroup.RecommendedCommand, score: 85, source: 'test' },
    { value: 'go', group: CompletionGroup.RecommendedCommand, score: 80, source: 'test' },
  ];

  beforeEach(() => {
    menu = new CompletionMenu();
    menu.setCompletions(testCompletions);
    handler = createCompletionKeyHandler(menu);
  });

  describe('handleKey', () => {
    it('should return "next" action for Tab', () => {
      const result = handler.handleKey('Tab');
      expect(result).toBe(KeyAction.Next);
      expect(menu.getSelectedIndex()).toBe(1);
    });

    it('should return "next" action for Down arrow', () => {
      const result = handler.handleKey('ArrowDown');
      expect(result).toBe(KeyAction.Next);
      expect(menu.getSelectedIndex()).toBe(1);
    });

    it('should return "previous" action for Shift+Tab', () => {
      menu.selectNext(); // Move to index 1
      const result = handler.handleKey('Tab', { shift: true });
      expect(result).toBe(KeyAction.Previous);
      expect(menu.getSelectedIndex()).toBe(0);
    });

    it('should return "previous" action for Up arrow', () => {
      menu.selectNext(); // Move to index 1
      const result = handler.handleKey('ArrowUp');
      expect(result).toBe(KeyAction.Previous);
      expect(menu.getSelectedIndex()).toBe(0);
    });

    it('should return "accept" action for Enter', () => {
      const result = handler.handleKey('Enter');
      expect(result).toBe(KeyAction.Accept);
    });

    it('should return "dismiss" action for Escape', () => {
      const result = handler.handleKey('Escape');
      expect(result).toBe(KeyAction.Dismiss);
    });

    it('should return "none" for unrecognized keys', () => {
      const result = handler.handleKey('KeyA');
      expect(result).toBe(KeyAction.None);
    });
  });

  describe('getSelectedCompletion', () => {
    it('should return the currently selected completion', () => {
      const selected = handler.getSelectedCompletion();
      expect(selected?.value).toBe('git');
    });

    it('should return updated selection after navigation', () => {
      handler.handleKey('Tab');
      const selected = handler.getSelectedCompletion();
      expect(selected?.value).toBe('grep');
    });
  });

  describe('isActive', () => {
    it('should return true when menu has completions', () => {
      expect(handler.isActive()).toBe(true);
    });

    it('should return false when menu is empty', () => {
      menu.clear();
      expect(handler.isActive()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear the menu', () => {
      handler.reset();
      expect(handler.isActive()).toBe(false);
    });
  });
});
