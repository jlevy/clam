/**
 * CommandCompleter - Provides command completions for shell input.
 *
 * Completes command names from:
 * 1. Recommended commands (curated list of common dev tools)
 * 2. PATH executables (future enhancement)
 *
 * Only active when cursor is at command position (first token).
 */

import type { InputState } from '../../input/state.js';
import type { Completer, Completion } from '../types.js';
import { CompletionGroup, COMPLETION_ICONS } from '../types.js';
import {
  RECOMMENDED_COMMANDS,
  isRecommendedCommand,
  getCommandDescription,
} from '../recommended-commands.js';
import { calculatePrefixScore } from '../scoring.js';

/**
 * CommandCompleter implements the Completer interface for shell commands.
 */
export interface CommandCompleter extends Completer {
  name: 'command';
}

/**
 * Check if the cursor is at command position (first token or empty input).
 */
function isAtCommandPosition(state: InputState): boolean {
  // Empty input - command position
  if (state.tokens.length === 0) {
    return true;
  }

  // Find first non-whitespace token
  const firstNonWhitespace = state.tokens.find((t) => t.type !== 'whitespace');

  if (!firstNonWhitespace) {
    return true;
  }

  // Check if cursor is within the first token
  return state.cursorPos >= firstNonWhitespace.start && state.cursorPos <= firstNonWhitespace.end;
}

/**
 * Create a CommandCompleter instance.
 */
export function createCommandCompleter(): CommandCompleter {
  return {
    name: 'command',

    isRelevant(state: InputState): boolean {
      // Only relevant in shell mode
      if (state.mode !== 'shell') {
        return false;
      }

      // Only relevant at command position
      return isAtCommandPosition(state);
    },

    getCompletions(state: InputState): Promise<Completion[]> {
      const prefix = state.prefix.toLowerCase();
      const completions: Completion[] = [];

      for (const cmd of RECOMMENDED_COMMANDS) {
        // Filter by prefix
        if (prefix && !cmd.toLowerCase().startsWith(prefix)) {
          continue;
        }

        // Calculate score
        const score = calculatePrefixScore(prefix, cmd);

        // Skip if no match
        if (score === 0 && prefix) {
          continue;
        }

        const group = isRecommendedCommand(cmd)
          ? CompletionGroup.RecommendedCommand
          : CompletionGroup.OtherCommand;

        completions.push({
          value: cmd,
          description: getCommandDescription(cmd),
          group,
          score,
          source: 'command',
          icon: COMPLETION_ICONS.command,
        });
      }

      return Promise.resolve(completions);
    },
  };
}
