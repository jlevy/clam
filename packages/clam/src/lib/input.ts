/**
 * InputReader - Rich input interface for clam.
 *
 * This module handles:
 * - Basic readline-based prompt
 * - Special commands (/quit, /help, etc.)
 * - Ctrl+C interruption
 * - Multi-line input with backslash continuation
 *
 * Uses Node.js readline for basic functionality.
 * Future: autocomplete, history, slash command completion.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as readline from 'node:readline';
import { formatConfig, type ClamCodeConfig } from './config.js';
import {
  colors,
  getColorForMode,
  getPromptForMode,
  inputColors,
  promptChars,
} from './formatting.js';
import type { ModeDetector, InputMode } from './mode-detection.js';
import { isExplicitShell, stripShellTrigger, suggestCommand } from './mode-detection.js';
import type { OutputWriter } from './output.js';
import type { ShellModule } from './shell.js';

/** Check if stdout is a TTY for cursor control sequences */
const isTTY = process.stdout.isTTY ?? false;

/**
 * Slash command definition.
 */
export interface SlashCommand {
  name: string;
  description: string;
  execute: (args: string, ctx: InputContext) => void | Promise<void>;
}

/**
 * Context passed to slash commands.
 */
export interface InputContext {
  output: OutputWriter;
  quit: () => void;
}

/**
 * Input reader options.
 */
export interface InputReaderOptions {
  /** Output writer for displaying prompts and messages */
  output: OutputWriter;

  /** Configuration */
  config?: ClamCodeConfig;

  /** Shell module for executing shell commands */
  shell?: ShellModule;

  /** Mode detector for input classification */
  modeDetector?: ModeDetector;

  /** Callback when user requests to quit */
  onQuit: () => void;

  /** Callback when user sends a prompt (non-command input) */
  onPrompt: (text: string) => Promise<void>;

  /** Callback when user requests to cancel current operation */
  onCancel?: () => void | Promise<void>;

  /** Check if a command name is an ACP command (without leading slash) */
  isAcpCommand?: (name: string) => boolean;

  /** Send an ACP command. Returns when command completes. */
  onAcpCommand?: (name: string, args: string) => Promise<void>;

  /** Get available ACP commands for help display */
  getAcpCommands?: () => { name: string; description?: string }[];

  /** Path to history file for persistence */
  historyPath?: string;

  /** Maximum history entries to keep (default: 1000) */
  historySize?: number;
}

/**
 * Completer function type for readline.
 */
type CompleterResult = [string[], string];
type Completer = (line: string) => CompleterResult;

/**
 * Input reader for terminal input with slash command support.
 */
export class InputReader {
  private rl: readline.Interface | null = null;
  private options: InputReaderOptions;
  private commands = new Map<string, SlashCommand>();
  private running = false;
  private history: string[] = [];
  private lastCtrlCTime = 0; // Track last Ctrl+C for double-tap to quit

  constructor(options: InputReaderOptions) {
    this.options = options;
    this.loadHistory();
    this.registerBuiltinCommands();
  }

  /**
   * Load command history from file.
   */
  private loadHistory(): void {
    const { historyPath } = this.options;
    if (!historyPath) return;

    try {
      if (existsSync(historyPath)) {
        const content = readFileSync(historyPath, 'utf-8');
        this.history = content.split('\n').filter((line) => line.trim().length > 0);
      }
    } catch {
      // Ignore errors loading history
    }
  }

  /**
   * Save command history to file.
   */
  private saveHistory(): void {
    const { historyPath, historySize = 1000 } = this.options;
    if (!historyPath || !this.rl) return;

    try {
      // Get history from readline (it's in reverse order, newest first)
      const rlHistory = (this.rl as readline.Interface & { history?: string[] }).history ?? [];
      // Limit to historySize entries
      const trimmedHistory = rlHistory.slice(0, historySize);
      // Save to file (one entry per line)
      writeFileSync(historyPath, trimmedHistory.join('\n'), 'utf-8');
    } catch {
      // Ignore errors saving history
    }
  }

