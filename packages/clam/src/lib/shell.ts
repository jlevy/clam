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

import { exec as execCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { getColorEnv } from './shell/color-env.js';

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
  const defaultCwd = options.cwd ?? process.cwd();

  // Cache which results to avoid repeated lookups
  const whichCache = new Map<string, string | null>();

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
    return new Promise((resolve, reject) => {
      // Build environment: start with process.env or color env, then overlay user env
      const baseEnv = execOptions.forceColor ? getColorEnv() : process.env;
      const env = { ...baseEnv, ...execOptions.env };

      const proc = spawn('bash', ['-c', command], {
        cwd: execOptions.cwd ?? defaultCwd,
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
      }
      // Complete files/directories
      const { stdout } = await execPromise(`compgen -f -- ${shellEscape(currentWord)} | head -20`, {
        timeout: whichTimeout,
      });
      return stdout.trim().split('\n').filter(Boolean);
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
  };
}

/**
 * Check if a word is a shell builtin.
 */
export function isShellBuiltin(word: string): boolean {
  return SHELL_BUILTINS.has(word);
}
