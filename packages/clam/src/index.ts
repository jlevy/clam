/**
 * @clam/code - True terminal scrollback ACP client for Claude Code
 *
 * This package provides:
 * - OutputWriter: Semantic output interface for ANSI terminal rendering
 * - InputReader: Rich input with completion support
 * - ACP client utilities for connecting to agents
 *
 * All output goes through the semantic OutputWriter interface to enable
 * future upgrade to Clam codes without code changes.
 */

export type { AcpClientOptions, AcpCommand, PermissionHandler } from './lib/acp.js';
// ACP client
export { AcpClient, createAcpClient } from './lib/acp.js';
export type { ClamCodeConfig } from './lib/config.js';
// Configuration
export {
  formatConfig,
  getConfigDir,
  getHistoryPath,
  loadConfig,
  saveConfig,
} from './lib/config.js';
// Formatting utilities
export {
  colors,
  formatDuration,
  formatTimestamp,
  formatTokenUsage,
  formatToolStatus,
  symbols,
  truncateLines,
} from './lib/formatting.js';
export type { InputContext, InputReaderOptions, SlashCommand } from './lib/input.js';
// Input handling
export { createInputReader, InputReader } from './lib/input.js';
export type { InputMode, ModeDetector, ModeDetectorOptions } from './lib/mode-detection.js';
// Mode detection
export {
  createModeDetector,
  hasShellOperators,
  isExplicitShell,
  stripShellTrigger,
} from './lib/mode-detection.js';
export type { OutputWriter, OutputWriterOptions, ToolStatus } from './lib/output.js';
// Core interfaces and implementations
export { createOutputWriter } from './lib/output.js';
export type { PermissionDecision, StoredPermissions } from './lib/permissions.js';
// Permissions
export {
  createPermissionManager,
  getDecisionFromKind,
  getScopeFromKind,
  PermissionManager,
} from './lib/permissions.js';
export type { ExecOptions, ExecResult, ShellModule, ShellModuleOptions } from './lib/shell.js';
// Shell utilities
export { createShellModule, isShellBuiltin } from './lib/shell.js';
