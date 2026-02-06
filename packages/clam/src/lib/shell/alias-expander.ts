/**
 * Alias expansion engine.
 *
 * Single entry point for all alias expansion, replacing both rewriteCommand()
 * and rewriteZoxideCommand() from the old architecture.
 */

import { ALIASES } from './alias-definitions.js';
import type { AliasContext, AliasDefinition, AliasExpansionResult } from './alias-types.js';
import type { AbsolutePath } from './utils.js';

/**
 * Check if an alias is active (required tool is installed or no requirement).
 */
export function isAliasActive(
  def: AliasDefinition,
  installedTools: Map<string, AbsolutePath>
): boolean {
  return !def.requires || installedTools.has(def.requires);
}

/**
 * Get all active aliases (where required tool is installed).
 */
export function getActiveAliases(
  installedTools: Map<string, AbsolutePath>
): Map<string, AliasDefinition> {
  const active = new Map<string, AliasDefinition>();

  for (const [name, def] of Object.entries(ALIASES)) {
    if (isAliasActive(def, installedTools)) {
      active.set(name, def);
    }
  }

  return active;
}

/**
 * Parse a command string into command name and arguments.
 */
export function parseCommand(command: string): {
  cmdName: string;
  args: string[];
  argsStr: string;
} {
  const trimmed = command.trim();
  const spaceIdx = trimmed.indexOf(' ');

  if (spaceIdx === -1) {
    return { cmdName: trimmed, args: [], argsStr: '' };
  }

  const cmdName = trimmed.slice(0, spaceIdx);
  const argsStr = trimmed.slice(spaceIdx + 1);
  // Simple split on whitespace. Doesn't handle quoted strings, but that's fine:
  // string aliases pass argsStr through verbatim (preserving quoting), and
  // callable aliases can use argsStr directly if they need the raw string.
  const args = argsStr.split(/\s+/).filter(Boolean);

  return { cmdName, args, argsStr };
}

/**
 * Expand an alias if one matches the command.
 *
 * This is the single entry point for all alias expansion. It replaces both
 * rewriteCommand() and rewriteZoxideCommand() from the old architecture.
 */
export async function expandAlias(
  command: string,
  installedTools: Map<string, AbsolutePath>,
  cwd: string,
  enabled = true
): Promise<AliasExpansionResult> {
  if (!enabled) {
    return { command, wasExpanded: false };
  }

  const { cmdName, args, argsStr } = parseCommand(command);

  if (!cmdName) {
    return { command, wasExpanded: false };
  }

  const def = ALIASES[cmdName];

  if (!def) {
    return { command, wasExpanded: false };
  }

  if (!isAliasActive(def, installedTools)) {
    return { command, wasExpanded: false };
  }

  const expansion = def.expansion;
  let expandedCommand: string;

  if (typeof expansion === 'string') {
    expandedCommand = argsStr ? `${expansion} ${argsStr}` : expansion;
  } else if (typeof expansion === 'function') {
    const ctx: AliasContext = {
      command: cmdName,
      args,
      argsStr,
      cwd,
    };
    expandedCommand = await expansion(ctx);
  } else {
    return { command, wasExpanded: false };
  }

  return {
    command: expandedCommand,
    wasExpanded: true,
    aliasName: cmdName,
  };
}

/**
 * Format active aliases for display (e.g., in /help or /aliases).
 */
export function formatActiveAliases(installedTools: Map<string, AbsolutePath>): string {
  const active = getActiveAliases(installedTools);
  const lines: string[] = [];

  for (const [name, def] of active) {
    const expansionStr = typeof def.expansion === 'function' ? '(dynamic)' : def.expansion;

    lines.push(`  ${name.padEnd(8)} -> ${expansionStr}`);
    if (def.description) {
      lines.push(`             ${def.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format aliases as a simple list for compact display.
 */
export function formatAliasesCompact(installedTools: Map<string, AbsolutePath>): string {
  const active = getActiveAliases(installedTools);
  const parts: string[] = [];

  for (const [name, def] of active) {
    const target = typeof def.expansion === 'function' ? '(fn)' : def.expansion.split(' ')[0];
    parts.push(`${name}->${target}`);
  }

  return parts.join(' ');
}
