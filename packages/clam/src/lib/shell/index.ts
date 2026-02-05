/**
 * Shell utilities - color environment, command flags, and subprocess execution.
 */

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
