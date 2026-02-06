import { describe, expect, it, beforeEach } from 'vitest';

import { createBlockDetector } from './block-detector.js';

describe('createBlockDetector', () => {
  let detector: ReturnType<typeof createBlockDetector>;

  beforeEach(() => {
    detector = createBlockDetector();
  });

  describe('detectBlockType', () => {
    it('detects headers', () => {
      expect(detector.detectBlockType('# Header')).toBe('header');
      expect(detector.detectBlockType('## Sub Header')).toBe('header');
      expect(detector.detectBlockType('###### Deep Header')).toBe('header');
    });

    it('detects code fences', () => {
      expect(detector.detectBlockType('```javascript')).toBe('code_fence');
      expect(detector.detectBlockType('```')).toBe('code_fence');
    });

    it('detects tables', () => {
      expect(detector.detectBlockType('| col1 | col2 |')).toBe('table');
    });

    it('detects unordered lists', () => {
      expect(detector.detectBlockType('- item')).toBe('list');
      expect(detector.detectBlockType('* item')).toBe('list');
    });

    it('detects ordered lists', () => {
      expect(detector.detectBlockType('1. item')).toBe('list');
      expect(detector.detectBlockType('10. item')).toBe('list');
    });

    it('detects blockquotes', () => {
      expect(detector.detectBlockType('> quote')).toBe('blockquote');
      expect(detector.detectBlockType('>quote')).toBe('blockquote');
    });

    it('detects paragraphs as default', () => {
      expect(detector.detectBlockType('plain text')).toBe('paragraph');
    });

    it('returns null for empty text', () => {
      expect(detector.detectBlockType('')).toBe(null);
      expect(detector.detectBlockType('   ')).toBe(null);
    });
  });

  describe('findBoundary - headers', () => {
    it('finds header boundary at newline', () => {
      const boundary = detector.findBoundary('# Header\nNext line');
      expect(boundary).toEqual({
        index: 9,
        type: 'header',
      });
    });

    it('returns null for incomplete header', () => {
      const boundary = detector.findBoundary('# Header without newline');
      expect(boundary).toBe(null);
    });
  });

  describe('findBoundary - code fences', () => {
    it('finds code fence boundary at closing fence', () => {
      const code = '```javascript\nconsole.log("hi");\n```\n';
      const boundary = detector.findBoundary(code);
      expect(boundary).toEqual({
        index: code.length,
        type: 'code_fence',
        language: 'javascript',
      });
    });

    it('returns null for unclosed code fence', () => {
      const boundary = detector.findBoundary('```\ncode here');
      expect(boundary).toBe(null);
    });
  });

  describe('findBoundary - paragraphs', () => {
    it('finds paragraph boundary at double newline', () => {
      const text = 'First paragraph.\n\nSecond paragraph.';
      const boundary = detector.findBoundary(text);
      // "First paragraph." (16) + "\n\n" (2) = 18
      expect(boundary).toEqual({
        index: 18,
        type: 'paragraph',
      });
    });

    it('returns null for single newline', () => {
      const boundary = detector.findBoundary('Single line\nAnother line');
      expect(boundary).toBe(null);
    });
  });

  describe('findBoundary - tables', () => {
    it('finds table boundary at blank line', () => {
      const table = '| a | b |\n| c | d |\n\nNext';
      detector.enterBlock('table');
      const boundary = detector.findBoundary(table);
      expect(boundary?.type).toBe('table');
    });
  });

  describe('findBoundary - lists', () => {
    it('finds unordered list boundary at blank line', () => {
      const list = '- item 1\n- item 2\n\nParagraph';
      detector.enterBlock('list');
      detector.setListType('unordered');
      const boundary = detector.findBoundary(list);
      expect(boundary?.type).toBe('list');
    });

    it('finds ordered list boundary at blank line', () => {
      const list = '1. item 1\n2. item 2\n\nParagraph';
      detector.enterBlock('list');
      detector.setListType('ordered');
      const boundary = detector.findBoundary(list);
      expect(boundary?.type).toBe('list');
    });
  });

  describe('findBoundary - blockquotes', () => {
    it('finds blockquote boundary at non-quote line', () => {
      const quote = '> line 1\n> line 2\n\nNormal';
      detector.enterBlock('blockquote');
      const boundary = detector.findBoundary(quote);
      expect(boundary?.type).toBe('blockquote');
    });
  });

  describe('state management', () => {
    it('tracks code fence state', () => {
      expect(detector.getState()).toBe('normal');
      detector.enterBlock('code_fence', 'python');
      expect(detector.getState()).toBe('in_code_fence');
      expect(detector.getCodeLanguage()).toBe('python');
      detector.exitBlock();
      expect(detector.getState()).toBe('normal');
    });

    it('resets state correctly', () => {
      detector.enterBlock('code_fence', 'rust');
      detector.reset();
      expect(detector.getState()).toBe('normal');
      expect(detector.getCodeLanguage()).toBe('');
    });
  });
});
