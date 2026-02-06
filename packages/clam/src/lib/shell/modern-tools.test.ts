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
import { asAbsolutePath, type AbsolutePath } from './utils.js';

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
    it('should return a map of tool paths', async () => {
      const installed = await detectInstalledTools();
      expect(installed).toBeInstanceOf(Map);
      // Only installed tools are in the map now
    });

    it('should detect common tools like ls alternative', async () => {
      const installed = await detectInstalledTools();
      // We just check that the detection ran - actual availability depends on system
      // If eza is installed, it will be in the map with its path
      if (installed.has('eza')) {
        expect(installed.get('eza')).toMatch(/eza/);
      }
    });
  });

  describe('formatToolStatus', () => {
    it('should format tool status with check marks', () => {
      const installed = new Map<string, AbsolutePath>([
        ['eza', asAbsolutePath('/usr/bin/eza')],
        ['bat', asAbsolutePath('/usr/bin/bat')],
        // 'rg' not installed - not in map
      ]);

      const status = formatToolStatus(installed);
      expect(status).toContain('Found tools:');
      expect(status).toContain('✔ eza');
      expect(status).toContain('✔ bat');
      expect(status).toContain('✗ rg');
    });

    it('should show only installed tools when option set', () => {
      const installed = new Map<string, AbsolutePath>([
        ['eza', asAbsolutePath('/usr/bin/eza')],
        ['rg', asAbsolutePath('/usr/bin/rg')],
        // 'bat' not installed - not in map
      ]);

      const status = formatToolStatus(installed, { showOnlyInstalled: true });
      expect(status).toContain('✔ eza');
      expect(status).toContain('✔ rg');
      expect(status).not.toContain('bat');
    });

    it('should return empty string when no tools match', () => {
      const installed = new Map<string, AbsolutePath>();
      const status = formatToolStatus(installed, { showOnlyInstalled: true });
      expect(status).toBe('');
    });
  });

  describe('getToolDetails', () => {
    it('should return detailed tool information', () => {
      const installed = new Map<string, AbsolutePath>([
        ['eza', asAbsolutePath('/usr/bin/eza')],
        // 'bat' not installed
      ]);

      const details = getToolDetails(installed);
      const eza = details.find((d) => d.name === 'eza');
      const bat = details.find((d) => d.name === 'bat');

      expect(eza?.available).toBe(true);
      expect(eza?.path).toBe('/usr/bin/eza');
      expect(eza?.replaces).toBe('ls');
      expect(bat?.available).toBe(false);
      expect(bat?.path).toBeUndefined();
    });
  });

  describe('getModernAlternatives', () => {
    it('should find alternatives for ls', () => {
      const installed = new Map<string, AbsolutePath>([
        ['eza', asAbsolutePath('/usr/bin/eza')],
        ['bat', asAbsolutePath('/usr/bin/bat')],
      ]);

      const alternatives = getModernAlternatives('ls', installed);
      expect(alternatives.length).toBe(1);
      expect(alternatives[0]?.name).toBe('eza');
    });

    it('should return empty array when no alternatives installed', () => {
      const installed = new Map<string, AbsolutePath>([
        // 'eza' not installed
        ['bat', asAbsolutePath('/usr/bin/bat')],
      ]);

      const alternatives = getModernAlternatives('ls', installed);
      expect(alternatives.length).toBe(0);
    });

    it('should return empty array for commands with no alternatives', () => {
      const installed = new Map<string, AbsolutePath>([
        ['eza', asAbsolutePath('/usr/bin/eza')],
        ['bat', asAbsolutePath('/usr/bin/bat')],
      ]);

      const alternatives = getModernAlternatives('vim', installed);
      expect(alternatives.length).toBe(0);
    });
  });
});
