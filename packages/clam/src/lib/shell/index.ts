/**
 * Shell utilities - color environment, command flags, and subprocess execution.
 */

export { execPromise, isCommandAvailable } from './utils.js';
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
  COMMAND_ALIASES,
  rewriteCommand,
  getAlias,
  getActiveAliases,
  formatAlias,
  type CommandAlias,
} from './command-aliases.js';
export {
  isZoxideInstalled,
  isZoxideAvailable,
  zoxideQuery,
  zoxideAdd,
  detectZoxideCommand,
  rewriteZoxideCommand,
} from './zoxide.js';
export {
  isDirectoryPath,
  formatExitCode,
  formatDuration,
  createCommandTimer,
  type CommandTimer,
} from './conveniences.js';
