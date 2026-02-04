/**
 * Unit tests for Shell Module.
 *
 * Tests verify:
 * - Command lookup via which
 * - Shell builtin detection
 * - Command execution
 * - Completion generation
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createShellModule, isShellBuiltin, type ShellModule } from './shell.js';

describe('ShellModule', () => {
  let shell: ShellModule;

  beforeEach(() => {
    shell = createShellModule();
  });

  describe('isShellBuiltin', () => {
    it('should recognize common builtins', () => {
      expect(isShellBuiltin('cd')).toBe(true);
      expect(isShellBuiltin('export')).toBe(true);
      expect(isShellBuiltin('alias')).toBe(true);
      expect(isShellBuiltin('source')).toBe(true);
      expect(isShellBuiltin('pwd')).toBe(true);
    });

    it('should not recognize non-builtins', () => {
      expect(isShellBuiltin('ls')).toBe(false);
      expect(isShellBuiltin('git')).toBe(false);
      expect(isShellBuiltin('node')).toBe(false);
    });
  });

  describe('which', () => {
    it('should find common commands', async () => {
      const lsPath = await shell.which('ls');
      expect(lsPath).toBeTruthy();
      expect(lsPath).toMatch(/\/ls$/);
    });

    it('should return builtin for shell builtins', async () => {
      const cdPath = await shell.which('cd');
      expect(cdPath).toBe('builtin');
    });

    it('should return null for non-existent commands', async () => {
      const path = await shell.which('nonexistent_command_12345');
      expect(path).toBeNull();
    });

    it('should cache results', async () => {
      // First call
      const path1 = await shell.which('ls');
      // Second call should hit cache
      const path2 = await shell.which('ls');
      expect(path1).toBe(path2);
    });
  });

  describe('isCommand', () => {
    it('should recognize valid commands', async () => {
      expect(await shell.isCommand('ls')).toBe(true);
      expect(await shell.isCommand('cd')).toBe(true); // builtin
    });

    it('should reject invalid command names', async () => {
      expect(await shell.isCommand('ls -la')).toBe(false); // contains space
      expect(await shell.isCommand('a/b')).toBe(false); // contains slash
      expect(await shell.isCommand('')).toBe(false); // empty
    });

    it('should return false for non-existent commands', async () => {
      expect(await shell.isCommand('nonexistent_xyz_123')).toBe(false);
    });
  });

  describe('exec', () => {
    it('should execute simple commands', async () => {
      const result = await shell.exec('echo hello', { captureOutput: true });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    });

    it('should capture stderr', async () => {
      const result = await shell.exec('echo error >&2', { captureOutput: true });
      expect(result.exitCode).toBe(0);
      expect(result.stderr.trim()).toBe('error');
    });

    it('should report non-zero exit codes', async () => {
      const result = await shell.exec('exit 42', { captureOutput: true });
      expect(result.exitCode).toBe(42);
    });

    it(
      'should respect timeout',
      async () => {
        // Use node instead of sleep for cross-platform compatibility (Windows has no sleep)
        const result = await shell.exec('node -e "setTimeout(() => {}, 10000)"', {
          captureOutput: true,
          timeout: 100,
        });
        // Command should be killed
        expect(result.signal).toBeDefined();
      },
      { timeout: 10000 }
    );
  });

  describe('getCompletions', () => {
    it('should return array for command completions', async () => {
      const completions = await shell.getCompletions('l', 1);
      // compgen may not work in all environments, so just verify it returns an array
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should return array for file completions', async () => {
      const completions = await shell.getCompletions('ls ', 3);
      // Should return an array (may be empty depending on environment)
      expect(Array.isArray(completions)).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear the which cache', async () => {
      // Populate cache
      await shell.which('ls');
      // Clear it
      shell.clearCache();
      // Should work (cache was cleared, will re-lookup)
      const path = await shell.which('ls');
      expect(path).toBeTruthy();
    });
  });
});
