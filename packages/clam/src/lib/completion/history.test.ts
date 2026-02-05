import { beforeEach, describe, expect, it } from 'bun:test';
import {
  createHistoryProvider,
  extractCommand,
  type HistoryProviderOptions,
  parseHistoryFile,
  parseHistoryLine,
} from './history.js';

describe('history', () => {
  describe('parseHistoryLine', () => {
    it('should parse simple bash history line', () => {
      const result = parseHistoryLine('git status');
      expect(result).toBe('git status');
    });

    it('should handle lines with leading spaces', () => {
      const result = parseHistoryLine('  git status');
      expect(result).toBe('git status');
    });

    it('should handle zsh extended format with timestamp', () => {
      // zsh format: : timestamp:0;command
      const result = parseHistoryLine(': 1707123456:0;git push');
      expect(result).toBe('git push');
    });

    it('should return null for empty lines', () => {
      expect(parseHistoryLine('')).toBeNull();
      expect(parseHistoryLine('   ')).toBeNull();
    });

    it('should return null for comment lines', () => {
      expect(parseHistoryLine('# comment')).toBeNull();
    });
  });

  describe('extractCommand', () => {
    it('should extract first word as command', () => {
      expect(extractCommand('git status')).toBe('git');
      expect(extractCommand('ls -la /tmp')).toBe('ls');
    });

    it('should handle commands with pipes', () => {
      expect(extractCommand('cat file | grep text')).toBe('cat');
    });

    it('should handle commands with redirects', () => {
      expect(extractCommand('echo hello > file.txt')).toBe('echo');
    });

    it('should handle commands with environment variables', () => {
      expect(extractCommand('NODE_ENV=prod node app.js')).toBe('NODE_ENV=prod');
    });

    it('should return empty for empty input', () => {
      expect(extractCommand('')).toBe('');
    });
  });

  describe('parseHistoryFile', () => {
    it('should parse multiple history lines', () => {
      const content = `git status
git add .
git commit -m "test"
npm test`;

      const entries = parseHistoryFile(content);

      expect(entries).toHaveLength(4);
      expect(entries[0]?.command).toBe('git status');
      expect(entries[3]?.command).toBe('npm test');
    });

    it('should skip empty lines and comments', () => {
      const content = `git status

# comment
git push`;

      const entries = parseHistoryFile(content);

      expect(entries).toHaveLength(2);
      expect(entries[0]?.command).toBe('git status');
      expect(entries[1]?.command).toBe('git push');
    });

    it('should assign timestamps to entries', () => {
      const content = 'git status\ngit push';
      const entries = parseHistoryFile(content);

      // Each entry should have a timestamp
      expect(entries[0]?.timestamp).toBeInstanceOf(Date);
      expect(entries[1]?.timestamp).toBeInstanceOf(Date);
    });

    it('should limit to maxEntries', () => {
      const content = Array(100).fill('cmd').join('\n');
      const entries = parseHistoryFile(content, 10);

      expect(entries).toHaveLength(10);
    });
  });

  describe('createHistoryProvider', () => {
    let provider: ReturnType<typeof createHistoryProvider>;
    let options: HistoryProviderOptions;

    beforeEach(() => {
      options = {
        maxEntries: 100,
        maxAge: 3600000, // 1 hour
      };
      provider = createHistoryProvider(options);
    });

    it('should add entries to history', () => {
      provider.add('git status');
      const entries = provider.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]?.command).toBe('git status');
    });

    it('should limit entries to maxEntries', () => {
      for (let i = 0; i < 150; i++) {
        provider.add(`cmd${i}`);
      }

      const entries = provider.getEntries();
      expect(entries.length).toBeLessThanOrEqual(100);
    });

    it('should get recent entries only', () => {
      provider.add('recent');
      const entries = provider.getRecent(1);

      expect(entries).toHaveLength(1);
      expect(entries[0]?.command).toBe('recent');
    });

    it('should clear history', () => {
      provider.add('git status');
      provider.clear();

      expect(provider.getEntries()).toHaveLength(0);
    });
  });
});
