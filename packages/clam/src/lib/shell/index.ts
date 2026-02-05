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