  /**
   * Create a completer function for Tab completion.
   * Supports:
   * - Slash commands: /quit, /help, etc.
   * - File paths: @./path/to/file or @path/to/file
   */
  private createCompleter(): Completer {
    return (line: string): CompleterResult => {
      // Reset terminal color before returning completions
      // This ensures completion output uses default color, not the current input color
      const resetColor = isTTY ? inputColors.reset : '';

      // Complete slash commands
      if (line.startsWith('/')) {
        const commands = Array.from(this.commands.keys()).map((c) => `/${c}`);
        const hits = commands.filter((c) => c.startsWith(line));
        const matches = hits.length ? hits : commands;
        // Reset color for completion display if multiple matches
        if (matches.length > 1 && resetColor) {
          process.stdout.write(resetColor);
        }
        return [matches, line];
      }

      // Complete file paths starting with @
      // The @ is a trigger character that should be removed after completion
      // Find the last @ symbol in the line (could be mid-sentence)
      const atIndex = line.lastIndexOf('@');
      if (atIndex >= 0) {
        // Get text after @ to the end of line
        const pathPart = line.slice(atIndex + 1);
        // Only complete if it looks like a path (no spaces after @)
        if (!pathPart.includes(' ')) {
          const completions = this.completeFilePath(pathPart);
          if (completions.length > 0) {
            // Return completions WITHOUT the @ prefix - @ is just a trigger character
            // This replaces "@path" with just "path" (the completed filename)
            const prefix = line.slice(0, atIndex);
            const hits = completions.map((c) => `${prefix}${c}`);
            // Reset color for completion display if multiple matches
            if (hits.length > 1 && resetColor) {
              process.stdout.write(resetColor);
            }
            return [hits, line];
          }
        }
      }

      // No completion for regular text
      return [[], line];
    };
  }

  /**
   * Complete a file path, returning matching files/directories.
   */
  private completeFilePath(partial: string): string[] {
    try {
      // Handle empty path - complete from current directory
      if (partial === '') {
        const entries = readdirSync('.');
        return entries.slice(0, 20).map((e) => {
          const stat = statSync(e);
          return stat.isDirectory() ? `${e}/` : e;
        });
      }

      // Resolve the path
      const resolvedPath = resolve(partial);
      const dir = dirname(resolvedPath);
      const base = partial.endsWith('/') ? '' : (resolvedPath.split('/').pop() ?? '');

      // Check if this is a complete directory path (ends with /)
      if (partial.endsWith('/') && existsSync(resolvedPath)) {
        const entries = readdirSync(resolvedPath);
        return entries.slice(0, 20).map((e) => {
          const fullPath = join(resolvedPath, e);
          const stat = statSync(fullPath);
          return stat.isDirectory() ? `${partial}${e}/` : `${partial}${e}`;
        });
      }

      // Complete partial path
      if (existsSync(dir)) {
        const entries = readdirSync(dir);
        const matches = entries.filter((e) => e.startsWith(base));
        const dirPath = partial.slice(0, partial.length - base.length);

        return matches.slice(0, 20).map((e) => {
          const fullPath = join(dir, e);
          try {
            const stat = statSync(fullPath);
            return stat.isDirectory() ? `${dirPath}${e}/` : `${dirPath}${e}`;
          } catch {
            return `${dirPath}${e}`;
          }
        });
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Register a slash command.
   */
  registerCommand(command: SlashCommand): void {
    this.commands.set(command.name, command);
  }

  /**
   * Register built-in slash commands.
   */
  private registerBuiltinCommands(): void {
    const { output, onQuit } = this.options;

    // /help - show available commands
    this.registerCommand({
      name: 'help',
      description: 'Show available commands',
      execute: () => {
        output.newline();
        output.info(colors.bold('Local Commands:'));
        for (const [name, cmd] of this.commands) {
          output.info(`  /${name.padEnd(12)} ${colors.muted(cmd.description)}`);
        }

        // Show ACP commands if available
        const { getAcpCommands } = this.options;
        if (getAcpCommands) {
          const acpCommands = getAcpCommands();
          if (acpCommands.length > 0) {
            output.newline();
            output.info(colors.bold('Claude Code Commands:'));
            for (const cmd of acpCommands) {
              const desc = cmd.description ?? '';
              output.info(`  /${cmd.name.padEnd(12)} ${colors.muted(desc)}`);
            }
          }
        }
      },
    });

    // /quit or /exit - exit clam
    this.registerCommand({
      name: 'quit',
      description: 'Exit clam',
      execute: () => {
        onQuit();
      },
    });

    this.registerCommand({
      name: 'exit',
      description: 'Exit clam (alias for /quit)',
      execute: () => {
        onQuit();
      },
    });

    // /clear - clear terminal (simple version)
    this.registerCommand({
      name: 'clear',
      description: 'Clear the terminal',
      execute: () => {
        // Just print many newlines to "clear" without cursor positioning
        for (let i = 0; i < 50; i++) {
          output.newline();
        }
      },
    });

    // /status - show session status
    this.registerCommand({
      name: 'status',
      description: 'Show session status',
      execute: () => {
        output.info('Session status: connected');
        // TODO: Show more status info (tokens used, permissions granted, etc.)
      },
    });

    // /config - show current configuration
    this.registerCommand({
      name: 'config',
      description: 'Show current configuration',
      execute: () => {
        const config = this.options.config ?? {};
        output.newline();
        output.info(colors.bold('Current Configuration:'));
        for (const line of formatConfig(config)) {
          output.info(`  ${line}`);
        }
        output.newline();
        output.info(colors.muted('Config file: ~/.clam/code/config.json'));
        output.info(colors.muted('Env vars: CLAM_CODE_TRUNCATE_AFTER, CLAM_CODE_VERBOSE, etc.'));
      },
    });
  }

  /**
   * Promisified question wrapper for callback-based readline.
   */
  private question(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.rl) {
        reject(new Error('readline was closed'));
        return;
      }

      const rl = this.rl;

      // Handle Ctrl+D (EOF) - readline closes without calling the callback
      const closeHandler = () => {
        reject(new Error('readline was closed'));
      };
      rl.once('close', closeHandler);

      rl.question(prompt, (answer) => {
        rl.removeListener('close', closeHandler);
        resolve(answer);
      });
    });
  }

