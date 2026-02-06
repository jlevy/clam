/**
 * Type definitions for the functional alias system.
 *
 * Inspired by xonsh's callable aliases, this supports both simple string
 * substitution and dynamic callable expansion through a unified type system.
 */

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
export type AliasExpansion = string | ((ctx: AliasContext) => string | Promise<string>);

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
