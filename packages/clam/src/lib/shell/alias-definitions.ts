/**
 * All alias definitions in one place.
 *
 * To add a new alias:
 * 1. Add entry to ALIASES object
 * 2. If it requires a tool, add `requires: 'toolname'`
 *    (tool name must match a key from detectInstalledTools())
 * 3. For simple substitution, use a string
 * 4. For dynamic behavior, use a function
 */

import type { AliasDefinition } from './alias-types.js';

export const ALIASES: Record<string, AliasDefinition> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Modern Tool Substitutions (migrated from command-aliases.ts)
  // ═══════════════════════════════════════════════════════════════════════════

  ls: {
    expansion: 'eza --group-directories-first -F',
    requires: 'eza',
    description: 'List with eza (colors, git status)',
  },

  ll: {
    expansion: 'eza --group-directories-first -F -l',
    requires: 'eza',
    description: 'Long list with eza',
  },

  la: {
    expansion: 'eza --group-directories-first -F -la',
    requires: 'eza',
    description: 'List all (including hidden) with eza',
  },

  cat: {
    expansion: 'bat --paging=never',
    requires: 'bat',
    description: 'Cat with syntax highlighting via bat',
  },

  grep: {
    expansion: 'rg',
    requires: 'rg',
    description: 'Fast grep with ripgrep',
  },

  find: {
    expansion: 'fd',
    requires: 'fd',
    description: 'Fast find with fd',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // New aliases
  // ═══════════════════════════════════════════════════════════════════════════

  tree: {
    expansion: 'eza --tree',
    requires: 'eza',
    description: 'Tree view with eza',
  },

  less: {
    expansion: 'bat --paging=always',
    requires: 'bat',
    description: 'Pager with syntax highlighting via bat',
  },

  du: {
    expansion: 'dust',
    requires: 'dust',
    description: 'Disk usage visualization with dust',
  },

  df: {
    expansion: 'duf',
    requires: 'duf',
    description: 'Disk free visualization with duf',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Zoxide - Smart Directory Jumping (migrated from zoxide.ts)
  // These are callable aliases that generate dynamic cd commands
  // ═══════════════════════════════════════════════════════════════════════════

  z: {
    expansion: ({ args, cwd }) => {
      if (!args.length) {
        return 'cd ~';
      }
      const query = args.join(' ');
      return `cd "$(zoxide query --exclude "${cwd}" -- ${query})"`;
    },
    requires: 'zoxide',
    description: 'Smart directory jump (zoxide)',
  },

  zi: {
    expansion: ({ args }) => {
      if (args.length) {
        const query = args.join(' ');
        return `cd "$(zoxide query -i -- ${query})"`;
      }
      return 'cd "$(zoxide query -i)"';
    },
    requires: 'zoxide',
    description: 'Interactive directory jump with fzf (zoxide)',
  },
};

/**
 * Get list of all defined alias names.
 */
export function getAliasNames(): string[] {
  return Object.keys(ALIASES);
}

/**
 * Get alias definition by name.
 */
export function getAliasDefinition(name: string): AliasDefinition | undefined {
  return ALIASES[name];
}
