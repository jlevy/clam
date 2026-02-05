/**
 * CompletionIntegration - Wires the completion system into the InputReader.
 *
 * This module orchestrates:
 * - InputState management
 * - CompletionManager coordination
 * - Menu rendering and keyboard navigation
 * - Terminal output (with scrollback protection)
 */

import { CompletionManager } from './manager.js';
import { CompletionMenu } from './menu.js';
import { createCompletionKeyHandler, KeyAction, type KeyModifiers } from './key-handler.js';
import { detectTrigger } from './trigger.js';
import { createCommandCompleter } from './completers/command-completer.js';
import { createSlashCompleter } from './completers/slash-completer.js';
import { createEntityCompleter } from './completers/entity-completer.js';
import { wrapMenuRender, clearMenu } from './terminal.js';
import { createInputState, type InputMode } from '../input/state.js';
import { updateInputStateWithTokens } from '../input/parser.js';
import type { Completion } from './types.js';

/**
 * Options for the completion integration.
 */
export interface CompletionIntegrationOptions {
  /** Maximum completions to show in menu */
  maxVisible?: number;
  /** Whether to enable command completion */
  enableCommands?: boolean;
  /** Whether to enable slash command completion */
  enableSlashCommands?: boolean;
  /** Whether to enable entity (@) completion */
  enableEntities?: boolean;
  /** Current working directory */
  cwd?: string;
}

/**
 * State of the completion UI.
 */
export interface CompletionState {
  /** Whether completion menu is visible */
  isVisible: boolean;
  /** Number of lines currently shown */
  menuLines: number;
  /** Currently selected completion */
  selected: Completion | null;
  /** All current completions */
  completions: Completion[];
}

/**
 * Result of handling a keypress.
 */
export interface KeypressResult {
  /** Whether the key was handled by completion system */
  handled: boolean;
  /** Text to insert (if a completion was accepted) */
  insertText?: string;
  /** Whether to suppress the default keypress behavior */
  suppress?: boolean;
}

/**
 * CompletionIntegration handles all completion interactions.
 */
export class CompletionIntegration {
  private manager: CompletionManager;
  private menu: CompletionMenu;
  private keyHandler: ReturnType<typeof createCompletionKeyHandler>;
  private options: CompletionIntegrationOptions;
  private menuLinesShown = 0;
  private lastInput = '';
  private cwd: string;

  constructor(options: CompletionIntegrationOptions = {}) {
    this.options = {
      maxVisible: 8,
      enableCommands: true,
      enableSlashCommands: true,
      enableEntities: true,
      cwd: process.cwd(),
      ...options,
    };
    this.cwd = this.options.cwd ?? process.cwd();

    // Initialize components
    this.manager = new CompletionManager();
    this.menu = new CompletionMenu();
    this.keyHandler = createCompletionKeyHandler(this.menu);

    // Register completers based on options
    if (this.options.enableCommands) {
      this.manager.registerCompleter(createCommandCompleter());
    }
    if (this.options.enableSlashCommands) {
      this.manager.registerCompleter(createSlashCompleter());
    }
    if (this.options.enableEntities) {
      this.manager.registerCompleter(createEntityCompleter());
    }
  }

  /**
   * Update completions based on current input.
   * Call this on each keystroke (debounced in practice).
   */
  async updateCompletions(rawText: string, cursorPos: number, mode: InputMode): Promise<void> {
    this.lastInput = rawText;

    // Create InputState
    const state = updateInputStateWithTokens(createInputState(rawText, cursorPos, mode, this.cwd));

    // Check for triggers
    const trigger = detectTrigger(state);

    if (!trigger.triggered) {
      // No trigger - clear menu
      this.menu.clear();
      return;
    }

    // Get completions from manager
    const completions = await this.manager.getCompletions(state, {
      maxResults: 50,
      timeout: 100, // Fast timeout for responsive UI
    });

    // Update menu
    this.menu.setCompletions(completions);
  }

  /**
   * Handle a keypress event.
   * Returns information about how the key was handled.
   */
  handleKeypress(key: string, modifiers: KeyModifiers = {}): KeypressResult {
    // If menu isn't active, don't handle
    if (!this.keyHandler.isActive()) {
      return { handled: false };
    }

    const action = this.keyHandler.handleKey(key, modifiers);

    switch (action) {
      case KeyAction.Next:
      case KeyAction.Previous:
        // Navigation handled, suppress default
        return { handled: true, suppress: true };

      case KeyAction.Accept: {
        // Accept the selected completion
        const selected = this.keyHandler.getSelectedCompletion();
        if (selected) {
          this.keyHandler.reset();
          return {
            handled: true,
            suppress: true,
            insertText: selected.value,
          };
        }
        return { handled: false };
      }

      case KeyAction.Dismiss:
        // Escape pressed - dismiss menu
        this.keyHandler.reset();
        return { handled: true, suppress: true };

      default:
        return { handled: false };
    }
  }

  /**
   * Render the completion menu.
   * Returns the ANSI string to output, or empty if no menu to show.
   */
  renderMenu(): string {
    if (!this.keyHandler.isActive()) {
      return '';
    }

    const content = this.menu.render({
      maxVisible: this.options.maxVisible,
      valueWidth: 25,
    });

    if (!content) {
      return '';
    }

    const lineCount = content.split('\n').length;
    this.menuLinesShown = lineCount;

    return wrapMenuRender(content, lineCount);
  }

  /**
   * Get string to clear the current menu.
   */
  clearMenuOutput(): string {
    if (this.menuLinesShown === 0) {
      return '';
    }

    const output = clearMenu(this.menuLinesShown);
    this.menuLinesShown = 0;
    return output;
  }

  /**
   * Check if completion menu is currently active.
   */
  isActive(): boolean {
    return this.keyHandler.isActive();
  }

  /**
   * Get current completion state for external use.
   */
  getState(): CompletionState {
    return {
      isVisible: this.keyHandler.isActive(),
      menuLines: this.menuLinesShown,
      selected: this.keyHandler.getSelectedCompletion(),
      completions: this.menu.getCompletions(),
    };
  }

  /**
   * Reset/clear the completion state.
   */
  reset(): void {
    this.keyHandler.reset();
    this.menuLinesShown = 0;
    this.lastInput = '';
  }

  /**
   * Update the working directory.
   */
  setCwd(cwd: string): void {
    this.cwd = cwd;
  }
}

/**
 * Create a completion integration instance.
 */
export function createCompletionIntegration(
  options: CompletionIntegrationOptions = {}
): CompletionIntegration {
  return new CompletionIntegration(options);
}
