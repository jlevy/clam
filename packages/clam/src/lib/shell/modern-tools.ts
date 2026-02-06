/**
 * Modern Tool Detection - Detect installed modern CLI tools.
 *
 * This module handles:
 * - Detection of modern CLI alternatives (eza, bat, rg, etc.)
 * - Formatting status display for startup message
 *
 * Based on kash's modern tool detection system.
 */

import { isCommandAvailable } from './utils.js';

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
 * @returns Map of tool name to availability
 */
export async function detectInstalledTools(): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Run all checks in parallel
  const checks = MODERN_TOOLS.map(async (tool) => {
    const available = await isCommandAvailable(tool.command);
    return { name: tool.name, available };
  });

  const resolved = await Promise.all(checks);
  for (const { name, available } of resolved) {
    results.set(name, available);
  }

  return results;
}

/**
 * Format tool status for startup display.
 *
 * Example output: "Modern tools: ✔ eza ✔ bat ✔ rg ✗ dust"
 *
 * @param installed - Map of tool name to availability
 * @param options - Formatting options
 * @returns Formatted status string
 */
export function formatToolStatus(
  installed: Map<string, boolean>,
  options: { showOnlyInstalled?: boolean } = {}
): string {
  const { showOnlyInstalled = false } = options;

  const parts: string[] = [];

  for (const tool of MODERN_TOOLS) {
    const available = installed.get(tool.name) ?? false;

    if (showOnlyInstalled && !available) {
      continue;
    }

    const icon = available ? '✔' : '✗';
    parts.push(`${icon} ${tool.name}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `Modern tools: ${parts.join(' ')}`;
}

/**
 * Get detailed tool info for help display.
 *
 * @param installed - Map of tool name to availability
 * @returns Array of tool status objects
 */
export function getToolDetails(installed: Map<string, boolean>): {
  name: string;
  available: boolean;
  replaces?: string;
  description: string;
}[] {
  return MODERN_TOOLS.map((tool) => ({
    name: tool.name,
    available: installed.get(tool.name) ?? false,
    replaces: tool.replaces,
    description: tool.description,
  }));
}

/**
 * Get tools that can alias a specific command.
 *
 * @param command - Traditional command (e.g., 'ls')
 * @param installed - Map of tool name to availability
 * @returns Array of available modern tools that replace this command
 */
export function getModernAlternatives(
  command: string,
  installed: Map<string, boolean>
): ToolInfo[] {
  return MODERN_TOOLS.filter(
    (tool) => tool.replaces === command && (installed.get(tool.name) ?? false)
  );
}
