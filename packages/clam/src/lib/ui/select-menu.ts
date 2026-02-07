/**
 * Simple select menu for terminal prompts.
 *
 * Uses raw mode input capture to bypass readline.
 * Matches Claude Code's UI style with numbered options.
 */

import pc from 'picocolors';

/**
 * An option in the select menu.
 */
export interface SelectOption {
  /** Display text */
  label: string;
  /** Value returned when selected */
  value: string;
  /** Optional hint shown after label, e.g., "(shift+tab)" */
  hint?: string;
}

/**
 * Result of a select menu interaction.
 */
export type SelectResult = { ok: true; value: string } | { ok: false; cancelled: true };

/**
 * Keys we recognize from stdin.
 */
export type KeyAction = 'up' | 'down' | 'enter' | 'escape' | 'cancel' | `select:${number}`;

/**
 * Parse a keypress buffer into an action.
 */
export function parseKeypress(data: string): KeyAction | null {
  // Arrow keys
  if (data === '\x1b[A' || data === 'k') return 'up';
  if (data === '\x1b[B' || data === 'j') return 'down';

  // Enter
  if (data === '\r' || data === '\n') return 'enter';

  // Escape (but not arrow key sequences)
  if (data === '\x1b') return 'escape';

  // Ctrl+C
  if (data === '\x03') return 'cancel';

  // Number keys 1-9
  if (data >= '1' && data <= '9') {
    const index = parseInt(data, 10) - 1;
    return `select:${index}`;
  }

  return null;
}

/**
 * Render the menu as an array of lines.
 * Does not include ANSI cursor movement - just the content.
 */
export function renderMenuLines(
  message: string,
  options: SelectOption[],
  selectedIndex: number
): string[] {
  const lines: string[] = [];

  // Message line
  lines.push(` ${message}`);

  // Option lines
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt) continue;
    const isSelected = i === selectedIndex;
    const indicator = isSelected ? pc.cyan('❯') : ' ';
    const number = `${i + 1}.`;
    const hint = opt.hint ? ` ${pc.dim(opt.hint)}` : '';
    lines.push(` ${indicator} ${number} ${opt.label}${hint}`);
  }

  return lines;
}

/**
 * Clear N lines above cursor and move cursor up.
 */
function clearLines(count: number): void {
  // Move up and clear each line
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1b[1A'); // Move up
    process.stdout.write('\x1b[2K'); // Clear line
  }
}

/**
 * Display a select menu and wait for user selection.
 *
 * @param message - The prompt message to display
 * @param options - Array of options to choose from
 * @returns The selected value, or cancelled result
 */
export async function selectMenu(message: string, options: SelectOption[]): Promise<SelectResult> {
  if (options.length === 0) {
    throw new Error('selectMenu requires at least one option');
  }

  // Non-TTY fallback
  if (!process.stdin.isTTY) {
    return selectMenuFallback(message, options);
  }

  let selectedIndex = 0;
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;

  // Render initial state
  const render = () => {
    const lines = renderMenuLines(message, options, selectedIndex);
    process.stdout.write(lines.join('\n') + '\n');
  };

  // Re-render (clear previous, draw new)
  const rerender = () => {
    clearLines(options.length + 1); // +1 for message
    render();
  };

  // Initial render
  render();

  return new Promise<SelectResult>((resolve) => {
    // Enable raw mode
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.removeListener('data', handleData);
      if (!wasRaw) {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };

    const finish = (result: SelectResult) => {
      cleanup();
      // Clear the menu after selection
      clearLines(options.length + 1);
      resolve(result);
    };

    const handleData = (data: Buffer) => {
      const key = data.toString();
      const action = parseKeypress(key);

      if (!action) return;

      switch (action) {
        case 'up':
          selectedIndex = (selectedIndex - 1 + options.length) % options.length;
          rerender();
          break;

        case 'down':
          selectedIndex = (selectedIndex + 1) % options.length;
          rerender();
          break;

        case 'enter': {
          const selected = options[selectedIndex];
          if (selected) {
            finish({ ok: true, value: selected.value });
          }
          break;
        }

        case 'escape':
        case 'cancel':
          finish({ ok: false, cancelled: true });
          break;

        default: {
          // Check for select:N
          if (action.startsWith('select:')) {
            const index = parseInt(action.slice(7), 10);
            const opt = options[index];
            if (index >= 0 && index < options.length && opt) {
              finish({ ok: true, value: opt.value });
            }
          }
          break;
        }
      }
    };

    stdin.on('data', handleData);
  });
}

/**
 * Fallback for non-TTY environments.
 * Uses simple numbered prompt.
 */
async function selectMenuFallback(message: string, options: SelectOption[]): Promise<SelectResult> {
  // Just print options and return first one for non-interactive
  console.log(message);
  for (const [i, opt] of options.entries()) {
    console.log(`  ${i + 1}. ${opt.label}`);
  }
  // In non-TTY, default to first option
  const first = options[0];
  if (!first) {
    return { ok: false, cancelled: true };
  }
  return { ok: true, value: first.value };
}
