# Feature: Functional Alias System

**Date:** 2026-02-05 (last updated 2026-02-06)

**Author:** Claude (with research from xonsh codebase)

**Status:** Ready for Implementation

**Reviewed:** 2026-02-06 (senior engineering review applied)

## Overview

A unified, functional alias system for Clam that consolidates command aliasing and
zoxide integration into a single architecture inspired by
[xonsh’s callable aliases](https://xon.sh/api/_autosummary/cmd/xonsh.aliases.html).

This replaces the current fragmented approach (separate `command-aliases.ts` and
`zoxide.ts` modules with two different rewrite functions) with a single `ALIASES` object
and one `expandAlias()` function.

## Goals

- **Unified expansion path**: One function replaces two sequential rewrite calls
- **Readable configuration**: All aliases defined in one file, easy to understand
- **Flexible**: String for simple aliases, functions for complex behavior (e.g., zoxide)
- **Testable**: Pure functions, easy to unit test
- **Self-documenting**: Each alias has a description for help output

## Non-Goals

- User-defined aliases at runtime (no `alias` command in shell)
- Shell function definitions
- Alias persistence/editing through the shell itself
- Complex alias chains or recursive alias expansion
- Windows-specific alias handling
- A sync expansion API (all expansion goes through a single async path)

## Background

### Current Implementation (PR #5)

The shell-polish PR introduced command aliasing with this structure:

```
packages/clam/src/lib/shell/
├── command-aliases.ts    # COMMAND_ALIASES array (6 aliases), rewriteCommand()
├── zoxide.ts             # z/zi handling, rewriteZoxideCommand(), zoxideAdd()
└── shell.ts              # Calls both rewrite functions separately in exec()
```

**Current aliases** (command-aliases.ts): ls, ll, la, cat, grep, find

**Problems with current approach:**

1. **Fragmented definitions**: Aliases split across two files with different data models
2. **Two rewrite functions**: `rewriteCommand()` and `rewriteZoxideCommand()` called
   separately in sequence in `shell.ts exec()`
3. **Special-case zoxide**: Zoxide commands use `detectZoxideCommand()` + conditional
   rewriting, a completely different code path from other aliases
4. **Hard to extend**: Adding a new dynamic alias requires understanding both modules

### Xonsh Inspiration

Xonsh provides a powerful alias system where aliases can be:

- **Strings**: `aliases['ll'] = 'ls -la'`
- **Callables**: `aliases['z'] = lambda args, stdin=None: zoxide_jump(args)`

The key insight from xonsh is that the `Aliases` class (a `MutableMapping`) normalizes
all alias types on assignment, and `eval_alias()` handles recursive expansion with cycle
detection. We adopt the polymorphic expansion pattern (string vs callable) while
deliberately not adopting xonsh’s complexity (recursive expansion, decorator aliases,
`ExecAlias`, `PartialEvalAlias`, signature-adaptive dispatch via `run_alias_by_params`).

**Key xonsh code references** (checked out in `attic/xonsh/`):

- `xonsh/aliases.py` - `Aliases` class, `FuncAlias`, `ExecAlias`, `eval_alias()`
- `xonsh/cli_utils.py` - `ArgParserAlias` for structured CLI-style aliases

## Design

### Architecture Overview

```
packages/clam/src/lib/shell/
├── alias-types.ts        # Type definitions (AliasContext, AliasExpansion, etc.)
├── alias-definitions.ts  # All aliases in one ALIASES object
├── alias-expander.ts     # expandAlias() function and helpers
├── alias-expander.test.ts # Comprehensive tests
├── zoxide.ts             # Reduced to just zoxideAdd() for post-cd tracking
└── index.ts              # Re-exports (updated)
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
  /** Arguments after the command, split on whitespace */
  args: string[];
  /** Raw argument string (everything after command name, preserves quoting) */
  argsStr: string;
  /** Current working directory */
  cwd: string;
}

/**
 * An alias expansion can be:
 * - A string: "eza --group-directories-first" (args appended automatically)
 * - A function: receives context, returns command string (handles args itself)
 */
export type AliasExpansion =
  | string
  | ((ctx: AliasContext) => string | Promise<string>);

/**
 * Definition of a single alias.
 */
export interface AliasDefinition {
  /** The expansion - string or function */
  expansion: AliasExpansion;
  /** Tool that must be installed (checked against detected tools map) */
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

**Design decisions on types:**

- **No `string[]` expansion type**: Not used by any alias.
  If needed later, trivial to add.
- **No `env` in AliasContext**: No current alias needs environment variables.
  Add when a real use case appears.
- **`argsStr` included**: Callable aliases get both the parsed `args` array and the raw
  `argsStr` string. This avoids losing quoting information when args are split.
- **No sync API**: All expansion goes through one async `expandAlias()`. Avoids the
  footgun of a sync version that silently skips callable aliases.

### Alias Definitions

All aliases in one readable file:

```typescript
// lib/shell/alias-definitions.ts

import type { AliasDefinition } from './alias-types.js';

/**
 * All alias definitions in one place.
 *
 * To add a new alias:
 * 1. Add entry to ALIASES object
 * 2. If it requires a tool, add `requires: 'toolname'`
 *    (tool name must match a key from detectInstalledTools())
 * 3. For simple substitution, use a string
 * 4. For dynamic behavior, use a function
 */
export const ALIASES: Record<string, AliasDefinition> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Modern Tool Substitutions (migrated from command-aliases.ts)
  // ═══════════════════════════════════════════════════════════════════════════

  ls: {
    expansion: 'eza --group-directories-first -F',
    requires: 'eza',
    description: 'List with eza (colors, git status)',
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

  cat: {
    expansion: 'bat --paging=never',
    requires: 'bat',
    description: 'Cat with syntax highlighting via bat',
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

  // ═══════════════════════════════════════════════════════════════════════════
  // New aliases (not in current command-aliases.ts)
  // ═══════════════════════════════════════════════════════════════════════════

  tree: {
    expansion: 'eza --tree',
    requires: 'eza',
    description: 'Tree view with eza',
  },

  less: {
    expansion: 'bat --paging=always',
    requires: 'bat',
    description: 'Pager with syntax highlighting via bat',
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
  // Zoxide - Smart Directory Jumping (migrated from zoxide.ts)
  // These are callable aliases that generate dynamic cd commands
  // ═══════════════════════════════════════════════════════════════════════════

  z: {
    expansion: ({ args, cwd }) => {
      if (!args.length) {
        // z with no args goes home (like cd with no args)
        return 'cd ~';
      }
      // Query zoxide for best match, excluding current directory.
      // Note: args are passed after -- to prevent injection. The double quotes
      // around $() protect against word splitting. Shell metacharacters in args
      // are a known limitation (same as current zoxide.ts implementation).
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
  // Simple split on whitespace. Doesn't handle quoted strings, but that's fine:
  // string aliases pass argsStr through verbatim (preserving quoting), and
  // callable aliases can use argsStr directly if they need the raw string.
  const args = argsStr.split(/\s+/).filter(Boolean);

  return { cmdName, args, argsStr };
}

/**
 * Expand an alias if one matches the command.
 *
 * This is the single entry point for all alias expansion. It replaces both
 * rewriteCommand() and rewriteZoxideCommand() from the old architecture.
 *
 * @param command - The full command string (e.g., "ls -la /tmp")
 * @param installedTools - Map of tool name to path (from detectInstalledTools)
 * @param cwd - Current working directory
 * @param enabled - Whether aliasing is enabled (false = always return original)
 * @returns Expansion result with the command to execute
 */
export async function expandAlias(
  command: string,
  installedTools: Map<string, AbsolutePath>,
  cwd: string,
  enabled = true
): Promise<AliasExpansionResult> {
  if (!enabled) {
    return { command, wasExpanded: false };
  }

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

  const expansion = def.expansion;
  let expandedCommand: string;

  if (typeof expansion === 'string') {
    // Simple string expansion: append original args (raw string, preserves quoting)
    expandedCommand = argsStr ? `${expansion} ${argsStr}` : expansion;
  } else if (typeof expansion === 'function') {
    // Callable expansion: function handles args itself
    const ctx: AliasContext = {
      command: cmdName,
      args,
      argsStr,
      cwd,
    };
    expandedCommand = await expansion(ctx);
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
        : def.expansion;

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
        : def.expansion.split(' ')[0];
    parts.push(`${name}->${target}`);
  }

  return parts.join(' ');
}
```

### Integration with Shell

Update `shell.ts` to use the new system.
This shows the full exec() changes needed, not just the alias call:

```typescript
// In shell.ts - updated imports
import { expandAlias } from './shell/alias-expander.js';
import { zoxideAdd } from './shell/zoxide.js';
// Remove: import { rewriteCommand } from './shell/command-aliases.js';
// Remove: import { detectZoxideCommand, rewriteZoxideCommand, ... } from './shell/zoxide.js';

// In exec() method - the key change is replacing two sequential rewrites with one call:

async function exec(command: string, execOptions: ExecOptions = {}): Promise<ExecResult> {
  const effectiveCwd = execOptions.cwd ?? currentCwd;

  // Single alias expansion replaces both rewriteCommand() and rewriteZoxideCommand()
  const { command: expandedCommand, wasExpanded, aliasName } = await expandAlias(
    command,
    installedTools,
    effectiveCwd,
    aliasingEnabled
  );

  // Detect if the expanded command is a cd (for cwd tracking).
  // This catches both explicit cd commands AND z/zi aliases that expand to cd.
  const isCdCommand = expandedCommand.trim().startsWith('cd') || (!wasExpanded && command.trim().startsWith('cd'));

  // ... rest of exec() remains unchanged (env setup, interactive/non-interactive
  // execution, cwd tracking via && pwd, zoxide add after cd) ...

  // The only structural change: remove the detectZoxideCommand() + rewriteZoxideCommand()
  // block and the rewriteCommand() call. Everything else (cwd tracking, && pwd append,
  // interactive vs non-interactive, zoxideAdd) stays as-is.

  // If this was a successful cd, update zoxide database (same as current code)
  if (isCdCommand && result.exitCode === 0 && installedTools.has('zoxide')) {
    zoxideAdd(currentCwd).catch(() => {});
  }

  return result;
}
```

**Key integration details:**

- `expandAlias()` accepts `enabled` parameter, replacing the separate `aliasingEnabled`
  check that `rewriteCommand()` had
- `isCdCommand` detection now works on the expanded command, which catches z/zi aliases
  that expand to `cd "$(zoxide query ...)"`. This simplifies the current logic that
  checks both `zoxideType !== null` and `workingCommand.startsWith('cd')`
- The `&& pwd` append, cwd tracking, interactive/non-interactive branching, and
  `zoxideAdd()` call all remain unchanged
- The `detectCdCommand()` helper in shell.ts is still needed for the interactive cwd
  tracking path

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

Removed from zoxide.ts: `isZoxideInstalled()`, `zoxideQuery()`, `buildZCommand()`,
`buildZiCommand()`, `detectZoxideCommand()`, `rewriteZoxideCommand()`. All of this
behavior is now handled by the z/zi callable aliases in alias-definitions.ts.

## Implementation Plan

### Phase 1: Create New Alias Infrastructure (additive, no breaking changes)

- [ ] Create `lib/shell/alias-types.ts` with type definitions
- [ ] Create `lib/shell/alias-definitions.ts` with all aliases (6 migrated + 4 new)
- [ ] Create `lib/shell/alias-expander.ts` with expansion logic
- [ ] Add comprehensive unit tests (`alias-expander.test.ts`)

### Phase 2: Integrate and Replace

- [ ] Update `shell.ts` to use `expandAlias()` instead of separate rewrite functions
- [ ] Remove `detectZoxideCommand()` and `rewriteZoxideCommand()` calls from shell.ts
- [ ] Remove `rewriteCommand()` call from shell.ts
- [ ] Update `isCdCommand` detection to work on expanded command
- [ ] Verify `aliasingEnabled` flag works via `expandAlias()`'s `enabled` param
- [ ] Ensure `zoxideAdd()` still called after successful cd

### Phase 3: Cleanup and Exports

- [ ] Remove `command-aliases.ts` (replaced by alias-definitions.ts + alias-expander.ts)
- [ ] Simplify `zoxide.ts` to only contain `zoxideAdd()` and `isZoxideAvailable()`
- [ ] Update `shell/index.ts` exports (remove old, add new)
- [ ] Remove old tests (`command-aliases.test.ts`, `zoxide.test.ts`) after verifying new
  tests cover all scenarios
- [ ] Run full test suite and verify no regressions

## Testing Strategy

### Unit Tests

```typescript
// alias-expander.test.ts

import { describe, expect, it } from 'vitest';
import { expandAlias, getActiveAliases, formatActiveAliases, parseCommand } from './alias-expander.js';
import { asAbsolutePath, type AbsolutePath } from './utils.js';

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
  });

  it('preserves raw args string', () => {
    const result = parseCommand('cat "file with spaces.txt"');
    expect(result.argsStr).toBe('"file with spaces.txt"');
  });
});

describe('expandAlias', () => {
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

  describe('string expansion', () => {
    it('expands ls to eza with flags', async () => {
      const result = await expandAlias('ls', allTools, '/home/user');
      expect(result.wasExpanded).toBe(true);
      expect(result.command).toBe('eza --group-directories-first -F');
      expect(result.aliasName).toBe('ls');
    });

    it('preserves arguments after expansion', async () => {
      const result = await expandAlias('ls -la /tmp', allTools, '/home/user');
      expect(result.command).toBe('eza --group-directories-first -F -la /tmp');
    });

    it('preserves quoted arguments', async () => {
      const result = await expandAlias('cat "file with spaces.txt"', allTools, '/home/user');
      expect(result.command).toBe('bat --paging=never "file with spaces.txt"');
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
      expect(result.command).toBe('cd ~');
    });

    it('expands zi to interactive mode', async () => {
      const result = await expandAlias('zi', allTools, '/home/user');
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
  });

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

    it('expands df to duf', async () => {
      const result = await expandAlias('df', allTools, '/home/user');
      expect(result.command).toBe('duf');
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

    it('handles whitespace-only command', async () => {
      const result = await expandAlias('   ', allTools, '/home/user');
      expect(result.wasExpanded).toBe(false);
    });
  });
});

describe('getActiveAliases', () => {
  it('returns only aliases with installed tools', () => {
    const tools = new Map<string, AbsolutePath>([
      ['eza', asAbsolutePath('/usr/bin/eza')],
    ]);
    const active = getActiveAliases(tools);

    expect(active.has('ls')).toBe(true);
    expect(active.has('ll')).toBe(true);
    expect(active.has('tree')).toBe(true);
    expect(active.has('cat')).toBe(false);  // bat not installed
    expect(active.has('z')).toBe(false);    // zoxide not installed
  });

  it('returns empty map when no tools installed', () => {
    const active = getActiveAliases(new Map());
    expect(active.size).toBe(0);
  });
});

describe('formatActiveAliases', () => {
  it('formats string aliases with expansion', () => {
    const tools = new Map<string, AbsolutePath>([
      ['eza', asAbsolutePath('/usr/bin/eza')],
    ]);
    const output = formatActiveAliases(tools);

    expect(output).toContain('ls');
    expect(output).toContain('eza');
  });

  it('formats callable aliases as (dynamic)', () => {
    const tools = new Map<string, AbsolutePath>([
      ['zoxide', asAbsolutePath('/usr/bin/zoxide')],
    ]);
    const output = formatActiveAliases(tools);

    expect(output).toContain('z');
    expect(output).toContain('(dynamic)');
  });
});
```

### Regression Coverage

The new test suite must cover all scenarios from the existing tests:

- From `command-aliases.test.ts`: rewriting with installed tools, argument preservation,
  tool availability checks, disabled flag, empty/whitespace commands, getAlias,
  formatAlias
- From `zoxide.test.ts`: z with args, z without args (cd ~), zi, zi with query,
  non-zoxide commands passed through, isZoxideAvailable

### Manual Testing

```bash
# Start clam
pnpm clam

# Test migrated aliases (same behavior as before)
> ls              # Should use eza if installed
> ll              # Should show long format
> cat package.json # Should have syntax highlighting
> grep TODO src/  # Should use rg

# Test new aliases
> tree src/       # Should use eza --tree
> less file.txt   # Should use bat with paging
> du              # Should use dust
> df              # Should use duf

# Test zoxide (same behavior as before)
> z clam          # Should jump to matching directory
> zi              # Should show interactive picker

# Test fallback when tool missing
> # (with tool not installed)
> ls              # Should fall back to regular ls
```

## Migration Guide

### Before (current code)

```typescript
// shell.ts exec()
const zoxideType = detectZoxideCommand(command);
let workingCommand = command;
if (zoxideType && installedTools.has('zoxide')) {
  workingCommand = rewriteZoxideCommand(command, effectiveCwd);
}
const aliasedCommand = rewriteCommand(workingCommand, installedTools, aliasingEnabled);
const isCdCommand = workingCommand.trim().startsWith('cd') || zoxideType !== null;
// ... execute aliasedCommand
```

### After (this spec)

```typescript
// shell.ts exec()
const { command: expandedCommand } = await expandAlias(
  command, installedTools, effectiveCwd, aliasingEnabled
);
const isCdCommand = expandedCommand.trim().startsWith('cd');
// ... execute expandedCommand
```

The two-function pipeline collapses to a single call.
The `isCdCommand` detection simplifies because z/zi aliases expand to
`cd "$(zoxide query ...)"`, which starts with `cd`.

## Comparison: Before vs After

| Aspect | Before (PR #5) | After (This Spec) |
| --- | --- | --- |
| Files | `command-aliases.ts` + `zoxide.ts` | `alias-types.ts` + `alias-definitions.ts` + `alias-expander.ts` |
| Alias storage | Array of 6 + separate zoxide module | Single `ALIASES` object (12 entries) |
| Zoxide | Special case, separate code path | Regular callable alias |
| Expansion | Two functions called in sequence | Single `expandAlias()` |
| Adding alias | Modify array + possibly update rewriter | Add entry to ALIASES |
| cd detection | Check zoxide type OR cd prefix | Check cd prefix (z/zi already expanded) |

## Decisions (Resolved Open Questions)

1. **Quoted argument handling**: Callable aliases receive both `args: string[]` (split)
   and `argsStr: string` (raw).
   String aliases use `argsStr` for pass-through, preserving quoting.
   Callable aliases can choose which to use.
   This is sufficient for our use cases.

2. **Alias chaining**: Not supported.
   No recursive expansion.
   An alias expands once.
   This avoids the complexity of cycle detection (which xonsh handles via `seen_tokens`
   set). If needed in future, xonsh’s `eval_alias` shows how to do it.

3. **Platform differences**: Not addressed in this spec.
   All current aliases use the same flags on all platforms.
   If platform-specific behavior is needed, the callable alias pattern already supports
   it (the function can check `process.platform`). Cross that bridge when we get there.

## Known Limitations

- **Shell injection in zoxide args**: The z/zi callable aliases interpolate query args
  into shell command strings.
  The `--` separator prevents flag injection, and the double quotes around `$(...)`
  prevent word splitting, but shell metacharacters in directory queries could
  theoretically cause issues.
  This is the same behavior as the current `zoxide.ts` implementation and is acceptable
  for a local shell tool.

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

## References

### Xonsh Alias System

- [xonsh aliases.py source](https://github.com/xonsh/xonsh/blob/main/xonsh/aliases.py) -
  `Aliases` class, `FuncAlias`, `ExecAlias`, `eval_alias()`
- [xonsh cli_utils.py](https://github.com/xonsh/xonsh/blob/main/xonsh/cli_utils.py) -
  `ArgParserAlias` for structured CLI-style aliases
- Local checkout: `attic/xonsh/xonsh/aliases.py`

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
