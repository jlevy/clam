/**
 * Integration tests for streaming markdown rendering.
 *
 * Tests the full flow from streaming chunks through formatted output,
 * verifying end-to-end behavior across all block types.
 */
import { beforeEach, describe, expect, it } from 'bun:test';

import { createBlockRenderer, type StreamRenderer } from './index.js';

describe('Markdown Streaming Integration', () => {
  let renderer: StreamRenderer;

  beforeEach(() => {
    renderer = createBlockRenderer();
  });

  describe('full document streaming', () => {
    it('renders markdown document with headers, paragraphs, and code', () => {
      const chunks = [
        '# Welcome\n\n',
        'This is a **bold** statement with `inline code`.\n\n',
        '```typescript\nconst x = 42;\n```\n',
        'Final paragraph.',
      ];

      let output = '';
      for (const chunk of chunks) {
        output += renderer.processChunk(chunk);
      }
      output += renderer.flush();

      expect(output).toContain('Welcome');
      expect(output).toContain('bold');
      expect(output).toContain('```');
      expect(output).toContain('42');
      expect(output).toContain('Final paragraph');
    });

    it('renders list with formatting', () => {
      const output = renderer.processChunk('- Item one\n- Item two\n\nAfter list.');
      const flushed = renderer.flush();

      // marked-terminal renders list items with * prefix
      expect(output).toContain('Item one');
      expect(output).toContain('Item two');
      expect(flushed).toContain('After list');
    });

    it('renders blockquote with styling', () => {
      const output = renderer.processChunk('> A wise quote\n\nAfter quote.');
      const flushed = renderer.flush();

      // marked-terminal renders blockquotes with indentation and styling
      expect(output).toContain('wise quote');
      expect(flushed).toContain('After quote');
    });

    it('handles character-by-character streaming', () => {
      const markdown = '# Title\n\nHello **world**.\n\n';
      let output = '';

      // Stream character by character
      for (const char of markdown) {
        output += renderer.processChunk(char);
      }
      output += renderer.flush();

      expect(output).toContain('Title');
      expect(output).toContain('world');
    });

    it('handles empty stream', () => {
      const output = renderer.flush();
      expect(output).toBe('');
    });

    it('handles whitespace-only stream', () => {
      renderer.processChunk('   \n   \n');
      const output = renderer.flush();
      expect(typeof output).toBe('string');
    });
  });

  describe('code block streaming', () => {
    it('accumulates code until fence closes', () => {
      // Code fence should not emit until closed
      const beforeClose = renderer.processChunk('```javascript\nconst x = 1;\n');
      expect(beforeClose).toBe('');

      // Closing fence triggers emission
      const afterClose = renderer.processChunk('```\n\nNext paragraph');
      expect(afterClose).toContain('```');
      expect(afterClose).toContain('const');
    });

    it('handles unclosed code fence on flush', () => {
      renderer.processChunk('```python\ndef hello():\n  pass');
      const output = renderer.flush();

      expect(output).toContain('def hello');
      expect(output).toContain('pass');
    });

    it('handles multiple code blocks', () => {
      let output = '';
      output += renderer.processChunk('```js\nconst a = 1;\n```\n\n');
      output += renderer.processChunk('```ts\nconst b: number = 2;\n```\n\n');
      output += renderer.flush();

      expect(output).toContain('const a');
      expect(output).toContain('const b');
    });

    it('preserves code content exactly within blocks', () => {
      let output = '';
      output += renderer.processChunk('```\n**not bold** *not italic*\n```\n\n');
      output += renderer.flush();

      // Code should not have markdown formatting applied
      expect(output).toContain('**not bold**');
      expect(output).toContain('*not italic*');
    });
  });

  describe('list streaming', () => {
    it('handles unordered lists', () => {
      let output = '';
      output += renderer.processChunk('- First item\n');
      output += renderer.processChunk('- Second item\n');
      output += renderer.processChunk('\nParagraph after list.');
      output += renderer.flush();

      // marked-terminal renders list items with * prefix
      expect(output).toContain('First item');
      expect(output).toContain('Second item');
    });

    it('handles ordered lists', () => {
      let output = '';
      output += renderer.processChunk('1. First\n');
      output += renderer.processChunk('2. Second\n');
      output += renderer.processChunk('3. Third\n');
      output += renderer.processChunk('\nAfter list.');
      output += renderer.flush();

      expect(output).toContain('1.');
      expect(output).toContain('First');
      expect(output).toContain('Third');
    });

    it('applies inline formatting within list items', () => {
      let output = '';
      output += renderer.processChunk('- Item with **bold** text\n');
      output += renderer.processChunk('- Item with `code`\n');
      output += renderer.processChunk('\nDone.');
      output += renderer.flush();

      expect(output).toContain('bold');
      expect(output).toContain('code');
    });
  });

  describe('table streaming', () => {
    it('renders a complete table', () => {
      const tableMarkdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

After table.`;

      let output = '';
      output += renderer.processChunk(tableMarkdown);
      output += renderer.flush();

      expect(output).toContain('Header 1');
      expect(output).toContain('Header 2');
      expect(output).toContain('Cell 1');
      expect(output).toContain('Cell 4');
    });

    it('handles table streamed in chunks', () => {
      let output = '';
      output += renderer.processChunk('| A | B |\n');
      output += renderer.processChunk('|---|---|\n');
      output += renderer.processChunk('| 1 | 2 |\n');
      output += renderer.processChunk('\nParagraph.');
      output += renderer.flush();

      expect(output).toContain('A');
      expect(output).toContain('B');
      expect(output).toContain('1');
      expect(output).toContain('2');
    });
  });

  describe('blockquote streaming', () => {
    it('renders blockquotes with proper styling', () => {
      let output = '';
      output += renderer.processChunk('> This is a quote\n');
      output += renderer.processChunk('> with multiple lines\n');
      output += renderer.processChunk('\nRegular text.');
      output += renderer.flush();

      // marked-terminal renders blockquotes with indentation and styling
      expect(output).toContain('quote');
      expect(output).toContain('multiple lines');
    });
  });

  describe('inline formatting', () => {
    it('formats bold text', () => {
      let output = '';
      output += renderer.processChunk('This is **bold** text.\n\n');
      output += renderer.flush();

      expect(output).toContain('bold');
    });

    it('formats italic text', () => {
      let output = '';
      output += renderer.processChunk('This is *italic* text.\n\n');
      output += renderer.flush();

      expect(output).toContain('italic');
    });

    it('formats inline code', () => {
      let output = '';
      output += renderer.processChunk('Run `npm install` to install.\n\n');
      output += renderer.flush();

      expect(output).toContain('npm install');
    });

    it('formats links', () => {
      let output = '';
      output += renderer.processChunk('Visit [Example](https://example.com) for more.\n\n');
      output += renderer.flush();

      expect(output).toContain('Example');
    });

    it('handles nested formatting', () => {
      let output = '';
      output += renderer.processChunk('This has **bold with `code` inside** it.\n\n');
      output += renderer.flush();

      expect(output).toContain('bold');
      expect(output).toContain('code');
    });
  });

  describe('reset functionality', () => {
    it('allows reuse after reset', () => {
      // First document
      let output1 = '';
      output1 += renderer.processChunk('# First\n\n');
      output1 += renderer.flush();
      expect(output1).toContain('First');

      // Reset
      renderer.reset();

      // Second document
      let output2 = '';
      output2 += renderer.processChunk('# Second\n\n');
      output2 += renderer.flush();
      expect(output2).toContain('Second');
      expect(output2).not.toContain('First');
    });

    it('clears partial code block state on reset', () => {
      // Start a code block without closing
      renderer.processChunk('```python\npartial code');

      // Reset mid-stream
      renderer.reset();

      // New content should work correctly
      let output = '';
      output += renderer.processChunk('# New Document\n\n');
      output += renderer.flush();

      expect(output).toContain('New Document');
      expect(output).not.toContain('partial');
    });
  });

  describe('edge cases', () => {
    it('handles markdown with no trailing newline', () => {
      let output = '';
      output += renderer.processChunk('# Title');
      output += renderer.flush();

      expect(output).toContain('Title');
    });

    it('handles consecutive headers', () => {
      let output = '';
      output += renderer.processChunk('# H1\n\n## H2\n\n### H3\n\n');
      output += renderer.flush();

      expect(output).toContain('H1');
      expect(output).toContain('H2');
      expect(output).toContain('H3');
    });

    it('handles code block followed by text without separator', () => {
      // When code block is followed by text without blank line,
      // the text is included after the code block
      let output = '';
      output += renderer.processChunk('```\ncode\n```\nText after');
      output += renderer.flush();

      expect(output).toContain('code');
      expect(output).toContain('Text after');
    });

    it('handles unicode content', () => {
      let output = '';
      output += renderer.processChunk('# Héllo Wörld 🌍\n\n');
      output += renderer.processChunk('中文文本 with **bold**.\n\n');
      output += renderer.flush();

      expect(output).toContain('Héllo');
      expect(output).toContain('Wörld');
      expect(output).toContain('🌍');
      expect(output).toContain('中文文本');
    });

    it('handles very long lines', () => {
      const longLine = 'A'.repeat(1000);
      let output = '';
      output += renderer.processChunk(`${longLine}\n\n`);
      output += renderer.flush();

      // marked-terminal reflows long text, but all characters should be present
      const contentWithoutNewlines = output.replace(/\n/g, '');
      expect(contentWithoutNewlines).toContain('A'.repeat(78)); // at least one full line
      // Total A characters should match (allowing for ANSI codes)
      const aCount = (output.match(/A/g) ?? []).length;
      expect(aCount).toBe(1000);
    });
  });

  describe('custom code highlighter', () => {
    it('accepts custom code highlighter', () => {
      const customHighlighter = (code: string, lang: string) => `[${lang}]${code}[/${lang}]`;

      const customRenderer = createBlockRenderer({ codeHighlighter: customHighlighter });

      let output = '';
      output += customRenderer.processChunk('```js\ncode\n```\n\n');
      output += customRenderer.flush();

      expect(output).toContain('[js]');
      expect(output).toContain('[/js]');
    });
  });
});
