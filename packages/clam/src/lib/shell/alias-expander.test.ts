/**
 * Tests for the functional alias system.
 *
 * Covers: string expansion, callable expansion (zoxide), disabled flag,
 * tool availability, edge cases. Provides regression coverage for scenarios
 * previously tested in command-aliases.test.ts and zoxide.test.ts.
 */

import { describe, expect, it } from 'bun:test';

import { getAliasDefinition, getAliasNames } from './alias-definitions.js';
import {
  expandAlias,
  formatActiveAliases,
  formatAliasesCompact,
  getActiveAliases,
  isAliasActive,
  parseCommand,
} from './alias-expander.js';
import { type AbsolutePath, asAbsolutePath } from './utils.js';

// ── Test fixtures ───────────────────────────────────────────────────────

const allTools = new Map<string, AbsolutePath>([
  ['eza', asAbsolutePath('/usr/bin/eza')],
  ['bat', asAbsolutePath('/usr/bin/bat')],
  ['rg', asAbsolutePath('/usr/bin/rg')],
  ['fd', asAbsolutePath('/usr/bin/fd')],
  ['zoxide', asAbsolutePath('/usr/bin/zoxide')],
  ['dust', asAbsolutePath('/usr/bin/dust')],
  ['duf', asAbsolutePath('/usr/bin/duf')],
]);

const noTools = new Map<string, AbsolutePath>();

const ezaOnly = new Map<string, AbsolutePath>([['eza', asAbsolutePath('/usr/bin/eza')]]);

// ── parseCommand ────────────────────────────────────────────────────────

describe('parseCommand', () => {
  it('parses command with no args', () => {
    const result = parseCommand('ls');
    expect(result).toEqual({ cmdName: 'ls', args: [], argsStr: '' });
  });

  it('parses command with args', () => {
    const result = parseCommand('ls -la /tmp');
    expect(result.cmdName).toBe('ls');
    expect(result.args).toEqual(['-la', '/tmp']);
    expect(result.argsStr).toBe('-la /tmp');
  });

  it('handles empty string', () => {
    const result = parseCommand('');
    expect(result.cmdName).toBe('');
    expect(result.args).toEqual([]);
    expect(result.argsStr).toBe('');
  });

  it('handles whitespace-only string', () => {
    const result = parseCommand('   ');
    expect(result.cmdName).toBe('');
  });

  it('preserves raw args string with quotes', () => {
    const result = parseCommand('cat "file with spaces.txt"');
    expect(result.argsStr).toBe('"file with spaces.txt"');
  });

  it('handles multiple spaces between args', () => {
    const result = parseCommand('ls   -la   /tmp');
    expect(result.cmdName).toBe('ls');
    expect(result.args).toEqual(['-la', '/tmp']);
    expect(result.argsStr).toBe('  -la   /tmp');
  });
});

// ── expandAlias: string expansion ───────────────────────────────────────

