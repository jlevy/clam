/**
 * Tests for zoxide integration.
 */

import { describe, expect, it } from 'vitest';
import { type AbsolutePath, asAbsolutePath } from './utils.js';
import {
  buildZCommand,
  buildZiCommand,
  detectZoxideCommand,
  isZoxideAvailable,
  rewriteZoxideCommand,
} from './zoxide.js';

describe('Zoxide Integration', () => {
  describe('isZoxideAvailable', () => {
    it('should return true when zoxide is in the map', () => {
      const tools = new Map<string, AbsolutePath>([['zoxide', asAbsolutePath('/usr/bin/zoxide')]]);
      expect(isZoxideAvailable(tools)).toBe(true);
    });

    it('should return false when zoxide is not in the map', () => {
      const tools = new Map<string, AbsolutePath>();
      expect(isZoxideAvailable(tools)).toBe(false);
    });
  });

  describe('detectZoxideCommand', () => {
    it('should detect z command', () => {
      expect(detectZoxideCommand('z foo')).toBe('z');
      expect(detectZoxideCommand('z')).toBe('z');
      expect(detectZoxideCommand('z projects/bar')).toBe('z');
    });

    it('should detect zi command', () => {
      expect(detectZoxideCommand('zi')).toBe('zi');
      expect(detectZoxideCommand('zi foo')).toBe('zi');
    });

    it('should not detect other commands', () => {
      expect(detectZoxideCommand('cd foo')).toBeNull();
      expect(detectZoxideCommand('ls')).toBeNull();
      expect(detectZoxideCommand('zoxide add foo')).toBeNull();
    });
  });

  describe('buildZCommand', () => {
    it('should build z command with query', () => {
      const cmd = buildZCommand('projects', '/home/user');
      expect(cmd).toContain('zoxide query');
      expect(cmd).toContain('--exclude');
      expect(cmd).toContain('projects');
    });

    it('should exclude current directory', () => {
      const cmd = buildZCommand('foo', '/current/dir');
      expect(cmd).toContain('/current/dir');
    });
  });

  describe('buildZiCommand', () => {
    it('should build zi command with query', () => {
      const cmd = buildZiCommand('foo');
      expect(cmd).toContain('zoxide query -i');
      expect(cmd).toContain('foo');
    });

    it('should build zi command without query', () => {
      const cmd = buildZiCommand('');
      expect(cmd).toContain('zoxide query -i');
      expect(cmd).not.toContain('--');
    });
  });

  describe('rewriteZoxideCommand', () => {
    it('should rewrite z command', () => {
      const result = rewriteZoxideCommand('z projects', '/home/user');
      expect(result).toContain('zoxide query');
      expect(result).toContain('projects');
    });

    it('should rewrite z with no args to cd ~', () => {
      const result = rewriteZoxideCommand('z', '/home/user');
      expect(result).toBe('cd ~');
    });

    it('should rewrite zi command', () => {
      const result = rewriteZoxideCommand('zi', '/home/user');
      expect(result).toContain('zoxide query -i');
    });

    it('should not rewrite other commands', () => {
      const result = rewriteZoxideCommand('cd foo', '/home/user');
      expect(result).toBe('cd foo');
    });
  });
});