  // Track menu state for ephemeral display
  private menuLinesShown = 0;
  private menuItems: string[] = []; // Command names in the menu
  private menuSelectedIndex = -1; // -1 means no selection (user is typing)

  // Track current input mode for proper submit behavior and coloring
  private currentInputMode: InputMode = 'nl';

  /**
   * Show command menu below current line (ephemeral - will be cleared on next keypress).
   * @param selectedIndex - Index of highlighted item (-1 for none)
   */
  private showCommandMenu(selectedIndex = -1): void {
    // Skip cursor control if not TTY
    if (!isTTY) return;

    const commands = Array.from(this.commands.entries());
    this.menuItems = commands.map(([name]) => name);
    this.menuSelectedIndex = selectedIndex;

    const menuLines = commands.map(([name, cmd], index) => {
      const isSelected = index === selectedIndex;
      if (isSelected) {
        // Highlight selected item with inverse colors
        return `  ${colors.bold(`→ /${name.padEnd(10)}`)} ${cmd.description}`;
      }
      return `  ${colors.slashCommand(`  /${name.padEnd(10)}`)} ${colors.muted(cmd.description)}`;
    });

    // Use save/restore cursor to show menu below without disrupting input
    process.stdout.write('\x1b[s'); // Save cursor position
    process.stdout.write('\n'); // Move to next line
    process.stdout.write(
      `${colors.muted('Commands:')} ${colors.muted('↑↓ navigate, Tab complete, Enter select')}\n`
    );
    for (const line of menuLines) {
      process.stdout.write(`${line}\n`);
    }
    process.stdout.write('\x1b[u'); // Restore cursor position

    // Track how many lines we printed for cleanup
    this.menuLinesShown = 1 + menuLines.length + 1;
  }

  /**
   * Clear the ephemeral menu if shown.
   * @param resetSelection - Whether to also reset the selection state (default: false)
   */
  private clearCommandMenu(resetSelection = false): void {
    // Skip cursor control if not TTY
    if (!isTTY) return;

    if (this.menuLinesShown > 0) {
      // Save cursor, move down, clear all menu lines, restore cursor
      process.stdout.write('\x1b[s'); // Save cursor
      // Clear from cursor to end of screen (clears everything below)
      process.stdout.write('\x1b[J');
      process.stdout.write('\x1b[u'); // Restore cursor
      this.menuLinesShown = 0;
    }

    if (resetSelection) {
      this.menuSelectedIndex = -1;
      this.menuItems = [];
    }
  }

