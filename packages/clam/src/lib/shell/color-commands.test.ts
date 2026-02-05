/**
 * Tests for command-specific color flag injection.
 */

import { describe, expect, it } from 'bun:test';
import {
  addColorFlags,
  COLOR_ALWAYS_COMMANDS,
  GIT_COLOR_SUBCOMMANDS,
  shouldForceColor,
} from './color-commands.js';

describe('COLOR_ALWAYS_COMMANDS', () => {
  it('should include ls', () => {
    expect(COLOR_ALWAYS_COMMANDS.ls).toEqual(['--color=always']);
  });

  it('should include grep variants', () => {
    expect(COLOR_ALWAYS_COMMANDS.grep).toEqual(['--color=always']);
    expect(COLOR_ALWAYS_COMMANDS.egrep).toEqual(['--color=always']);
    expect(COLOR_ALWAYS_COMMANDS.fgrep).toEqual(['--color=always']);
  });

  it('should include diff', () => {
    expect(COLOR_ALWAYS_COMMANDS.diff).toEqual(['--color=always']);
  });
});

describe('GIT_COLOR_SUBCOMMANDS', () => {
  it('should include common git subcommands that support color', () => {
    expect(GIT_COLOR_SUBCOMMANDS).toContain('diff');
    expect(GIT_COLOR_SUBCOMMANDS).toContain('log');
    expect(GIT_COLOR_SUBCOMMANDS).toContain('show');
    expect(GIT_COLOR_SUBCOMMANDS).toContain('status');
    expect(GIT_COLOR_SUBCOMMANDS).toContain('branch');
  });
});

describe('shouldForceColor', () => {
  it('should return true for commands in COLOR_ALWAYS_COMMANDS', () => {
    expect(shouldForceColor('ls')).toBe(true);
    expect(shouldForceColor('grep')).toBe(true);
    expect(shouldForceColor('diff')).toBe(true);
  });

  it('should return true for git', () => {
    expect(shouldForceColor('git')).toBe(true);
  });

  it('should return false for unknown commands', () => {
    expect(shouldForceColor('cat')).toBe(false);
    expect(shouldForceColor('echo')).toBe(false);
    expect(shouldForceColor('node')).toBe(false);
  });
});

describe('addColorFlags', () => {
  describe('for ls', () => {
    it('should prepend --color=always', () => {
      expect(addColorFlags('ls', ['-la'])).toEqual(['--color=always', '-la']);
    });

    it('should work with no existing args', () => {
      expect(addColorFlags('ls', [])).toEqual(['--color=always']);
    });
  });

  describe('for grep', () => {
    it('should prepend --color=always', () => {
      expect(addColorFlags('grep', ['pattern', 'file.txt'])).toEqual([
        '--color=always',
        'pattern',
        'file.txt',
      ]);
    });
  });

  describe('for diff', () => {
    it('should prepend --color=always', () => {
      expect(addColorFlags('diff', ['file1', 'file2'])).toEqual([
        '--color=always',
        'file1',
        'file2',
      ]);
    });
  });

  describe('for git', () => {
    it('should insert --color=always after color-supporting subcommands', () => {
      expect(addColorFlags('git', ['diff'])).toEqual(['diff', '--color=always']);
      expect(addColorFlags('git', ['log', '--oneline'])).toEqual([
        'log',
        '--color=always',
        '--oneline',
      ]);
      expect(addColorFlags('git', ['show', 'HEAD'])).toEqual(['show', '--color=always', 'HEAD']);
      expect(addColorFlags('git', ['status'])).toEqual(['status', '--color=always']);
      expect(addColorFlags('git', ['branch', '-a'])).toEqual(['branch', '--color=always', '-a']);
    });

    it('should not add flags for non-color git subcommands', () => {
      expect(addColorFlags('git', ['add', '.'])).toEqual(['add', '.']);
      expect(addColorFlags('git', ['commit', '-m', 'msg'])).toEqual(['commit', '-m', 'msg']);
      expect(addColorFlags('git', ['push'])).toEqual(['push']);
      expect(addColorFlags('git', ['pull'])).toEqual(['pull']);
    });

    it('should not modify git with no subcommand', () => {
      expect(addColorFlags('git', [])).toEqual([]);
    });
  });

  describe('for unknown commands', () => {
    it('should return args unchanged', () => {
      expect(addColorFlags('cat', ['file.txt'])).toEqual(['file.txt']);
      expect(addColorFlags('node', ['script.js'])).toEqual(['script.js']);
      expect(addColorFlags('echo', ['hello'])).toEqual(['hello']);
    });
  });

  describe('edge cases', () => {
    it('should not duplicate --color=always if already present', () => {
      expect(addColorFlags('ls', ['--color=always', '-la'])).toEqual(['--color=always', '-la']);
      expect(addColorFlags('git', ['diff', '--color=always'])).toEqual(['diff', '--color=always']);
    });
  });
});
