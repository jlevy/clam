/**
 * Tests for formatting utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  colors,
  formatDuration,
  formatTimestamp,
  formatTokenUsage,
  formatToolStatus,
  promptChars,
  symbols,
  truncateLines,
} from './formatting.js';

describe('colors', () => {
  it('should export semantic color functions', () => {
    // Verify all expected color functions exist
    expect(typeof colors.userPrompt).toBe('function');
    expect(typeof colors.agentText).toBe('function');
    expect(typeof colors.success).toBe('function');
    expect(typeof colors.error).toBe('function');
    expect(typeof colors.info).toBe('function');
    expect(typeof colors.warn).toBe('function');
    expect(typeof colors.muted).toBe('function');
    expect(typeof colors.bold).toBe('function');
  });

  it('should return strings from color functions', () => {
    expect(typeof colors.userPrompt('test')).toBe('string');
    expect(typeof colors.success('test')).toBe('string');
    expect(typeof colors.error('test')).toBe('string');
  });
});

describe('promptChars', () => {
  it('should export prompt characters', () => {
    expect(typeof promptChars.input).toBe('string');
    expect(typeof promptChars.tool).toBe('string');
    expect(typeof promptChars.continuation).toBe('string');
  });

  it('should have expected Unicode characters', () => {
    expect(promptChars.input).toBe('\u25b6'); // ▶
    expect(promptChars.continuation).toBe('\u2026'); // …
    expect(promptChars.tool).toBe('>');
  });
});

describe('symbols', () => {
  it('should export status symbols', () => {
    expect(typeof symbols.success).toBe('string');
    expect(typeof symbols.error).toBe('string');
    expect(typeof symbols.warning).toBe('string');
    expect(typeof symbols.info).toBe('string');
    expect(typeof symbols.arrow).toBe('string');
    expect(typeof symbols.bullet).toBe('string');
  });
});

describe('formatToolStatus', () => {
  it('should return appropriate symbols for each status', () => {
    expect(formatToolStatus('pending')).toContain('\u25cb'); // ○
    expect(formatToolStatus('in_progress')).toContain('\u25cf'); // ●
    expect(formatToolStatus('completed')).toContain('\u2713'); // ✓
    expect(formatToolStatus('failed')).toContain('\u2717'); // ✗
  });

  it('should handle unknown status', () => {
    // Cast to bypass TypeScript - testing runtime behavior
    expect(formatToolStatus('unknown' as 'pending')).toContain('?');
  });
});

describe('truncateLines', () => {
  it('should not truncate when within limit', () => {
    const result = truncateLines('line1\nline2\nline3', 5);
    expect(result.truncated).toBe(false);
    expect(result.hiddenLines).toBe(0);
    expect(result.text).toBe('line1\nline2\nline3');
  });

  it('should not truncate exactly at limit', () => {
    const result = truncateLines('line1\nline2\nline3', 3);
    expect(result.truncated).toBe(false);
    expect(result.hiddenLines).toBe(0);
  });

  it('should truncate when over limit', () => {
    const result = truncateLines('line1\nline2\nline3\nline4\nline5', 3);
    expect(result.truncated).toBe(true);
    expect(result.hiddenLines).toBe(2);
    expect(result.text).toBe('line1\nline2\nline3');
  });

  it('should handle single line', () => {
    const result = truncateLines('single line', 1);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe('single line');
  });

  it('should handle empty string', () => {
    const result = truncateLines('', 5);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe('');
  });
});

describe('formatTimestamp', () => {
  it('should format a specific date correctly', () => {
    const date = new Date('2024-01-15T14:30:45');
    const result = formatTimestamp(date);
    expect(result).toContain('14:30:45');
  });

  it('should pad single digit values', () => {
    const date = new Date('2024-01-15T09:05:03');
    const result = formatTimestamp(date);
    expect(result).toContain('09:05:03');
  });

  it('should use current date when no argument', () => {
    const result = formatTimestamp();
    // Should return a string in [HH:MM:SS] format
    expect(result).toMatch(/\[?\d{2}:\d{2}:\d{2}\]?/);
  });
});

describe('formatTokenUsage', () => {
  it('should format token counts correctly', () => {
    const result = formatTokenUsage(100, 200);
    expect(result).toContain('100');
    expect(result).toContain('200');
    expect(result).toContain('300'); // total
  });

  it('should handle large numbers with locale formatting', () => {
    const result = formatTokenUsage(1000, 2000);
    // Contains the numbers (may have locale-specific formatting)
    expect(result).toMatch(/1[,.]?000/);
    expect(result).toMatch(/2[,.]?000/);
    expect(result).toMatch(/3[,.]?000/);
  });

  it('should handle zero values', () => {
    const result = formatTokenUsage(0, 0);
    expect(result).toContain('0');
  });
});

describe('formatDuration', () => {
  it('should format milliseconds under 1 second', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1)).toBe('1ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds for 1000ms and above', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(2000)).toBe('2.0s');
  });

  it('should round to one decimal place for seconds', () => {
    expect(formatDuration(1234)).toBe('1.2s');
    expect(formatDuration(1567)).toBe('1.6s');
  });
});
