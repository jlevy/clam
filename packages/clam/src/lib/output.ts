/**
 * OutputWriter - Semantic output interface for clam.
 *
 * ALL output goes through this interface. NO console.log() elsewhere.
 * This enables:
 * - Centralized formatting control
 * - Easy enable/disable of output types
 * - Future Clam code integration without code changes
 *
 * Each method is a "TODO: Clam code upgrade point" where behavior will
 * change when Clam codes are enabled (e.g., truncated blocks become
 * expandable overlays).
 */

import type { ClamCodeConfig } from './config.js';
import {
  colors,
  formatTimestamp,
  formatTokenUsage,
  formatToolStatus,
  symbols,
  truncateLines,
} from './formatting.js';

/**
 * Tool execution status.
 */
export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Permission option from ACP.
 */
export interface PermissionOption {
  id: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

/**
 * Options for creating an OutputWriter.
 */
export interface OutputWriterOptions {
  /** Stream to write to (default: process.stdout) */
  stream?: NodeJS.WritableStream;

  /** Configuration options */
  config?: ClamCodeConfig;
}

/**
 * Semantic output interface.
 *
 * All methods write to stdout with NO cursor positioning.
 * Content flows into terminal's native scrollback buffer.
 */
export interface OutputWriter {
  // Basic output types
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  success(message: string): void;
  debug(message: string): void;

  // Structured content
  codeBlock(code: string, language?: string): void;
  diffBlock(path: string, additions: number, deletions: number, content: string): void;
  toolHeader(title: string, kind: string, status: ToolStatus): void;
  toolOutput(content: string, options?: { truncateAfter?: number }): void;

  // Interactive elements
  permissionPrompt(tool: string, command: string, options: PermissionOption[]): void;
  thinking(charCount: number): void;

  // Session stats
  tokenUsage(input: number, output: number): void;

  // Streaming
  streamStart(): void;
  streamChunk(text: string): void;
  streamEnd(): void;

  // Spinner (for waiting states)
  spinnerStart(message?: string): void;
  spinnerStop(): void;

  // Separators and formatting
  separator(): void;
  newline(): void;

  // Raw write (escape hatch, use sparingly)
  write(text: string): void;
  writeLine(text: string): void;
}

/**
 * Create an OutputWriter instance.
 */
export function createOutputWriter(options: OutputWriterOptions = {}): OutputWriter {
  const stream = options.stream ?? process.stdout;
  const config = options.config ?? {};
  const truncateAfter = config.truncateAfter ?? 10;
  const verbose = config.verbose ?? false;
  const showTimestamps = config.showTimestamps ?? false;

  // Track state for thinking indicator
  let thinkingChars = 0;
  // Track state for auto-separators between tools
  let _lastToolHeader = false;
  // Track state for spinner
  let spinnerInterval: ReturnType<typeof setInterval> | null = null;
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIndex = 0;

  const write = (text: string): void => {
    stream.write(text);
  };

  const writeLine = (text: string): void => {
    stream.write(`${text}\n`);
  };

  return {
    // Basic output types
    info(message: string): void {
      // TODO: Clam code upgrade point - could become info overlay
      writeLine(`${symbols.info} ${message}`);
    },

    warning(message: string): void {
      // TODO: Clam code upgrade point - could become warning overlay
      writeLine(`${symbols.warning} ${colors.warn(message)}`);
    },

    error(message: string): void {
      // TODO: Clam code upgrade point - could become error overlay
      writeLine(`${symbols.error} ${colors.error(message)}`);
    },

    success(message: string): void {
      // TODO: Clam code upgrade point - could become success overlay
      writeLine(`${symbols.success} ${colors.success(message)}`);
    },

    debug(message: string): void {
      // Only show if verbose mode enabled
      if (verbose) {
        writeLine(`${colors.dim(`[debug] ${message}`)}`);
      }
    },

    // Structured content
    codeBlock(code: string, language?: string): void {
      // TODO: Clam code upgrade point - becomes syntax-highlighted overlay with copy
      const langHint = language ? colors.muted(`[${language}]`) : '';
      writeLine(`${colors.muted('```')}${langHint}`);
      writeLine(code);
      writeLine(colors.muted('```'));
    },

    diffBlock(path: string, additions: number, deletions: number, content: string): void {
      // TODO: Clam code upgrade point - becomes diff viewer popover
      const addText = additions > 0 ? colors.success(`+${additions}`) : '';
      const delText = deletions > 0 ? colors.error(`-${deletions}`) : '';
      const stats = [addText, delText].filter(Boolean).join(' ');

      writeLine(`${colors.path(path)} ${stats}`);

      // Color diff lines
      for (const line of content.split('\n')) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          writeLine(colors.success(line));
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          writeLine(colors.error(line));
        } else if (line.startsWith('@@')) {
          writeLine(colors.info(line));
        } else {
          writeLine(line);
        }
      }
    },

    toolHeader(title: string, kind: string, status: ToolStatus): void {
      // TODO: Clam code upgrade point - becomes collapsible tool section
      // Stop spinner on first tool call
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        stream.write('\r                              \r');
      }

      // Add separator between consecutive tool headers
      if (_lastToolHeader) {
        writeLine(symbols.separator);
      }
      _lastToolHeader = true;

      const statusIcon = formatToolStatus(status);
      const kindBadge = colors.muted(`[${kind}]`);
      const timestamp = showTimestamps ? `${formatTimestamp()} ` : '';
      writeLine(`${timestamp}${symbols.arrow} ${colors.tool(title)} ${kindBadge} ${statusIcon}`);
    },

