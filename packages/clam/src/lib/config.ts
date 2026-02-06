/**
 * Configuration management for clam.
 *
 * Config is stored in ~/.clam/code/ directory:
 * - config.json: User configuration
 * - permissions.json: Saved permission decisions
 * - history/: Command history (future)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * User configuration options.
 */
export interface ClamCodeConfig {
  /** Working directory for sessions (default: cwd) */
  cwd?: string;

  /** Maximum lines to show for tool output before truncating (default: 5) */
  truncateAfter?: number;

  /** Show timestamps on tool outputs */
  showTimestamps?: boolean;

  /** Enable verbose/debug output */
  verbose?: boolean;

  /** Agent command to spawn (default: claude-code-acp) */
  agentCommand?: string;

  /** Require double-Enter to submit NL input (default: false) */
  doubleEnterForNl?: boolean;
}

const DEFAULT_CONFIG: ClamCodeConfig = {
  truncateAfter: 3,
  showTimestamps: false,
  verbose: false,
  doubleEnterForNl: false,
  // agentCommand is undefined by default - uses embedded adapter
};

/**
 * Get the configuration directory path.
 */
export function getConfigDir(): string {
  return join(homedir(), '.clam', 'code');
}

/**
 * Ensure the config directory exists.
 */
export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get path to a config file.
 */
export function getConfigPath(filename: string): string {
  return join(getConfigDir(), filename);
}

/**
 * Get path to the history file.
 */
export function getHistoryPath(): string {
  return getConfigPath('history');
}

/**
 * Load configuration from files and environment.
 *
 * Priority (highest to lowest):
 * 1. Environment variables (CLAM_CODE_*)
 * 2. ~/.clam/code/config.json
 * 3. .env.local in cwd
 * 4. .env in cwd
 * 5. Default values
 */
export function loadConfig(cwd?: string): ClamCodeConfig {
  // Load .env files (dotenv doesn't override existing env vars)
  const workDir = cwd ?? process.cwd();
  if (existsSync(join(workDir, '.env.local'))) {
    loadDotenv({ path: join(workDir, '.env.local') });
  }
  if (existsSync(join(workDir, '.env'))) {
    loadDotenv({ path: join(workDir, '.env') });
  }

  // Load config file
  const fileConfig: Partial<ClamCodeConfig> = {};
  const configPath = getConfigPath('config.json');
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      // Validate parsed config is an object
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        // Extract and validate known fields
        if (typeof obj.truncateAfter === 'number' && obj.truncateAfter > 0) {
          fileConfig.truncateAfter = obj.truncateAfter;
        }
        if (typeof obj.showTimestamps === 'boolean') {
          fileConfig.showTimestamps = obj.showTimestamps;
        }
        if (typeof obj.verbose === 'boolean') {
          fileConfig.verbose = obj.verbose;
        }
        if (typeof obj.doubleEnterForNl === 'boolean') {
          fileConfig.doubleEnterForNl = obj.doubleEnterForNl;
        }
        if (typeof obj.agentCommand === 'string' && obj.agentCommand.length > 0) {
          fileConfig.agentCommand = obj.agentCommand;
        }
        if (typeof obj.cwd === 'string' && obj.cwd.length > 0) {
          fileConfig.cwd = obj.cwd;
        }
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  // Build config with env overrides
  const config: ClamCodeConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
  };

  // Environment variable overrides
  if (process.env.CLAM_CODE_TRUNCATE_AFTER) {
    const parsed = Number.parseInt(process.env.CLAM_CODE_TRUNCATE_AFTER, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      config.truncateAfter = parsed;
    }
  }
  if (process.env.CLAM_CODE_VERBOSE === '1') {
    config.verbose = true;
  }
  if (process.env.CLAM_CODE_SHOW_TIMESTAMPS === '1') {
    config.showTimestamps = true;
  }
  if (process.env.CLAM_CODE_AGENT_COMMAND) {
    config.agentCommand = process.env.CLAM_CODE_AGENT_COMMAND;
  }
  if (process.env.CLAM_CODE_DOUBLE_ENTER_FOR_NL === '1') {
    config.doubleEnterForNl = true;
  }

  return config;
}

/**
 * Format configuration for display.
 */
export function formatConfig(config: ClamCodeConfig): string[] {
  return [
    `cwd: ${config.cwd ?? process.cwd()}`,
    `truncateAfter: ${config.truncateAfter ?? 5}`,
    `showTimestamps: ${config.showTimestamps ?? false}`,
    `verbose: ${config.verbose ?? false}`,
    `agentCommand: ${config.agentCommand ?? 'claude-code-acp'}`,
    `configDir: ${getConfigDir()}`,
  ];
}

/**
 * Save configuration to file.
 */
export function saveConfig(config: Partial<ClamCodeConfig>): void {
  ensureConfigDir();
  const configPath = getConfigPath('config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
