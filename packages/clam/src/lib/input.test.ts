/**
 * Unit tests for InputReader.
 *
 * Tests verify:
 * - Command registration
 * - Slash command parsing
 * - Built-in commands
 */

import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInputReader, InputReader } from './input.js';
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

describe('InputReader', () => {
  let mock: ReturnType<typeof createMockStream>;
  let output: ReturnType<typeof createOutputWriter>;

  beforeEach(() => {
    mock = createMockStream();
    output = createOutputWriter({ stream: mock.stream });
  });

  describe('createInputReader', () => {
    it('should create an InputReader instance', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      expect(reader).toBeInstanceOf(InputReader);
    });
  });

  describe('InputReader', () => {
    it('should not be running initially', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      expect(reader.isRunning()).toBe(false);
    });

    it('should have built-in commands registered', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      // Access private commands map via type assertion for testing
      const readerWithCommands = reader as unknown as { commands: Map<string, unknown> };
      expect(readerWithCommands.commands.has('help')).toBe(true);
      expect(readerWithCommands.commands.has('quit')).toBe(true);
      expect(readerWithCommands.commands.has('exit')).toBe(true);
      expect(readerWithCommands.commands.has('clear')).toBe(true);
      expect(readerWithCommands.commands.has('status')).toBe(true);
      expect(readerWithCommands.commands.has('config')).toBe(true);
    });

    it('should allow registering custom commands', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      reader.registerCommand({
        name: 'test',
        description: 'Test command',
        execute: vi.fn(),
      });

      const readerWithCommands = reader as unknown as { commands: Map<string, unknown> };
      expect(readerWithCommands.commands.has('test')).toBe(true);
    });

    it('should stop cleanly when not running', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      // Should not throw
      expect(() => {
        reader.stop();
      }).not.toThrow();
    });
  });

  describe('completer', () => {
    it('should complete slash commands', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      // Access private createCompleter via type assertion for testing
      const readerWithCompleter = reader as unknown as {
        createCompleter: () => (line: string) => [string[], string];
      };
      const completer = readerWithCompleter.createCompleter();

      // Test slash command completion
      const [hits, line] = completer('/he');
      expect(line).toBe('/he');
      expect(hits).toContain('/help');
    });

    it('should return all commands for bare slash', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      const readerWithCompleter = reader as unknown as {
        createCompleter: () => (line: string) => [string[], string];
      };
      const completer = readerWithCompleter.createCompleter();

      const [hits] = completer('/');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.startsWith('/help'))).toBe(true);
      expect(hits.some((h) => h.startsWith('/quit'))).toBe(true);
    });

    it('should complete file paths with @', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      const readerWithCompleter = reader as unknown as {
        createCompleter: () => (line: string) => [string[], string];
      };
      const completer = readerWithCompleter.createCompleter();

      // Test @path completion (will use current directory)
      const [hits, line] = completer('@src/');
      expect(line).toBe('@src/');
      // Should return completions if src/ directory exists
      // The actual content depends on the project structure
      expect(Array.isArray(hits)).toBe(true);
    });

    it('should return empty for regular text', () => {
      const reader = createInputReader({
        output,
        onQuit: vi.fn(),
        onPrompt: vi.fn(),
      });

      const readerWithCompleter = reader as unknown as {
        createCompleter: () => (line: string) => [string[], string];
      };
      const completer = readerWithCompleter.createCompleter();

      const [hits] = completer('hello world');
      expect(hits).toEqual([]);
    });
  });

  // Note: Testing the actual input loop requires mocking process.stdin
  // which is complex. Integration tests would cover the full flow.
});
