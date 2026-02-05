/**
 * Tests for command aliasing.
 */

import { describe, expect, it } from 'vitest';
import {
  COMMAND_ALIASES,
  rewriteCommand,
  getAlias,
  getActiveAliases,
  formatAlias,
} from './command-aliases.js';

describe('Command Aliases', () => {
  describe('COMMAND_ALIASES', () => {
    it('should define expected aliases', () => {
      const originals = COMMAND_ALIASES.map((a) => a.original);
      expect(originals).toContain('ls');
      expect(originals).toContain('ll');
      expect(originals).toContain('cat');
    });

    it('should have required tools for each alias', () => {
      for (const alias of COMMAND_ALIASES) {
        expect(alias.requiresTool).toBeTruthy();
      }
    });
  });

  describe('rewriteCommand', () => {
    const allToolsInstalled = new Map([
      ['eza', true],
      ['bat', true],
      ['rg', true],
      ['fd', true],
    ]);

    const noToolsInstalled = new Map([
      ['eza', false],
      ['bat', false],
      ['rg', false],
      ['fd', false],
    ]);

    it('should rewrite ls to eza when installed', () => {
      const result = rewriteCommand('ls', allToolsInstalled);
      expect(result).toContain('eza');
      expect(result).toContain('--group-directories-first');
    });

    it('should preserve ls arguments', () => {
      const result = rewriteCommand('ls -la /tmp', allToolsInstalled);
      expect(result).toContain('eza');
      expect(result).toContain('/tmp');
    });

    it('should rewrite ll to eza with -l', () => {
      const result = rewriteCommand('ll', allToolsInstalled);
      expect(result).toContain('eza');
      expect(result).toContain('-l');
    });

    it('should rewrite cat to bat when installed', () => {
      const result = rewriteCommand('cat file.txt', allToolsInstalled);
      expect(result).toContain('bat');
      expect(result).toContain('--paging=never');
      expect(result).toContain('file.txt');
    });

    it('should not rewrite when tool not installed', () => {
      const result = rewriteCommand('ls', noToolsInstalled);
      expect(result).toBe('ls');
    });

    it('should not rewrite unknown commands', () => {
      const result = rewriteCommand('git status', allToolsInstalled);
      expect(result).toBe('git status');
    });

    it('should respect enabled flag', () => {
      const result = rewriteCommand('ls', allToolsInstalled, false);
      expect(result).toBe('ls');
    });

    it('should handle empty command', () => {
      const result = rewriteCommand('', allToolsInstalled);
      expect(result).toBe('');
    });

    it('should handle command with only spaces', () => {
      const result = rewriteCommand('   ', allToolsInstalled);
      expect(result).toBe('   ');
    });
  });

  describe('getAlias', () => {
    const installedTools = new Map([
      ['eza', true],
      ['bat', false],
    ]);

    it('should return alias when tool is installed', () => {
      const alias = getAlias('ls', installedTools);
      expect(alias).toBeDefined();
      expect(alias?.replacement).toBe('eza');
    });

    it('should return undefined when tool not installed', () => {
      const alias = getAlias('cat', installedTools);
      expect(alias).toBeUndefined();
    });

    it('should return undefined for unknown command', () => {
      const alias = getAlias('vim', installedTools);
      expect(alias).toBeUndefined();
    });
  });

  describe('getActiveAliases', () => {
    it('should return only aliases with installed tools', () => {
      const installedTools = new Map([
        ['eza', true],
        ['bat', true],
        ['rg', false],
        ['fd', false],
      ]);

      const active = getActiveAliases(installedTools);
      const originals = active.map((a) => a.original);

      expect(originals).toContain('ls');
      expect(originals).toContain('cat');
      expect(originals).not.toContain('grep');
      expect(originals).not.toContain('find');
    });

    it('should return empty array when no tools installed', () => {
      const noTools = new Map<string, boolean>();
      const active = getActiveAliases(noTools);
      expect(active).toHaveLength(0);
    });
  });

  describe('formatAlias', () => {
    it('should format alias with flags', () => {
      const alias = COMMAND_ALIASES.find((a) => a.original === 'ls');
      if (!alias) throw new Error('ls alias not found');

      const formatted = formatAlias(alias);
      expect(formatted).toContain('ls →');
      expect(formatted).toContain('eza');
    });

    it('should format alias without flags', () => {
      const alias = COMMAND_ALIASES.find((a) => a.original === 'grep');
      if (!alias) throw new Error('grep alias not found');

      const formatted = formatAlias(alias);
      expect(formatted).toBe('grep → rg');
    });
  });
});
