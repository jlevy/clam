import { describe, expect, it } from 'vitest';

import { execPromise, isCommandAvailable } from './utils.js';

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

  describe('isCommandAvailable', () => {
    it('should return true for commands that exist', async () => {
      // 'echo' is a shell builtin available everywhere
      const result = await isCommandAvailable('ls');
      expect(result).toBe(true);
    });

    it('should return false for commands that do not exist', async () => {
      const result = await isCommandAvailable('nonexistent_command_xyz123');
      expect(result).toBe(false);
    });

    it('should respect timeout parameter', async () => {
      // Very short timeout should still work for simple commands
      const result = await isCommandAvailable('ls', 100);
      expect(result).toBe(true);
    });
  });
});
