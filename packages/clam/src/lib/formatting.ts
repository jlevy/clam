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
};

/**
 * Prompt characters - easy to customize.
 */
export const promptChars = {
  /** User input prompt character */
  input: '\u25b6', // ▶
  /** Tool/action arrow */
  tool: '>',
  /** Continuation prompt */
  continuation: '\u2026', // …
};

/**
 * Raw ANSI color codes for dynamic input coloring.
 * Used when we need to change text color mid-input (not wrapping strings).
 */
export const inputColors = {
  /** Natural language input - magenta */
  naturalLanguage: '\x1b[35m',
  /** Slash command input - bold blue */
  slashCommand: '\x1b[1;34m',
  /** Shell command input - white (future) */
  shell: '\x1b[37m',
  /** Reset to default */
  reset: '\x1b[0m',
};

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
