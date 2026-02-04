/**
 * Mode Detection - Input mode detection for clam.
 *
 * This module handles:
 * - Detecting whether input is shell, natural language, or slash command
 * - Sync detection for real-time coloring
 * - Async detection with which lookup for accuracy
 *
 * Detection rules (in priority order):
 * 1. Empty/whitespace → nl
 * 2. Starts with / → slash
 * 3. Starts with ! → shell (explicit trigger)
 * 4. Starts with space → nl (space-at-start shortcut)
 * 5. Contains shell operators → shell
 * 6. Contains $ (env var) → shell
 * 7. First word is builtin → shell
 * 8. First word passes which → shell
 * 9. First word fails which → nl
 */

import { isShellBuiltin, type ShellModule } from './shell.js';

/**
 * Input mode types.
 */
export type InputMode = 'shell' | 'nl' | 'slash';

/**
 * Mode detector interface.
 */
export interface ModeDetector {
  /** Detect mode synchronously (for real-time coloring) */
  detectModeSync(input: string): InputMode;

  /** Detect mode asynchronously (with which lookup for accuracy) */
  detectMode(input: string): Promise<InputMode>;
}

/**
 * Options for creating a mode detector.
 */
export interface ModeDetectorOptions {
  /** Shell module for command lookups */
  shell: ShellModule;

  /** Whether shell mode detection is enabled */
  enabled?: boolean;
}

/**
 * Shell operators that indicate shell mode.
 */
const SHELL_OPERATORS = /[|><;]|&&|\|\||\$\(|`/;

/**
 * Detect mode synchronously without async lookups.
 * Used for real-time input coloring.
 */
function detectModeSyncInternal(input: string): InputMode {
  const trimmed = input.trim();

  // Empty or whitespace → natural language
  if (!trimmed) return 'nl';

  // Starts with / → slash command
  if (trimmed.startsWith('/')) return 'slash';

  // Starts with ! → explicit shell mode (like IPython)
  if (trimmed.startsWith('!')) return 'shell';

  // Starts with space → natural language (space-at-start shortcut)
  if (input.startsWith(' ')) return 'nl';

  // Check for shell operators/syntax
  if (SHELL_OPERATORS.test(trimmed)) return 'shell';

  // Check for environment variables
  if (trimmed.includes('$')) return 'shell';

  // Get first word
  const firstWord = trimmed.split(/\s+/)[0] ?? '';

  // Check for shell built-ins
  if (isShellBuiltin(firstWord)) return 'shell';

  // For sync detection, assume shell if it looks command-like
  // This is a tentative guess that will be refined by async detection
  if (/^[a-zA-Z0-9_-]+$/.test(firstWord)) {
    return 'shell'; // Tentative - will be refined async
  }

  return 'nl';
}

/**
 * Create a mode detector instance.
 */
export function createModeDetector(options: ModeDetectorOptions): ModeDetector {
  const { shell, enabled = true } = options;

  function detectModeSync(input: string): InputMode {
    // If disabled, always return natural language
    if (!enabled) return 'nl';
    return detectModeSyncInternal(input);
  }

  async function detectMode(input: string): Promise<InputMode> {
    // If disabled, always return natural language
    if (!enabled) return 'nl';

    const syncMode = detectModeSyncInternal(input);

    // If sync detection found a definitive answer, use it
    if (syncMode === 'slash') return 'slash';

    // If sync detected shell due to operators/env vars/builtins, it's definitive
    if (syncMode === 'shell') {
      const trimmed = input.trim();

      // These are definitive shell indicators
      if (trimmed.startsWith('!')) return 'shell';
      if (SHELL_OPERATORS.test(trimmed)) return 'shell';
      if (trimmed.includes('$')) return 'shell';

      const firstWord = trimmed.split(/\s+/)[0] ?? '';
      if (isShellBuiltin(firstWord)) return 'shell';

      // If we get here, sync detection guessed shell based on command-like pattern
      // Verify with actual which lookup
      const isCmd = await shell.isCommand(firstWord);
      return isCmd ? 'shell' : 'nl';
    }

    // Sync returned nl, so return nl
    return 'nl';
  }

  return {
    detectModeSync,
    detectMode,
  };
}

/**
 * Check if input contains shell operators.
 */
export function hasShellOperators(input: string): boolean {
  return SHELL_OPERATORS.test(input);
}

/**
 * Check if input is an explicit shell trigger (starts with !).
 */
export function isExplicitShell(input: string): boolean {
  return input.trim().startsWith('!');
}

/**
 * Strip explicit shell trigger from input.
 */
export function stripShellTrigger(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('!')) {
    return trimmed.slice(1);
  }
  return input;
}
