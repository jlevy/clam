/**
 * Shell utilities - color environment, command flags, and subprocess execution.
 */

export {
  addColorFlags,
  COLOR_ALWAYS_COMMANDS,
  GIT_COLOR_SUBCOMMANDS,
  shouldForceColor,
} from './color-commands.js';
export { COLOR_FORCING_ENV, getColorEnv } from './color-env.js';
export {
  COMMAND_ALIASES,
  type CommandAlias,
  formatAlias,
  getActiveAliases,
  getAlias,
  rewriteCommand,
} from './command-aliases.js';
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
export {
  detectZoxideCommand,
  isZoxideAvailable,
  isZoxideInstalled,
  rewriteZoxideCommand,
  zoxideAdd,
  zoxideQuery,
} from './zoxide.js';
