/**
 * Environment variable helpers for forcing ANSI color output in subprocesses.
 *
 * Many commands check isatty(stdout) and disable colors when piped. These
 * environment variables tell supporting commands to force color output.
 *
 * Standards:
 * - FORCE_COLOR: Supported by chalk, supports-color, many npm tools
 * - CLICOLOR_FORCE: BSD/macOS convention (ls, grep, etc.)
 *
 * @see http://bixense.com/clicolors/
 * @see https://force-color.org/
 */

/**
 * Environment variables that force color output in supporting commands.
 * Does not include CLICOLOR (only works with TTY, not useful for piped output).
 */
export const COLOR_FORCING_ENV: Record<string, string> = {
  FORCE_COLOR: '1',
  CLICOLOR_FORCE: '1',
};

/**
 * Get environment variables for subprocess execution with color forcing enabled.
 * Merges color forcing variables with process.env and ensures TERM is set.
 */
export function getColorEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...COLOR_FORCING_ENV,
    TERM: process.env.TERM ?? 'xterm-256color',
  };
}
