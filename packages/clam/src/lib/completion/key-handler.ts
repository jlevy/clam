/**
 * CompletionKeyHandler - Handles keyboard input for completion navigation.
 *
 * Supported keys:
 * - Tab / ArrowDown: Select next completion
 * - Shift+Tab / ArrowUp: Select previous completion
 * - Enter: Accept selected completion
 * - Escape: Dismiss completion menu
 */

import type { CompletionMenu } from './menu.js';
import type { Completion } from './types.js';

/**
 * Key action types returned by handleKey.
 */
export enum KeyAction {
  /** Move to next completion */
  Next = 'next',
  /** Move to previous completion */
  Previous = 'previous',
  /** Accept current selection */
  Accept = 'accept',
  /** Dismiss completion menu */
  Dismiss = 'dismiss',
  /** Key not handled */
  None = 'none',
}

/**
 * Key modifiers.
 */
export interface KeyModifiers {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * CompletionKeyHandler interface.
 */
export interface CompletionKeyHandler {
  /**
   * Handle a key press. Returns the action taken.
   */
  handleKey(key: string, modifiers?: KeyModifiers): KeyAction;

  /**
   * Get the currently selected completion.
   */
  getSelectedCompletion(): Completion | null;

  /**
   * Check if the completion menu is active.
   */
  isActive(): boolean;

  /**
   * Reset/clear the completion state.
   */
  reset(): void;
}

/**
 * Create a CompletionKeyHandler that controls a CompletionMenu.
 */
export function createCompletionKeyHandler(menu: CompletionMenu): CompletionKeyHandler {
  return {
    handleKey(key: string, modifiers: KeyModifiers = {}): KeyAction {
      // Tab or Down arrow: next completion
      if (key === 'Tab' && !modifiers.shift) {
        menu.selectNext();
        return KeyAction.Next;
      }

      if (key === 'ArrowDown') {
        menu.selectNext();
        return KeyAction.Next;
      }

      // Shift+Tab or Up arrow: previous completion
      if (key === 'Tab' && modifiers.shift) {
        menu.selectPrevious();
        return KeyAction.Previous;
      }

      if (key === 'ArrowUp') {
        menu.selectPrevious();
        return KeyAction.Previous;
      }

      // Enter: accept selection
      if (key === 'Enter') {
        return KeyAction.Accept;
      }

      // Escape: dismiss menu
      if (key === 'Escape') {
        return KeyAction.Dismiss;
      }

      return KeyAction.None;
    },

    getSelectedCompletion(): Completion | null {
      return menu.getSelectedCompletion();
    },

    isActive(): boolean {
      return menu.getCompletions().length > 0;
    },

    reset(): void {
      menu.clear();
    },
  };
}
