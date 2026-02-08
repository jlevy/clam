/**
 * Tests for prompts module.
 */

import { describe, expect, it } from 'bun:test';
import { formatPromptWithContext } from './prompts.js';

describe('formatPromptWithContext', () => {
  it('includes simple working directory when session and user cwd match', () => {
    const result = formatPromptWithContext('hello', {
      sessionCwd: '/home/user/project',
      userCwd: '/home/user/project',
    });

    expect(result).toContain('[Working directory: /home/user/project]');
    expect(result).toContain('hello');
    expect(result).not.toContain("User's cwd");
  });

  it('includes both cwds when they differ', () => {
    const result = formatPromptWithContext('what files are here?', {
      sessionCwd: '/home/user/project',
      userCwd: '/home/user/project/src',
    });

    expect(result).toContain('Your cwd: /home/user/project');
    expect(result).toContain("User's cwd: /home/user/project/src");
    expect(result).toContain('relative to their cwd');
    expect(result).toContain('what files are here?');
  });

  it('preserves multi-line user input', () => {
    const multiLineInput = `First line
Second line
Third line`;

    const result = formatPromptWithContext(multiLineInput, {
      sessionCwd: '/home/user',
      userCwd: '/home/user',
    });

    expect(result).toContain('First line');
    expect(result).toContain('Second line');
    expect(result).toContain('Third line');
  });
});
