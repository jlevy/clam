/**
 * Tests for configuration module.
 */

import { homedir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { formatConfig, getConfigDir, getConfigPath, getHistoryPath, loadConfig } from './config.js';

describe('getConfigDir', () => {
  it('should return path under home directory', () => {
    const configDir = getConfigDir();
    expect(configDir).toContain(homedir());
    expect(configDir).toContain('.clam');
    expect(configDir).toContain('code');
  });
});

describe('getConfigPath', () => {
  it('should return path under config directory', () => {
    const configPath = getConfigPath('test.json');
    expect(configPath).toContain('.clam');
    expect(configPath).toContain('code');
    expect(configPath).toContain('test.json');
  });
});

describe('getHistoryPath', () => {
  it('should return path for history file', () => {
    const historyPath = getHistoryPath();
    expect(historyPath).toContain('.clam');
    expect(historyPath).toContain('code');
    expect(historyPath).toContain('history');
  });
});

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  it('should return valid config when no config file exists', () => {
    const config = loadConfig('/nonexistent/path');
    // Just verify we get a valid config object with expected properties
    expect(config.truncateAfter).toBeGreaterThan(0);
    expect(typeof config.showTimestamps).toBe('boolean');
    expect(typeof config.verbose).toBe('boolean');
  });

  it('should respect CLAM_CODE_VERBOSE environment variable', () => {
    process.env.CLAM_CODE_VERBOSE = '1';
    const config = loadConfig('/nonexistent/path');
    expect(config.verbose).toBe(true);
  });

  it('should respect CLAM_CODE_SHOW_TIMESTAMPS environment variable', () => {
    process.env.CLAM_CODE_SHOW_TIMESTAMPS = '1';
    const config = loadConfig('/nonexistent/path');
    expect(config.showTimestamps).toBe(true);
  });

  it('should respect CLAM_CODE_TRUNCATE_AFTER environment variable', () => {
    process.env.CLAM_CODE_TRUNCATE_AFTER = '20';
    const config = loadConfig('/nonexistent/path');
    expect(config.truncateAfter).toBe(20);
  });

  it('should ignore invalid CLAM_CODE_TRUNCATE_AFTER values', () => {
    process.env.CLAM_CODE_TRUNCATE_AFTER = 'invalid';
    const config = loadConfig('/nonexistent/path');
    expect(config.truncateAfter).toBeGreaterThan(0); // falls back to valid default
  });

  it('should ignore zero CLAM_CODE_TRUNCATE_AFTER', () => {
    process.env.CLAM_CODE_TRUNCATE_AFTER = '0';
    const config = loadConfig('/nonexistent/path');
    expect(config.truncateAfter).toBeGreaterThan(0); // 0 is invalid, uses default
  });

  it('should respect CLAM_CODE_AGENT_COMMAND environment variable', () => {
    process.env.CLAM_CODE_AGENT_COMMAND = 'custom-agent';
    const config = loadConfig('/nonexistent/path');
    expect(config.agentCommand).toBe('custom-agent');
  });
});

describe('formatConfig', () => {
  it('should format config with all values', () => {
    const config = {
      cwd: '/test/path',
      truncateAfter: 15,
      showTimestamps: true,
      verbose: true,
      agentCommand: 'custom-agent',
    };

    const lines = formatConfig(config);

    expect(lines.some((l) => l.includes('/test/path'))).toBe(true);
    expect(lines.some((l) => l.includes('15'))).toBe(true);
    expect(lines.some((l) => l.includes('true'))).toBe(true);
    expect(lines.some((l) => l.includes('custom-agent'))).toBe(true);
  });

  it('should use defaults when values are undefined', () => {
    const config = {};
    const lines = formatConfig(config);

    expect(lines.some((l) => l.includes('truncateAfter'))).toBe(true);
    expect(lines.some((l) => l.includes('showTimestamps'))).toBe(true);
    expect(lines.some((l) => l.includes('verbose'))).toBe(true);
  });

  it('should include configDir in output', () => {
    const lines = formatConfig({});
    expect(lines.some((l) => l.includes('configDir'))).toBe(true);
  });
});
