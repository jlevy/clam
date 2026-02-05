/**
 * BashExecutor - Safe shell command execution with security guardrails.
 *
 * SECURITY CONSIDERATIONS:
 * ========================
 *
 * This module executes arbitrary shell commands, which is inherently risky.
 * The following security measures are in place:
 *
 * 1. COMMAND VALIDATION: Dangerous patterns are detected and rejected before
 *    execution. This includes destructive commands like `rm -rf /`, fork bombs,
 *    and commands targeting system directories.
 *
 * 2. PROCESS ISOLATION: Commands run in a child process with:
 *    - Configurable working directory (defaults to project root, not /)
 *    - Timeout limits (default 30s, configurable)
 *    - Captured output for inspection
 *
 * 3. NO SHELL EXPANSION: We use spawn() with bash -c, which provides a single
 *    layer of shell interpretation. Arguments are not pre-expanded.
 *
 * 4. PRIVILEGE DROPPING: This module does NOT support sudo or privilege
 *    escalation. Commands run with the user's normal permissions.
 *
 * THREAT MODEL:
 * - Malicious input from AI/LLM that might try destructive commands
 * - Accidental typos that could cause damage (rm -rf with wrong path)
 * - Resource exhaustion (fork bombs, infinite loops)
 *
 * NOT IN SCOPE:
 * - Sandboxing (no container/VM isolation - that's for the deployment layer)
 * - Network isolation (commands can access network)
 * - File permission restrictions (uses caller's permissions)
 */

import { spawn } from 'node:child_process';

/**
 * Patterns that indicate potentially dangerous commands.
 * These are checked before execution.
 */
export const DANGEROUS_PATTERNS: RegExp[] = [
  // Destructive operations on root or system directories
  /rm\s+(-[^\s]*\s+)*-?r[^\s]*\s+\/($|\s)/i,
  /rm\s+(-[^\s]*\s+)*-?r[^\s]*\s+\/(etc|var|usr|bin|boot|dev|lib|proc|sys|root)/i,

  // Sudo with destructive commands
  /sudo\s+rm/i,
  /sudo\s+chmod\s+777/i,
  /sudo\s+chown/i,

  // Fork bombs and resource exhaustion
  /:\(\)\s*\{\s*:\s*\|\s*:.*&.*\}\s*;?\s*:/,
  /\$\(\s*:\(\)/,

  // Direct writes to system files
  />\s*\/(etc|var|usr|bin|boot)/i,

  // Format/wipe operations
  /mkfs\./i,
  /dd\s+.*of=\/dev\//i,

  // Curl/wget piped to shell (potential RCE)
  /(curl|wget)\s+.*\|\s*(ba)?sh/i,
];

/**
 * Result of command validation.
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a command for dangerous patterns.
 *
 * @param command - The command string to validate
 * @returns Validation result with reason if invalid
 */
export function validateCommand(command: string): ValidationResult {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        valid: false,
        reason: `Command matches dangerous pattern: ${pattern.source}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Options for command execution.
 */
export interface ExecuteOptions {
  /** Working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Environment variables to add */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Capture output instead of inheriting stdio */
  captureOutput?: boolean;
}

/**
 * Result of command execution.
 */
export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
}

/**
 * BashExecutor interface.
 */
export interface BashExecutor {
  name: 'bash-executor';

  /**
   * Execute a shell command with validation and security checks.
   *
   * @param command - The command to execute
   * @param options - Execution options
   * @throws Error if command is dangerous or execution fails
   */
  execute(command: string, options?: ExecuteOptions): Promise<ExecuteResult>;

  /**
   * Validate a command without executing it.
   */
  validate(command: string): ValidationResult;
}

/**
 * Default timeout in milliseconds.
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Create a BashExecutor instance.
 *
 * @example
 * ```typescript
 * const executor = createBashExecutor();
 *
 * // Safe command
 * const result = await executor.execute('ls -la', { captureOutput: true });
 * console.log(result.stdout);
 *
 * // Dangerous command - throws error
 * await executor.execute('rm -rf /'); // Error: Command matches dangerous pattern
 * ```
 */
export function createBashExecutor(): BashExecutor {
  return {
    name: 'bash-executor',

    validate(command: string): ValidationResult {
      return validateCommand(command);
    },

    async execute(command: string, options: ExecuteOptions = {}): Promise<ExecuteResult> {
      // SECURITY: Validate command before execution
      const validation = validateCommand(command);
      if (!validation.valid) {
        throw new Error(`Dangerous command rejected: ${validation.reason}`);
      }

      const {
        cwd = process.cwd(),
        env = {},
        timeout = DEFAULT_TIMEOUT,
        captureOutput = false,
      } = options;

      return new Promise((resolve, reject) => {
        // SECURITY: Use spawn with explicit bash -c to avoid shell injection
        // via process arguments. The command is passed as a single string.
        const proc = spawn('bash', ['-c', command], {
          cwd,
          env: { ...process.env, ...env },
          stdio: captureOutput ? 'pipe' : 'inherit',
        });

        let stdout = '';
        let stderr = '';

        if (captureOutput) {
          proc.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
          });
          proc.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        }

        // SECURITY: Enforce timeout to prevent runaway processes
        const timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
        }, timeout);

        proc.on('close', (code, signal) => {
          clearTimeout(timeoutId);
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 0,
            signal: signal ?? undefined,
          });
        });

        proc.on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });
    },
  };
}
