/**
 * Shell Module - Shell execution and completion for clam.
 *
 * This module handles:
 * - Command detection via `which`
 * - Shell command execution
 * - Bash completion integration
 *
 * Used by mode detection to identify shell commands.
 */

import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { exec as execCallback } from 'node:child_process';

import { getColorEnv } from './shell/color-env.js';
import { rewriteCommand } from './shell/command-aliases.js';
import { detectZoxideCommand, rewriteZoxideCommand, zoxideAdd } from './shell/zoxide.js';
import type { AbsolutePath } from './shell/utils.js';
import { withTtyManagement } from './tty/index.js';

const execPromise = promisify(execCallback);

/**
 * Shell module interface.
 */
export interface ShellModule {
  /** Look up command path via `which` */
  which(command: string): Promise<string | null>;

  /** Check if a word is a valid command */
  isCommand(word: string): Promise<boolean>;

  /** Execute a shell command */
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;

  /** Get completions for partial input */
  getCompletions(partial: string, cursorPos: number): Promise<string[]>;

  /** Clear the which cache */
  clearCache(): void;

  /** Get the current working directory */
  getCwd(): string;

  /** Set the current working directory */
  setCwd(path: string): void;

  /** Set installed tools for command aliasing */
  setInstalledTools(tools: Map<string, AbsolutePath>): void;

  /** Enable or disable command aliasing */
  setAliasingEnabled(enabled: boolean): void;
}

/**
 * Options for shell command execution.
 */
export interface ExecOptions {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Capture output instead of inheriting stdio */
  captureOutput?: boolean;
  /** Force ANSI color output via FORCE_COLOR and CLICOLOR_FORCE env vars */
  forceColor?: boolean;
}

/**
 * Result of shell command execution.
 */
export interface ExecResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Signal if killed */
  signal?: string;
}

/**
 * Options for creating a shell module.
 */
export interface ShellModuleOptions {
  /** Default working directory */
  cwd?: string;
  /** Default timeout for which lookups */
  whichTimeout?: number;
}

/**
 * Shell built-ins that don't show up in `which`.
 */
const SHELL_BUILTINS = new Set([
  'cd',
  'export',
  'alias',
  'unalias',
  'source',
  '.',
  'eval',
  'exec',
  'exit',
  'return',
  'set',
  'unset',
  'readonly',
  'local',
  'declare',
  'typeset',
  'builtin',
  'command',
  'type',
  'hash',
  'pwd',
  'pushd',
  'popd',
]);

/**
 * Escape a string for safe shell usage.
 */
