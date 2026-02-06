/**
 * Shared color and formatting utilities for clam CLI.
 *
 * All terminal colors go through picocolors which automatically handles:
 * - NO_COLOR environment variable
 * - FORCE_COLOR environment variable
 * - TTY detection (disables colors when piped)
 *
 * COLOR PHILOSOPHY:
 * - Use semantic/logical color names, not literal colors
 * - All color definitions are centralized here
 * - Components import and use these semantic colors
 */

import pc from 'picocolors';

import type { InputMode } from './mode-detection.js';

/**
 * Semantic color functions for consistent terminal output.
 *
 * Organized by purpose:
 * - Conversation: user prompts, agent responses, input waiting
 * - Status: success, error, warning, info
 * - UI Elements: tools, paths, code, permissions
 * - Text styling: bold, dim, muted
 */
export const colors = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** User's prompt text - what the user typed - light pink to distinguish from output */
  userPrompt: (s: string) => pc.magenta(s),

  /** Agent's prose/text output - default readable color */
  agentText: (s: string) => pc.reset(s),

  /** Agent's code blocks (```) - distinct from prose */
  agentCode: (s: string) => pc.cyan(s),

  /** Agent's inline code (`) - subtle distinction */
  agentInlineCode: (s: string) => pc.dim(pc.cyan(s)),

  /** Tool/command output - dim to distinguish from agent prose */
  toolOutput: (s: string) => pc.dim(s),

  /** Input prompt indicator (the "> " waiting for input) - bold pink like cursor */
  inputPrompt: (s: string) => pc.bold(pc.magenta(s)),

  /** Input prompt after submission - dim to not compete with output */
  inputPromptDim: (s: string) => pc.dim(pc.magenta(s)),

  /** Slash command text - purple/blue to distinguish from regular input */
  slashCommand: (s: string) => pc.blue(s),

  /** Shell command text - bold white to distinguish from NL input */
  shellCommand: (s: string) => pc.bold(pc.white(s)),

  /** Shell prompt character ($) - bold white */
  shellPrompt: (s: string) => pc.bold(pc.white(s)),

  /** Slash command prompt character (▶) - blue */
  slashPrompt: (s: string) => pc.blue(s),

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMITTED STATE COLORS (dimmed for scroll history)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Shell prompt after submission - dim to not compete with output */
  shellPromptDim: (s: string) => pc.dim(pc.white(s)),

  /** Slash prompt after submission - dim blue */
  slashPromptDim: (s: string) => pc.dim(pc.blue(s)),

  /** Shell command text after submission - dim */
  shellCommandDim: (s: string) => pc.dim(pc.white(s)),

  /** Slash command text after submission - dim blue */
  slashCommandDim: (s: string) => pc.dim(pc.blue(s)),

  /** Streaming indicator while agent is thinking/responding */
  streaming: (s: string) => pc.cyan(s),

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Success messages */
  success: (s: string) => pc.green(s),

  /** Error messages */
  error: (s: string) => pc.red(s),

  /** Informational/descriptive messages - italic to distinguish from content */
  info: (s: string) => pc.italic(pc.cyan(s)),

  /** Warning messages */
  warn: (s: string) => pc.yellow(s),

  /** Status messages - dim for non-critical info like "Connecting..." */
  status: (s: string) => pc.gray(s),

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION PROMPT COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Permission prompt heading */
  permissionHeading: (s: string) => pc.yellow(pc.bold(s)),

  /** Permission tool/action name */
  permissionTool: (s: string) => pc.cyan(s),

  /** Permission command/details */
  permissionCommand: (s: string) => pc.white(s),

  /** Allow option in permission prompt */
  permissionAllow: (s: string) => pc.green(s),

  /** Deny option in permission prompt */
  permissionDeny: (s: string) => pc.red(s),

  /** Option key/shortcut in permission prompt - bold white to not conflict with red/green options */
  permissionKey: (s: string) => pc.bold(pc.white(s)),

  /** Box drawing characters for prompts */
  permissionBox: (s: string) => pc.gray(s),

  // ═══════════════════════════════════════════════════════════════════════════
  // UI ELEMENT COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Tool/command names */
  tool: (s: string) => pc.cyan(s),

  /** File paths */
  path: (s: string) => pc.blue(s),

  /** Code/command text */
  code: (s: string) => pc.cyan(pc.bold(s)),

  /** Section headers */
  header: (s: string) => pc.bold(pc.white(s)),

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT STYLING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Muted/secondary text */
  muted: (s: string) => pc.gray(s),

  /** Bold text */
  bold: (s: string) => pc.bold(s),

  /** Dim text */
  dim: (s: string) => pc.dim(s),

  // ═══════════════════════════════════════════════════════════════════════════
  // SPINNER COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Spinner wave icon - bold blue for visibility */
  spinnerIcon: (s: string) => pc.bold(pc.blue(s)),

  /** Spinner text (verbs, messages) - dim blue for subtlety */
  spinnerText: (s: string) => pc.dim(pc.blue(s)),
};

/**
 * Prompt characters - easy to customize.
 */
export const promptChars = {
  /** Natural language input prompt character */
  nl: '\u25b6', // ▶
  /** Shell command input prompt character */
  shell: '$',
  /** Slash command input prompt character */
  slash: '\u25b6', // ▶
  /** Default/legacy input prompt (alias for nl) */
  input: '\u25b6', // ▶
  /** Tool/action arrow */
  tool: '>',
  /** Continuation prompt */
  continuation: '\u2026', // …
};

