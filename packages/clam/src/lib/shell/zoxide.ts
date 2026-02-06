/**
 * Zoxide Integration - Post-cd directory tracking.
 *
 * The z/zi command expansion is now handled by callable aliases in
 * alias-definitions.ts. This module only provides the zoxideAdd()
 * function for updating zoxide's database after successful cd.
 */

import { execPromise, type AbsolutePath } from './utils.js';

/**
 * Check if zoxide is available from pre-detected tools map.
 */
export function isZoxideAvailable(installedTools: Map<string, AbsolutePath>): boolean {
  return installedTools.has('zoxide');
}

/**
 * Add a directory to zoxide's database.
 * Call this after successful cd to update frecency.
 */
export async function zoxideAdd(dir: string): Promise<void> {
  try {
    await execPromise(`zoxide add "${dir}"`, { timeout: 1000 });
  } catch {
    // Ignore errors - zoxide add is best-effort
  }
}
