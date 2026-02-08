/**
 * Tests for color environment variable helpers.
 */

import { describe, expect, it } from 'bun:test';
import { COLOR_FORCING_ENV, getColorEnv } from './color-env.js';

describe('COLOR_FORCING_ENV', () => {
  it('should include FORCE_COLOR set to 1', () => {
    expect(COLOR_FORCING_ENV.FORCE_COLOR).toBe('1');
  });

  it('should include CLICOLOR_FORCE set to 1', () => {
    expect(COLOR_FORCING_ENV.CLICOLOR_FORCE).toBe('1');
  });

  it('should not include CLICOLOR alone (only works with TTY)', () => {
    expect(COLOR_FORCING_ENV.CLICOLOR).toBeUndefined();
  });
});

describe('getColorEnv', () => {
  it('should include color forcing environment variables', () => {
    const env = getColorEnv();
    expect(env.FORCE_COLOR).toBe('1');
    expect(env.CLICOLOR_FORCE).toBe('1');
  });

  it('should preserve existing process.env variables', () => {
    const originalPath = process.env.PATH;
    const env = getColorEnv();
    expect(env.PATH).toBe(originalPath);
  });

  it('should set TERM to xterm-256color if not already set', () => {
    const originalTerm = process.env.TERM;
    try {
      delete process.env.TERM;
      const env = getColorEnv();
      expect(env.TERM).toBe('xterm-256color');
    } finally {
      if (originalTerm !== undefined) {
        process.env.TERM = originalTerm;
      }
    }
  });

  it('should preserve existing TERM if already set', () => {
    const originalTerm = process.env.TERM;
    try {
      process.env.TERM = 'screen-256color';
      const env = getColorEnv();
      expect(env.TERM).toBe('screen-256color');
    } finally {
      if (originalTerm !== undefined) {
        process.env.TERM = originalTerm;
      } else {
        delete process.env.TERM;
      }
    }
  });
});