/**
 * Raw ANSI color codes for dynamic input coloring.
 * Used when we need to change text color mid-input (not wrapping strings).
 * Returns empty strings when stdout is not a TTY to avoid garbage output.
 *
 * NOTE: Defined before modeVisualConfig because it's referenced there.
 */
const isTTY = process.stdout.isTTY ?? false;
export const inputColors = {
  /** Natural language input - magenta */
  naturalLanguage: isTTY ? '\x1b[35m' : '',
  /** Slash command input - bold blue */
  slashCommand: isTTY ? '\x1b[1;34m' : '',
  /** Shell command input - bold white */
  shell: isTTY ? '\x1b[1;37m' : '',
  /** Ambiguous input - yellow (caution) */
  ambiguous: isTTY ? '\x1b[33m' : '',
  /** Invalid input - red (error) */
  nothing: isTTY ? '\x1b[31m' : '',
  /** Reset to default */
  reset: isTTY ? '\x1b[0m' : '',
};

/**
 * Mode-specific visual configuration.
 * All prompt character, formatting, and color settings for each mode are here.
 * To change any aspect of a mode's appearance, edit this configuration.
 */
export interface ModeVisualConfig {
  /** Prompt character for this mode */
  char: string;
  /** Color function for active (editing) state */
  activePromptColor: (s: string) => string;
  /** Color function for submitted (history) state */
  submittedPromptColor: (s: string) => string;
  /** Color function for input text */
  textColor: (s: string) => string;
  /** Raw ANSI code for mid-line coloring */
  rawColor: string;
}

/**
 * Visual configuration for all input modes.
 * Single source of truth for mode appearance - easy to customize.
 */
export const modeVisualConfig: Record<InputMode, ModeVisualConfig> = {
  nl: {
    char: promptChars.nl,
    activePromptColor: colors.inputPrompt,
    submittedPromptColor: colors.inputPromptDim,
    textColor: colors.userPrompt,
    rawColor: inputColors.naturalLanguage,
  },
  shell: {
    char: promptChars.shell,
    activePromptColor: colors.shellPrompt,
    submittedPromptColor: colors.shellPromptDim,
    textColor: colors.shellCommand,
    rawColor: inputColors.shell,
  },
  slash: {
    char: promptChars.slash,
    activePromptColor: colors.slashPrompt,
    submittedPromptColor: colors.slashPromptDim,
    textColor: colors.slashCommand,
    rawColor: inputColors.slashCommand,
  },
  ambiguous: {
    char: promptChars.nl,
    activePromptColor: pc.yellow,
    submittedPromptColor: (s: string) => pc.dim(pc.yellow(s)),
    textColor: pc.yellow,
    rawColor: inputColors.ambiguous,
  },
  nothing: {
    char: promptChars.nl,
    activePromptColor: pc.red,
    submittedPromptColor: (s: string) => pc.dim(pc.red(s)),
    textColor: pc.red,
    rawColor: inputColors.nothing,
  },
};

/**
 * Get the prompt character and color for a given input mode.
 * Used for dynamic prompt display based on detected mode.
 *
 * @param mode - The detected input mode
 * @returns Object with char, color function, and raw ANSI color
 */
export function getPromptForMode(mode: InputMode): {
  char: string;
  colorFn: (s: string) => string;
  rawColor: string;
} {
  const config = modeVisualConfig[mode];
  return {
    char: config.char,
    colorFn: config.activePromptColor,
    rawColor: config.rawColor,
  };
}

/**
 * Get the color function for a given input mode.
 * Used for real-time input coloring based on detected mode.
 * Derives from modeVisualConfig for consistency.
 *
 * @param mode - The detected input mode
 * @returns A function that colors the input string
 */
export function getColorForMode(mode: InputMode): (s: string) => string {
  return modeVisualConfig[mode].textColor;
}

/**
 * Status symbols with consistent styling.
 */
export const symbols = {
  success: pc.green('\u2713'), // ✓
  error: pc.red('\u2717'), // ✗
  warning: pc.yellow('\u26a0'), // ⚠
  info: pc.cyan('\u2139'), // ℹ
  arrow: pc.cyan(promptChars.tool), // > for tool headers
  bullet: pc.gray('\u2022'), // •
  separator: '', // Just a blank line (no visual clutter)
};

/**
 * Format a tool status indicator.
 */
export function formatToolStatus(
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
): string {
  switch (status) {
    case 'pending':
      return pc.gray('\u25cb'); // ○
    case 'in_progress':
      return pc.yellow('\u25cf'); // ●
    case 'completed':
      return pc.green('\u2713'); // ✓
    case 'failed':
      return pc.red('\u2717'); // ✗
    default:
      return pc.gray('?');
  }
}

/**
 * Truncate text with ellipsis indicator.
 */
export function truncateLines(
  text: string,
  maxLines: number
): { text: string; truncated: boolean; hiddenLines: number } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false, hiddenLines: 0 };
  }

  const visibleLines = lines.slice(0, maxLines);
  const hiddenLines = lines.length - maxLines;

  return {
    text: visibleLines.join('\n'),
    truncated: true,
    hiddenLines,
  };
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(date: Date = new Date()): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return pc.gray(`[${hours}:${minutes}:${seconds}]`);
}

/**
 * Format token usage for display.
 */
export function formatTokenUsage(input: number, output: number): string {
  const total = input + output;
  return pc.gray(
    `[tokens: ${input.toLocaleString()} in + ${output.toLocaleString()} out = ${total.toLocaleString()} total]`
  );
}

/**
 * Format a duration in milliseconds for display.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}
