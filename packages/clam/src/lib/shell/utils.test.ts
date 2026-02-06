import { describe, expect, it } from 'bun:test';

import {
  type AbsolutePath,
  asAbsolutePath,
  execPromise,
  getCommandPath,
  isCommandAvailable,
} from './utils.js';

describe('shell/utils', () => {
  describe('execPromise', () => {
    it('should execute commands and return stdout', async () => {
      const { stdout } = await execPromise('echo hello');
      expect(stdout.trim()).toBe('hello');
    });

    it('should reject on command failure', async () => {
      await expect(execPromise('false')).rejects.toThrow();
    });
  });

  describe('asAbsolutePath', () => {
    it('should brand a string as AbsolutePath', () => {
      const path: AbsolutePath = asAbsolutePath('/usr/bin/ls');
      expect(path).toBe(asAbsolutePath('/usr/bin/ls'));
      // The branded type is still usable as a string
      expect(path.startsWith('/')).toBe(true);
    });
  });

  describe('getCommandPath', () => {
    it('should return absolute path for commands that exist', async () => {
      const path = await getCommandPath('ls');
      expect(path).toBeTruthy();
      expect(path).toMatch(/^\/.*ls$/);
    });

    it('should return null for commands that do not exist', async () => {
      const path = await getCommandPath('nonexistent_command_xyz123');
      expect(path).toBeNull();
    });

    it('should respect timeout parameter', async () => {
      // Use a generous timeout to avoid flaky failures on slow CI (especially Windows)
      const path = await getCommandPath('ls', 5000);
      expect(path).toBeTruthy();
    });
  });

  describe('isCommandAvailable', () => {
    it('should return true for commands that exist', async () => {
      const result = await isCommandAvailable('ls');
      expect(result).toBe(true);
    });

    it('should return false for commands that do not exist', async () => {
      const result = await isCommandAvailable('nonexistent_command_xyz123');
      expect(result).toBe(false);
    });

    it('should respect timeout parameter', async () => {
      const result = await isCommandAvailable('ls', 100);
      expect(result).toBe(true);
    });
  });
});
