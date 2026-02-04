/**
 * ACP Client - Agent Client Protocol connection for clam.
 *
 * This module handles:
 * - Spawning the claude-code-acp adapter as a subprocess
 * - NDJSON communication over stdin/stdout
 * - Session lifecycle (initialize, new session, prompt)
 * - Routing ACP events to OutputWriter
 *
 * The adapter is embedded as a dependency - no global install needed.
 * Based on the @agentclientprotocol/sdk.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import type { ClamCodeConfig } from './config.js';
import type { OutputWriter, PermissionOption } from './output.js';

/**
 * Callback for handling permission requests.
 */
export type PermissionHandler = (
  tool: string,
  command: string,
  options: PermissionOption[]
) => Promise<string>;

/**
 * ACP client options.
 */
export interface AcpClientOptions {
  /** Output writer for rendering ACP events */
  output: OutputWriter;

  /** Configuration */
  config: ClamCodeConfig;

  /** Working directory for the session */
  cwd: string;

  /** Handler for permission requests */
  onPermission: PermissionHandler;

  /** Callback when agent completes */
  onComplete?: (stopReason: string) => void;

  /** Callback when agent errors */
  onError?: (error: Error) => void;
}

/**
 * ACP Client for connecting to Claude Code via claude-code-acp adapter.
 */
export class AcpClient {
  private process: ChildProcess | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private sessionId: string | null = null;
  private options: AcpClientOptions;
  private isPrompting = false;

  constructor(options: AcpClientOptions) {
    this.options = options;
  }

  /**
   * Resolve the path to the embedded claude-code-acp adapter.
   * Falls back to global command if config overrides it.
   */
  private resolveAdapterPath(): { command: string; args: string[]; useShell: boolean } {
    const { config } = this.options;

    // Allow config override for development/testing
    if (config.agentCommand) {
      return { command: config.agentCommand, args: [], useShell: true };
    }

    // Resolve the embedded adapter from node_modules
    try {
      const require = createRequire(import.meta.url);
      const adapterPath = require.resolve('@zed-industries/claude-code-acp/dist/index.js');
      return { command: process.execPath, args: [adapterPath], useShell: false };
    } catch {
      // Fallback to global command if not found in node_modules
      return { command: 'claude-code-acp', args: [], useShell: true };
    }
  }

