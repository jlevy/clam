import { describe, expect, it } from 'vitest';

import { createCodeHighlighter, highlightCode, isLanguageSupported } from './code-highlighter.js';

/**
 * Note: cli-highlight uses chalk internally which respects FORCE_COLOR.
 * In test environments without TTY, colors may be disabled.
 * These tests focus on the function behavior rather than exact output.
 */

describe('highlightCode', () => {
  describe('supported languages', () => {
    it('does not throw for JavaScript code', () => {
      const code = 'const x = 42;';
      expect(() => highlightCode(code, 'javascript')).not.toThrow();
    });

    it('does not throw for TypeScript code', () => {
      const code = 'const x: number = 42;';
      expect(() => highlightCode(code, 'typescript')).not.toThrow();
    });

    it('does not throw for Python code', () => {
      const code = 'def hello(): pass';
      expect(() => highlightCode(code, 'python')).not.toThrow();
    });

    it('does not throw for Bash code', () => {
      const code = 'echo "hello"';
      expect(() => highlightCode(code, 'bash')).not.toThrow();
    });

    it('does not throw for JSON', () => {
      const code = '{"key": "value"}';
      expect(() => highlightCode(code, 'json')).not.toThrow();
    });

    it('returns string containing original code tokens', () => {
      const code = 'const x = 42;';
      const result = highlightCode(code, 'javascript');
      // The result should contain the original tokens, possibly with ANSI codes
      expect(result).toContain('const');
      expect(result).toContain('42');
    });
  });

  describe('language aliases', () => {
    it('handles js as javascript', () => {
      const code = 'const x = 1;';
      const jsResult = highlightCode(code, 'js');
      const javascriptResult = highlightCode(code, 'javascript');
      expect(jsResult).toBe(javascriptResult);
    });

    it('handles ts as typescript', () => {
      const code = 'const x: number = 1;';
      const tsResult = highlightCode(code, 'ts');
      const typescriptResult = highlightCode(code, 'typescript');
      expect(tsResult).toBe(typescriptResult);
    });

    it('handles sh as bash', () => {
      const code = 'echo hi';
      const shResult = highlightCode(code, 'sh');
      const bashResult = highlightCode(code, 'bash');
      expect(shResult).toBe(bashResult);
    });

    it('handles py as python', () => {
      const code = 'print("hi")';
      const pyResult = highlightCode(code, 'py');
      const pythonResult = highlightCode(code, 'python');
      expect(pyResult).toBe(pythonResult);
    });

    it('handles yml as yaml', () => {
      const code = 'key: value';
      const ymlResult = highlightCode(code, 'yml');
      const yamlResult = highlightCode(code, 'yaml');
      expect(ymlResult).toBe(yamlResult);
    });
  });

  describe('unsupported/empty languages', () => {
    it('returns code unchanged for empty language', () => {
      const code = 'some code';
      expect(highlightCode(code, '')).toBe(code);
    });

    it('returns code unchanged for unsupported language', () => {
      const code = 'some code';
      expect(highlightCode(code, 'notareallanguage')).toBe(code);
    });

    it('returns code unchanged for whitespace-only language', () => {
      const code = 'some code';
      expect(highlightCode(code, '   ')).toBe(code);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase language names', () => {
      const code = 'const x = 1;';
      // Should not throw and should return a string
      const result = highlightCode(code, 'JAVASCRIPT');
      expect(typeof result).toBe('string');
      expect(result).toContain('const');
    });

    it('handles mixed case language names', () => {
      const code = 'const x = 1;';
      const result = highlightCode(code, 'JavaScript');
      expect(typeof result).toBe('string');
      expect(result).toContain('const');
    });
  });
});

describe('isLanguageSupported', () => {
  it('returns true for supported languages', () => {
    expect(isLanguageSupported('javascript')).toBe(true);
    expect(isLanguageSupported('typescript')).toBe(true);
    expect(isLanguageSupported('python')).toBe(true);
    expect(isLanguageSupported('bash')).toBe(true);
  });

  it('returns true for language aliases', () => {
    expect(isLanguageSupported('js')).toBe(true);
    expect(isLanguageSupported('ts')).toBe(true);
    expect(isLanguageSupported('py')).toBe(true);
    expect(isLanguageSupported('sh')).toBe(true);
  });

  it('returns false for unsupported languages', () => {
    expect(isLanguageSupported('notareallanguage')).toBe(false);
    expect(isLanguageSupported('')).toBe(false);
    expect(isLanguageSupported('   ')).toBe(false);
  });
});

describe('createCodeHighlighter', () => {
  it('creates a highlighter instance', () => {
    const highlighter = createCodeHighlighter();
    expect(highlighter).toBeDefined();
    expect(typeof highlighter.highlight).toBe('function');
  });

  it('highlighter.highlight returns a string', () => {
    const highlighter = createCodeHighlighter();
    const code = 'const x = 1;';
    const result = highlighter.highlight(code, 'javascript');
    expect(typeof result).toBe('string');
    expect(result).toContain('const');
  });
});
