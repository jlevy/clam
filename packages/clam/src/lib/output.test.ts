/**
 * Unit tests for OutputWriter.
 *
 * Tests verify:
 * - Correct ANSI output format
 * - NO cursor positioning codes
 * - Truncation behavior
 * - All semantic methods produce output
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { Writable } from 'node:stream';
import { createOutputWriter } from './output.js';

/**
 * Strip ANSI escape codes from a string.
 * Useful for testing content without color formatting.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

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

describe('OutputWriter', () => {
  let mock: ReturnType<typeof createMockStream>;
  let output: ReturnType<typeof createOutputWriter>;

  beforeEach(() => {
    mock = createMockStream();
    output = createOutputWriter({ stream: mock.stream });
  });

  describe('basic output methods', () => {
    it('should write info messages', () => {
      output.info('test message');
      expect(mock.getOutput()).toContain('test message');
      expect(mock.getOutput()).toContain('\n');
    });

    it('should write warning messages', () => {
      output.warning('warning message');
      expect(mock.getOutput()).toContain('warning message');
    });

    it('should write error messages', () => {
      output.error('error message');
      expect(mock.getOutput()).toContain('error message');
    });

    it('should write success messages', () => {
      output.success('success message');
      expect(mock.getOutput()).toContain('success message');
    });
  });

  describe('debug output', () => {
    it('should not show debug messages when verbose is false', () => {
      output.debug('debug message');
      expect(mock.getOutput()).toBe('');
    });

    it('should show debug messages when verbose is true', () => {
      const verboseOutput = createOutputWriter({
        stream: mock.stream,
        config: { verbose: true },
      });
      verboseOutput.debug('debug message');
      expect(mock.getOutput()).toContain('debug message');
    });
  });

  describe('tool output truncation', () => {
    it('should not truncate short output', () => {
      output.toolOutput('line1\nline2\nline3');
      const result = mock.getOutput();
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('line3');
      expect(result).not.toContain('more lines');
    });

    it('should truncate output exceeding default limit (10 lines)', () => {
      const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join('\n');
      output.toolOutput(lines);
      const result = mock.getOutput();
      expect(result).toContain('line1');
      expect(result).toContain('line10');
      expect(result).not.toContain('line11');
      expect(result).toContain('5 more lines');
    });

    it('should respect custom truncateAfter option', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');
      output.toolOutput(lines, { truncateAfter: 3 });
      const result = mock.getOutput();
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('line3');
      expect(result).not.toContain('line4');
      expect(result).toContain('7 more lines');
    });
  });

  describe('NO cursor positioning', () => {
    it('should not contain cursor positioning escape codes', () => {
      // Test all major output methods
      output.info('info');
      output.warning('warning');
      output.error('error');
      output.success('success');
      output.toolHeader('Tool', 'execute', 'completed');
      output.toolOutput('output\nline2\nline3');
      output.codeBlock('const x = 1;', 'typescript');
      output.separator();

      const result = mock.getOutput();

      // Cursor positioning codes to check for
      const cursorCodes = [
        '\x1b[H', // Home
        '\x1b[2J', // Clear screen
        '\x1b[K', // Clear line
        '\x1b[s', // Save cursor
        '\x1b[u', // Restore cursor
        '\x1b[A', // Cursor up
        '\x1b[B', // Cursor down
        '\x1b[C', // Cursor forward
        '\x1b[D', // Cursor back
      ];

      for (const code of cursorCodes) {
        expect(result).not.toContain(code);
      }
    });
  });

  describe('streaming output', () => {
    it('should stream chunks without newlines between them', () => {
      output.streamStart();
      output.streamChunk('Hello ');
      output.streamChunk('World');
      output.streamEnd();

      // Strip ANSI codes since pc.reset() wraps each chunk
      const result = stripAnsi(mock.getOutput());
      expect(result).toContain('Hello World');
    });
  });

  describe('tool header', () => {
    it('should include tool name, kind, and status', () => {
      output.toolHeader('bash', 'execute', 'completed');
      const result = mock.getOutput();
      expect(result).toContain('bash');
      expect(result).toContain('execute');
    });
  });

  describe('permission prompt', () => {
    it('should display tool, command, and letter-based options', () => {
      output.permissionPrompt('bash', 'rm -rf node_modules', [
        { id: '1', name: 'Allow once', kind: 'allow_once' },
        { id: '2', name: 'Allow always', kind: 'allow_always' },
        { id: '3', name: 'Reject once', kind: 'reject_once' },
        { id: '4', name: 'Reject always', kind: 'reject_always' },
      ]);
      const result = mock.getOutput();
      expect(result).toContain('Permission Required');
      expect(result).toContain('bash');
      expect(result).toContain('rm -rf node_modules');
      // Letter-based shortcuts: a=allow_once, A=allow_always, d=reject_once, D=reject_always
      expect(result).toContain('[a]');
      expect(result).toContain('[A]');
      expect(result).toContain('[d]');
      expect(result).toContain('[D]');
      expect(result).toContain('Allow once');
      expect(result).toContain('Allow always');
    });
  });

  describe('token usage', () => {
    it('should display token counts', () => {
      output.tokenUsage(1000, 500);
      const result = mock.getOutput();
      expect(result).toContain('1,000');
      expect(result).toContain('500');
      expect(result).toContain('1,500');
      expect(result).toContain('tokens');
    });
  });

  describe('tool separators', () => {
    it('should add blank line between tool headers', () => {
      output.toolHeader('bash', 'execute', 'completed');
      output.toolHeader('write', 'file', 'completed');
      const result = mock.getOutput();
      // Should have a blank line (double newline) between tools
      expect(result).toContain('\n\n');
    });

    it('should not add blank line before first tool header', () => {
      output.toolHeader('bash', 'execute', 'completed');
      const result = mock.getOutput();
      // First character should not be a newline
      expect(result.startsWith('\n')).toBe(false);
    });
  });

  describe('timestamps', () => {
    it('should include timestamps when showTimestamps is true', () => {
      const timestampOutput = createOutputWriter({
        stream: mock.stream,
        config: { showTimestamps: true },
      });
      timestampOutput.toolHeader('bash', 'execute', 'completed');
      const result = mock.getOutput();
      // Should contain timestamp format [HH:MM:SS]
      expect(result).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });

    it('should not include timestamps by default', () => {
      output.toolHeader('bash', 'execute', 'completed');
      const result = mock.getOutput();
      // Should not contain timestamp format
      expect(result).not.toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });
  });
});
