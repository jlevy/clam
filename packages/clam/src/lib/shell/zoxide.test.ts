/**
 * Tests for zoxide post-cd tracking (the remaining zoxide.ts API).
 * z/zi command expansion tests are in alias-expander.test.ts.
 */

import { describe, expect, it } from 'bun:test';
import { type AbsolutePath, asAbsolutePath } from './utils.js';
import { isZoxideAvailable } from './zoxide.js';

describe('Zoxide Integration', () => {
  describe('isZoxideAvailable', () => {
    it('should return true when zoxide is in the map', () => {
      const tools = new Map<string, AbsolutePath>([['zoxide', asAbsolutePath('/usr/bin/zoxide')]]);
      expect(isZoxideAvailable(tools)).toBe(true);
    });

    it('should return false when zoxide is not in the map', () => {
      const tools = new Map<string, AbsolutePath>();
      expect(isZoxideAvailable(tools)).toBe(false);
    });
  });
});
