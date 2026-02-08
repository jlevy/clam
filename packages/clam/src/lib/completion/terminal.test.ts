import { describe, expect, it } from 'bun:test';
import {
  ANSI,
  clearLine,
  clearMenu,
  clearToEndOfLine,
  hideCursor,
  moveDown,
  moveUp,
  restoreCursor,
  saveCursor,
  showCursor,
  wrapMenuRender,
} from './terminal.js';

describe('terminal utilities', () => {
  describe('ANSI constants', () => {
    it('should have correct save cursor sequence', () => {
      expect(ANSI.SAVE_CURSOR).toBe('\x1b[s');
    });

    it('should have correct restore cursor sequence', () => {
      expect(ANSI.RESTORE_CURSOR).toBe('\x1b[u');
    });

    it('should have correct hide cursor sequence', () => {
      expect(ANSI.HIDE_CURSOR).toBe('\x1b[?25l');
    });

    it('should have correct show cursor sequence', () => {
      expect(ANSI.SHOW_CURSOR).toBe('\x1b[?25h');
    });

    it('should have correct clear line sequence', () => {
      expect(ANSI.CLEAR_LINE).toBe('\x1b[2K');
    });

    it('should have correct clear to end sequence', () => {
      expect(ANSI.CLEAR_TO_END).toBe('\x1b[K');
    });
  });

  describe('cursor functions', () => {
    it('saveCursor should return save sequence', () => {
      expect(saveCursor()).toBe('\x1b[s');
    });

    it('restoreCursor should return restore sequence', () => {
      expect(restoreCursor()).toBe('\x1b[u');
    });

    it('hideCursor should return hide sequence', () => {
      expect(hideCursor()).toBe('\x1b[?25l');
    });

    it('showCursor should return show sequence', () => {
      expect(showCursor()).toBe('\x1b[?25h');
    });
  });

  describe('line clearing functions', () => {
    it('clearLine should return clear line sequence', () => {
      expect(clearLine()).toBe('\x1b[2K');
    });

    it('clearToEndOfLine should return clear to end sequence', () => {
      expect(clearToEndOfLine()).toBe('\x1b[K');
    });
  });

  describe('cursor movement', () => {
    it('moveUp should move cursor up n lines', () => {
      expect(moveUp(1)).toBe('\x1b[1A');
      expect(moveUp(5)).toBe('\x1b[5A');
    });

    it('moveDown should move cursor down n lines', () => {
      expect(moveDown(1)).toBe('\x1b[1B');
      expect(moveDown(3)).toBe('\x1b[3B');
    });

    it('moveUp with 0 should return empty', () => {
      expect(moveUp(0)).toBe('');
    });

    it('moveDown with 0 should return empty', () => {
      expect(moveDown(0)).toBe('');
    });
  });

  describe('wrapMenuRender', () => {
    it('should wrap content with save/restore cursor', () => {
      const menuContent = 'line1\nline2\nline3';
      const wrapped = wrapMenuRender(menuContent, 3);

      // Should contain save at start
      expect(wrapped.startsWith('\x1b[s')).toBe(true);

      // Should contain the menu content
      expect(wrapped).toContain('line1');
      expect(wrapped).toContain('line2');
      expect(wrapped).toContain('line3');

      // Should contain restore at end
      expect(wrapped.endsWith('\x1b[u')).toBe(true);
    });

    it('should hide cursor during render when hidesDuringRender is true', () => {
      const menuContent = 'item';
      const wrapped = wrapMenuRender(menuContent, 1, { hideCursorDuringRender: true });

      // Should hide cursor after save
      expect(wrapped).toContain('\x1b[?25l');
      // Should show cursor before restore
      expect(wrapped).toContain('\x1b[?25h');
    });

    it('should return empty string for empty content', () => {
      expect(wrapMenuRender('', 0)).toBe('');
    });
  });

  describe('clearMenu', () => {
    it('should generate clear sequence for menu lines', () => {
      const clearSeq = clearMenu(3);

      // Should clear each of 3 lines
      // eslint-disable-next-line no-control-regex
      const clearLineCount = (clearSeq.match(/\x1b\[2K/g) ?? []).length;
      expect(clearLineCount).toBe(3);
    });

    it('should move up and clear each line', () => {
      const clearSeq = clearMenu(2);

      // Contains move up sequences
      expect(clearSeq).toContain('\x1b[1A');
      // Contains clear line sequences
      expect(clearSeq).toContain('\x1b[2K');
    });

    it('should return empty string for 0 lines', () => {
      expect(clearMenu(0)).toBe('');
    });
  });
});