  /**
   * Recolor the current input line based on detected mode.
   * Uses ANSI escape codes to clear and rewrite the line with color.
   * Also updates the prompt character based on mode:
   * - NL mode: ▶ (pink)
   * - Shell mode: $ (bold white)
   * - Slash mode: ▶ (blue)
   *
   * @param line - Current line content
   * @param mode - Detected input mode
   */
  private recolorLine(line: string, mode: InputMode): void {
    // TTY detection guard - skip if not a TTY
    if (!isTTY) return;

    // Skip recoloring when menu is visible to avoid flicker
    if (this.menuLinesShown > 0) return;

    const textColor = getColorForMode(mode);
    const promptInfo = getPromptForMode(mode);
    const cursorPos = (this.rl as readline.Interface & { cursor?: number })?.cursor ?? line.length;

    // Clear current line and rewrite with color
    // \r = return to start, \x1b[K = clear to end of line
    process.stdout.write('\r\x1b[K');

    // Write prompt with mode-specific character and color + colored input
    const prompt = promptInfo.colorFn(`${promptInfo.char} `);
    process.stdout.write(prompt);
    process.stdout.write(textColor(line));

    // Move cursor back to correct position (if not at end)
    const charsFromEnd = line.length - cursorPos;
    if (charsFromEnd > 0) {
      process.stdout.write(`\x1b[${charsFromEnd}D`); // Move left N chars
    }

    // Set the terminal color for subsequent input (picocolors resets after each string)
    // This prevents flicker on the next keystroke
    process.stdout.write(promptInfo.rawColor);
  }

