/**
 * Tests for modern tool detection.
 */

import { describe, expect, it } from 'vitest';
import {
  MODERN_TOOLS,
  detectInstalledTools,
  formatToolStatus,
  getToolDetails,
  getModernAlternatives,
} from './modern-tools.js';

describe('Modern Tools', () => {
  describe('MODERN_TOOLS', () => {
    it('should define expected tools', () => {
      const toolNames = MODERN_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('eza');
      expect(toolNames).toContain('bat');
      expect(toolNames).toContain('rg');
      expect(toolNames).toContain('zoxide');
    });

    it('should have replaces defined for most tools', () => {
      const replacers = MODERN_TOOLS.filter((t) => t.replaces);
      expect(replacers.length).toBeGreaterThan(5);
    });

    it('should have descriptions for all tools', () => {
      for (const tool of MODERN_TOOLS) {
        expect(tool.description).toBeTruthy();
      }
    });
  });

  describe('detectInstalledTools', () => {
    it('should return a map of tool availability', async () => {
      const installed = await detectInstalledTools();
      expect(installed).toBeInstanceOf(Map);
      expect(installed.size).toBe(MODERN_TOOLS.length);
    });

    it('should detect common tools like ls alternative', async () => {
      const installed = await detectInstalledTools();
      // We just check that the map has entries - actual availability depends on system
      expect(installed.has('eza')).toBe(true);
      expect(installed.has('bat')).toBe(true);
    });
  });

  describe('formatToolStatus', () => {
    it('should format tool status with check marks', () => {
      const installed = new Map([
        ['eza', true],
        ['bat', true],
        ['rg', false],
      ]);

      const status = formatToolStatus(installed);
      expect(status).toContain('Modern tools:');
      expect(status).toContain('✔ eza');
      expect(status).toContain('✔ bat');
      expect(status).toContain('✗ rg');
    });

    it('should show only installed tools when option set', () => {
      const installed = new Map([
        ['eza', true],
        ['bat', false],
        ['rg', true],
      ]);

      const status = formatToolStatus(installed, { showOnlyInstalled: true });
      expect(status).toContain('✔ eza');
      expect(status).toContain('✔ rg');
      expect(status).not.toContain('bat');
    });

    it('should return empty string when no tools match', () => {
      const installed = new Map<string, boolean>();
      const status = formatToolStatus(installed, { showOnlyInstalled: true });
      expect(status).toBe('');
    });
  });

  describe('getToolDetails', () => {
    it('should return detailed tool information', () => {
      const installed = new Map([
        ['eza', true],
        ['bat', false],
      ]);

      const details = getToolDetails(installed);
      const eza = details.find((d) => d.name === 'eza');
      const bat = details.find((d) => d.name === 'bat');

      expect(eza?.available).toBe(true);
      expect(eza?.replaces).toBe('ls');
      expect(bat?.available).toBe(false);
    });
  });

  describe('getModernAlternatives', () => {
    it('should find alternatives for ls', () => {
      const installed = new Map([
        ['eza', true],
        ['bat', true],
      ]);

      const alternatives = getModernAlternatives('ls', installed);
      expect(alternatives.length).toBe(1);
      expect(alternatives[0]?.name).toBe('eza');
    });

    it('should return empty array when no alternatives installed', () => {
      const installed = new Map([
        ['eza', false],
        ['bat', true],
      ]);

      const alternatives = getModernAlternatives('ls', installed);
      expect(alternatives.length).toBe(0);
    });

    it('should return empty array for commands with no alternatives', () => {
      const installed = new Map([
        ['eza', true],
        ['bat', true],
      ]);

      const alternatives = getModernAlternatives('vim', installed);
      expect(alternatives.length).toBe(0);
    });
  });
});