  /**
   * Connect to the agent.
   */
  async connect(): Promise<void> {
    const { output, cwd } = this.options;
    const { command, args, useShell } = this.resolveAdapterPath();

    output.debug(`Spawning agent: ${command} ${args.join(' ')}`);

    // Spawn the agent process
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'], // stdin, stdout, stderr
      cwd,
      shell: useShell,
      env: {
        ...process.env,
        // Pass through any relevant env vars
      },
    });

    // Handle process errors
    this.process.on('error', (error) => {
      output.error(`Failed to spawn agent: ${error.message}`);
      if (error.message.includes('ENOENT')) {
        output.info('The claude-code-acp adapter could not be found.');
        output.info('Try running: npm install');
      }
      this.options.onError?.(error);
    });

    this.process.on('exit', (code, signal) => {
      output.debug(`Agent exited with code ${code}, signal ${signal}`);
      if (code !== 0 && code !== null) {
        output.error(`Agent exited with code ${code}`);
      }
    });

    // Create NDJSON streams
    // stdin/stdout are guaranteed non-null when spawn uses stdio: ['pipe', 'pipe', ...]
    const { stdin, stdout: stdoutStream } = this.process;
    if (!stdin || !stdoutStream) {
      throw new Error('Failed to create stdio streams for agent process');
    }
    const input = Writable.toWeb(stdin);
    const stdout = Readable.toWeb(stdoutStream) as ReadableStream<Uint8Array>;

    // Create the ACP connection
    const stream = acp.ndJsonStream(input, stdout);
    const clientImpl = this.createClientImplementation();
    this.connection = new acp.ClientSideConnection(() => clientImpl, stream);

    // Initialize the connection
    output.debug('Initializing ACP connection...');
    const initResult = await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
      },
      clientInfo: {
        name: 'clam',
        version: '0.1.0',
      },
    });

    output.debug(`Connected to agent (protocol v${initResult.protocolVersion})`);

    // Create a new session
    output.debug('Creating new session...');
    const sessionResult = await this.connection.newSession({
      cwd,
      mcpServers: [],
    });

    this.sessionId = sessionResult.sessionId;
    output.debug(`Session created: ${this.sessionId}`);
    output.success('Connected to Claude Code');
  }

  /**
   * Send a prompt to the agent.
   */
  async prompt(text: string): Promise<string> {
    if (!this.connection || !this.sessionId) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { output } = this.options;
    output.debug(`Sending prompt: ${text.slice(0, 50)}...`);
    output.streamStart();

    this.isPrompting = true;
    try {
      const result = await this.connection.prompt({
        sessionId: this.sessionId,
        prompt: [
          {
            type: 'text',
            text,
          },
        ],
      });

      output.streamEnd();
      output.debug(`Prompt completed with: ${result.stopReason}`);
      this.options.onComplete?.(result.stopReason);

      return result.stopReason;
    } finally {
      this.isPrompting = false;
    }
  }

  /**
   * Cancel the current prompt.
   * Returns true if a cancellation was sent, false if not prompting.
   */
  async cancel(): Promise<boolean> {
    if (!this.connection || !this.sessionId || !this.isPrompting) {
      return false;
    }

    const { output } = this.options;
    output.debug('Sending cancel request...');

    await this.connection.cancel({
      sessionId: this.sessionId,
    });

    return true;
  }

  /**
   * Check if currently prompting (waiting for agent response).
   */
  isCurrentlyPrompting(): boolean {
    return this.isPrompting;
  }

  /**
   * Disconnect from the agent.
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connection = null;
    this.sessionId = null;
    this.options.output.debug('Disconnected from agent');
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connection !== null && this.sessionId !== null;
  }

  /**
   * Create the ACP client implementation.
   */
  private createClientImplementation(): acp.Client {
    const { output, onPermission } = this.options;

    return {
      async requestPermission(
        params: acp.RequestPermissionRequest
      ): Promise<acp.RequestPermissionResponse> {
        const toolCall = params.toolCall;
        const tool = toolCall.title ?? 'Unknown tool';

        // Extract command from rawInput if available
        let command = '';
        if (toolCall.rawInput && typeof toolCall.rawInput === 'object') {
          const rawInput = toolCall.rawInput as Record<string, unknown>;
          command = (rawInput.command as string) ?? JSON.stringify(rawInput);
        }

        // Convert ACP options to our format
        const options: PermissionOption[] = params.options.map((opt) => ({
          id: opt.optionId,
          name: opt.name,
          kind: opt.kind,
        }));

        // Render permission prompt via OutputWriter
        output.permissionPrompt(tool, command, options);

        // Get user response via callback
        const selectedId = await onPermission(tool, command, options);

        return {
          outcome: {
            outcome: 'selected',
            optionId: selectedId,
          },
        };
      },

      async sessionUpdate(params: acp.SessionNotification): Promise<void> {
        const update = params.update;

        switch (update.sessionUpdate) {
          case 'agent_message_chunk':
            if (update.content.type === 'text') {
              output.streamChunk(update.content.text);
            } else {
              output.info(`[${update.content.type}]`);
            }
            break;

          case 'agent_thought_chunk':
            if (update.content.type === 'text') {
              output.thinking(update.content.text.length);
            }
            break;

          case 'tool_call': {
            const status = update.status ?? 'pending';
            const kind = update.kind ?? 'other';
            output.toolHeader(update.title, kind, status);
            break;
          }

          case 'tool_call_update': {
            const status = update.status ?? 'pending';
            if (status === 'completed' || status === 'failed') {
              // Show tool output if available
              if (update.content && update.content.length > 0) {
                for (const content of update.content) {
                  if (content.type === 'content' && content.content.type === 'text') {
                    output.toolOutput(content.content.text);
                  } else if (content.type === 'diff') {
                    // Count additions and deletions
                    const additions = (content.newText.match(/\n/g) ?? []).length;
                    const deletions = content.oldText
                      ? (content.oldText.match(/\n/g) ?? []).length
                      : 0;
                    output.diffBlock(content.path, additions, deletions, content.newText);
                  }
                }
              }
            }
            break;
          }

          case 'plan':
            if (update.entries && update.entries.length > 0) {
              output.info('Plan:');
              for (const entry of update.entries) {
                const statusIcon =
                  entry.status === 'completed'
                    ? '\u2713'
                    : entry.status === 'in_progress'
                      ? '\u25cf'
                      : '\u25cb';
                output.info(`  ${statusIcon} ${entry.content}`);
              }
            }
            break;

          case 'user_message_chunk':
            // Echo back user messages (usually not needed)
            break;

          case 'available_commands_update':
            // Store available commands for slash command completion
            output.debug(`Available commands: ${JSON.stringify(update.availableCommands)}`);
            break;

          case 'current_mode_update':
            output.debug(`Mode changed to: ${update.currentModeId}`);
            break;

          default:
            // Unknown update type
            break;
        }
        // Satisfy eslint require-await for async method
        await Promise.resolve();
      },

      async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
        output.debug(`Read file: ${params.path}`);
        try {
          const { readFileSync } = await import('node:fs');
          const content = readFileSync(params.path, 'utf-8');
          return { content };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          output.error(`Failed to read file ${params.path}: ${message}`);
          throw new Error(`Failed to read file ${params.path}: ${message}`);
        }
      },

      async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
        output.debug(`Write file: ${params.path}`);
        try {
          const { writeFileSync } = await import('node:fs');
          writeFileSync(params.path, params.content, 'utf-8');
          return {};
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          output.error(`Failed to write file ${params.path}: ${message}`);
          throw new Error(`Failed to write file ${params.path}: ${message}`);
        }
      },
    };
  }
}

/**
 * Create an ACP client instance.
 */
export function createAcpClient(options: AcpClientOptions): AcpClient {
  return new AcpClient(options);
}
