import { describe, it, expect } from 'vitest';
import {
  RECOMMENDED_COMMANDS,
  isRecommendedCommand,
  getCommandCategory,
} from './recommended-commands.js';

describe('Recommended Commands', () => {
  describe('RECOMMENDED_COMMANDS', () => {
    it('should have common development commands', () => {
      expect(RECOMMENDED_COMMANDS).toContain('git');
      expect(RECOMMENDED_COMMANDS).toContain('npm');
      expect(RECOMMENDED_COMMANDS).toContain('node');
    });

    it('should have common shell commands', () => {
      expect(RECOMMENDED_COMMANDS).toContain('ls');
      expect(RECOMMENDED_COMMANDS).toContain('cd');
      expect(RECOMMENDED_COMMANDS).toContain('cat');
    });

    it('should have network tools', () => {
      expect(RECOMMENDED_COMMANDS).toContain('curl');
      expect(RECOMMENDED_COMMANDS).toContain('ssh');
    });

    it('should be a frozen set for performance', () => {
      expect(Object.isFrozen(RECOMMENDED_COMMANDS)).toBe(true);
    });
  });

  describe('isRecommendedCommand', () => {
    it('should return true for recommended commands', () => {
      expect(isRecommendedCommand('git')).toBe(true);
      expect(isRecommendedCommand('npm')).toBe(true);
    });

    it('should return false for non-recommended commands', () => {
      expect(isRecommendedCommand('nonexistent')).toBe(false);
      expect(isRecommendedCommand('randomcmd')).toBe(false);
    });
  });

  describe('getCommandCategory', () => {
    it('should return version-control for git', () => {
      expect(getCommandCategory('git')).toBe('version-control');
    });

    it('should return package-manager for npm/pnpm/yarn', () => {
      expect(getCommandCategory('npm')).toBe('package-manager');
      expect(getCommandCategory('pnpm')).toBe('package-manager');
      expect(getCommandCategory('yarn')).toBe('package-manager');
    });

    it('should return shell for basic commands', () => {
      expect(getCommandCategory('ls')).toBe('shell');
      expect(getCommandCategory('cd')).toBe('shell');
    });

    it('should return other for unknown commands', () => {
      expect(getCommandCategory('unknowncmd')).toBe('other');
    });
  });
});
