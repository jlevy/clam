/**
 * Tests for the select menu component.
 *
 * These tests verify the rendering and key handling logic.
 * Actual stdin interaction is tested via integration tests.
 */

import { describe, expect, it } from 'bun:test';

import {
  parseKeypress,
  renderMenuLines,
  type SelectOption,
  type SelectResult,
} from './select-menu.js';

describe('select-menu', () => {
  describe('renderMenuLines', () => {
    const options: SelectOption[] = [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ];

    it('should render message and options', () => {
      const lines = renderMenuLines('Allow edit?', options, 0);
      expect(lines).toHaveLength(3); // message + 2 options
      expect(lines[0]).toContain('Allow edit?');
      expect(lines[1]).toContain('1.');
      expect(lines[1]).toContain('Yes');
      expect(lines[2]).toContain('2.');
      expect(lines[2]).toContain('No');
    });

    it('should show indicator on selected option', () => {
      const lines = renderMenuLines('Pick one', options, 0);
      // First option should have indicator
      expect(lines[1]).toMatch(/[❯›>]/); // Some indicator char
      // Second option should not
      expect(lines[2]).not.toMatch(/[❯›>]/);
    });

    it('should move indicator when selection changes', () => {
      const lines = renderMenuLines('Pick one', options, 1);
      // First option should not have indicator
      expect(lines[1]).not.toMatch(/[❯›>]/);
      // Second option should have indicator
      expect(lines[2]).toMatch(/[❯›>]/);
    });

    it('should include hint if provided', () => {
      const optionsWithHint: SelectOption[] = [
        { label: 'Yes', value: 'yes' },
        { label: 'Yes to all', value: 'yes_all', hint: '(shift+tab)' },
      ];
      const lines = renderMenuLines('Allow?', optionsWithHint, 0);
      expect(lines[2]).toContain('(shift+tab)');
    });
  });

  describe('parseKeypress', () => {
    it('should recognize arrow up', () => {
      expect(parseKeypress('\x1b[A')).toBe('up');
    });

    it('should recognize arrow down', () => {
      expect(parseKeypress('\x1b[B')).toBe('down');
    });

    it('should recognize j as down', () => {
      expect(parseKeypress('j')).toBe('down');
    });

    it('should recognize k as up', () => {
      expect(parseKeypress('k')).toBe('up');
    });

    it('should recognize enter', () => {
      expect(parseKeypress('\r')).toBe('enter');
      expect(parseKeypress('\n')).toBe('enter');
    });

    it('should recognize escape', () => {
      expect(parseKeypress('\x1b')).toBe('escape');
    });

    it('should recognize number keys 1-9', () => {
      expect(parseKeypress('1')).toBe('select:0');
      expect(parseKeypress('2')).toBe('select:1');
      expect(parseKeypress('9')).toBe('select:8');
    });

    it('should recognize Ctrl+C', () => {
      expect(parseKeypress('\x03')).toBe('cancel');
    });

    it('should return null for unknown keys', () => {
      expect(parseKeypress('x')).toBeNull();
      expect(parseKeypress('\x1b[C')).toBeNull(); // arrow right
    });
  });

  describe('SelectResult', () => {
    it('should have ok=true with value when selected', () => {
      const result: SelectResult = { ok: true, value: 'yes' };
      expect(result.ok).toBe(true);
      expect(result.value).toBe('yes');
    });

    it('should have ok=false when cancelled', () => {
      const result: SelectResult = { ok: false, cancelled: true };
      expect(result.ok).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });
});
