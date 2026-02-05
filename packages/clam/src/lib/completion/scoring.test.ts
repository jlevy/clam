import { describe, expect, it } from 'bun:test';
import {
  calculateLengthPenalty,
  calculatePrefixScore,
  calculateRecencyBonus,
  scoreCompletion,
  sortCompletions,
} from './scoring.js';
import { type Completion, CompletionGroup } from './types.js';

describe('Completion Scoring', () => {
  describe('calculatePrefixScore', () => {
    it('should give highest score for exact prefix match', () => {
      const score = calculatePrefixScore('git', 'git');
      expect(score).toBe(100);
    });

    it('should give high score for prefix match at start', () => {
      const score = calculatePrefixScore('gi', 'git');
      expect(score).toBeGreaterThan(80);
    });

    it('should give lower score for partial matches', () => {
      const prefixScore = calculatePrefixScore('gi', 'git');
      const partialScore = calculatePrefixScore('g', 'git');

      expect(prefixScore).toBeGreaterThan(partialScore);
    });

    it('should return 0 for no prefix match', () => {
      const score = calculatePrefixScore('xyz', 'git');
      expect(score).toBe(0);
    });

    it('should handle empty prefix', () => {
      const score = calculatePrefixScore('', 'git');
      expect(score).toBeGreaterThan(0); // Should still have base score
    });

    it('should be case-insensitive', () => {
      const score1 = calculatePrefixScore('GIT', 'git');
      const score2 = calculatePrefixScore('git', 'git');
      expect(score1).toBe(score2);
    });
  });

  describe('calculateRecencyBonus', () => {
    it('should give bonus for recent usage', () => {
      const recentTime = new Date(Date.now() - 60000); // 1 minute ago
      const bonus = calculateRecencyBonus('git', [{ command: 'git', timestamp: recentTime }]);

      expect(bonus).toBeGreaterThan(0);
    });

    it('should give higher bonus for more recent usage', () => {
      const veryRecent = new Date(Date.now() - 30000); // 30 seconds ago
      const lessRecent = new Date(Date.now() - 3600000); // 1 hour ago

      const recentBonus = calculateRecencyBonus('git', [{ command: 'git', timestamp: veryRecent }]);
      const olderBonus = calculateRecencyBonus('git', [{ command: 'git', timestamp: lessRecent }]);

      expect(recentBonus).toBeGreaterThan(olderBonus);
    });

    it('should return 0 for commands not in history', () => {
      const bonus = calculateRecencyBonus('git', [{ command: 'ls', timestamp: new Date() }]);

      expect(bonus).toBe(0);
    });

    it('should handle empty history', () => {
      const bonus = calculateRecencyBonus('git', []);
      expect(bonus).toBe(0);
    });
  });

  describe('calculateLengthPenalty', () => {
    it('should penalize longer completions', () => {
      const shortPenalty = calculateLengthPenalty('git');
      const longPenalty = calculateLengthPenalty('git-filter-branch');

      expect(shortPenalty).toBeLessThan(longPenalty);
    });

    it('should not over-penalize reasonable lengths', () => {
      const penalty = calculateLengthPenalty('git');
      expect(penalty).toBeLessThan(10); // Reasonable penalty
    });
  });

  describe('scoreCompletion', () => {
    it('should combine prefix score, recency bonus, and length penalty', () => {
      const history = [{ command: 'git', timestamp: new Date() }];
      const score = scoreCompletion('gi', 'git', history);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should favor shorter completions with same prefix', () => {
      const shortScore = scoreCompletion('ls', 'ls', []);
      const longScore = scoreCompletion('ls', 'lsattr', []);

      expect(shortScore).toBeGreaterThan(longScore);
    });
  });

  describe('sortCompletions', () => {
    it('should sort by group first (lower group = higher priority)', () => {
      const completions: Completion[] = [
        {
          value: 'other',
          group: CompletionGroup.OtherCommand,
          score: 90,
          source: 'test',
        },
        {
          value: 'builtin',
          group: CompletionGroup.Builtin,
          score: 50,
          source: 'test',
        },
      ];

      const sorted = sortCompletions(completions);

      expect(sorted[0]?.value).toBe('builtin');
      expect(sorted[1]?.value).toBe('other');
    });

    it('should sort by score within same group (higher score first)', () => {
      const completions: Completion[] = [
        {
          value: 'low',
          group: CompletionGroup.RecommendedCommand,
          score: 30,
          source: 'test',
        },
        {
          value: 'high',
          group: CompletionGroup.RecommendedCommand,
          score: 80,
          source: 'test',
        },
        {
          value: 'mid',
          group: CompletionGroup.RecommendedCommand,
          score: 50,
          source: 'test',
        },
      ];

      const sorted = sortCompletions(completions);

      expect(sorted[0]?.value).toBe('high');
      expect(sorted[1]?.value).toBe('mid');
      expect(sorted[2]?.value).toBe('low');
    });

    it('should handle empty array', () => {
      const sorted = sortCompletions([]);
      expect(sorted).toEqual([]);
    });

    it('should not mutate original array', () => {
      const completions: Completion[] = [
        {
          value: 'b',
          group: CompletionGroup.OtherCommand,
          score: 90,
          source: 'test',
        },
        {
          value: 'a',
          group: CompletionGroup.Builtin,
          score: 50,
          source: 'test',
        },
      ];
      const original = [...completions];

      sortCompletions(completions);

      expect(completions).toEqual(original);
    });
  });
});
