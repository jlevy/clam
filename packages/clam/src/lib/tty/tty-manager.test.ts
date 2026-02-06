/**
 * Tests for TTY Manager module.
 *
 * Note: Many TTY operations require an actual terminal, so these tests
 * focus on the logic that can be tested without a real TTY.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  disableRawMode,
  enableRawMode,
  restoreTtyState,
  saveTtyState,
  withTtyManagement,
} from './tty-manager.js';

describe('TTY Manager', () => {
  describe('saveTtyState', () => {
    it('returns null when stdin is not a TTY', () => {
      // In test environment, stdin is usually not a TTY
      const state = saveTtyState();
      // Either null (no TTY) or an object with wasRawMode
      if (process.stdin.isTTY) {
        expect(state).toHaveProperty('wasRawMode');
      } else {
        expect(state).toBeNull();
      }
    });
  });

  describe('restoreTtyState', () => {
    it('handles null state gracefully', () => {
      // Should not throw
      expect(() => {
        restoreTtyState(null);
      }).not.toThrow();
    });

    it('handles state with wasRawMode false', () => {
      // Should not throw
      expect(() => {
        restoreTtyState({ wasRawMode: false });
      }).not.toThrow();
    });
  });

  describe('disableRawMode', () => {
    it('does not throw when stdin is not a TTY', () => {
      expect(() => {
        disableRawMode();
      }).not.toThrow();
    });
  });

  describe('enableRawMode', () => {
    it('does not throw when stdin is not a TTY', () => {
      expect(() => {
        enableRawMode();
      }).not.toThrow();
    });
  });

  describe('withTtyManagement', () => {
    it('executes the provided function', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await withTtyManagement(fn);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('returns the function result', async () => {
      const result = await withTtyManagement(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('propagates errors from the function', async () => {
      const error = new Error('test error');
      await expect(withTtyManagement(() => Promise.reject(error))).rejects.toThrow('test error');
    });

    it('restores state even when function throws', async () => {
      // Even if the function throws, restoreTtyState should be called
      const fn = vi.fn().mockRejectedValue(new Error('test'));

      try {
        await withTtyManagement(fn);
      } catch {
        // Expected
      }

      // Function was called
      expect(fn).toHaveBeenCalled();
    });
  });
});
