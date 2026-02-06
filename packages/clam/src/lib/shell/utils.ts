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
 * Check if a command is available via `which`.
 *
 * @param command - Command name to check
 * @param timeout - Timeout in milliseconds (default 500ms)
 * @returns true if command is available, false otherwise
 */
export async function isCommandAvailable(command: string, timeout = 500): Promise<boolean> {
  try {
    await execPromise(`which ${command}`, { timeout });
    return true;
  } catch {
    return false;
  }
}
