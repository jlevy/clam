/**
 * SlashCompleter - Provides completions for slash commands.
 *
 * Slash commands are internal commands like /help, /clear, /config.
 * They are triggered when input starts with '/'.
 */

import type { InputState } from '../../input/state.js';
import type { Completer, Completion } from '../types.js';
import { CompletionGroup, COMPLETION_ICONS } from '../types.js';
import { calculatePrefixScore } from '../scoring.js';

/**
 * SlashCompleter implements the Completer interface for slash commands.
 */
export interface SlashCompleter extends Completer {
  name: 'slash';
}

/**
 * Definition of a slash command.
 */
interface SlashCommand {
  name: string;
  description: string;
}

/**
 * Built-in slash commands.
 */
const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/help', description: 'Show help and available commands' },
  { name: '/clear', description: 'Clear the screen' },
  { name: '/config', description: 'View or edit configuration' },
  { name: '/history', description: 'Show command history' },
  { name: '/exit', description: 'Exit the shell' },
  { name: '/mode', description: 'Switch between shell and natural language modes' },
  { name: '/version', description: 'Show version information' },
  { name: '/debug', description: 'Toggle debug mode' },
];

/**
 * Create a SlashCompleter instance.
 */
export function createSlashCompleter(): SlashCompleter {
  return {
    name: 'slash',

    isRelevant(state: InputState): boolean {
      // Relevant when in slash mode or input starts with /
      return state.mode === 'slash' || state.rawText.startsWith('/');
    },

    getCompletions(state: InputState): Promise<Completion[]> {
      // Get prefix without the leading /
      const rawPrefix = state.prefix;
      const prefix = rawPrefix.startsWith('/') ? rawPrefix.slice(1) : rawPrefix;

      const completions: Completion[] = [];

      for (const cmd of SLASH_COMMANDS) {
        const cmdName = cmd.name.slice(1); // Remove leading /

        // Filter by prefix
        if (prefix && !cmdName.toLowerCase().startsWith(prefix.toLowerCase())) {
          continue;
        }

        // Calculate score
        const score = calculatePrefixScore(prefix, cmdName);

        // Skip if no match and we have a prefix
        if (score === 0 && prefix) {
          continue;
        }

        completions.push({
          value: cmd.name,
          description: cmd.description,
          group: CompletionGroup.InternalCommand,
          score,
          source: 'slash',
          icon: COMPLETION_ICONS.internal,
        });
      }

      return Promise.resolve(completions);
    },
  };
}
