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
import { sortCompletions } from './scoring.js';
import type { Completer, Completion } from './types.js';

/**
 * Options for getCompletions.
 */
export interface CompletionOptions {
  /** Maximum number of completions to return (default: 50) */
  maxResults?: number;
  /** Timeout in ms for completer execution (default: 5000) */
  timeout?: number;
}

/**
 * Default maximum number of completions.
 */
const DEFAULT_MAX_RESULTS = 50;

/**
 * Default timeout for completers in ms.
 */
const DEFAULT_TIMEOUT = 5000;

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
   * 2. Run all relevant completers in parallel with timeout
   * 3. Merge, deduplicate, and sort results
   * 4. Return top N completions
   */
  async getCompletions(state: InputState, options: CompletionOptions = {}): Promise<Completion[]> {
    const { maxResults = DEFAULT_MAX_RESULTS, timeout = DEFAULT_TIMEOUT } = options;

    // Find relevant completers
    const relevantCompleters = this.getCompleters().filter((c) => c.isRelevant(state));

    if (relevantCompleters.length === 0) {
      return [];
    }

    // Run all completers in parallel with error handling and timeout
    const completionArrays = await Promise.all(
      relevantCompleters.map((c) => this.runCompleterWithTimeout(c, state, timeout))
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
   * Run a completer with timeout and error handling.
   * Returns empty array on error or timeout.
   */
  private async runCompleterWithTimeout(
    completer: Completer,
    state: InputState,
    timeout: number
  ): Promise<Completion[]> {
    try {
      const result = await Promise.race([
        completer.getCompletions(state),
        new Promise<Completion[]>((_, reject) =>
          setTimeout(() => {
            reject(new Error('Timeout'));
          }, timeout)
        ),
      ]);
      return result;
    } catch {
      // Silently ignore errors and timeouts, return empty
      return [];
    }
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
