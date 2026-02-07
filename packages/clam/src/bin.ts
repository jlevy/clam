/**
 * clam CLI - True terminal scrollback ACP client for Claude Code.
 *
 * This is the main entry point for the CLI application.
 * All output goes through OutputWriter - NO console.log() in this file.
 */

import { createRequire } from 'node:module';
import { createAcpClient } from './lib/acp.js';
import { ensureConfigDir, getHistoryPath, loadConfig } from './lib/config.js';
import { colors } from './lib/formatting.js';
import { createInputReader } from './lib/input.js';
import { createModeDetector } from './lib/mode-detection.js';
import { createOutputWriter } from './lib/output.js';
import { formatPromptWithContext } from './lib/prompts.js';
import {
  type AbsolutePath,
  detectInstalledTools,
  formatActiveAliases,
  formatToolStatus,
} from './lib/shell/index.js';
import { createShellModule } from './lib/shell.js';
import { installEmergencyCleanup } from './lib/tty/index.js';
import { type SelectOption, selectMenu } from './lib/ui/select-menu.js';

interface CliArgs {
  help: boolean;
  version: boolean;
  verbose: boolean;
  cwd?: string;
}

/**
 * Parse command line arguments.
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    help: false,
    version: false,
    verbose: false,
    cwd: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--verbose') {
      result.verbose = true;
    } else if (arg === '--cwd' && args[i + 1]) {
      result.cwd = args[i + 1];
      i++;
    }
  }

  return result;
}

/**
 * Show help text.
 */
function showHelp(output: ReturnType<typeof createOutputWriter>): void {
  output.writeLine(`${colors.bold('clam')} - True terminal scrollback ACP client for Claude Code`);
  output.newline();
  output.writeLine('USAGE:');
  output.writeLine('  clam [options]');
  output.newline();
  output.writeLine('OPTIONS:');
  output.writeLine('  -h, --help        Show this help message');
  output.writeLine('  -v, --version     Show version');
  output.writeLine('  --verbose         Enable verbose/debug output');
  output.writeLine('  --cwd <path>      Set working directory');
  output.newline();
  output.writeLine('CONFIGURATION:');
  output.writeLine('  Config files are stored in ~/.clam/code/');
  output.writeLine('  - config.json: User configuration');
  output.writeLine('  - permissions.json: Saved permission decisions');
  output.newline();
  output.writeLine('ENVIRONMENT VARIABLES:');
  output.writeLine('  CLAM_CODE_VERBOSE=1          Enable verbose output');
  output.writeLine('  CLAM_CODE_TRUNCATE_AFTER     Max lines before truncating (default: 10)');
  output.writeLine('  CLAM_CODE_AGENT_COMMAND      Agent command to spawn');
  output.newline();
  output.writeLine('COMMANDS (during session):');
  output.writeLine('  /help    Show available commands');
  output.writeLine('  /quit    Exit clam');
  output.writeLine('  /status  Show session status');
  output.writeLine('  /config  Show current configuration');
  output.writeLine('  /clear   Clear the terminal');
  output.newline();
  output.writeLine('MULTI-LINE INPUT:');
  output.writeLine('  Type and press Enter to add lines');
  output.writeLine('  Press Enter on empty line to submit (two Enters)');
}

/**
 * Get version from package.json.
 */
function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.1.0'; // Fallback
  }
}

/**
 * Show version.
 */
