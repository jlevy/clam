/**
 * Shell utilities - color environment, command flags, and subprocess execution.
 */

export { ALIASES, getAliasDefinition, getAliasNames } from './alias-definitions.js';
export {
  expandAlias,
  formatActiveAliases,
  formatAliasesCompact,
  getActiveAliases,
  isAliasActive,
  parseCommand,
} from './alias-expander.js';
export type {
  AliasContext,
  AliasDefinition,
  AliasExpansion,
  AliasExpansionResult,
} from './alias-types.js';
export {
  addColorFlags,
  COLOR_ALWAYS_COMMANDS,
  GIT_COLOR_SUBCOMMANDS,
  shouldForceColor,
} from './color-commands.js';
export { COLOR_FORCING_ENV, getColorEnv } from './color-env.js';
export {
  type CommandTimer,
  createCommandTimer,
  formatDuration,
  formatExitCode,
  isDirectoryPath,
} from './conveniences.js';
export {
  detectInstalledTools,
  formatToolStatus,
  getModernAlternatives,
  getToolDetails,
  MODERN_TOOLS,
  type ToolInfo,
} from './modern-tools.js';
export {
  type AbsolutePath,
  asAbsolutePath,
  execPromise,
  getCommandPath,
  isCommandAvailable,
} from './utils.js';
export { isZoxideAvailable, zoxideAdd } from './zoxide.js';
