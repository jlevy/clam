/**
 * CompletionManager - Orchestrates multiple completers.
 *
 * The CompletionManager is the central coordinator for the completion system.
 * It manages a registry of completers and combines their results into a
 * sorted, deduplicated list.
 *
 * Features:
 * - Lazy evaluation: Only runs completers that are relevant for the input
 * - Parallel execution: Runs all relevant completers concurrently
 * - Result merging: Combines and sorts completions by group/score
 * - Deduplication: Removes duplicate completion values
 */

import type { InputState } from '../input/state.js';
import type { Completer, Completion } from './types.js';
import { sortCompletions } from './scoring.js';

/**
 * Options for getCompletions.
 */
export interface CompletionOptions {
  /** Maximum number of completions to return (default: 50) */
  maxResults?: number;
}

/**
 * Default maximum number of completions.
 */
const DEFAULT_MAX_RESULTS = 50;

/**
 * CompletionManager orchestrates multiple completers and merges results.
 */
export class CompletionManager {
  private completers = new Map<string, Completer>();

  /**
   * Register a completer.
   *
   * Completers with the same name will not be duplicated.
   */
  registerCompleter(completer: Completer): void {
    if (!this.completers.has(completer.name)) {
      this.completers.set(completer.name, completer);
    }
  }

  /**
   * Unregister a completer by name.
   */
  unregisterCompleter(name: string): void {
    this.completers.delete(name);
  }

  /**
   * Get all registered completers.
   */
  getCompleters(): Completer[] {
    return Array.from(this.completers.values());
  }

  /**
   * Get completions for the given input state.
   *
   * 1. Filter to relevant completers (fast isRelevant check)
   * 2. Run all relevant completers in parallel
   * 3. Merge, deduplicate, and sort results
   * 4. Return top N completions
   */
  async getCompletions(state: InputState, options: CompletionOptions = {}): Promise<Completion[]> {
    const { maxResults = DEFAULT_MAX_RESULTS } = options;

    // Find relevant completers
    const relevantCompleters = this.getCompleters().filter((c) => c.isRelevant(state));

    if (relevantCompleters.length === 0) {
      return [];
    }

    // Run all completers in parallel
    const completionArrays = await Promise.all(
      relevantCompleters.map((c) => c.getCompletions(state))
    );

    // Flatten results
    const allCompletions = completionArrays.flat();

    // Deduplicate by value (keep highest-scoring duplicate)
    const uniqueCompletions = this.deduplicateCompletions(allCompletions);

    // Sort by group then score
    const sortedCompletions = sortCompletions(uniqueCompletions);

    // Return top N
    return sortedCompletions.slice(0, maxResults);
  }

  /**
   * Remove duplicate completions, keeping the one with the highest score.
   */
  private deduplicateCompletions(completions: Completion[]): Completion[] {
    const seen = new Map<string, Completion>();

    for (const completion of completions) {
      const existing = seen.get(completion.value);
      if (!existing || completion.score > existing.score) {
        seen.set(completion.value, completion);
      }
    }

    return Array.from(seen.values());
  }
}
