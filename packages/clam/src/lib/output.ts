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
  formatTokenUsage,
  formatToolStatus,
  symbols,
  truncateLines,
} from './formatting.js';
import { createBlockRenderer, type StreamRenderer } from './markdown/index.js';
import type { ExecResult } from './shell.js';
import { createSpinner, type Spinner, SpinnerMode } from './spinner.js';

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

  // Shell output
  shellOutput(result: ExecResult, command?: string): void;

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
  const truncateAfter = config.truncateAfter ?? 5;
  const verbose = config.verbose ?? false;
  const markdownRendering = config.markdownRendering ?? true;

  // Track state for thinking indicator
  let thinkingChars = 0;
  // Track state for auto-separators between tools
  let _lastToolHeader = false;
  // Track state for spinner (aquatic-themed)
  let currentSpinner: Spinner | null = null;
  // Track whether last output ended with a newline (for clean formatting)
  let lastEndedWithNewline = true;
  // Markdown renderer for streaming output
  let mdRenderer: StreamRenderer | null = null;

  const write = (text: string): void => {
    stream.write(text);
    lastEndedWithNewline = text.endsWith('\n');
  };

  const writeLine = (text: string): void => {
    stream.write(`${text}\n`);
    lastEndedWithNewline = true;
  };

  // Ensure we're on a fresh line before important output
  const ensureNewline = (): void => {
    if (!lastEndedWithNewline) {
      stream.write('\n');
      lastEndedWithNewline = true;
    }
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
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }

      // Ensure we're on a fresh line before tool header
      ensureNewline();

      // Add separator between consecutive tool headers
      if (_lastToolHeader) {
        writeLine(symbols.separator);
      }
      _lastToolHeader = true;

      const statusIcon = formatToolStatus(status);
      const kindBadge = colors.muted(`[${kind}]`);
      writeLine(`${symbols.arrow} ${colors.tool(title)} ${kindBadge} ${statusIcon}`);
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

    shellOutput(result: ExecResult, command?: string): void {
      // Shell command output - distinct from ACP tool output
      // Show command if provided (for context)
      if (command) {
        writeLine(colors.muted(`$ ${command}`));
      }

      // Show stdout
      if (result.stdout) {
        write(result.stdout);
        // Ensure we end with a newline
        if (!result.stdout.endsWith('\n')) {
          writeLine('');
        }
      }

      // Show stderr in warning color
      if (result.stderr) {
        write(colors.warn(result.stderr));
        if (!result.stderr.endsWith('\n')) {
          writeLine('');
        }
      }

      // Show non-zero exit code
      if (result.exitCode !== 0) {
        writeLine(colors.error(`exit ${result.exitCode}`));
      }

      // Show signal if killed
      if (result.signal) {
        writeLine(colors.warn(`killed by ${result.signal}`));
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
      // Left-border-only layout with YAML-like key: value formatting

      // Ensure we're on a fresh line before permission prompt
      ensureNewline();

      const border = colors.permissionBox('\u2502  ');

      writeLine('');
      writeLine(colors.permissionHeading(' Permission Required'));
      writeLine(border);
      writeLine(border + colors.muted('tool: ') + colors.permissionTool(tool));
      if (command) {
        writeLine(border + colors.muted('command: ') + colors.permissionCommand(command));
      }
      writeLine(border);

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
            border +
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
            border +
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
          writeLine(`${border}${colors.permissionKey(`[${key}]`)} ${colorFn(option.name)}`);
        }
      }

      writeLine(border);
      // Build prompt from actual available keys
      const keyList = optionKeys.map((o) => o.key).join('/');
      write(colors.bold(`Choice (${keyList}): `));
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
      // Initialize markdown renderer if enabled
      if (markdownRendering) {
        mdRenderer = createBlockRenderer();
      }
    },

    streamChunk(text: string): void {
      // Stop spinner on first content
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }

      // Process through markdown renderer if enabled
      if (mdRenderer) {
        const formatted = mdRenderer.processChunk(text);
        if (formatted) {
          write(formatted);
        }
      } else {
        // Fallback: plain text with agent color
        write(colors.agentText(text));
      }
    },

    streamEnd(): void {
      // Flush remaining markdown buffer
      if (mdRenderer) {
        const remaining = mdRenderer.flush();
        if (remaining) {
          write(remaining);
        }
        mdRenderer = null;
      }

      // Ensure we end with a newline
      if (!lastEndedWithNewline) {
        writeLine('');
      }

      // Final thinking summary if there was thinking
      if (thinkingChars > 0) {
        writeLine(colors.muted(`[total thinking: ${thinkingChars.toLocaleString()} chars]`));
        thinkingChars = 0;
      }
    },

    spinnerStart(message?: string): void {
      // Stop any existing spinner
      if (currentSpinner) {
        currentSpinner.stop();
      }

      // Determine spinner mode:
      // - No message or 'Thinking': Fun verbs (Claude Code is processing)
      // - Custom message: Custom message mode (specific operation like connecting)
      const mode =
        message && message !== 'Thinking' ? SpinnerMode.CustomMessage : SpinnerMode.FunVerbs;

      currentSpinner = createSpinner({
        mode,
        message,
        write: (text) => stream.write(text),
      });
      currentSpinner.start();
    },

    spinnerStop(): void {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
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
