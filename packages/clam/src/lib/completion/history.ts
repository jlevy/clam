/**
 * Shell history provider for recency scoring.
 *
 * Loads command history from shell history files (bash_history, zsh_history)
 * and provides an in-memory cache for recent commands during the session.
 */

import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HistoryEntry } from '../input/state.js';

/**
 * Parse a single history line.
 *
 * Handles both bash format (plain commands) and zsh extended format
 * (: timestamp:0;command).
 *
 * @returns The command string or null if line should be skipped
 */
export function parseHistoryLine(line: string): string | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  // Handle zsh extended format: : timestamp:0;command
  if (trimmed.startsWith(': ') && trimmed.includes(';')) {
    const semicolonIndex = trimmed.indexOf(';');
    return trimmed.slice(semicolonIndex + 1);
  }

  return trimmed;
}

/**
 * Extract the command name from a full command line.
 */
export function extractCommand(commandLine: string): string {
  // Get first word (the command)
  const match = /^(\S+)/.exec(commandLine);
  return match?.[1] ?? '';
}

/**
 * Parse a history file content into HistoryEntry array.
 *
 * @param content - The file content
 * @param maxEntries - Maximum entries to return (most recent)
 */
export function parseHistoryFile(content: string, maxEntries = 1000): HistoryEntry[] {
  const lines = content.split('\n');
  const entries: HistoryEntry[] = [];
  const now = Date.now();

  // Process from end to get most recent first
  for (let i = lines.length - 1; i >= 0 && entries.length < maxEntries; i--) {
    const line = lines[i];
    if (!line) continue;

    const command = parseHistoryLine(line);
    if (command) {
      // Assign decreasing timestamps (more recent entries first)
      // This is approximate since we don't have real timestamps
      entries.push({
        command,
        timestamp: new Date(now - entries.length * 1000), // 1 second apart
      });
    }
  }

  // Reverse to get chronological order
  return entries.reverse();
}

/**
 * Shell history file paths to try.
 */
const HISTORY_FILES = ['.bash_history', '.zsh_history', '.history'];

/**
 * Load shell history from common history file locations.
 *
 * @param maxEntries - Maximum entries to load
 */
export async function loadShellHistory(maxEntries = 500): Promise<HistoryEntry[]> {
  const home = homedir();

  for (const filename of HISTORY_FILES) {
    const filepath = join(home, filename);

    try {
      // Check if file exists
      await access(filepath);

      // Read and parse
      const content = await readFile(filepath, 'utf-8');
      return parseHistoryFile(content, maxEntries);
    } catch {}
  }

  // No history file found
  return [];
}

/**
 * Options for the history provider.
 */
export interface HistoryProviderOptions {
  /** Maximum entries to keep in memory */
  maxEntries?: number;
  /** Maximum age for entries in ms (default: 1 hour) */
  maxAge?: number;
}

/**
 * HistoryProvider interface for managing command history.
 */
export interface HistoryProvider {
  /** Add a command to history */
  add(command: string): void;
  /** Get all history entries */
  getEntries(): HistoryEntry[];
  /** Get most recent N entries */
  getRecent(n: number): HistoryEntry[];
  /** Clear all history */
  clear(): void;
  /** Load history from shell files */
  loadFromShell(): Promise<void>;
}

/**
 * Create an in-memory history provider.
 *
 * Maintains a list of recent commands for recency scoring.
 * Can optionally load initial history from shell history files.
 */
export function createHistoryProvider(options: HistoryProviderOptions = {}): HistoryProvider {
  const { maxEntries = 500, maxAge = 3600000 } = options;
  let entries: HistoryEntry[] = [];

  function pruneOld(): void {
    const cutoff = Date.now() - maxAge;
    entries = entries.filter((e) => e.timestamp.getTime() > cutoff);
  }

  function pruneSize(): void {
    if (entries.length > maxEntries) {
      entries = entries.slice(-maxEntries);
    }
  }

  return {
    add(command: string): void {
      entries.push({
        command,
        timestamp: new Date(),
      });
      pruneSize();
    },

    getEntries(): HistoryEntry[] {
      pruneOld();
      return [...entries];
    },

    getRecent(n: number): HistoryEntry[] {
      pruneOld();
      return entries.slice(-n);
    },

    clear(): void {
      entries = [];
    },

    async loadFromShell(): Promise<void> {
      const shellHistory = await loadShellHistory(maxEntries);
      entries = shellHistory;
    },
  };
}