describe('expandAlias', () => {
  describe('string expansion', () => {
    it('expands ls to eza with flags', async () => {
      const result = await expandAlias('ls', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toBe('eza --group-directories-first -F');
      expect(result.aliasName).toBe('ls');
    });

    it('expands ll to eza with long format', async () => {
      const result = await expandAlias('ll', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toBe('eza --group-directories-first -F -l');
    });

    it('expands la to eza with all files', async () => {
      const result = await expandAlias('la', allTools, '/home/user');
      expect(result.command).toBe('eza --group-directories-first -F -la');
    });

    it('preserves arguments after expansion', async () => {
      const result = await expandAlias('ls -la /tmp', allTools, '/home/user');
      expect(result.command).toBe('eza --group-directories-first -F -la /tmp');
    });

    it('preserves quoted arguments', async () => {
      const result = await expandAlias('cat "file with spaces.txt"', allTools, '/home/user');
      expect(result.command).toBe('bat --paging=never "file with spaces.txt"');
    });

    it('expands cat to bat', async () => {
      const result = await expandAlias('cat file.txt', allTools, '/home/user');
      expect(result.command).toBe('bat --paging=never file.txt');
    });

    it('expands grep to rg', async () => {
      const result = await expandAlias('grep TODO src/', allTools, '/home/user');
      expect(result.command).toBe('rg TODO src/');
    });

    it('expands find to fd', async () => {
      const result = await expandAlias('find . -name "*.ts"', allTools, '/home/user');
      expect(result.command).toBe('fd . -name "*.ts"');
    });

    it('returns original when tool not installed', async () => {
      const result = await expandAlias('ls', noTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
      expect(result.command).toBe('ls');
    });

    it('returns original when disabled', async () => {
      const result = await expandAlias('ls', allTools, '/home/user', false);
      expect(result.wasExpanded).toBe(false);
      expect(result.command).toBe('ls');
    });
  });

  // ── New aliases ─────────────────────────────────────────────────────────

  describe('new aliases', () => {
    it('expands tree to eza --tree', async () => {
      const result = await expandAlias('tree src/', allTools, '/home/user');
      expect(result.command).toBe('eza --tree src/');
    });

    it('expands less to bat with paging', async () => {
      const result = await expandAlias('less file.txt', allTools, '/home/user');
      expect(result.command).toBe('bat --paging=always file.txt');
    });

    it('expands du to dust', async () => {
      const result = await expandAlias('du', allTools, '/home/user');
      expect(result.command).toBe('dust');
    });

    it('expands du with args', async () => {
      const result = await expandAlias('du -h /var', allTools, '/home/user');
      expect(result.command).toBe('dust -h /var');
    });

    it('expands df to duf', async () => {
      const result = await expandAlias('df', allTools, '/home/user');
      expect(result.command).toBe('duf');
    });
  });

  // ── Callable expansion (zoxide) ─────────────────────────────────────────

  describe('callable expansion (zoxide)', () => {
    it('expands z with args to zoxide query', async () => {
      const result = await expandAlias('z projects', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toContain('zoxide query');
      expect(result.command).toContain('--exclude');
      expect(result.command).toContain('projects');
      expect(result.command).toContain('/home/user');
    });

    it('expands z without args to cd ~', async () => {
      const result = await expandAlias('z', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toBe('cd ~');
    });

    it('expands z with multi-word query', async () => {
      const result = await expandAlias('z my project', allTools, '/home/user');
      expect(result.command).toContain('zoxide query');
      expect(result.command).toContain('my project');
    });

    it('expands zi to interactive mode', async () => {
      const result = await expandAlias('zi', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toContain('zoxide query -i');
    });

    it('expands zi with query to filtered interactive', async () => {
      const result = await expandAlias('zi projects', allTools, '/home/user');
      expect(result.command).toContain('zoxide query -i');
      expect(result.command).toContain('projects');
    });

    it('does not expand z when zoxide not installed', async () => {
      const result = await expandAlias('z projects', noTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
      expect(result.command).toBe('z projects');
    });

    it('does not expand zi when zoxide not installed', async () => {
      const result = await expandAlias('zi', noTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
    });
  });

  // ── No expansion ───────────────────────────────────────────────────────

  describe('no expansion', () => {
    it('returns original for unknown commands', async () => {
      const result = await expandAlias('git status', allTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
      expect(result.command).toBe('git status');
    });

    it('handles empty command', async () => {
      const result = await expandAlias('', allTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
    });

    it('handles whitespace-only command', async () => {
      const result = await expandAlias('   ', allTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
    });

    it('does not expand cd (not an alias)', async () => {
      const result = await expandAlias('cd /tmp', allTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
      expect(result.command).toBe('cd /tmp');
    });
  });
});

// ── isAliasActive ───────────────────────────────────────────────────────

describe('isAliasActive', () => {
  it('returns true when tool is installed', () => {
    const def = { expansion: 'eza', requires: 'eza', description: 'test' };
    expect(isAliasActive(def, allTools)).toBe(true);
  });

  it('returns false when tool is not installed', () => {
    const def = { expansion: 'eza', requires: 'eza', description: 'test' };
    expect(isAliasActive(def, noTools)).toBe(false);
  });

  it('returns true when no tool required', () => {
    const def = { expansion: 'echo hello', description: 'test' };
    expect(isAliasActive(def, noTools)).toBe(true);
  });
});

// ── getActiveAliases ────────────────────────────────────────────────────

describe('getActiveAliases', () => {
  it('returns only aliases with installed tools', () => {
    const active = getActiveAliases(ezaOnly);

    expect(active.has('ls')).toBe(true);
    expect(active.has('ll')).toBe(true);
    expect(active.has('la')).toBe(true);
    expect(active.has('tree')).toBe(true);
    expect(active.has('cat')).toBe(false);
    expect(active.has('z')).toBe(false);
  });

  it('returns empty map when no tools installed', () => {
    const active = getActiveAliases(noTools);
    expect(active.size).toBe(0);
  });

  it('returns all aliases when all tools installed', () => {
    const active = getActiveAliases(allTools);
    expect(active.size).toBe(12);
  });
});

// ── Alias definitions ───────────────────────────────────────────────────

describe('alias definitions', () => {
  it('getAliasNames returns all alias names', () => {
    const names = getAliasNames();
    expect(names).toContain('ls');
    expect(names).toContain('z');
    expect(names).toContain('tree');
    expect(names.length).toBe(12);
  });

  it('getAliasDefinition returns definition for known alias', () => {
    const def = getAliasDefinition('ls');
    expect(def).toBeDefined();
    expect(def?.requires).toBe('eza');
  });

  it('getAliasDefinition returns undefined for unknown alias', () => {
    expect(getAliasDefinition('nonexistent')).toBeUndefined();
  });

  it('all aliases have descriptions', () => {
    for (const name of getAliasNames()) {
      const def = getAliasDefinition(name);
      expect(def?.description).toBeTruthy();
    }
  });
});

// ── Format helpers ──────────────────────────────────────────────────────

describe('formatActiveAliases', () => {
  it('formats string aliases with expansion', () => {
    const output = formatActiveAliases(ezaOnly);

    expect(output).toContain('ls');
    expect(output).toContain('eza');
  });

  it('formats callable aliases as (dynamic)', () => {
    const tools = new Map<string, AbsolutePath>([['zoxide', asAbsolutePath('/usr/bin/zoxide')]]);
    const output = formatActiveAliases(tools);

    expect(output).toContain('z');
    expect(output).toContain('(dynamic)');
  });

  it('returns empty string when no tools installed', () => {
    const output = formatActiveAliases(noTools);
    expect(output).toBe('');
  });
});

describe('formatAliasesCompact', () => {
  it('formats aliases in compact form', () => {
    const output = formatAliasesCompact(ezaOnly);
    expect(output).toContain('ls->eza');
    expect(output).toContain('ll->eza');
  });

  it('formats callable aliases as (fn)', () => {
    const tools = new Map<string, AbsolutePath>([['zoxide', asAbsolutePath('/usr/bin/zoxide')]]);
    const output = formatAliasesCompact(tools);
    expect(output).toContain('z->(fn)');
  });
});
