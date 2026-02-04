/**
 * Unit tests for ACP client.
 *
 * These tests verify the client structure and mock interactions.
 * Integration tests with real claude-code-acp would be in a separate file.
 */

import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcpClient, createAcpClient } from './acp.js';
import { createOutputWriter } from './output.js';

/**
 * Create a mock stream that captures output.
 */
function createMockStream(): { stream: Writable; getOutput: () => string } {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  return {
    stream,
    getOutput: () => output,
  };
}

describe('AcpClient', () => {
  let mock: ReturnType<typeof createMockStream>;
  let output: ReturnType<typeof createOutputWriter>;

  beforeEach(() => {
    mock = createMockStream();
    output = createOutputWriter({ stream: mock.stream, config: { verbose: true } });
  });

  describe('createAcpClient', () => {
    it('should create an ACP client instance', () => {
      const client = createAcpClient({
        output,
        config: { agentCommand: 'echo' },
        cwd: process.cwd(),
        onPermission: vi.fn(),
      });

      expect(client).toBeInstanceOf(AcpClient);
    });
  });

  describe('AcpClient', () => {
    it('should not be connected initially', () => {
      const client = createAcpClient({
        output,
        config: { agentCommand: 'echo' },
        cwd: process.cwd(),
        onPermission: vi.fn(),
      });

      expect(client.isConnected()).toBe(false);
    });

    it('should throw when prompting without connection', async () => {
      const client = createAcpClient({
        output,
        config: { agentCommand: 'echo' },
        cwd: process.cwd(),
        onPermission: vi.fn(),
      });

      await expect(client.prompt('test')).rejects.toThrow('Not connected');
    });

    it('should handle disconnect gracefully when not connected', () => {
      const client = createAcpClient({
        output,
        config: { agentCommand: 'echo' },
        cwd: process.cwd(),
        onPermission: vi.fn(),
      });

      // Should not throw
      expect(() => {
        client.disconnect();
      }).not.toThrow();
    });
  });

  // Note: Integration tests with real claude-code-acp would be in acp.integration.test.ts
  // These unit tests only verify the client structure without spawning real processes
});
