/**
 * Tests for shell convenience features.
 */

import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';
import {
  createCommandTimer,
  formatDuration,
  formatExitCode,
  isDirectoryPath,
} from './conveniences.js';

describe('Shell Conveniences', () => {
  describe('isDirectoryPath', () => {
    it('should return true for valid directories', () => {
      // Current directory
      expect(isDirectoryPath('.')).toBe(true);
      // Parent directory
      expect(isDirectoryPath('..')).toBe(true);
      // Absolute path (use OS temp dir for cross-platform compatibility)
      expect(isDirectoryPath(tmpdir())).toBe(true);
    });

    it('should return true for home directory shortcut', () => {
      // This depends on HOME being set
      if (process.env.HOME) {
        expect(isDirectoryPath('~')).toBe(true);
      }
    });

    it('should return false for empty input', () => {
      expect(isDirectoryPath('')).toBe(false);
      expect(isDirectoryPath('   ')).toBe(false);
    });

    it('should return false for command-like input', () => {
      expect(isDirectoryPath('ls -la')).toBe(false);
      expect(isDirectoryPath('git status')).toBe(false);
    });

    it('should return false for non-existent paths', () => {
      expect(isDirectoryPath('/nonexistent/path/12345')).toBe(false);
    });
  });

  describe('formatExitCode', () => {
    it('should return empty string for success', () => {
      expect(formatExitCode(0)).toBe('');
    });

    it('should format non-zero exit codes', () => {
      expect(formatExitCode(1)).toBe('[exit 1]');
      expect(formatExitCode(127)).toBe('[exit 127]');
      expect(formatExitCode(255)).toBe('[exit 255]');
    });
  });

  describe('formatDuration', () => {
    it('should return empty string for short durations', () => {
      expect(formatDuration(100)).toBe('');
      expect(formatDuration(1999)).toBe('');
    });

    it('should format durations at or above threshold', () => {
      expect(formatDuration(2000)).toBe('[2.0s]');
      expect(formatDuration(2300)).toBe('[2.3s]');
      expect(formatDuration(5000)).toBe('[5.0s]');
    });

    it('should format minute durations', () => {
      expect(formatDuration(60000)).toBe('[1m 0s]');
      expect(formatDuration(90000)).toBe('[1m 30s]');
      expect(formatDuration(125000)).toBe('[2m 5s]');
    });

    it('should respect custom threshold', () => {
      expect(formatDuration(500, 500)).toBe('[0.5s]');
      expect(formatDuration(500, 1000)).toBe('');
    });
  });

  describe('createCommandTimer', () => {
    it('should track command duration', async () => {
      const timer = createCommandTimer();
      timer.start();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = timer.stop();
      expect(duration).toBeGreaterThan(40);
      expect(duration).toBeLessThan(200);
    });

    it('should format duration', async () => {
      const timer = createCommandTimer();
      timer.start();
      await new Promise((resolve) => setTimeout(resolve, 50));
      timer.stop();

      // Should be empty because below default threshold
      expect(timer.format()).toBe('');

      // With lower threshold, should show duration
      const formatted = timer.format(10);
      expect(formatted).toMatch(/^\[\d+\.\ds\]$/);
    });

    it('should return 0 if not started', () => {
      const timer = createCommandTimer();
      expect(timer.stop()).toBe(0);
    });

    it('should return empty format if not started', () => {
      const timer = createCommandTimer();
      expect(timer.format()).toBe('');
    });
  });
});
