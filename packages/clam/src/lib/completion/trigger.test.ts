import { describe, expect, it } from 'bun:test';
import { createInputState as createState, type InputMode } from '../input/state.js';
import { detectTrigger, TriggerType } from './trigger.js';

/**
 * Helper to create a minimal InputState for testing.
 */
function createInputState(rawText: string, cursorPos?: number, mode: InputMode = 'shell') {
  const pos = cursorPos ?? rawText.length;
  return createState(rawText, pos, mode, '/test');
}

describe('detectTrigger', () => {
  describe('@ entity trigger', () => {
    it('should detect @ at start of input', () => {
      const state = createInputState('@');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
      expect(result.position).toBe(0);
    });

    it('should detect @ after whitespace', () => {
      const state = createInputState('echo @');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
      expect(result.position).toBe(5);
    });

    it('should detect @ in middle of input with cursor at @', () => {
      const state = createInputState('cat @file.txt', 5);
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
    });

    it('should not detect @ in middle of word as entity trigger', () => {
      const state = createInputState('user@example.com');
      const result = detectTrigger(state);
      // @ in middle of word is not an entity trigger (e.g., email addresses)
      expect(result.type).not.toBe(TriggerType.Entity);
    });

    it('should not detect @ inside quoted string as entity trigger', () => {
      const state = createInputState('"email@test.com"');
      const result = detectTrigger(state);
      // @ inside quotes is not an entity trigger
      expect(result.type).not.toBe(TriggerType.Entity);
    });

    it('should detect @ after command with partial prefix', () => {
      const state = createInputState('cat @read');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
      expect(result.prefix).toBe('read');
    });
  });

  describe('/ slash command trigger', () => {
    it('should detect / at start of input', () => {
      const state = createInputState('/');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.SlashCommand);
      expect(result.triggered).toBe(true);
      expect(result.position).toBe(0);
    });

    it('should detect /help with prefix', () => {
      const state = createInputState('/help');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.SlashCommand);
      expect(result.triggered).toBe(true);
      expect(result.prefix).toBe('help');
    });

    it('should not detect / after other characters', () => {
      const state = createInputState('echo /dev/null');
      const result = detectTrigger(state);
      // This is a path, not a slash command
      expect(result.type).not.toBe(TriggerType.SlashCommand);
    });

    it('should not detect / in path context', () => {
      const state = createInputState('cd /usr/local');
      const result = detectTrigger(state);
      expect(result.type).not.toBe(TriggerType.SlashCommand);
    });
  });

  describe('command trigger', () => {
    it('should detect command trigger for empty input', () => {
      const state = createInputState('');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Command);
      expect(result.triggered).toBe(true);
    });

    it('should detect command trigger for partial command', () => {
      const state = createInputState('gi');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Command);
      expect(result.triggered).toBe(true);
      expect(result.prefix).toBe('gi');
    });

    it('should not trigger command completion after command is complete', () => {
      const state = createInputState('git ');
      const result = detectTrigger(state);
      // After space, we're in argument position, not command
      expect(result.type).not.toBe(TriggerType.Command);
    });
  });

  describe('argument trigger', () => {
    it('should trigger entity completion for argument position (Tab completion)', () => {
      const state = createInputState('git status');
      const result = detectTrigger(state);
      // Tab after command should trigger entity/file completion
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
      expect(result.prefix).toBe('status');
    });

    it('should trigger entity completion with empty prefix after space', () => {
      const state = createInputState('ls ');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
      expect(result.prefix).toBe('');
    });
  });

  describe('no trigger', () => {
    it('should return no trigger when cursor is in middle of word', () => {
      const state = createInputState('echo hello @', 5);
      const result = detectTrigger(state);
      // Cursor is at position 5 (middle of "hello"), not at end of word or at @
      expect(result.triggered).toBe(false);
    });
  });

  describe('chat mode', () => {
    it('should detect @ trigger in chat mode', () => {
      const state = createInputState('@', undefined, 'nl');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.Entity);
      expect(result.triggered).toBe(true);
    });

    it('should detect / trigger in chat mode', () => {
      const state = createInputState('/', undefined, 'nl');
      const result = detectTrigger(state);
      expect(result.type).toBe(TriggerType.SlashCommand);
      expect(result.triggered).toBe(true);
    });

    it('should not trigger command completion in chat mode', () => {
      const state = createInputState('gi', undefined, 'nl');
      const result = detectTrigger(state);
      // Command completion only in shell mode
      expect(result.type).not.toBe(TriggerType.Command);
    });
  });
});