function shellEscape(str: string): string {
  // Use single quotes, escaping any embedded single quotes
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Create a shell module instance.
 */
export function createShellModule(options: ShellModuleOptions = {}): ShellModule {
  const whichTimeout = options.whichTimeout ?? 500;

  // Track current working directory - mutable state that persists across commands
  let currentCwd = options.cwd ?? process.cwd();

  // Command aliasing state
  let installedTools = new Map<string, AbsolutePath>();
  let aliasingEnabled = true;

  // Cache which results to avoid repeated lookups
  const whichCache = new Map<string, string | null>();

  /**
   * Get the current working directory.
   */
  function getCwd(): string {
    return currentCwd;
  }

  /**
   * Set the current working directory.
   */
  function setCwd(path: string): void {
    currentCwd = path;
  }

  /**
   * Set installed tools for command aliasing.
   */
  function setInstalledTools(tools: Map<string, AbsolutePath>): void {
    installedTools = tools;
  }

  /**
   * Enable or disable command aliasing.
   */
  function setAliasingEnabled(enabled: boolean): void {
    aliasingEnabled = enabled;
  }

  /**
   * Detect if a command is a cd command and extract the target directory.
   * Returns the target directory if it's a cd command, null otherwise.
   */
  function detectCdCommand(command: string): string | null {
    const trimmed = command.trim();
    // Match: cd, cd -, cd ~, cd /path, cd path, cd "path with spaces"
    const cdMatch = /^cd(?:\s+(.*))?$/.exec(trimmed);
    if (!cdMatch) return null;

    const target = cdMatch[1]?.trim() ?? '';
    if (!target || target === '') {
      // cd with no args goes to home directory
      return process.env.HOME ?? '/';
    }
    if (target === '-') {
      // cd - goes to previous directory (not tracked here, bash will handle it)
      return null; // Let bash handle it, we'll query pwd after
    }
    if (target === '~') {
      return process.env.HOME ?? '/';
    }
    if (target.startsWith('~/')) {
      return (process.env.HOME ?? '') + target.slice(1);
    }
    return target;
  }

  async function which(command: string): Promise<string | null> {
    // Check cache first
    if (whichCache.has(command)) {
      return whichCache.get(command) ?? null;
    }

    // Check if it's a shell builtin
    if (SHELL_BUILTINS.has(command)) {
      whichCache.set(command, 'builtin');
      return 'builtin';
    }

    try {
      const { stdout } = await execPromise(`which ${shellEscape(command)}`, {
        timeout: whichTimeout,
      });
      const path = stdout.trim() || null;
      whichCache.set(command, path);
      return path;
    } catch {
      whichCache.set(command, null);
      return null;
    }
  }

  async function isCommand(word: string): Promise<boolean> {
    // Quick validation: must be alphanumeric/dash/underscore, no spaces
    if (!/^[a-zA-Z0-9_-]+$/.test(word)) {
      return false;
    }

    // Check shell builtins first (fast path)
    if (SHELL_BUILTINS.has(word)) {
      return true;
    }

    return (await which(word)) !== null;
  }

  async function exec(command: string, execOptions: ExecOptions = {}): Promise<ExecResult> {
    // Use explicit cwd from options, or fall back to tracked current working directory
    const effectiveCwd = execOptions.cwd ?? currentCwd;

    // Check for zoxide commands (z, zi) and rewrite them
    const zoxideType = detectZoxideCommand(command);
    let workingCommand = command;

    if (zoxideType && installedTools.has('zoxide')) {
      // Rewrite z/zi to actual zoxide commands
      workingCommand = rewriteZoxideCommand(command, effectiveCwd);
    }

    // Apply command aliasing (e.g., ls -> eza)
    const aliasedCommand = rewriteCommand(workingCommand, installedTools, aliasingEnabled);

    // For interactive commands (captureOutput: false), use TTY management
    // to properly save/restore terminal state around subprocess execution
    const isInteractive = !execOptions.captureOutput;

    // Detect if this is a cd command (or z command that becomes cd)
    // We'll need to update our tracked cwd after and call zoxide add
    const isCdCommand = workingCommand.trim().startsWith('cd') || zoxideType !== null;

    const runCommand = (): Promise<ExecResult> => {
      return new Promise((resolve, reject) => {
        // Build environment: start with process.env or color env, then overlay user env
        const baseEnv = execOptions.forceColor ? getColorEnv() : process.env;
        const env = { ...baseEnv, ...execOptions.env };

        // For cd commands, we need to capture the new working directory after the command
        // We append "; pwd" to get the resulting directory, but only if captureOutput is true
        // For interactive mode, we'll query pwd separately after the command completes
        const finalCommand =
          isCdCommand && execOptions.captureOutput ? `${aliasedCommand} && pwd` : aliasedCommand;

        const proc = spawn('bash', ['-c', finalCommand], {
          cwd: effectiveCwd,
          env,
          stdio: execOptions.captureOutput ? 'pipe' : 'inherit',
        });

        let stdout = '';
        let stderr = '';

        if (execOptions.captureOutput) {
          proc.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
          });
          proc.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        }

        const timeout = execOptions.timeout
          ? setTimeout(() => proc.kill('SIGTERM'), execOptions.timeout)
          : null;

        proc.on('close', (code, signal) => {
          if (timeout) clearTimeout(timeout);
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 0,
            signal: signal ?? undefined,
          });
        });

        proc.on('error', reject);
      });
    };

    // Wrap interactive commands with TTY management to prevent terminal corruption
    let result: ExecResult;
    if (isInteractive) {
      result = await withTtyManagement(runCommand);
    } else {
      result = await runCommand();
    }

    // Update tracked cwd after successful cd command
    if (isCdCommand && result.exitCode === 0) {
      if (execOptions.captureOutput) {
        // For captured output mode, we appended "&& pwd" - extract the new cwd
        const lines = result.stdout.trim().split('\n');
        const newCwd = lines[lines.length - 1];
        if (newCwd?.startsWith('/')) {
          currentCwd = newCwd;
          // Remove the pwd output from stdout to not confuse callers
          result.stdout = lines.slice(0, -1).join('\n');
        }
      } else {
        // For interactive mode, query the new cwd separately
        try {
          const { stdout } = await execPromise('pwd', { cwd: effectiveCwd, timeout: 500 });
          // Actually, pwd will return the directory where we started, not where cd went
          // For cd commands in interactive mode, we need a different approach
          // Use bash -c 'cd <target> && pwd' to get the resulting directory
          const cdTarget = detectCdCommand(command);
          if (cdTarget) {
            const { stdout: newCwdOutput } = await execPromise(
              `cd ${shellEscape(cdTarget)} && pwd`,
              { cwd: effectiveCwd, timeout: 500 }
            );
            const newCwd = newCwdOutput.trim();
            if (newCwd?.startsWith('/')) {
              currentCwd = newCwd;
            }
          } else {
            // cd - or similar - query the bash's OLDPWD isn't reliable here
            // For now, use the current effective cwd
            currentCwd = stdout.trim();
          }
        } catch {
          // Ignore errors querying pwd
        }
      }

      // If zoxide is installed, add the new directory to zoxide's database
      // This enables zoxide to learn frequently visited directories
      if (installedTools.has('zoxide')) {
        // Run in background, don't wait for it
        zoxideAdd(currentCwd).catch(() => {
          // Ignore errors
        });
      }
    }

    return result;
  }

  async function getCompletions(partial: string, cursorPos: number): Promise<string[]> {
    const beforeCursor = partial.slice(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] ?? '';
    const isFirstWord = words.length === 1;

    try {
      if (isFirstWord) {
        // Complete commands
        const { stdout } = await execPromise(
          `compgen -c -- ${shellEscape(currentWord)} | head -20`,
          { timeout: whichTimeout }
        );
        return stdout.trim().split('\n').filter(Boolean);
      } else {
        // Complete files/directories
        const { stdout } = await execPromise(
          `compgen -f -- ${shellEscape(currentWord)} | head -20`,
          { timeout: whichTimeout }
        );
        return stdout.trim().split('\n').filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  function clearCache(): void {
    whichCache.clear();
  }

  return {
    which,
    isCommand,
    exec,
    getCompletions,
    clearCache,
    getCwd,
    setCwd,
    setInstalledTools,
    setAliasingEnabled,
  };
}

/**
 * Check if a word is a shell builtin.
 */
export function isShellBuiltin(word: string): boolean {
  return SHELL_BUILTINS.has(word);
}