    toolOutput(content: string, opts?: { truncateAfter?: number }): void {
      // TODO: Clam code upgrade point - becomes expandable overlay block
      const maxLines = opts?.truncateAfter ?? truncateAfter;
      const { text, truncated, hiddenLines } = truncateLines(content, maxLines);

      // Tool output - uses semantic color (distinct from agent prose)
      writeLine(colors.toolOutput(text));

      if (truncated) {
        writeLine(colors.muted(`... (${hiddenLines} more lines)`));
      }
    },

    // Interactive elements
    permissionPrompt(tool: string, command: string, options: PermissionOption[]): void {
      // TODO: Clam code upgrade point - becomes clickable button overlay
      //
      // Letter shortcuts for permission options:
      //   a = allow once     A = allow always
      //   d = deny once      D = deny always
      //
      // Box drawing with semantic colors for clear visual separation

      const box = colors.permissionBox;

      writeLine('');
      writeLine(
        box('\u250c\u2500') +
          colors.permissionHeading(' Permission Required ') +
          box('\u2500'.repeat(40))
      );
      writeLine(box('\u2502'));
      writeLine(box('\u2502  ') + colors.muted('Tool:    ') + colors.permissionTool(tool));
      if (command) {
        writeLine(box('\u2502  ') + colors.muted('Command: ') + colors.permissionCommand(command));
      }
      writeLine(box('\u2502'));

      // Map options to letter shortcuts based on kind
      const optionKeys: { key: string; option: PermissionOption }[] = [];
      for (const opt of options) {
        let key: string;
        switch (opt.kind) {
          case 'allow_once':
            key = 'a';
            break;
          case 'allow_always':
            key = 'A';
            break;
          case 'reject_once':
            key = 'd';
            break;
          case 'reject_always':
            key = 'D';
            break;
          default:
            key = String(optionKeys.length + 1);
        }
        optionKeys.push({ key, option: opt });
      }

      // Display options in a 2x2 grid if we have 4 options
      if (optionKeys.length === 4) {
        // Row 1: allow options
        const allowOnce = optionKeys.find((o) => o.option.kind === 'allow_once');
        const allowAlways = optionKeys.find((o) => o.option.kind === 'allow_always');
        // Row 2: deny options
        const denyOnce = optionKeys.find((o) => o.option.kind === 'reject_once');
        const denyAlways = optionKeys.find((o) => o.option.kind === 'reject_always');

        if (allowOnce && allowAlways) {
          writeLine(
            box('\u2502  ') +
              colors.permissionKey(`[${allowOnce.key}]`) +
              ' ' +
              colors.permissionAllow(allowOnce.option.name.padEnd(16)) +
              colors.permissionKey(`[${allowAlways.key}]`) +
              ' ' +
              colors.permissionAllow(allowAlways.option.name)
          );
        }
        if (denyOnce && denyAlways) {
          writeLine(
            box('\u2502  ') +
              colors.permissionKey(`[${denyOnce.key}]`) +
              ' ' +
              colors.permissionDeny(denyOnce.option.name.padEnd(16)) +
              colors.permissionKey(`[${denyAlways.key}]`) +
              ' ' +
              colors.permissionDeny(denyAlways.option.name)
          );
        }
      } else {
        // Fallback: list all options vertically
        for (const { key, option } of optionKeys) {
          const isAllow = option.kind.startsWith('allow');
          const colorFn = isAllow ? colors.permissionAllow : colors.permissionDeny;
          writeLine(
            `${box('\u2502  ')}${colors.permissionKey(`[${key}]`)} ${colorFn(option.name)}`
          );
        }
      }

      writeLine(box('\u2502'));
      writeLine(
        box(
          '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518'
        )
      );
      write(colors.bold('Choice (a/A/d/D): '));
    },

    thinking(charCount: number): void {
      // TODO: Clam code upgrade point - becomes expandable thinking section
      // Accumulate thinking chars for the session
      thinkingChars += charCount;
      // Only show occasionally (every 500 chars) to avoid spam
      if (thinkingChars % 500 < charCount) {
        writeLine(colors.muted(`[thinking... ${thinkingChars.toLocaleString()} chars]`));
      }
    },

    tokenUsage(input: number, output: number): void {
      // TODO: Clam code upgrade point - becomes stats popover
      writeLine(formatTokenUsage(input, output));
    },

    // Streaming
    streamStart(): void {
      // Reset thinking counter for new streaming session
      thinkingChars = 0;
      // Reset tool separator state
      _lastToolHeader = false;
    },

    streamChunk(text: string): void {
      // Stop spinner on first content
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        stream.write('\r                              \r');
      }
      // Agent text - default color (distinct from tool output)
      write(colors.agentText(text));
    },

    streamEnd(): void {
      writeLine(''); // Ensure newline at end
      // Final thinking summary if there was thinking
      if (thinkingChars > 0) {
        writeLine(colors.muted(`[total thinking: ${thinkingChars.toLocaleString()} chars]`));
        thinkingChars = 0;
      }
    },

    spinnerStart(message = 'Thinking'): void {
      // Stop any existing spinner
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
      }
      spinnerIndex = 0;
      // Use \r to overwrite line in place (works in most terminals)
      spinnerInterval = setInterval(() => {
        const frame = spinnerFrames[spinnerIndex % spinnerFrames.length];
        stream.write(`\r${colors.muted(`${frame} ${message}...`)}  `);
        spinnerIndex++;
      }, 80);
    },

    spinnerStop(): void {
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        // Clear the spinner line
        stream.write('\r                              \r');
      }
    },

    // Separators and formatting
    separator(): void {
      writeLine(symbols.separator);
    },

    newline(): void {
      writeLine('');
    },

    // Raw access
    write,
    writeLine,
  };
}
