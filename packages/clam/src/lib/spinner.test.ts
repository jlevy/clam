import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AQUATIC_VERBS,
  createSpinner,
  createVerbSelector,
  getNextFrame,
  SpinnerMode,
  WAVE_FRAMES,
} from './spinner.js';

describe('spinner', () => {
  describe('wave frames', () => {
    it('should have the correct wave character set', () => {
      // Wave pattern: calm → ripple → waves → strong → waves → ripple → repeat
      expect(WAVE_FRAMES).toEqual(['─', '~', '≈', '≋', '≈', '~']);
    });

    it('should have 6 frames for a complete wave cycle', () => {
      expect(WAVE_FRAMES).toHaveLength(6);
    });
  });

  describe('getNextFrame', () => {
    it('should return the first frame for index 0', () => {
      expect(getNextFrame(0)).toBe('─');
    });

    it('should cycle through frames', () => {
      expect(getNextFrame(0)).toBe('─');
      expect(getNextFrame(1)).toBe('~');
      expect(getNextFrame(2)).toBe('≈');
      expect(getNextFrame(3)).toBe('≋');
      expect(getNextFrame(4)).toBe('≈');
      expect(getNextFrame(5)).toBe('~');
    });

    it('should wrap around after the last frame', () => {
      expect(getNextFrame(6)).toBe('─');
      expect(getNextFrame(7)).toBe('~');
      expect(getNextFrame(12)).toBe('─');
    });
  });

  describe('aquatic verbs', () => {
    it('should have at least 80 verbs for variety', () => {
      expect(AQUATIC_VERBS.length).toBeGreaterThanOrEqual(80);
    });

    it('should contain core aquatic verbs', () => {
      const expectedVerbs = ['Swimming', 'Drifting', 'Bubbling', 'Clamming', 'Filtering'];
      for (const verb of expectedVerbs) {
        expect(AQUATIC_VERBS).toContain(verb);
      }
    });

    it('should have unique verbs (no duplicates)', () => {
      const uniqueVerbs = new Set(AQUATIC_VERBS);
      expect(uniqueVerbs.size).toBe(AQUATIC_VERBS.length);
    });

    it('all verbs should end with "ing"', () => {
      for (const verb of AQUATIC_VERBS) {
        expect(verb.endsWith('ing')).toBe(true);
      }
    });
  });

  describe('createVerbSelector', () => {
    it('should return a function', () => {
      const selector = createVerbSelector();
      expect(typeof selector).toBe('function');
    });

    it('should return verbs from the list', () => {
      const selector = createVerbSelector();
      const verb = selector();
      expect(AQUATIC_VERBS).toContain(verb);
    });

    it('should return different verbs over multiple calls', () => {
      const selector = createVerbSelector();
      const verbs = new Set<string>();
      // Get 10 verbs and check we get at least 5 unique ones
      for (let i = 0; i < 10; i++) {
        verbs.add(selector());
      }
      expect(verbs.size).toBeGreaterThanOrEqual(5);
    });

    it('should eventually cycle through all verbs', () => {
      const selector = createVerbSelector();
      const seen = new Set<string>();
      // Get enough verbs to see all of them
      for (let i = 0; i < AQUATIC_VERBS.length * 2; i++) {
        seen.add(selector());
      }
      // Should have seen all verbs after going through the list twice
      expect(seen.size).toBe(AQUATIC_VERBS.length);
    });
  });

  describe('SpinnerMode', () => {
    it('should have three modes', () => {
      expect(SpinnerMode.Plain).toBe('plain');
      expect(SpinnerMode.CustomMessage).toBe('custom');
      expect(SpinnerMode.FunVerbs).toBe('funVerbs');
    });
  });

  describe('createSpinner', () => {
    let output: string[];
    let mockWrite: (text: string) => void;

    beforeEach(() => {
      vi.useFakeTimers();
      output = [];
      mockWrite = (text: string) => output.push(text);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('plain mode', () => {
      it('should render just the wave character', () => {
        const spinner = createSpinner({ mode: SpinnerMode.Plain, write: mockWrite });
        spinner.start();

        // First frame
        expect(output[0]).toContain('─');
        expect(output[0]).not.toContain('...');

        vi.advanceTimersByTime(80);
        expect(output[1]).toContain('~');

        spinner.stop();
      });

      it('should stop and clear output', () => {
        const spinner = createSpinner({ mode: SpinnerMode.Plain, write: mockWrite });
        spinner.start();
        spinner.stop();

        // Last output should be a clear sequence
        const lastOutput = output[output.length - 1];
        expect(lastOutput).toContain('\r');
        expect(lastOutput).toContain('\x1b[K');
      });
    });

    describe('custom message mode', () => {
      it('should render wave character and custom message', () => {
        const spinner = createSpinner({
          mode: SpinnerMode.CustomMessage,
          message: 'Connecting',
          write: mockWrite,
        });
        spinner.start();

        expect(output[0]).toContain('─');
        expect(output[0]).toContain('Connecting');

        spinner.stop();
      });

      it('should default to empty message if none provided', () => {
        const spinner = createSpinner({
          mode: SpinnerMode.CustomMessage,
          write: mockWrite,
        });
        spinner.start();

        expect(output[0]).toContain('─');

        spinner.stop();
      });
    });

    describe('fun verbs mode', () => {
      it('should render wave character and a verb', () => {
        const spinner = createSpinner({
          mode: SpinnerMode.FunVerbs,
          write: mockWrite,
        });
        spinner.start();

        // Should contain a wave frame
        expect(output[0]).toMatch(/[─~≈≋]/);
        // Should contain some verb (any from our list)
        const firstOutput = output[0]!;
        const hasVerb = AQUATIC_VERBS.some((verb) => firstOutput.includes(verb));
        expect(hasVerb).toBe(true);

        spinner.stop();
      });

      it('should animate ellipsis over time', () => {
        const spinner = createSpinner({
          mode: SpinnerMode.FunVerbs,
          write: mockWrite,
        });
        spinner.start();

        // Collect outputs over time to check ellipsis animation
        vi.advanceTimersByTime(200); // First frame: "Verb"
        vi.advanceTimersByTime(150); // Second frame: "Verb."
        vi.advanceTimersByTime(150); // Third frame: "Verb.."
        vi.advanceTimersByTime(400); // Fourth frame: "Verb..."

        // Check that we see progressive dots
        const dotsPattern = output.filter(
          (o) => o.includes('.') || o.includes('..') || o.includes('...')
        );
        expect(dotsPattern.length).toBeGreaterThan(0);

        spinner.stop();
      });
    });
  });
});
