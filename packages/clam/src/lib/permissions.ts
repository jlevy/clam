/**
 * Permissions - Permission management for clam.
 *
 * This module handles:
 * - Session permission state (allow always / reject always)
 * - Permission persistence to ~/.clam/code/permissions.json
 * - Permission prompt and response capture
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as readline from 'node:readline/promises';
import { ensureConfigDir, getConfigPath } from './config.js';
import type { PermissionOption } from './output.js';

/**
 * Permission decision for a tool.
 */
export interface PermissionDecision {
  /** Tool name or pattern */
  tool: string;
  /** Decision: allow or reject */
  decision: 'allow' | 'reject';
  /** Timestamp when decision was made */
  timestamp: number;
}

/**
 * Stored permissions.
 */
export interface StoredPermissions {
  /** Session-scoped permissions (cleared on exit) */
  session: PermissionDecision[];
  /** Persistent permissions (saved to file) */
  persistent: PermissionDecision[];
}

/**
 * Permission manager for handling tool permissions.
 */
export class PermissionManager {
  private sessionPermissions = new Map<string, 'allow' | 'reject'>();
  private persistentPermissions = new Map<string, 'allow' | 'reject'>();

  constructor() {
    this.loadPersistentPermissions();
  }

  /**
   * Load persistent permissions from file.
   */
  private loadPersistentPermissions(): void {
    const path = getConfigPath('permissions.json');
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const data = JSON.parse(content) as StoredPermissions;
        for (const decision of data.persistent || []) {
          this.persistentPermissions.set(decision.tool, decision.decision);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Save persistent permissions to file.
   */
  private savePersistentPermissions(): void {
    ensureConfigDir();
    const path = getConfigPath('permissions.json');
    const data: StoredPermissions = {
      session: [],
      persistent: Array.from(this.persistentPermissions.entries()).map(([tool, decision]) => ({
        tool,
        decision,
        timestamp: Date.now(),
      })),
    };
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Check if we have a cached decision for a tool.
   */
  getDecision(tool: string): 'allow' | 'reject' | null {
    // Check session permissions first
    const sessionDecision = this.sessionPermissions.get(tool);
    if (sessionDecision) {
      return sessionDecision;
    }

    // Check persistent permissions
    const persistentDecision = this.persistentPermissions.get(tool);
    if (persistentDecision) {
      return persistentDecision;
    }

    return null;
  }

  /**
   * Record a permission decision.
   */
  recordDecision(
    tool: string,
    decision: 'allow' | 'reject',
    scope: 'once' | 'session' | 'persistent'
  ): void {
    switch (scope) {
      case 'session':
        this.sessionPermissions.set(tool, decision);
        break;
      case 'persistent':
        this.persistentPermissions.set(tool, decision);
        this.savePersistentPermissions();
        break;
      case 'once':
        // Don't record, just return
        break;
    }
  }

  /**
   * Clear session permissions.
   */
  clearSession(): void {
    this.sessionPermissions.clear();
  }

  /**
   * Clear all permissions (session and persistent).
   */
  clearAll(): void {
    this.sessionPermissions.clear();
    this.persistentPermissions.clear();
    this.savePersistentPermissions();
  }
}

/**
 * Prompt user for permission choice.
 *
 * Reads a number from stdin corresponding to the option index.
 * Returns the selected option ID.
 */
export async function promptForPermission(
  options: PermissionOption[]
): Promise<{ optionId: string; kind: PermissionOption['kind'] }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY ?? false,
  });

  try {
    while (true) {
      const answer = await rl.question('');
      const trimmed = answer.trim();

      // Parse number
      const index = Number.parseInt(trimmed, 10);
      if (Number.isNaN(index) || index < 1 || index > options.length) {
        process.stdout.write(`Please enter a number between 1 and ${options.length}: `);
        continue;
      }

      const selected = options[index - 1];
      if (!selected) {
        process.stdout.write(`Please enter a number between 1 and ${options.length}: `);
        continue;
      }

      return {
        optionId: selected.id,
        kind: selected.kind,
      };
    }
  } finally {
    rl.close();
  }
}

/**
 * Determine scope from permission option kind.
 */
export function getScopeFromKind(kind: PermissionOption['kind']): 'once' | 'session' {
  switch (kind) {
    case 'allow_always':
    case 'reject_always':
      return 'session';
    case 'allow_once':
    case 'reject_once':
      return 'once';
    default:
      return 'once';
  }
}

/**
 * Determine decision from permission option kind.
 */
export function getDecisionFromKind(kind: PermissionOption['kind']): 'allow' | 'reject' {
  switch (kind) {
    case 'allow_always':
    case 'allow_once':
      return 'allow';
    case 'reject_always':
    case 'reject_once':
      return 'reject';
    default:
      return 'reject';
  }
}

/**
 * Create a permission manager instance.
 */
export function createPermissionManager(): PermissionManager {
  return new PermissionManager();
}
