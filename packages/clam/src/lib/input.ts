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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as readline from 'node:readline';
import { formatConfig, type ClamCodeConfig } from './config.js';
import { colors, inputColors, promptChars } from './formatting.js';
import type { ModeDetector, InputMode } from './mode-detection.js';
import { isExplicitShell, stripShellTrigger } from './mode-detection.js';
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
   * Returns matching slash commands when input starts with '/'.
   */
  private createCompleter(): Completer {
    return (line: string): CompleterResult => {
      // Only complete slash commands
      if (line.startsWith('/')) {
        const commands = Array.from(this.commands.keys()).map((c) => `/${c}`);
        const hits = commands.filter((c) => c.startsWith(line));
        // Return all matches, or all commands if no partial match
        return [hits.length ? hits : commands, line];
      }
      // No completion for regular text
      return [[], line];
    };
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
    return new Promise((resolve) => {
      if (!this.rl) {
        resolve('');
        return;
      }
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  // Track menu state for ephemeral display
  private menuLinesShown = 0;

  /**
   * Show command menu below current line (ephemeral - will be cleared on next keypress).
   */
  private showCommandMenu(): void {
    // Skip cursor control if not TTY
    if (!isTTY) return;

    const commands = Array.from(this.commands.entries());
    const menuLines = commands.map(
      ([name, cmd]) =>
        `  ${colors.slashCommand(`/${name.padEnd(10)}`)} ${colors.muted(cmd.description)}`
    );

    // Use save/restore cursor to show menu below without disrupting input
    process.stdout.write('\x1b[s'); // Save cursor position
    process.stdout.write('\n'); // Move to next line
    process.stdout.write(`${colors.muted('Commands:')}\n`);
    for (const line of menuLines) {
      process.stdout.write(`${line}\n`);
    }
    process.stdout.write('\x1b[u'); // Restore cursor position

    // Track how many lines we printed for cleanup
    this.menuLinesShown = 1 + menuLines.length + 1;
  }

  /**
   * Clear the ephemeral menu if shown.
   */
  private clearCommandMenu(): void {
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

    // Track detected mode for coloring
    let currentMode: InputMode = 'nl';

    // Listen for keypresses to detect mode and update colors
    const keypressHandler = (_ch: string, key: readline.Key | undefined) => {
      if (!key) return;

      const currentLine = this.rl?.line ?? '';
      const modeDetector = this.options.modeDetector;

      // When "/" is pressed at start of empty line, show menu and switch color
      if (key.sequence === '/' && currentLine === '' && !menuShownForCurrentInput) {
        menuShownForCurrentInput = true;
        currentMode = 'slash';
        // Switch to slash command color
        process.stdout.write(inputColors.slashCommand);
        // Defer to after the "/" is added to the line
        setImmediate(() => {
          this.showCommandMenu();
        });
        return;
      }

      // Any other keypress while menu is shown - clear the menu
      if (menuShownForCurrentInput && key.sequence !== '/') {
        this.clearCommandMenu();
      }

      // Update mode detection and colors on each keypress
      if (modeDetector && key.name !== 'return') {
        // Get the line after this keypress
        const nextLine =
          key.name === 'backspace' ? currentLine.slice(0, -1) : currentLine + (key.sequence ?? '');

        const newMode = modeDetector.detectModeSync(nextLine);
        if (newMode !== currentMode) {
          currentMode = newMode;
          // Apply new color
          switch (newMode) {
            case 'shell':
              process.stdout.write(inputColors.shell);
              break;
            case 'slash':
              process.stdout.write(inputColors.slashCommand);
              break;
            case 'nl':
            default:
              process.stdout.write(inputColors.naturalLanguage);
              break;
          }
        }
      }

      // Reset menu flag and color on Enter or when line is cleared completely
      if (key.name === 'return') {
        this.clearCommandMenu();
        menuShownForCurrentInput = false;
        currentMode = 'nl';
      } else if (key.name === 'backspace' && currentLine.length <= 1) {
        this.clearCommandMenu();
        menuShownForCurrentInput = false;
        currentMode = 'nl';
        // Switch back to natural language color
        process.stdout.write(inputColors.naturalLanguage);
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

    // Handle Ctrl+C - delegate to onCancel handler for all messaging
    this.rl.on('SIGINT', () => {
      // Newline first to move past any ^C the terminal shows
      output.newline();

      if (onCancel) {
        void onCancel();
      } else {
        output.info('Press Ctrl+C again to exit, or type /quit');
      }

      // Newline after message, then redisplay prompt so user can continue
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
        const promptText = isFirstLine
          ? `${colors.inputPrompt(`${promptChars.input} `)}${inputColors.naturalLanguage}`
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
          break;
        }

        // Empty first line - keep waiting
        if (line === '' && lines.length === 0) {
          // Clear the empty prompt line
          if (isTTY) {
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
}

/**
 * Create an input reader instance.
 */
export function createInputReader(options: InputReaderOptions): InputReader {
  return new InputReader(options);
}
