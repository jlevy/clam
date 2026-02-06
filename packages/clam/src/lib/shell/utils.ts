/**
 * Shell utilities - shared helpers for command detection and execution.
 *
 * This module provides common utilities used by other shell modules to avoid
 * code duplication. All command availability checks should use these functions.
 */

import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Promisified exec for async command execution.
 */
export const execPromise = promisify(execCallback);

/**
 * Branded type for absolute file paths.
 * Use this to indicate a string is known to be an absolute path.
 */
export type AbsolutePath = string & { readonly __brand: 'AbsolutePath' };

/**
 * Create an AbsolutePath from a string.
 * Only use this when you're certain the path is absolute.
 */
export function asAbsolutePath(path: string): AbsolutePath {
  return path as AbsolutePath;
}

/**
 * Get the absolute path of a command via `which`.
 *
 * @param command - Command name to find
 * @param timeout - Timeout in milliseconds (default 500ms)
 * @returns Absolute path to the command, or null if not found
 */
export async function getCommandPath(command: string, timeout = 500): Promise<AbsolutePath | null> {
  try {
    const { stdout } = await execPromise(`which ${command}`, { timeout });
    const path = stdout.trim();
    return path ? asAbsolutePath(path) : null;
  } catch {
    return null;
  }
}

/**
 * Check if a command is available via `which`.
 *
 * @param command - Command name to check
 * @param timeout - Timeout in milliseconds (default 500ms)
 * @returns true if command is available, false otherwise
 */
export async function isCommandAvailable(command: string, timeout = 500): Promise<boolean> {
  return (await getCommandPath(command, timeout)) !== null;
}
