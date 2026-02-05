/**
 * Command-specific color flag injection for subprocess execution.
 *
 * Many commands support --color=always to force ANSI color output even when
 * stdout is piped. This module injects those flags automatically for known
 * commands.
 */

/**
 * Commands that support --color=always flag.
 * Maps command name to the flags to prepend.
 */
export const COLOR_ALWAYS_COMMANDS: Record<string, string[]> = {
  ls: ['--color=always'],
  grep: ['--color=always'],
  egrep: ['--color=always'],
  fgrep: ['--color=always'],
  diff: ['--color=always'],
};

/**
 * Git subcommands that support --color=always.
 * Flag is inserted after the subcommand, not before.
 */
export const GIT_COLOR_SUBCOMMANDS = ['diff', 'log', 'show', 'status', 'branch', 'stash', 'grep'];

/**
 * Check if a command should have color flags injected.
 */
export function shouldForceColor(cmd: string): boolean {
  return cmd === 'git' || cmd in COLOR_ALWAYS_COMMANDS;
}

/**
 * Add color flags to command arguments if the command supports them.
 * Returns the modified args array, or the original if no changes needed.
 */
export function addColorFlags(cmd: string, args: string[]): string[] {
  // Handle git subcommands specially
  if (cmd === 'git') {
    const subcommand = args[0];
    if (subcommand === undefined) {
      return args;
    }

    if (!GIT_COLOR_SUBCOMMANDS.includes(subcommand)) {
      return args;
    }

    // Check if --color=always is already present
    if (args.includes('--color=always')) {
      return args;
    }

    // Insert --color=always after the subcommand
    return [subcommand, '--color=always', ...args.slice(1)];
  }

  // Handle other commands
  const extraFlags = COLOR_ALWAYS_COMMANDS[cmd];
  if (!extraFlags) {
    return args;
  }

  // Check if flags already present
  if (args.includes('--color=always')) {
    return args;
  }

  return [...extraFlags, ...args];
}
