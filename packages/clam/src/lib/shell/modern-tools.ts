/**
 * Modern Tool Detection - Detect installed modern CLI tools.
 *
 * This module handles:
 * - Detection of modern CLI alternatives (eza, bat, rg, etc.)
 * - Formatting status display for startup message
 *
 * Based on kash's modern tool detection system.
 */

import { type AbsolutePath, getCommandPath } from './utils.js';

/**
 * Information about a modern CLI tool.
 */
export interface ToolInfo {
  /** Tool name (e.g., 'eza') */
  name: string;
  /** Command to check (usually same as name) */
  command: string;
  /** Traditional command it replaces */
  replaces?: string;
  /** Description for display */
  description: string;
  /** Category for grouping */
  category: 'file' | 'search' | 'navigation' | 'system' | 'other';
}

/**
 * Modern CLI tools we detect and can use.
 * Order matters - tools are displayed in this order.
 */
export const MODERN_TOOLS: ToolInfo[] = [
  {
    name: 'eza',
    command: 'eza',
    replaces: 'ls',
    description: 'Modern ls with icons and git',
    category: 'file',
  },
  {
    name: 'bat',
    command: 'bat',
    replaces: 'cat',
    description: 'Cat with syntax highlighting',
    category: 'file',
  },
  {
    name: 'rg',
    command: 'rg',
    replaces: 'grep',
    description: 'Fast grep (ripgrep)',
    category: 'search',
  },
  {
    name: 'fd',
    command: 'fd',
    replaces: 'find',
    description: 'Fast find alternative',
    category: 'search',
  },
  {
    name: 'zoxide',
    command: 'zoxide',
    replaces: 'cd',
    description: 'Smart directory jumping',
    category: 'navigation',
  },
  {
    name: 'dust',
    command: 'dust',
    replaces: 'du',
    description: 'Modern disk usage',
    category: 'system',
  },
  {
    name: 'duf',
    command: 'duf',
    replaces: 'df',
    description: 'Modern disk free',
    category: 'system',
  },
  {
    name: 'hexyl',
    command: 'hexyl',
    description: 'Modern hex viewer',
    category: 'other',
  },
];

/**
 * Detect which modern tools are installed.
 * Runs checks in parallel for speed.
 *
 * @returns Map of tool name to absolute path (only includes installed tools)
 */
export async function detectInstalledTools(): Promise<Map<string, AbsolutePath>> {
  const results = new Map<string, AbsolutePath>();

  // Run all checks in parallel
  const checks = MODERN_TOOLS.map(async (tool) => {
    const path = await getCommandPath(tool.command);
    return { name: tool.name, path };
  });

  const resolved = await Promise.all(checks);
  for (const { name, path } of resolved) {
    if (path) {
      results.set(name, path);
    }
  }

  return results;
}

/**
 * Format tool status for startup display.
 *
 * Example output: "Found tools: ✔ eza ✔ bat ✔ rg ✗ dust"
 *
 * @param installed - Map of tool name to path (presence indicates availability)
 * @param options - Formatting options
 * @returns Formatted status string
 */
export function formatToolStatus(
  installed: Map<string, AbsolutePath>,
  options: { showOnlyInstalled?: boolean } = {}
): string {
  const { showOnlyInstalled = false } = options;

  const parts: string[] = [];

  for (const tool of MODERN_TOOLS) {
    const available = installed.has(tool.name);

    if (showOnlyInstalled && !available) {
      continue;
    }

    const icon = available ? '✔' : '✗';
    parts.push(`${icon} ${tool.name}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `Found tools: ${parts.join(' ')}`;
}

/**
 * Get detailed tool info for help display.
 *
 * @param installed - Map of tool name to path (presence indicates availability)
 * @returns Array of tool status objects with path if available
 */
export function getToolDetails(installed: Map<string, AbsolutePath>): {
  name: string;
  available: boolean;
  path?: AbsolutePath;
  replaces?: string;
  description: string;
}[] {
  return MODERN_TOOLS.map((tool) => ({
    name: tool.name,
    available: installed.has(tool.name),
    path: installed.get(tool.name),
    replaces: tool.replaces,
    description: tool.description,
  }));
}

/**
 * Get tools that can alias a specific command.
 *
 * @param command - Traditional command (e.g., 'ls')
 * @param installed - Map of tool name to path (presence indicates availability)
 * @returns Array of available modern tools that replace this command
 */
export function getModernAlternatives(
  command: string,
  installed: Map<string, AbsolutePath>
): ToolInfo[] {
  return MODERN_TOOLS.filter((tool) => tool.replaces === command && installed.has(tool.name));
}
