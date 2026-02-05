/**
 * Zoxide Integration - Smart directory jumping.
 *
 * Zoxide is a smarter cd command that learns your most frequently
 * used directories and lets you jump to them with partial matches.
 *
 * This module provides:
 * - z <query> - Jump to best matching directory
 * - zi <query> - Interactive selection
 * - Automatic directory tracking after cd
 */

import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(execCallback);

/**
 * Check if zoxide is installed.
 */
export async function isZoxideInstalled(): Promise<boolean> {
  try {
    await execPromise('which zoxide', { timeout: 500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Query zoxide for the best matching directory.
 *
 * @param query - Directory query string
 * @param currentDir - Current working directory (to exclude from results)
 * @returns Best matching directory path, or null if no match
 */
export async function zoxideQuery(query: string, currentDir: string): Promise<string | null> {
  try {
    const { stdout } = await execPromise(`zoxide query --exclude "${currentDir}" -- ${query}`, {
      timeout: 2000,
    });
    const result = stdout.trim();
    return result || null;
  } catch {
    // No match found or zoxide not installed
    return null;
  }
}

/**
 * Add a directory to zoxide's database.
 * Call this after successful cd to update frecency.
 *
 * @param dir - Directory to add
 */
export async function zoxideAdd(dir: string): Promise<void> {
  try {
    await execPromise(`zoxide add "${dir}"`, { timeout: 1000 });
  } catch {
    // Ignore errors - zoxide add is best-effort
  }
}

/**
 * Build the command for z (zoxide jump).
 *
 * @param query - Directory query
 * @param currentDir - Current working directory
 * @returns Shell command to execute
 */
export function buildZCommand(query: string, currentDir: string): string {
  // zoxide query returns the best match
  return `cd "$(zoxide query --exclude "${currentDir}" -- ${query})"`;
}

/**
 * Build the command for zi (interactive zoxide).
 *
 * @param query - Optional query to filter
 * @returns Shell command to execute
 */
export function buildZiCommand(query: string): string {
  if (query) {
    return `cd "$(zoxide query -i -- ${query})"`;
  }
  return `cd "$(zoxide query -i)"`;
}

/**
 * Check if a command is a zoxide command (z or zi).
 *
 * @param command - Command to check
 * @returns 'z', 'zi', or null
 */
export function detectZoxideCommand(command: string): 'z' | 'zi' | null {
  const trimmed = command.trim();
  const firstWord = trimmed.split(/\s+/)[0];

  if (firstWord === 'z') return 'z';
  if (firstWord === 'zi') return 'zi';
  return null;
}

/**
 * Rewrite a z/zi command to the actual zoxide command.
 *
 * @param command - Original command (z foo or zi foo)
 * @param currentDir - Current working directory
 * @returns Rewritten shell command
 */
export function rewriteZoxideCommand(command: string, currentDir: string): string {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const query = parts.slice(1).join(' ');

  if (cmd === 'z') {
    if (!query) {
      // z with no args goes home
      return 'cd ~';
    }
    return buildZCommand(query, currentDir);
  }

  if (cmd === 'zi') {
    return buildZiCommand(query);
  }

  // Not a zoxide command, return original
  return command;
}
