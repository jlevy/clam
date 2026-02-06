/**
 * Command Aliasing - Rewrite commands to use modern alternatives.
 *
 * When modern tools are available, this module rewrites traditional
 * commands to use their modern equivalents with sensible defaults.
 *
 * Example: `ls` -> `eza --group-directories-first -F`
 */

import type { AbsolutePath } from './utils.js';

/**
 * Alias definition for command rewriting.
 */
export interface CommandAlias {
  /** Original command to match */
  original: string;
  /** Modern command replacement */
  replacement: string;
  /** Default flags to add */
  defaultFlags: string[];
  /** Tool that must be installed for this alias to work */
  requiresTool: string;
  /** Description for help/display */
  description: string;
}

/**
 * Command aliases - modern tool replacements for traditional commands.
 */
export const COMMAND_ALIASES: CommandAlias[] = [
  {
    original: 'ls',
    replacement: 'eza',
    defaultFlags: ['--group-directories-first', '-F'],
    requiresTool: 'eza',
    description: 'ls with icons and better formatting',
  },
  {
    original: 'll',
    replacement: 'eza',
    defaultFlags: ['--group-directories-first', '-F', '-l'],
    requiresTool: 'eza',
    description: 'Long listing with eza',
  },
  {
    original: 'la',
    replacement: 'eza',
    defaultFlags: ['--group-directories-first', '-F', '-la'],
    requiresTool: 'eza',
    description: 'List all with eza',
  },
  {
    original: 'cat',
    replacement: 'bat',
    defaultFlags: ['--paging=never'],
    requiresTool: 'bat',
    description: 'cat with syntax highlighting',
  },
  {
    original: 'grep',
    replacement: 'rg',
    defaultFlags: [],
    requiresTool: 'rg',
    description: 'Fast grep with ripgrep',
  },
  {
    original: 'find',
    replacement: 'fd',
    defaultFlags: [],
    requiresTool: 'fd',
    description: 'Fast find with fd',
  },
];

/**
 * Rewrite a command using available aliases.
 *
 * @param command - The original command string
 * @param installedTools - Map of tool name to path (presence indicates availability)
 * @param enabled - Whether aliasing is enabled
 * @returns Rewritten command or original if no alias applies
 */
export function rewriteCommand(
  command: string,
  installedTools: Map<string, AbsolutePath>,
  enabled = true
): string {
  if (!enabled) return command;

  const trimmed = command.trim();
  if (!trimmed) return command;

  // Extract the first word (command name) and the rest
  const spaceIndex = trimmed.indexOf(' ');
  const cmdName = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
  const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1);

  // Find matching alias
  const alias = COMMAND_ALIASES.find((a) => a.original === cmdName);
  if (!alias) return command;

  // Check if the required tool is installed
  if (!installedTools.has(alias.requiresTool)) return command;

  // Build the rewritten command
  const flagsStr = alias.defaultFlags.length > 0 ? alias.defaultFlags.join(' ') + ' ' : '';
  const argsStr = args ? ' ' + args : '';

  return `${alias.replacement} ${flagsStr}${argsStr}`.trim();
}

/**
 * Get the alias for a specific command, if one exists.
 *
 * @param cmdName - Command name to look up
 * @param installedTools - Map of tool name to path (presence indicates availability)
 * @returns The alias if found and tool is installed, undefined otherwise
 */
export function getAlias(
  cmdName: string,
  installedTools: Map<string, AbsolutePath>
): CommandAlias | undefined {
  const alias = COMMAND_ALIASES.find((a) => a.original === cmdName);
  if (!alias) return undefined;

  if (!installedTools.has(alias.requiresTool)) return undefined;

  return alias;
}

/**
 * Get all active aliases (where the required tool is installed).
 *
 * @param installedTools - Map of tool name to path (presence indicates availability)
 * @returns Array of active aliases
 */
export function getActiveAliases(installedTools: Map<string, AbsolutePath>): CommandAlias[] {
  return COMMAND_ALIASES.filter((alias) => installedTools.has(alias.requiresTool));
}

/**
 * Format alias info for display (e.g., in /help or startup).
 *
 * @param alias - The alias to format
 * @returns Formatted string like "ls → eza --group-directories-first -F"
 */
export function formatAlias(alias: CommandAlias): string {
  const flags = alias.defaultFlags.length > 0 ? ' ' + alias.defaultFlags.join(' ') : '';
  return `${alias.original} → ${alias.replacement}${flags}`;
}
