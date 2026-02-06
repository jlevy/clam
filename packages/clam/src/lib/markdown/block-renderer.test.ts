import pc from 'picocolors';
import { describe, expect, it, beforeEach } from 'vitest';

import { createBlockRenderer } from './block-renderer.js';
import type { StreamRenderer } from './types.js';

describe('createBlockRenderer', () => {
  let renderer: StreamRenderer;

  beforeEach(() => {
    renderer = createBlockRenderer();
  });

  describe('processChunk - headers', () => {
    it('formats headers immediately after newline', () => {
      const output = renderer.processChunk('# Hello World\n\nMore text');
      // marked-terminal renders headers with styling
      expect(output).toContain('Hello World');
    });

    it('buffers incomplete headers', () => {
      const output = renderer.processChunk('# Hello World');
      expect(output).toBe('');
    });

    it('formats H2 headers', () => {
      const output = renderer.processChunk('## Sub Header\n\nNext');
      expect(output).toContain('Sub Header');
    });

    it('formats H3 headers', () => {
      const output = renderer.processChunk('### Third Header\n\nNext');
      expect(output).toContain('Third Header');
    });

    it('formats H5 headers', () => {
      const output = renderer.processChunk('##### Fifth Header\n\nNext');
      expect(output).toContain('Fifth Header');
    });
  });

  describe('processChunk - paragraphs', () => {
    it('formats paragraph at double newline', () => {
      const output = renderer.processChunk('This is a **bold** paragraph.\n\nNext paragraph');
      // marked-terminal renders bold text (content should be present)
      expect(output).toContain('bold');
      expect(output).toContain('paragraph');
    });

    it('buffers incomplete paragraphs', () => {
      const output = renderer.processChunk('This is incomplete');
      expect(output).toBe('');
    });
  });

  describe('processChunk - code fences', () => {
    it('formats code block at closing fence', () => {
      const code = '```javascript\nconsole.log("hi");\n```\n';
      const output = renderer.processChunk(code);
      // Code fences still use picocolors via cli-highlight
      expect(output).toContain(pc.gray('```'));
      expect(output).toContain(pc.gray('[javascript]'));
    });

    it('buffers unclosed code fence', () => {
      const output = renderer.processChunk('```\ncode');
      expect(output).toBe('');
    });

    it('uses custom highlighter when provided', () => {
      const customRenderer = createBlockRenderer({
        codeHighlighter: (code, lang) => `HIGHLIGHTED:${lang}:${code}`,
      });
      const output = customRenderer.processChunk('```python\nprint("hi")\n```\n');
      expect(output).toContain('HIGHLIGHTED:python:print("hi")');
    });
  });

  describe('processChunk - lists', () => {
    it('formats unordered lists', () => {
      const list = '- item 1\n- item 2\n\nNext';
      const output = renderer.processChunk(list);
      // marked-terminal renders list items with * prefix
      expect(output).toContain('item 1');
      expect(output).toContain('item 2');
    });

    it('formats ordered lists', () => {
      const list = '1. first\n2. second\n\nNext';
      const output = renderer.processChunk(list);
      expect(output).toContain('1.');
      expect(output).toContain('2.');
    });
  });

  describe('processChunk - tables', () => {
    it('formats tables with box-drawing characters', () => {
      const table = '| a | b |\n|---|---|\n| 1 | 2 |\n\nNext';
      const output = renderer.processChunk(table);
      // marked-terminal renders tables with box-drawing characters
      expect(output).toContain('a');
      expect(output).toContain('b');
      expect(output).toContain('┌'); // top-left corner
      expect(output).toContain('┐'); // top-right corner
      expect(output).toContain('└'); // bottom-left corner
      expect(output).toContain('┘'); // bottom-right corner
    });
  });

  describe('processChunk - blockquotes', () => {
    it('formats blockquotes', () => {
      const quote = '> This is a quote.\n\nNext';
      const output = renderer.processChunk(quote);
      // marked-terminal renders blockquotes with indentation and styling
      expect(output).toContain('This is a quote.');
    });
  });

  describe('streaming behavior', () => {
    it('handles chunks split across calls', () => {
      renderer.processChunk('# Hel');
      const output = renderer.processChunk('lo\n\nText');
      // marked-terminal renders the complete header
      expect(output).toContain('Hello');
    });

    it('accumulates multiple blocks', () => {
      const chunk1 = renderer.processChunk('# Title\n\n');
      const chunk2 = renderer.processChunk('Paragraph **bold**.\n\n');
      expect(chunk1).toContain('Title');
      expect(chunk2).toContain('bold');
    });
  });

  describe('flush', () => {
    it('formats remaining buffer', () => {
      renderer.processChunk('Unfinished **paragraph**');
      const output = renderer.flush();
      expect(output).toContain('paragraph');
    });

    it('handles unclosed code fence', () => {
      renderer.processChunk('```python\ncode');
      const output = renderer.flush();
      expect(output).toContain('code');
    });

    it('returns empty for empty buffer', () => {
      expect(renderer.flush()).toBe('');
    });
  });

  describe('reset', () => {
    it('clears buffer', () => {
      renderer.processChunk('buffered content');
      renderer.reset();
      expect(renderer.flush()).toBe('');
    });

    it('resets state for new stream', () => {
      renderer.processChunk('```\ncode');
      renderer.reset();
      const output = renderer.processChunk('Plain text\n\nMore');
      expect(output).toContain('Plain text');
    });
  });

  describe('inline formatting within blocks', () => {
    it('applies inline formatting in paragraphs', () => {
      const output = renderer.processChunk('Text with **bold** and *italic* and `code`.\n\nNext');
      // marked-terminal renders inline formatting (content present, styling depends on chalk)
      expect(output).toContain('bold');
      expect(output).toContain('italic');
      expect(output).toContain('code');
    });

    it('applies inline formatting in lists', () => {
      const output = renderer.processChunk('- **bold** item\n\nNext');
      expect(output).toContain('bold');
    });
  });
});
