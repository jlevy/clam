/**
 * TTY Management Module - Terminal state management for interactive subprocesses.
 *
 * This module handles:
 * - Saving/restoring stdin raw mode state
 * - Running `stty sane` for terminal restoration
 * - Emergency cleanup on process exit
 *
 * Problem solved:
 * When clam runs interactive commands like `bash` or `vim`, the terminal can
 * become corrupted because:
 * 1. clam's keypress handler is in raw mode
 * 2. The subprocess also wants to control the terminal
 * 3. Neither properly hands off control to the other
 *
 * Solution (Option A - simple approach from spec):
 * 1. Disable raw mode before spawning subprocess
 * 2. Run `stty sane` after subprocess exits
 * 3. Re-enable raw mode after subprocess
 * 4. Emergency cleanup on crash/exit
 */

import { execSync } from 'node:child_process';

/** Saved terminal state */
interface TtyState {
  wasRawMode: boolean;
}

/** Global flag to track if emergency cleanup is already installed */
let emergencyCleanupInstalled = false;

/**
 * Run `stty sane` to restore terminal to a known good state.
 * This is the recommended recovery approach from xonsh.
 * Only runs on Unix-like systems (Linux, macOS) - stty doesn't exist on Windows.
 */
function runSttySane(): void {
  // Skip on Windows - stty is a Unix command
  if (process.platform === 'win32') {
    return;
  }

  try {
    // Use execSync with shell directly - stdio: 'inherit' ensures we use the real TTY
    execSync('stty sane 2>/dev/null || true', { stdio: 'inherit' });
  } catch {
    // Ignore errors - terminal may not support stty
  }
}

/**
 * Save current terminal state (raw mode) before running subprocess.
 */
export function saveTtyState(): TtyState | null {
  if (!process.stdin.isTTY) {
    return null;
  }

  try {
    return {
      wasRawMode: process.stdin.isRaw ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Restore terminal state after subprocess exits.
 * Also runs `stty sane` to handle edge cases the subprocess may have caused.
 */
export function restoreTtyState(state: TtyState | null): void {
  if (!process.stdin.isTTY) {
    return;
  }

  // Always run stty sane first to clean up any terminal corruption
  runSttySane();

  // Restore raw mode if it was enabled before
  if (state?.wasRawMode) {
    try {
      process.stdin.setRawMode(true);
    } catch {
      // Ignore errors - stdin may have closed
    }
  }
}

/**
 * Disable raw mode before spawning an interactive subprocess.
 * This allows the subprocess to properly control the terminal.
 */
export function disableRawMode(): void {
  if (!process.stdin.isTTY) {
    return;
  }

  try {
    if (process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Enable raw mode after subprocess exits (if needed).
 */
export function enableRawMode(): void {
  if (!process.stdin.isTTY) {
    return;
  }

  try {
    process.stdin.setRawMode(true);
  } catch {
    // Ignore errors
  }
}

/**
 * Emergency terminal cleanup.
 * Runs `stty sane` to restore terminal even after crash.
 */
export function emergencyCleanup(): void {
  runSttySane();
}

/**
 * Install emergency cleanup handlers on process exit signals.
 * This ensures the terminal is restored even if clam crashes.
 *
 * Should be called once at application startup.
 */
export function installEmergencyCleanup(): void {
  if (emergencyCleanupInstalled) {
    return;
  }
  emergencyCleanupInstalled = true;

  // Cleanup on normal exit
  process.on('exit', () => {
    emergencyCleanup();
  });

  // Cleanup on SIGINT (Ctrl+C) - note: this may be called multiple times
  // We add our handler but don't prevent the default behavior
  const originalSigint = process.listeners('SIGINT');
  process.removeAllListeners('SIGINT');
  process.on('SIGINT', () => {
    emergencyCleanup();
    // Re-emit for other handlers
    for (const listener of originalSigint) {
      if (typeof listener === 'function') {
        listener('SIGINT');
      }
    }
    // If no other handlers, exit with standard SIGINT code
    if (originalSigint.length === 0) {
      process.exit(130);
    }
  });

  // Cleanup on SIGTERM
  const originalSigterm = process.listeners('SIGTERM');
  process.removeAllListeners('SIGTERM');
  process.on('SIGTERM', () => {
    emergencyCleanup();
    // Re-emit for other handlers
    for (const listener of originalSigterm) {
      if (typeof listener === 'function') {
        listener('SIGTERM');
      }
    }
    // If no other handlers, exit with standard SIGTERM code
    if (originalSigterm.length === 0) {
      process.exit(143);
    }
  });

  // Cleanup on uncaught exception
  process.on('uncaughtException', (err) => {
    emergencyCleanup();
    // Re-throw to let Node.js handle it normally

    console.error('Uncaught exception:', err);
    process.exit(1);
  });

  // Cleanup on unhandled promise rejection
  process.on('unhandledRejection', (reason) => {
    emergencyCleanup();

    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });
}

/**
 * Wrap an async function to properly manage TTY state around subprocess execution.
 * This is the main helper for running interactive commands.
 *
 * Usage:
 *   const result = await withTtyManagement(async () => {
 *     return await spawn('vim', [], { stdio: 'inherit' });
 *   });
 *
 * @param fn - Async function that runs the subprocess
 * @returns The result of the function
 */
export async function withTtyManagement<T>(fn: () => Promise<T>): Promise<T> {
  const state = saveTtyState();

  // Disable raw mode before subprocess
  disableRawMode();

  try {
    return await fn();
  } finally {
    // Always restore terminal state, even on error
    restoreTtyState(state);
  }
}
