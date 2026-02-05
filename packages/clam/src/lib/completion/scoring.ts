/**
 * Scoring Algorithm - Ranks completions by relevance.
 *
 * The scoring system considers:
 * 1. Prefix match quality (exact > partial > fuzzy)
 * 2. Recency of command usage (more recent = higher)
 * 3. Length penalty (shorter completions preferred)
 *
 * Ported from kash scoring system with simplifications.
 */

import type { Completion } from './types.js';
import type { HistoryEntry } from '../input/state.js';

/**
 * Maximum score for a perfect match.
 */
const MAX_SCORE = 100;

/**
 * Base score for empty prefix (shows all completions).
 */
const EMPTY_PREFIX_SCORE = 50;

/**
 * Maximum recency bonus.
 */
const MAX_RECENCY_BONUS = 15;

/**
 * Time window for recency calculation (1 hour in ms).
 */
const RECENCY_WINDOW_MS = 60 * 60 * 1000;

/**
 * Calculate score based on how well the prefix matches the value.
 *
 * Scoring:
 * - Exact match: 100
 * - Prefix match: 80-99 (based on match ratio)
 * - No match: 0
 */
export function calculatePrefixScore(prefix: string, value: string): number {
  if (!prefix) {
    return EMPTY_PREFIX_SCORE;
  }

  const lowerPrefix = prefix.toLowerCase();
  const lowerValue = value.toLowerCase();

  // Exact match
  if (lowerValue === lowerPrefix) {
    return MAX_SCORE;
  }

  // Prefix match
  if (lowerValue.startsWith(lowerPrefix)) {
    // Score based on how much of the value is covered by the prefix
    const coverage = lowerPrefix.length / lowerValue.length;
    // Scale from 80 to 99
    return Math.round(80 + coverage * 19);
  }

  // No match
  return 0;
}

/**
 * Calculate recency bonus based on command history.
 *
 * More recent usage = higher bonus (up to MAX_RECENCY_BONUS).
 * Decays over time within RECENCY_WINDOW_MS.
 */
export function calculateRecencyBonus(value: string, history: HistoryEntry[]): number {
  const matchingEntry = history.find((entry) => entry.command === value);

  if (!matchingEntry) {
    return 0;
  }

  const now = Date.now();
  const elapsed = now - matchingEntry.timestamp.getTime();

  if (elapsed > RECENCY_WINDOW_MS) {
    return 1; // Minimal bonus for old entries
  }

  // Linear decay: full bonus at 0 elapsed, 1 at window edge
  const decay = 1 - elapsed / RECENCY_WINDOW_MS;
  return Math.round(1 + decay * (MAX_RECENCY_BONUS - 1));
}

/**
 * Calculate length penalty for longer completions.
 *
 * Shorter completions are generally more useful. The penalty
 * is small but helps break ties.
 */
export function calculateLengthPenalty(value: string): number {
  // Logarithmic penalty: grows slowly with length
  // 3 chars = ~1, 10 chars = ~3, 20 chars = ~4
  return Math.round(Math.log2(value.length + 1));
}

/**
 * Calculate the overall score for a completion.
 *
 * Combines prefix matching, recency bonus, and length penalty.
 */
export function scoreCompletion(prefix: string, value: string, history: HistoryEntry[]): number {
  const prefixScore = calculatePrefixScore(prefix, value);

  // If no prefix match, return 0
  if (prefixScore === 0) {
    return 0;
  }

  const recencyBonus = calculateRecencyBonus(value, history);
  const lengthPenalty = calculateLengthPenalty(value);

  // Combine scores, capped at MAX_SCORE
  const totalScore = prefixScore + recencyBonus - lengthPenalty;
  return Math.max(0, Math.min(MAX_SCORE, totalScore));
}

/**
 * Sort completions by group (ascending) then score (descending).
 *
 * Returns a new array without mutating the original.
 */
export function sortCompletions(completions: Completion[]): Completion[] {
  return [...completions].sort((a, b) => {
    // Sort by group first (lower = higher priority)
    if (a.group !== b.group) {
      return a.group - b.group;
    }

    // Within same group, sort by score (higher = better)
    return b.score - a.score;
  });
}