  /**
   * Start the input loop.
   */
  async start(): Promise<void> {
    const { output, onPrompt, onCancel } = this.options;

    this.running = true;

    // Enable keypress events for slash detection
    readline.emitKeypressEvents(process.stdin);

    // Track if we've shown the menu for this input session
    let menuShownForCurrentInput = false;

    // Reset input mode at start
    this.currentInputMode = 'nl';

    /**
     * Unified keypress handler for mode detection and visual updates.
     *
     * Design principles:
     * 1. Mode detection is the SINGLE source of truth for input classification
     * 2. Visual state (prompt char, colors) always derives from mode
     * 3. After every keypress, we: detect mode → update state → recolor
     * 4. Menu display is separate from mode detection (it's a UI overlay)
     *
     * State transitions:
     * - Empty line → 'nl' mode (pink ▶)
     * - "/" at start → 'slash' mode (blue ▶)
     * - Command-like input → 'shell' mode (white $)
     * - Question/NL input → 'nl' mode (pink ▶)
     */
    const keypressHandler = (_ch: string, key: readline.Key | undefined) => {
      if (!key) return;

      const currentLine = this.rl?.line ?? '';
      const modeDetector = this.options.modeDetector;

      // === MENU NAVIGATION (doesn't affect mode) ===
      if (menuShownForCurrentInput && this.menuItems.length > 0) {
        if (key.name === 'down') {
          const newIndex =
            this.menuSelectedIndex < this.menuItems.length - 1 ? this.menuSelectedIndex + 1 : 0;
          this.clearCommandMenu();
          this.showCommandMenu(newIndex);
          return;
        }
        if (key.name === 'up') {
          const newIndex =
            this.menuSelectedIndex > 0 ? this.menuSelectedIndex - 1 : this.menuItems.length - 1;
          this.clearCommandMenu();
          this.showCommandMenu(newIndex);
          return;
        }
        if (key.name === 'return' && this.menuSelectedIndex >= 0) {
          // Select the highlighted menu item
          const selectedCommand = this.menuItems[this.menuSelectedIndex];
          if (selectedCommand && this.rl) {
            this.clearCommandMenu();
            const newLine = `/${selectedCommand}`;
            // Update readline's internal line buffer
            (this.rl as readline.Interface & { line: string; cursor: number }).line = newLine;
            (this.rl as readline.Interface & { line: string; cursor: number }).cursor =
              newLine.length;
            // Recolor with slash mode (mode detection would also give 'slash', but we know)
            this.currentInputMode = 'slash';
            this.recolorLine(newLine, 'slash');
          }
          menuShownForCurrentInput = false;
          this.menuSelectedIndex = -1;
          this.menuItems = [];
          return;
        }
      }

      // === SPECIAL: Show slash command menu on "/" at start ===
      if (key.sequence === '/' && currentLine === '' && !menuShownForCurrentInput) {
        menuShownForCurrentInput = true;
        // Don't return - let mode detection handle the coloring
      }

      // Clear menu on any non-navigation keypress
      if (menuShownForCurrentInput && !['up', 'down'].includes(key.name ?? '')) {
        if (key.name !== 'return' || this.menuSelectedIndex < 0) {
          this.clearCommandMenu(true);
        }
      }

      // === MAIN MODE DETECTION AND RECOLORING ===
      // This is the single source of truth for mode and visual state
      if (key.name === 'return') {
        // Line is being submitted - don't recolor, just clean up
        menuShownForCurrentInput = false;
        return;
      }

      if (modeDetector) {
        // Defer until readline has processed the keystroke
        setImmediate(() => {
          const actualLine = this.rl?.line ?? '';
          const newMode = modeDetector.detectModeSync(actualLine);

          // Always update mode and recolor to ensure consistency
          // This handles: mode changes, backspace, and edge cases
          const modeChanged = newMode !== this.currentInputMode;
          this.currentInputMode = newMode;

          // Always recolor to maintain visual consistency
          // (readline operations like backspace can reset terminal state)
          this.recolorLine(actualLine, newMode);

          // Show menu after recoloring if "/" was just typed
          if (
            modeChanged &&
            newMode === 'slash' &&
            actualLine === '/' &&
            menuShownForCurrentInput
          ) {
            this.showCommandMenu();
          }

          // Reset menu flag when line is empty
          if (actualLine === '') {
            menuShownForCurrentInput = false;
          }
        });
      }
    };

    process.stdin.on('keypress', keypressHandler);

    // Create readline interface with Tab completion and history
    const { historySize = 1000 } = this.options;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY ?? false,
      completer: this.createCompleter(),
      history: this.history,
      historySize,
    });

    // Handle Ctrl+C - double-tap to quit, single tap to cancel current input
    this.rl.on('SIGINT', () => {
      const isTTY = process.stdout.isTTY ?? false;
      const now = Date.now();
      const timeSinceLastCtrlC = now - this.lastCtrlCTime;

      if (isTTY) {
        // Clear the current prompt line (which may show ^C)
        // Move to start of line and clear it
        process.stdout.write('\r\x1b[2K');
      } else {
        // Non-TTY: just add a newline
        output.newline();
      }

      // If double Ctrl+C within 2 seconds, quit
      if (timeSinceLastCtrlC < 2000) {
        this.lastCtrlCTime = 0; // Reset
        this.options.onQuit();
        return;
      }

      this.lastCtrlCTime = now;

      // First Ctrl+C - cancel current input, show message
      if (onCancel) {
        void onCancel();
      }
      output.info('Cancelled. Hit Ctrl+C again to quit.');

      // Reset input mode and show fresh prompt
      this.currentInputMode = 'nl';
      menuShownForCurrentInput = false;
      this.clearCommandMenu(true);
      output.newline();
      process.stdout.write(
        `${colors.inputPrompt(`${promptChars.input} `)}${inputColors.naturalLanguage}`
      );
    });

    // Clean up keypress handler when readline closes
    this.rl.on('close', () => {
      process.stdin.removeListener('keypress', keypressHandler);
    });

    // Main input loop
    while (this.running) {
      try {
        const input = await this.prompt();

        if (input === null) {
          // EOF (Ctrl+D) - trigger quit
          this.options.onQuit();
          return;
        }

        const trimmed = input.trim();

        if (!trimmed) {
          continue;
        }

        // Check for slash commands
        if (trimmed.startsWith('/')) {
          await this.handleSlashCommand(trimmed);
          continue;
        }

        // Check for shell commands using mode detection
        const { shell, modeDetector } = this.options;
        if (shell && modeDetector) {
          // Get sync mode first to see if it looked like a command
          const syncMode = modeDetector.detectModeSync(trimmed);
          const mode = await modeDetector.detectMode(trimmed);

          if (mode === 'shell') {
            // Route shell command directly
            const command = isExplicitShell(trimmed) ? stripShellTrigger(trimmed) : trimmed;
            try {
              const result = await shell.exec(command, { captureOutput: true });
              output.shellOutput(result);
            } catch (error) {
              if (error instanceof Error) {
                output.error(`Shell error: ${error.message}`);
              }
            }
            continue;
          }

          // Ambiguous mode: prompt user to confirm
          if (mode === 'ambiguous') {
            const confirmed = await this.confirmShellCommand(trimmed);
            if (confirmed) {
              // User confirmed - execute as shell command
              try {
                const result = await shell.exec(trimmed, { captureOutput: true });
                output.shellOutput(result);
              } catch (error) {
                if (error instanceof Error) {
                  output.error(`Shell error: ${error.message}`);
                }
              }
            } else {
              // User declined - send to Claude instead
              output.info(colors.muted('Sending to Claude...'));
              try {
                await onPrompt(trimmed);
              } catch (error) {
                if (error instanceof Error) {
                  output.error(`Error: ${error.message}`);
                }
              }
            }
            continue;
          }

          // Nothing mode: invalid input, show error and suggestions
          if (mode === 'nothing') {
            const firstWord = trimmed.split(/\s+/)[0] ?? '';
            const restOfCommand = trimmed.slice(firstWord.length).trim();
            const suggestion = suggestCommand(firstWord);

            if (suggestion) {
              // Suggest corrected command
              const suggestedFull = restOfCommand ? `${suggestion} ${restOfCommand}` : suggestion;
              output.warning(`"${firstWord}" is not a recognized command`);
              output.info(
                `${colors.muted('Did you mean:')} ${colors.bold(suggestedFull)}${colors.muted('?')}`
              );
              output.info(
                colors.muted('Tip: Use !command to force shell mode, or ?text to send to Claude')
              );
            } else {
              // No suggestion found
              output.warning(`"${firstWord}" is not a recognized command`);
              output.info(
                colors.muted('Tip: Use ?text to send to Claude, or !command to force shell mode')
              );
            }
            continue;
          }

          // Partial command rejection: if sync thought it was shell but async said NL,
          // and it's a single word, it might be a typo/partial command
          if (syncMode === 'shell' && mode === 'nl') {
            const words = trimmed.split(/\s+/);
            if (words.length === 1 && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
              // Single word that looked like a command but isn't
              output.info(`"${trimmed}" is not a recognized command. Sending to Claude...`);
              output.info(colors.muted('Tip: Use !command to force shell mode'));
            }
          }
        }

        // Send to prompt handler (natural language)
        try {
          await onPrompt(trimmed);
        } catch (error) {
          if (error instanceof Error) {
            output.error(`Error: ${error.message}`);
          }
        }
      } catch (error) {
        // Handle readline errors
        if (error instanceof Error && error.message.includes('readline was closed')) {
          break;
        }
        throw error;
      }
    }
  }

  /**
   * Stop the input loop.
   */
  stop(): void {
    this.running = false;
    if (this.rl) {
      this.saveHistory();
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Prompt for input with multi-line support.
   *
   * "Two enters" mode for regular prompts:
   * - Type content, press Enter to add lines
   * - Blank line (Enter on empty) submits
   * - Backslash at end of line strips it (legacy continuation support)
   *
   * Slash commands submit on single Enter.
   */
  private async prompt(): Promise<string | null> {
    if (!this.rl) {
      return null;
    }

    try {
      const lines: string[] = [];
      let isFirstLine = true;

      while (true) {
        // Include input color at end of prompt so typed text has correct color
        // Add newline before first prompt for cleaner visual separation
        const promptText = isFirstLine
          ? `\n${colors.inputPrompt(`${promptChars.input} `)}${inputColors.naturalLanguage}`
          : `${colors.muted(`${promptChars.continuation} `)}${inputColors.naturalLanguage}`;
        const line = await this.question(promptText);
        // Reset color after input
        process.stdout.write(inputColors.reset);

        // Slash commands submit immediately on first Enter
        if (isFirstLine && line.startsWith('/')) {
          // Reprint with slash command colors (purple/violet)
          if (isTTY) {
            process.stdout.write('\x1b[1A\x1b[2K'); // Move up, clear line
            process.stdout.write(
              `${colors.inputPromptDim(`${promptChars.input} `)}${colors.slashCommand(line)}\n`
            );
          }
          this.currentInputMode = 'nl'; // Reset for next input
          return line;
        }

        // Shell commands submit immediately on first Enter (if mode is still 'shell')
        if (isFirstLine && this.currentInputMode === 'shell') {
          // Reprint with shell colors (white/default)
          if (isTTY) {
            process.stdout.write('\x1b[1A\x1b[2K'); // Move up, clear line
            process.stdout.write(
              `${colors.inputPromptDim(`${promptChars.input} `)}${colors.shellCommand(line)}\n`
            );
          }
          this.currentInputMode = 'nl'; // Reset for next input
          return line;
        }

        // Blank line submits if we have content
        if (line === '' && lines.length > 0) {
          if (isTTY) {
            // Clear the continuation prompt line for cleaner output
            // Move cursor up one line, clear it
            process.stdout.write('\x1b[1A\x1b[2K');

            // Reprint all lines with proper colors:
            // - First line: dim prompt (was bright), pink text
            // - Other lines: muted prompt, pink text
            // Move up to first line
            const linesToFirst = lines.length;
            process.stdout.write(`\x1b[${linesToFirst}A`);

            // Reprint each line: dim prompt char, bright magenta text
            for (let i = 0; i < lines.length; i++) {
              process.stdout.write('\x1b[2K'); // Clear line
              const prompt =
                i === 0
                  ? colors.inputPromptDim(`${promptChars.input} `)
                  : colors.inputPromptDim(`${promptChars.continuation} `);
              process.stdout.write(`${prompt}${colors.userPrompt(lines[i] ?? '')}\n`);
            }

            // Add newline for spacing after output
            process.stdout.write('\n');
          }
          this.currentInputMode = 'nl'; // Reset for next input
          break;
        }

        // Empty line on first prompt - erase the prompt line and continue
        if (line.trim() === '' && lines.length === 0) {
          if (isTTY) {
            // Move up to the prompt line and clear it (removes the empty prompt)
            // The newline before the prompt means we're now 2 lines down:
            // 1. The newline before prompt
            // 2. The prompt line itself
            // Move up 1 line to the prompt and clear it
            process.stdout.write('\x1b[1A\x1b[2K');
          }
          continue;
        }

        // Strip trailing backslash (legacy support, now optional)
        const cleanLine = line.endsWith('\\') ? line.slice(0, -1) : line;
        lines.push(cleanLine);
        isFirstLine = false;
      }

      return lines.join('\n');
    } catch {
      // Readline closed
      return null;
    }
  }

  /**
   * Handle a slash command.
   */
  private async handleSlashCommand(input: string): Promise<void> {
    const { output, isAcpCommand, onAcpCommand } = this.options;

    // Parse command and args
    const withoutSlash = input.slice(1);
    const spaceIndex = withoutSlash.indexOf(' ');
    const commandName = spaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, spaceIndex);
    const args = spaceIndex === -1 ? '' : withoutSlash.slice(spaceIndex + 1).trim();

    // Check for ACP command first (e.g., /commit, /review, /model)
    if (isAcpCommand && onAcpCommand && isAcpCommand(commandName)) {
      try {
        output.spinnerStart();
        await onAcpCommand(commandName, args);
        output.spinnerStop();
      } catch (error) {
        output.spinnerStop();
        if (error instanceof Error) {
          output.error(`ACP command error: ${error.message}`);
        }
      }
      return;
    }

    // Look up local command
    const command = this.commands.get(commandName);

    if (!command) {
      output.warning(`Unknown command: /${commandName}`);
      output.info('Type /help for available commands');
      return;
    }

    // Execute local command
    const ctx: InputContext = {
      output,
      quit: () => {
        this.options.onQuit();
      },
    };

    try {
      await command.execute(args, ctx);
    } catch (error) {
      if (error instanceof Error) {
        output.error(`Command error: ${error.message}`);
      }
    }
  }

  /**
   * Check if currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Prompt user to confirm executing a command.
   * Used for ambiguous inputs like "who" or "date" that could be shell commands or NL.
   *
   * @param command - The command to confirm
   * @returns true if user wants to run as shell command, false to send to Claude
   */
  private async confirmShellCommand(command: string): Promise<boolean> {
    const { output } = this.options;

    // Show confirmation prompt
    output.info(`"${command}" could be a shell command or a question for Claude.`);

    return new Promise((resolve) => {
      if (!this.rl) {
        resolve(false);
        return;
      }

      // Use simple y/n prompt
      const prompt = `${colors.muted('Run as shell command?')} ${colors.bold('[y/N]')} `;
      this.rl.question(prompt, (answer) => {
        const trimmed = answer.trim().toLowerCase();
        resolve(trimmed === 'y' || trimmed === 'yes');
      });
    });
  }
}

/**
 * Create an input reader instance.
 */
export function createInputReader(options: InputReaderOptions): InputReader {
  return new InputReader(options);
}
