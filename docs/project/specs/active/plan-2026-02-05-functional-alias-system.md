# Feature: Functional Alias System

**Date:** 2026-02-05 (last updated 2026-02-05)

**Author:** Claude (with research from xonsh codebase)

**Status:** Draft

## Overview

A unified, functional alias system for Clam that consolidates command aliasing and
zoxide integration into a single, type-safe architecture inspired by
[xonsh’s callable aliases](https://xon.sh/api/_autosummary/cmd/xonsh.aliases.html).

This replaces the current fragmented approach (separate `command-aliases.ts` and
`zoxide.ts` modules with two different rewrite functions) with a single `ALIASES` object
and one `expandAlias()` function.

## Goals

- **Readable configuration**: All aliases defined in one file, easy to understand
- **Type-safe**: TypeScript ensures expansions are valid at compile time
- **Flexible**: String for simple aliases, functions for complex behavior (e.g., zoxide)
- **Testable**: Pure functions, easy to unit test
- **Self-documenting**: Each alias has a description for help output
- **Future-extensible**: Users could have `~/.clam/aliases.ts` in future versions

## Non-Goals

- User-defined aliases at runtime (no `alias` command in shell)
- Shell function definitions
- Alias persistence/editing through the shell itself
- Complex alias chains or recursive alias expansion
- Windows-specific alias handling

## Background

### Current Implementation (PR #5)

The shell-polish PR introduced command aliasing with this structure:

```
packages/clam/src/lib/shell/
├── command-aliases.ts    # COMMAND_ALIASES array, rewriteCommand()
├── zoxide.ts             # z/zi handling, rewriteZoxideCommand()
└── shell.ts              # Calls both rewrite functions separately
```

**Problems with current approach:**

1. **Fragmented definitions**: Aliases split across two files
2. **Two rewrite functions**: `rewriteCommand()` and `rewriteZoxideCommand()` called
   separately
3. **Special-case zoxide**: Zoxide commands treated differently from other aliases
4. **Hard to extend**: Adding new aliases requires understanding multiple code paths

### Xonsh Inspiration

Xonsh provides a powerful alias system where aliases can be:

- **Strings**: `aliases['ll'] = 'ls -la'`
- **Lists**: `aliases['ll'] = ['ls', '-la']`
- **Callables**: `aliases['z'] = lambda args, stdin=None: zoxide_jump(args)`

This pattern unifies simple string substitution with complex programmatic behavior.

**Key xonsh code references:**

- [aliases.py](https://github.com/xonsh/xonsh/blob/main/xonsh/aliases.py) - FuncAlias,
  ExecAlias implementation
- [xonsh aliases API](https://xon.sh/api/_autosummary/cmd/xonsh.aliases.html) - Callable
  alias documentation

## Design

### Architecture Overview

```
packages/clam/src/lib/shell/
├── alias-types.ts        # Type definitions (AliasContext, AliasExpansion, etc.)
├── alias-definitions.ts  # All aliases in one ALIASES object
├── alias-expander.ts     # expandAlias() function and helpers
├── alias-expander.test.ts # Comprehensive tests
├── zoxide.ts             # Reduced to just zoxideAdd() for post-cd tracking
└── index.ts              # Re-exports
```

### Type Definitions

```typescript
// lib/shell/alias-types.ts

/**
 * Context passed to callable aliases.
 * Provides all information needed to expand the alias dynamically.
 */
export interface AliasContext {
  /** Original command name (e.g., 'z', 'ls') */
  command: string;
  /** Arguments after the command, already split */
  args: string[];
  /** Current working directory */
  cwd: string;
  /** Environment variables */
  env: NodeJS.ProcessEnv;
}

/**
 * An alias expansion can be:
 * - A string: "eza --group-directories-first" (args appended automatically)
 * - An array: ["eza", "--group-directories-first"] (joined, args appended)
 * - A function: receives context, returns command (handles args itself)
 */
export type AliasExpansion =
  | string
  | string[]
  | ((ctx: AliasContext) => string | string[] | Promise<string | string[]>);

/**
 * Definition of a single alias.
 */
export interface AliasDefinition {
  /** The expansion - string, array, or function */
  expansion: AliasExpansion;
  /** Tool that must be installed (checked against detected tools) */
  requires?: string;
  /** Human-readable description for help output */
  description: string;
}

/**
 * Result of alias expansion.
 */
export interface AliasExpansionResult {
  /** The expanded command to execute */
  command: string;
  /** Whether an alias was applied */
  wasExpanded: boolean;
  /** The alias that was applied (if any) */
  aliasName?: string;
}
```

### Alias Definitions

All aliases in one readable file:

```typescript
// lib/shell/alias-definitions.ts

import type { AliasDefinition } from './alias-types.js';

/**
 * All alias definitions in one place.
 * Simple, readable, easy to extend.
 *
 * To add a new alias:
 * 1. Add entry to ALIASES object
 * 2. If it requires a tool, add `requires: 'toolname'`
 * 3. For simple substitution, use a string
 * 4. For dynamic behavior, use a function
 */
export const ALIASES: Record<string, AliasDefinition> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Modern Tool Substitutions
  // These replace traditional Unix commands with modern alternatives
  // ═══════════════════════════════════════════════════════════════════════════

  ls: {
    expansion: 'eza --group-directories-first -F',
    requires: 'eza',
    description: 'List with eza (icons, colors, git status)',
  },

  ll: {
    expansion: 'eza --group-directories-first -F -l',
    requires: 'eza',
    description: 'Long list with eza',
  },

  la: {
    expansion: 'eza --group-directories-first -F -la',
    requires: 'eza',
    description: 'List all (including hidden) with eza',
  },

  tree: {
    expansion: 'eza --tree',
    requires: 'eza',
    description: 'Tree view with eza',
  },

  cat: {
    expansion: 'bat --paging=never',
    requires: 'bat',
    description: 'Cat with syntax highlighting via bat',
  },

  less: {
    expansion: 'bat --paging=always',
    requires: 'bat',
    description: 'Pager with syntax highlighting via bat',
  },

  grep: {
    expansion: 'rg',
    requires: 'rg',
    description: 'Fast grep with ripgrep',
  },

  find: {
    expansion: 'fd',
    requires: 'fd',
    description: 'Fast find with fd',
  },

  du: {
    expansion: 'dust',
    requires: 'dust',
    description: 'Disk usage visualization with dust',
  },

  df: {
    expansion: 'duf',
    requires: 'duf',
    description: 'Disk free visualization with duf',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Zoxide - Smart Directory Jumping
  // These are callable aliases that generate dynamic commands
  // ═══════════════════════════════════════════════════════════════════════════

  z: {
    expansion: ({ args, cwd }) => {
      if (!args.length) {
        // z with no args goes home (like cd with no args)
        return 'cd ~';
      }
      // Query zoxide for best match, excluding current directory
      const query = args.join(' ');
      return `cd "$(zoxide query --exclude "${cwd}" -- ${query})"`;
    },
    requires: 'zoxide',
    description: 'Smart directory jump (zoxide)',
  },

  zi: {
    expansion: ({ args }) => {
      // Interactive selection with fzf
      if (args.length) {
        const query = args.join(' ');
        return `cd "$(zoxide query -i -- ${query})"`;
      }
      return 'cd "$(zoxide query -i)"';
    },
    requires: 'zoxide',
    description: 'Interactive directory jump with fzf (zoxide)',
  },
};

/**
 * Get list of all defined alias names.
 */
export function getAliasNames(): string[] {
  return Object.keys(ALIASES);
}

/**
 * Get alias definition by name.
 */
export function getAliasDefinition(name: string): AliasDefinition | undefined {
  return ALIASES[name];
}
```

### Alias Expander

The core expansion logic:

```typescript
// lib/shell/alias-expander.ts

import { ALIASES } from './alias-definitions.js';
import type { AliasContext, AliasDefinition, AliasExpansionResult } from './alias-types.js';
import type { AbsolutePath } from './utils.js';

/**
 * Check if an alias is active (required tool is installed or no requirement).
 */
export function isAliasActive(
  def: AliasDefinition,
  installedTools: Map<string, AbsolutePath>
): boolean {
  return !def.requires || installedTools.has(def.requires);
}

/**
 * Get all active aliases (where required tool is installed).
 */
export function getActiveAliases(
  installedTools: Map<string, AbsolutePath>
): Map<string, AliasDefinition> {
  const active = new Map<string, AliasDefinition>();

  for (const [name, def] of Object.entries(ALIASES)) {
    if (isAliasActive(def, installedTools)) {
      active.set(name, def);
    }
  }

  return active;
}

/**
 * Parse a command string into command name and arguments.
 */
export function parseCommand(command: string): { cmdName: string; args: string[]; argsStr: string } {
  const trimmed = command.trim();
  const spaceIdx = trimmed.indexOf(' ');

  if (spaceIdx === -1) {
    return { cmdName: trimmed, args: [], argsStr: '' };
  }

  const cmdName = trimmed.slice(0, spaceIdx);
  const argsStr = trimmed.slice(spaceIdx + 1);
  // Simple split on whitespace - doesn't handle quoted strings
  // For complex cases, the callable alias handles its own arg parsing
  const args = argsStr.split(/\s+/).filter(Boolean);

  return { cmdName, args, argsStr };
}

/**
 * Expand an alias if one matches the command.
 *
 * @param command - The full command string (e.g., "ls -la /tmp")
 * @param installedTools - Map of tool name to path (from detectInstalledTools)
 * @param cwd - Current working directory
 * @returns Expansion result with the command to execute
 */
export async function expandAlias(
  command: string,
  installedTools: Map<string, AbsolutePath>,
  cwd: string
): Promise<AliasExpansionResult> {
  const { cmdName, args, argsStr } = parseCommand(command);

  // No command to expand
  if (!cmdName) {
    return { command, wasExpanded: false };
  }

  const def = ALIASES[cmdName];

  // No alias defined for this command
  if (!def) {
    return { command, wasExpanded: false };
  }

  // Check if required tool is available
  if (!isAliasActive(def, installedTools)) {
    return { command, wasExpanded: false };
  }

  const ctx: AliasContext = {
    command: cmdName,
    args,
    cwd,
    env: process.env,
  };

  const expansion = def.expansion;
  let expandedCommand: string;

  if (typeof expansion === 'string') {
    // Simple string expansion: append original args
    expandedCommand = argsStr ? `${expansion} ${argsStr}` : expansion;
  } else if (Array.isArray(expansion)) {
    // Array expansion: join and append args
    const base = expansion.join(' ');
    expandedCommand = argsStr ? `${base} ${argsStr}` : base;
  } else if (typeof expansion === 'function') {
    // Callable expansion: function handles args itself
    const result = await expansion(ctx);
    expandedCommand = Array.isArray(result) ? result.join(' ') : result;
  } else {
    // Unknown expansion type, return original
    return { command, wasExpanded: false };
  }

  return {
    command: expandedCommand,
    wasExpanded: true,
    aliasName: cmdName,
  };
}

/**
 * Synchronous version for cases where async isn't needed.
 * Only works with string/array expansions, not callable.
 */
export function expandAliasSync(
  command: string,
  installedTools: Map<string, AbsolutePath>
): AliasExpansionResult {
  const { cmdName, argsStr } = parseCommand(command);

  if (!cmdName) {
    return { command, wasExpanded: false };
  }

  const def = ALIASES[cmdName];
  if (!def || !isAliasActive(def, installedTools)) {
    return { command, wasExpanded: false };
  }

  const expansion = def.expansion;

  if (typeof expansion === 'string') {
    const expandedCommand = argsStr ? `${expansion} ${argsStr}` : expansion;
    return { command: expandedCommand, wasExpanded: true, aliasName: cmdName };
  }

  if (Array.isArray(expansion)) {
    const base = expansion.join(' ');
    const expandedCommand = argsStr ? `${base} ${argsStr}` : base;
    return { command: expandedCommand, wasExpanded: true, aliasName: cmdName };
  }

  // Callable expansion requires async
  return { command, wasExpanded: false };
}

/**
 * Format active aliases for display (e.g., in /help or /aliases).
 */
export function formatActiveAliases(
  installedTools: Map<string, AbsolutePath>
): string {
  const active = getActiveAliases(installedTools);
  const lines: string[] = [];

  for (const [name, def] of active) {
    const expansionStr =
      typeof def.expansion === 'function'
        ? '(dynamic)'
        : typeof def.expansion === 'string'
          ? def.expansion
          : def.expansion.join(' ');

    lines.push(`  ${name.padEnd(8)} -> ${expansionStr}`);
    if (def.description) {
      lines.push(`             ${def.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format aliases as a simple list for compact display.
 */
export function formatAliasesCompact(
  installedTools: Map<string, AbsolutePath>
): string {
  const active = getActiveAliases(installedTools);
  const parts: string[] = [];

  for (const [name, def] of active) {
    const target =
      typeof def.expansion === 'function'
        ? '(fn)'
        : typeof def.expansion === 'string'
          ? def.expansion.split(' ')[0]
          : def.expansion[0];
    parts.push(`${name}->${target}`);
  }

  return parts.join(' ');
}
```

### Integration with Shell

Update `shell.ts` to use the new system:

```typescript
// In shell.ts exec() method

import { expandAlias } from './alias-expander.js';
import { zoxideAdd } from './zoxide.js';

async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
  // Expand aliases before execution
  const { command: expandedCommand, wasExpanded } = await expandAlias(
    command,
    this.installedTools,
    this.cwd
  );

  if (wasExpanded) {
    // Optionally log the expansion for debugging
    // console.debug(`Alias: ${command} -> ${expandedCommand}`);
  }

  // Execute the expanded command
  const result = await this.executeCommand(expandedCommand, options);

  // If this was a successful cd, update zoxide database
  if (result.exitCode === 0 && this.isZoxideAvailable) {
    const cdMatch = expandedCommand.match(/^cd\s+(.+)/);
    if (cdMatch) {
      await zoxideAdd(this.cwd);
    }
  }

  return result;
}
```

### Reduced Zoxide Module

After migration, `zoxide.ts` only needs:

```typescript
// lib/shell/zoxide.ts (simplified)

import { execPromise, type AbsolutePath } from './utils.js';

/**
 * Check if zoxide is available from pre-detected tools map.
 */
export function isZoxideAvailable(installedTools: Map<string, AbsolutePath>): boolean {
  return installedTools.has('zoxide');
}

/**
 * Add a directory to zoxide's database.
 * Call this after successful cd to update frecency.
 */
export async function zoxideAdd(dir: string): Promise<void> {
  try {
    await execPromise(`zoxide add "${dir}"`, { timeout: 1000 });
  } catch {
    // Ignore errors - zoxide add is best-effort
  }
}
```

## Implementation Plan

### Phase 1: Create New Alias Infrastructure

- [ ] Create `lib/shell/alias-types.ts` with type definitions
- [ ] Create `lib/shell/alias-definitions.ts` with all aliases migrated from current
  code
- [ ] Create `lib/shell/alias-expander.ts` with expansion logic
- [ ] Add comprehensive unit tests for all expansion types

### Phase 2: Integrate and Replace

- [ ] Update `shell.ts` to use `expandAlias()` instead of separate rewrite functions
- [ ] Update `index.ts` exports
- [ ] Verify zoxide `z` and `zi` work correctly with callable aliases
- [ ] Ensure `zoxide add` still called after successful cd

### Phase 3: Cleanup

- [ ] Remove `command-aliases.ts` (replaced by alias-definitions.ts)
- [ ] Simplify `zoxide.ts` to only contain `zoxideAdd()` and `isZoxideAvailable()`
- [ ] Remove old `rewriteCommand()` and `rewriteZoxideCommand()` calls
- [ ] Update `/help` or add `/aliases` command to show active aliases

## Testing Strategy

### Unit Tests

```typescript
// alias-expander.test.ts

describe('expandAlias', () => {
  const allTools = new Map([
    ['eza', '/usr/bin/eza'],
    ['bat', '/usr/bin/bat'],
    ['rg', '/usr/bin/rg'],
    ['zoxide', '/usr/bin/zoxide'],
  ]);

  const noTools = new Map();

  describe('string expansion', () => {
    it('expands ls to eza with flags', async () => {
      const result = await expandAlias('ls', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toBe('eza --group-directories-first -F');
    });

    it('preserves arguments after expansion', async () => {
      const result = await expandAlias('ls -la /tmp', allTools, '/home/user');
      expect(result.command).toBe('eza --group-directories-first -F -la /tmp');
    });

    it('returns original when tool not installed', async () => {
      const result = await expandAlias('ls', noTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
      expect(result.command).toBe('ls');
    });
  });

  describe('callable expansion (zoxide)', () => {
    it('expands z with args to zoxide query', async () => {
      const result = await expandAlias('z projects', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toContain('zoxide query');
      expect(result.command).toContain('projects');
    });

    it('expands z without args to cd ~', async () => {
      const result = await expandAlias('z', allTools, '/home/user');
      expect(result.command).toBe('cd ~');
    });

    it('expands zi to interactive mode', async () => {
      const result = await expandAlias('zi', allTools, '/home/user');
      expect(result.command).toContain('zoxide query -i');
    });
  });

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
  });
});

describe('getActiveAliases', () => {
  it('returns only aliases with installed tools', () => {
    const tools = new Map([['eza', '/usr/bin/eza']]);
    const active = getActiveAliases(tools);

    expect(active.has('ls')).toBe(true);
    expect(active.has('ll')).toBe(true);
    expect(active.has('cat')).toBe(false); // bat not installed
    expect(active.has('z')).toBe(false);   // zoxide not installed
  });
});

describe('formatActiveAliases', () => {
  it('formats aliases for display', () => {
    const tools = new Map([['eza', '/usr/bin/eza']]);
    const output = formatActiveAliases(tools);

    expect(output).toContain('ls');
    expect(output).toContain('eza');
  });
});
```

### Integration Tests

- Run `ls` and verify eza output (when installed)
- Run `z projectname` and verify directory change
- Run `cat file.txt` and verify bat syntax highlighting
- Verify aliases don’t apply when tools missing

### Manual Testing

```bash
# Start clam
pnpm clam

# Test basic aliases
> ls              # Should use eza if installed
> ll              # Should show long format
> cat package.json # Should have syntax highlighting

# Test zoxide
> z clam          # Should jump to matching directory
> zi              # Should show interactive picker

# Test when tool missing
> # (uninstall eza temporarily)
> ls              # Should fall back to regular ls
```

## Migration Guide

### Before (PR #5)

```typescript
// shell.ts
const rewritten = rewriteCommand(command, this.installedTools);
const zoxideCmd = rewriteZoxideCommand(rewritten, this.cwd);
await this.executeCommand(zoxideCmd);
```

### After (This Spec)

```typescript
// shell.ts
const { command: expanded } = await expandAlias(command, this.installedTools, this.cwd);
await this.executeCommand(expanded);
```

## Comparison: Before vs After

| Aspect | Before (PR #5) | After (This Spec) |
| --- | --- | --- |
| Files | `command-aliases.ts` + `zoxide.ts` | `alias-types.ts` + `alias-definitions.ts` + `alias-expander.ts` |
| Alias storage | Array + separate zoxide module | Single `ALIASES` object |
| Zoxide | Special case, separate code path | Regular callable alias |
| Expansion | Two functions called in sequence | Single `expandAlias()` |
| Adding alias | Modify array + update rewriter | Add entry to ALIASES |
| Type safety | Partial | Full (expansion types checked) |
| Testability | Coupled to implementation | Pure functions, easy to mock |

## Future Enhancements

### User-Defined Aliases (Future)

```typescript
// Possible future: ~/.clam/aliases.ts
import type { AliasDefinition } from 'clam';

export const userAliases: Record<string, AliasDefinition> = {
  myalias: {
    expansion: 'some-command --my-flags',
    description: 'My custom alias',
  },
};
```

### Alias Commands (Future)

```
/aliases           # List active aliases
/alias add ...     # Add runtime alias (session only)
/alias remove ...  # Remove alias
```

## Open Questions

1. **Quoted argument handling**: The simple `split(/\s+/)` doesn’t handle quoted
   strings. For most aliases this is fine since args are passed through.
   Should callable aliases receive raw args string instead of parsed array?

2. **Alias chaining**: Should `alias1 -> alias2 -> command` be supported?
   Currently not planned - adds complexity.

3. **Platform differences**: Some tools have different flags on macOS vs Linux.
   Handle in alias definition or separate platform config?

## References

### Xonsh Alias System

- [xonsh aliases API](https://xon.sh/api/_autosummary/cmd/xonsh.aliases.html) - Callable
  alias architecture
- [xonsh aliases.py source](https://github.com/xonsh/xonsh/blob/main/xonsh/aliases.py) -
  Implementation of FuncAlias, ExecAlias
- [xonsh tutorial: aliases](https://xon.sh/tutorial.html) - Lambda aliases

### Related Clam Specs

- [Shell Polish Spec](plan-2026-02-05-shell-polish.md) - Parent spec for shell
  improvements

### Modern CLI Tools

- [eza](https://github.com/eza-community/eza) - Modern ls
- [bat](https://github.com/sharkdp/bat) - Cat with wings
- [ripgrep](https://github.com/BurntSushi/ripgrep) - Fast grep
- [fd](https://github.com/sharkdp/fd) - Fast find
- [zoxide](https://github.com/ajeetdsouza/zoxide) - Smart cd
- [dust](https://github.com/bootandy/dust) - Modern du
- [duf](https://github.com/muesli/duf) - Modern df
