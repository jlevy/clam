/**
 * Shell utilities - color environment, command flags, and subprocess execution.
 */

export {
  execPromise,
  isCommandAvailable,
  getCommandPath,
  asAbsolutePath,
  type AbsolutePath,
} from './utils.js';
export { COLOR_FORCING_ENV, getColorEnv } from './color-env.js';
export {
  COLOR_ALWAYS_COMMANDS,
  GIT_COLOR_SUBCOMMANDS,
  addColorFlags,
  shouldForceColor,
} from './color-commands.js';
export {
  MODERN_TOOLS,
  detectInstalledTools,
  formatToolStatus,
  getToolDetails,
  getModernAlternatives,
  type ToolInfo,
} from './modern-tools.js';
export {
  type AliasContext,
  type AliasDefinition,
  type AliasExpansion,
  type AliasExpansionResult,
} from './alias-types.js';
export { ALIASES, getAliasNames, getAliasDefinition } from './alias-definitions.js';
export {
  expandAlias,
  isAliasActive,
  getActiveAliases,
  formatActiveAliases,
  formatAliasesCompact,
  parseCommand,
} from './alias-expander.js';
export { isZoxideAvailable, zoxideAdd } from './zoxide.js';
export {
  isDirectoryPath,
  formatExitCode,
  formatDuration,
  createCommandTimer,
  type CommandTimer,
} from './conveniences.js';
