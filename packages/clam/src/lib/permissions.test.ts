/**
 * Unit tests for PermissionManager.
 *
 * Tests verify:
 * - Session permission storage and retrieval
 * - Persistent permission storage (mocked)
 * - Scope and decision helpers
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPermissionManager,
  getDecisionFromKind,
  getScopeFromKind,
  PermissionManager,
} from './permissions.js';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock config module
vi.mock('./config.js', () => ({
  getConfigPath: vi.fn((file: string) => `/mock/config/${file}`),
  ensureConfigDir: vi.fn(),
}));

describe('PermissionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPermissionManager', () => {
    it('should create a PermissionManager instance', () => {
      const manager = createPermissionManager();
      expect(manager).toBeInstanceOf(PermissionManager);
    });
  });

  describe('session permissions', () => {
    it('should return null for unknown tool', () => {
      const manager = createPermissionManager();
      expect(manager.getDecision('unknown-tool')).toBe(null);
    });

    it('should record and retrieve session allow decision', () => {
      const manager = createPermissionManager();
      manager.recordDecision('Bash', 'allow', 'session');
      expect(manager.getDecision('Bash')).toBe('allow');
    });

    it('should record and retrieve session reject decision', () => {
      const manager = createPermissionManager();
      manager.recordDecision('Write', 'reject', 'session');
      expect(manager.getDecision('Write')).toBe('reject');
    });

    it('should not record "once" decisions', () => {
      const manager = createPermissionManager();
      manager.recordDecision('Read', 'allow', 'once');
      expect(manager.getDecision('Read')).toBe(null);
    });

    it('should clear session permissions', () => {
      const manager = createPermissionManager();
      manager.recordDecision('Bash', 'allow', 'session');
      manager.clearSession();
      expect(manager.getDecision('Bash')).toBe(null);
    });
  });

  describe('persistent permissions', () => {
    it('should record persistent decision and save to file', async () => {
      const { writeFileSync } = await import('node:fs');
      const manager = createPermissionManager();
      manager.recordDecision('Bash', 'allow', 'persistent');

      expect(writeFileSync).toHaveBeenCalled();
      expect(manager.getDecision('Bash')).toBe('allow');
    });

    it('should clear all permissions', async () => {
      const { writeFileSync } = await import('node:fs');
      const manager = createPermissionManager();

      manager.recordDecision('Bash', 'allow', 'session');
      manager.recordDecision('Write', 'allow', 'persistent');
      manager.clearAll();

      expect(manager.getDecision('Bash')).toBe(null);
      expect(manager.getDecision('Write')).toBe(null);
      expect(writeFileSync).toHaveBeenCalled();
    });
  });
});

describe('getScopeFromKind', () => {
  it('should return "session" for allow_always', () => {
    expect(getScopeFromKind('allow_always')).toBe('session');
  });

  it('should return "session" for reject_always', () => {
    expect(getScopeFromKind('reject_always')).toBe('session');
  });

  it('should return "once" for allow_once', () => {
    expect(getScopeFromKind('allow_once')).toBe('once');
  });

  it('should return "once" for reject_once', () => {
    expect(getScopeFromKind('reject_once')).toBe('once');
  });
});

describe('getDecisionFromKind', () => {
  it('should return "allow" for allow_always', () => {
    expect(getDecisionFromKind('allow_always')).toBe('allow');
  });

  it('should return "allow" for allow_once', () => {
    expect(getDecisionFromKind('allow_once')).toBe('allow');
  });

  it('should return "reject" for reject_always', () => {
    expect(getDecisionFromKind('reject_always')).toBe('reject');
  });

  it('should return "reject" for reject_once', () => {
    expect(getDecisionFromKind('reject_once')).toBe('reject');
  });
});
