import pc from 'picocolors';
import { describe, expect, it } from 'vitest';

import { formatInline, hasUnclosedFormatting } from './inline-formatter.js';

describe('formatInline', () => {
  describe('bold formatting', () => {
    it('formats **bold** text', () => {
      const result = formatInline('this is **bold** text');
      expect(result).toBe(`this is ${pc.bold('bold')} text`);
    });

    it('formats __bold__ text with underscores', () => {
      const result = formatInline('this is __bold__ text');
      expect(result).toBe(`this is ${pc.bold('bold')} text`);
    });

    it('handles multiple bold segments', () => {
      const result = formatInline('**first** and **second**');
      expect(result).toBe(`${pc.bold('first')} and ${pc.bold('second')}`);
    });
  });

  describe('italic formatting', () => {
    it('formats *italic* text', () => {
      const result = formatInline('this is *italic* text');
      expect(result).toBe(`this is ${pc.italic('italic')} text`);
    });

    it('formats _italic_ text with underscores', () => {
      const result = formatInline('this is _italic_ text');
      expect(result).toBe(`this is ${pc.italic('italic')} text`);
    });
  });

  describe('inline code formatting', () => {
    it('formats `code` with backticks', () => {
      const result = formatInline('use `console.log()` for debugging');
      expect(result).toBe(`use ${pc.cyan('console.log()')} for debugging`);
    });

    it('formats ``code with ` inside`` with double backticks', () => {
      const result = formatInline('the ``code with ` inside`` is tricky');
      expect(result).toBe(`the ${pc.cyan('code with ` inside')} is tricky`);
    });

    it('does not format markdown inside code', () => {
      const result = formatInline('use `**not bold**` in code');
      expect(result).toBe(`use ${pc.cyan('**not bold**')} in code`);
    });
  });

  describe('link formatting', () => {
    it('formats [link](url) as underlined blue text', () => {
      const result = formatInline('check [this link](https://example.com) out');
      expect(result).toBe(`check ${pc.blue(pc.underline('this link'))} out`);
    });

    it('handles multiple links', () => {
      const result = formatInline('[one](a) and [two](b)');
      expect(result).toBe(`${pc.blue(pc.underline('one'))} and ${pc.blue(pc.underline('two'))}`);
    });
  });

  describe('strikethrough formatting', () => {
    it('formats ~~strikethrough~~ text', () => {
      const result = formatInline('this is ~~deleted~~ text');
      expect(result).toBe(`this is ${pc.strikethrough('deleted')} text`);
    });
  });

  describe('combined formatting', () => {
    it('handles bold and italic together', () => {
      const result = formatInline('**bold** and *italic* combined');
      expect(result).toBe(`${pc.bold('bold')} and ${pc.italic('italic')} combined`);
    });

    it('handles code and bold together', () => {
      const result = formatInline('**bold** with `code` here');
      expect(result).toBe(`${pc.bold('bold')} with ${pc.cyan('code')} here`);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(formatInline('')).toBe('');
    });

    it('handles text without formatting', () => {
      const text = 'plain text without any formatting';
      expect(formatInline(text)).toBe(text);
    });

    it('handles unclosed formatting gracefully', () => {
      // Unclosed formatting should be left as-is
      const result = formatInline('incomplete **bold');
      expect(result).toBe('incomplete **bold');
    });
  });
});

describe('hasUnclosedFormatting', () => {
  it('returns false for complete formatting', () => {
    expect(hasUnclosedFormatting('**bold** text')).toBe(false);
    expect(hasUnclosedFormatting('`code` here')).toBe(false);
    expect(hasUnclosedFormatting('[link](url)')).toBe(false);
  });

  it('returns true for unclosed bold', () => {
    expect(hasUnclosedFormatting('incomplete **bold')).toBe(true);
  });

  it('returns true for unclosed code', () => {
    expect(hasUnclosedFormatting('incomplete `code')).toBe(true);
  });

  it('returns true for unclosed link', () => {
    expect(hasUnclosedFormatting('incomplete [link')).toBe(true);
    expect(hasUnclosedFormatting('incomplete [link](')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasUnclosedFormatting('')).toBe(false);
  });
});
