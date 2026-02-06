/**
 * Shell Convenience Features.
 *
 * This module provides:
 * - Auto-cd: Automatically cd to a path if it's a directory
 * - Exit code display: Format exit codes for display
 * - Command timing: Track and format command execution time
 */

import { statSync } from 'node:fs';

/**
 * Check if a string is a valid directory path.
 * Used for auto-cd feature.
 *
 * @param input - Input string to check
 * @returns true if input is a directory path
 */
export function isDirectoryPath(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Skip if it contains spaces but isn't quoted (likely not a path)
  if (trimmed.includes(' ') && !trimmed.startsWith('"') && !trimmed.startsWith("'")) {
    return false;
  }

  // Skip if it looks like a command with args
  if (/^[a-zA-Z0-9_-]+\s/.test(trimmed)) {
    return false;
  }

  // Handle paths
  try {
    // Remove quotes if present
    const path = trimmed.replace(/^["']|["']$/g, '');

    // Expand ~ to home directory
    const expandedPath = path.startsWith('~') ? path.replace(/^~/, process.env.HOME ?? '') : path;

    const stat = statSync(expandedPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Format an exit code for display.
 *
 * @param exitCode - Command exit code
 * @returns Formatted string like "[exit 1]" or empty string for success
 */
export function formatExitCode(exitCode: number): string {
  if (exitCode === 0) return '';
  return `[exit ${exitCode}]`;
}

/**
 * Format command execution time for display.
 *
 * @param durationMs - Duration in milliseconds
 * @param threshold - Minimum duration to display (default 2000ms)
 * @returns Formatted string like "[2.3s]" or "[1m 23s]" or empty string
 */
export function formatDuration(durationMs: number, threshold = 2000): string {
  if (durationMs < threshold) return '';

  const seconds = durationMs / 1000;

  if (seconds < 60) {
    return `[${seconds.toFixed(1)}s]`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `[${minutes}m ${remainingSeconds}s]`;
}

/**
 * Create a simple timer for tracking command execution.
 */
export interface CommandTimer {
  /** Start the timer */
  start(): void;
  /** Stop the timer and return duration in milliseconds */
  stop(): number;
  /** Get formatted duration string */
  format(threshold?: number): string;
}

/**
 * Create a command timer.
 */
export function createCommandTimer(): CommandTimer {
  let startTime: number | null = null;
  let endTime: number | null = null;

  return {
    start() {
      startTime = Date.now();
      endTime = null;
    },
    stop() {
      if (startTime === null) return 0;
      endTime = Date.now();
      return endTime - startTime;
    },
    format(threshold = 2000) {
      if (startTime === null || endTime === null) return '';
      return formatDuration(endTime - startTime, threshold);
    },
  };
}