function showVersion(output: ReturnType<typeof createOutputWriter>): void {
  const version = getVersion();
  output.writeLine(`clam ${version}`);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  // Install emergency terminal cleanup handlers first
  // This ensures terminal is restored even if clam crashes
  installEmergencyCleanup();

  const args = parseArgs();
  const config = loadConfig(args.cwd);

  // Apply CLI overrides
  if (args.verbose) {
    config.verbose = true;
  }

  const output = createOutputWriter({ config });

  if (args.help) {
    showHelp(output);
    process.exit(0);
  }

  if (args.version) {
    showVersion(output);
    process.exit(0);
  }

  // Ensure config directory exists
  ensureConfigDir();

  // Double Ctrl+C to exit tracking
  let lastCancelTime = 0;
  const DOUBLE_CANCEL_WINDOW_MS = 2000;

  const cwd = args.cwd ?? process.cwd();

  // Create ACP client
  const acpClient = createAcpClient({
    output,
    config,
    cwd,
    onPermission: async (_tool, _command, options) => {
      // Convert PermissionOption[] to SelectOption[] with keyboard shortcuts
      const menuOptions: SelectOption[] = options.map((opt) => {
        let shortcut: string | undefined;
        switch (opt.kind) {
          case 'allow_once':
            shortcut = 'a';
            break;
          case 'allow_always':
            shortcut = 'A';
            break;
          case 'reject_once':
            shortcut = 'd';
            break;
          case 'reject_always':
            shortcut = 'D';
            break;
        }
        const hint = shortcut ? `(${shortcut})` : undefined;
        return { label: opt.name, value: opt.id, hint, shortcut };
      });

      const result = await selectMenu('Select an option:', menuOptions);
      if (result.ok) {
        return result.value;
      }
      // Cancelled - return first reject option or first option as fallback
      const rejectOpt = options.find((o) => o.kind.includes('reject'));
      return rejectOpt?.id ?? options[0]?.id ?? '';
    },
    onComplete: (stopReason) => {
      output.debug(`Completed: ${stopReason}`);
    },
    onError: (error) => {
      output.error(`Agent error: ${error.message}`);
    },
  });

  // Show welcome message
  output.newline();
  output.writeLine(`${colors.bold('clam')} \u25aa An unusually intelligent shell`);
  output.newline();

  // Connect to agent with spinner
  output.spinnerStart('Connecting to Claude Code');
  try {
    await acpClient.connect();
    output.spinnerStop();
    output.writeLine(`${colors.success('\u2713')} ${colors.status('Connected to Claude Code')}`);
  } catch (error) {
    output.spinnerStop();
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to connect: ${message}`);
    if (message.includes('ENOENT')) {
      output.newline();
      output.info('The claude-code-acp adapter could not be found.');
      output.info('Try running: npm install');
    }
    process.exit(1);
  }

  output.writeLine(colors.status('Type /help for commands, /quit to exit'));
  output.writeLine(colors.status('Shell commands run directly, natural language goes to Claude'));

  // Create shell module and mode detector
  const shell = createShellModule({ cwd });
  const modeDetector = createModeDetector({ shell });

  // Detect and display modern tools, then enable command aliasing
  let installedTools = new Map<string, AbsolutePath>();
  try {
    installedTools = await detectInstalledTools();
    shell.setInstalledTools(installedTools);

    const toolStatus = formatToolStatus(installedTools);
    if (toolStatus) {
      output.writeLine(colors.muted(toolStatus));
    }
  } catch {
    // Ignore errors detecting tools
  }

  output.newline();

  // Session cwd is fixed at connection time - this is where Claude's tools execute
  const sessionCwd = cwd;

  // Create input reader
  const inputReader = createInputReader({
    output,
    config,
    shell,
    modeDetector,
    historyPath: getHistoryPath(),
    historySize: 1000,
    isAcpCommand: (name) => acpClient.hasCommand(name),
    onAcpCommand: async (name, args) => {
      await acpClient.sendCommand(name, args);
    },
    getAcpCommands: () => acpClient.getAvailableCommands(),
    onQuit: () => {
      output.info('Goodbye!');
      acpClient.disconnect();
      inputReader.stop();
      process.exit(0);
    },
    onPrompt: async (text) => {
      // Send prompt to ACP with working directory context
      if (acpClient.isConnected()) {
        output.spinnerStart();
        try {
          // Get user's current working directory from shell
          const userCwd = shell.getCwd();
          // Format prompt with cwd context so Claude knows where the user is
          const promptWithContext = formatPromptWithContext(text, { sessionCwd, userCwd });
          await acpClient.prompt(promptWithContext);
        } catch (error) {
          output.spinnerStop();
          const msg = error instanceof Error ? error.message : String(error);
          output.error(`Error: ${msg}`);
        }
      } else {
        output.error('Not connected to agent');
      }
    },
    onCancel: async () => {
      const now = Date.now();

      // Cancel ongoing prompt if prompting
      if (acpClient.isCurrentlyPrompting()) {
        output.info('Cancelling...');
        const cancelled = await acpClient.cancel();
        if (cancelled) {
          output.info('Cancel request sent');
        }
        lastCancelTime = 0; // Reset double-cancel tracking
        return;
      }

      // Not prompting - check for double Ctrl+C to exit
      if (now - lastCancelTime < DOUBLE_CANCEL_WINDOW_MS) {
        // Second Ctrl+C within window - exit
        output.info('Goodbye!');
        acpClient.disconnect();
        inputReader.stop();
        process.exit(0);
      }

      // First Ctrl+C - warn and start timer
      lastCancelTime = now;
      output.info('Press Ctrl+C again to exit, or type /quit');
    },
  });

  // Register /aliases command to show active aliases
  inputReader.registerCommand({
    name: 'aliases',
    description: 'Show active command aliases',
    execute: () => {
      const aliasOutput = formatActiveAliases(installedTools);
      if (aliasOutput) {
        output.newline();
        output.info(colors.bold('Active Aliases:'));
        output.info(aliasOutput);
      } else {
        output.info('No aliases active (no modern tools detected)');
      }
    },
  });

  // Handle process signals for graceful shutdown
  const cleanup = () => {
    acpClient.disconnect();
    inputReader.stop();
  };

  process.on('SIGINT', () => {
    output.newline();
    output.info('Interrupted. Cleaning up...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Start input loop (blocks until quit)
  await inputReader.start();
}

main().catch((err: unknown) => {
  // Error output through stderr directly (before OutputWriter may be initialized)
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${colors.error(`Error: ${message}`)}\n`);
  process.exit(1);
});
