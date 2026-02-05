/**
 * EntityCompleter - Provides completions for @ file/entity mentions.
 *
 * Entity completions are triggered by the @ symbol and include:
 * 1. Files in the current directory
 * 2. Common project files (package.json, README, etc.)
 *
 * Format: @filename becomes a reference that can be resolved.
 */

import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import type { InputState } from '../../input/state.js';
import type { Completer, Completion } from '../types.js';
import { CompletionGroup, COMPLETION_ICONS } from '../types.js';
import { calculatePrefixScore } from '../scoring.js';

/**
 * EntityCompleter implements the Completer interface for @ mentions.
 */
export interface EntityCompleter extends Completer {
  name: 'entity';
}

/**
 * Get files in a directory for completion.
 */
function getFilesInDirectory(dir: string, limit = 50): string[] {
  try {
    const entries = readdirSync(dir);
    const files: string[] = [];

    for (const entry of entries) {
      if (files.length >= limit) break;

      // Skip hidden files and node_modules
      if (entry.startsWith('.') || entry === 'node_modules') {
        continue;
      }

      try {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        const name = stat.isDirectory() ? `${entry}/` : entry;
        files.push(name);
      } catch {
        // Skip files we can't stat
      }
    }

    return files;
  } catch {
    return [];
  }
}

/**
 * Create an EntityCompleter instance.
 */
export function createEntityCompleter(): EntityCompleter {
  return {
    name: 'entity',

    isRelevant(state: InputState): boolean {
      // Relevant when @ trigger detected or prefix starts with @
      return state.isEntityTrigger || state.prefix.startsWith('@');
    },

    getCompletions(state: InputState): Promise<Completion[]> {
      // Strip @ from prefix
      const rawPrefix = state.prefix;
      const prefix = rawPrefix.startsWith('@') ? rawPrefix.slice(1) : rawPrefix;

      // Get files from current directory
      const files = getFilesInDirectory(state.cwd);

      const completions: Completion[] = [];

      for (const file of files) {
        const fileName = basename(file).replace(/\/$/, '');

        // Filter by prefix
        if (prefix && !fileName.toLowerCase().startsWith(prefix.toLowerCase())) {
          continue;
        }

        // Calculate score
        const score = calculatePrefixScore(prefix, fileName);

        // Skip if no match and we have a prefix
        if (score === 0 && prefix) {
          continue;
        }

        const isDir = file.endsWith('/');
        const icon = isDir ? COMPLETION_ICONS.directory : COMPLETION_ICONS.file;

        completions.push({
          value: `@${file}`,
          display: file,
          group: CompletionGroup.Entity,
          score,
          source: 'entity',
          icon,
        });
      }

      return Promise.resolve(completions);
    },
  };
}
