/**
 * CompletionMenu - ANSI-styled completion menu renderer.
 *
 * Renders a dropdown-style completion menu with:
 * - Highlighted selection
 * - Icons for different completion types
 * - Descriptions (dimmed)
 * - Configurable visible count
 */

import pc from 'picocolors';
import type { Completion } from './types.js';

/**
 * Options for rendering the completion menu.
 */
export interface MenuRenderOptions {
  /** Maximum items visible at once (default: 10) */
  maxVisible?: number;

  /** Width for the value column (default: 30) */
  valueWidth?: number;
}

/**
 * Default maximum visible items.
 */
const DEFAULT_MAX_VISIBLE = 10;

/**
 * Default value column width.
 */
const DEFAULT_VALUE_WIDTH = 30;

/**
 * Render a single completion item.
 *
 * Format: [marker][icon] value    description
 *
 * @param completion - The completion to render
 * @param selected - Whether this item is selected
 * @param valueWidth - Width for the value column
 */
export function renderCompletionItem(
  completion: Completion,
  selected: boolean,
  valueWidth: number = DEFAULT_VALUE_WIDTH
): string {
  const displayText = completion.display ?? completion.value;
  const icon = completion.icon ? `${completion.icon} ` : '  ';
  const description = completion.description ? ` ${pc.dim(completion.description)}` : '';

  // Selection marker (> for selected, space for not)
  const marker = selected ? '> ' : '  ';

  // Pad value to align descriptions
  const paddedValue = displayText.padEnd(valueWidth);

  const line = `${marker}${icon}${paddedValue}${description}`;

  if (selected) {
    // Use inverse for selection highlight (visible in TTY)
    return pc.inverse(line);
  }

  return line;
}

/**
 * Render a completion menu with multiple items.
 *
 * @param completions - Array of completions to display
 * @param selectedIndex - Currently selected index
 * @param options - Render options
 */
export function renderCompletionMenu(
  completions: Completion[],
  selectedIndex: number,
  options: MenuRenderOptions = {}
): string {
  if (completions.length === 0) {
    return '';
  }

  const { maxVisible = DEFAULT_MAX_VISIBLE, valueWidth = DEFAULT_VALUE_WIDTH } = options;

  // Calculate visible window (scroll if needed)
  const visibleCount = Math.min(completions.length, maxVisible);
  const halfVisible = Math.floor(visibleCount / 2);

  let startIndex = 0;
  if (completions.length > maxVisible) {
    // Center the selection in the visible window
    startIndex = Math.max(0, selectedIndex - halfVisible);
    startIndex = Math.min(startIndex, completions.length - visibleCount);
  }

  const visibleCompletions = completions.slice(startIndex, startIndex + visibleCount);

  const lines = visibleCompletions.map((completion, i) => {
    const actualIndex = startIndex + i;
    return renderCompletionItem(completion, actualIndex === selectedIndex, valueWidth);
  });

  return lines.join('\n');
}

/**
 * CompletionMenu - Stateful menu component.
 *
 * Manages completion list and selection state for keyboard navigation.
 */
export class CompletionMenu {
  private completions: Completion[] = [];
  private selectedIndex = 0;

  /**
   * Set the completions to display.
   * Resets selection to first item.
   */
  setCompletions(completions: Completion[]): void {
    this.completions = completions;
    this.selectedIndex = 0;
  }

  /**
   * Get current completions.
   */
  getCompletions(): Completion[] {
    return this.completions;
  }

  /**
   * Get the selected index.
   */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * Get the currently selected completion.
   */
  getSelectedCompletion(): Completion | null {
    return this.completions[this.selectedIndex] ?? null;
  }

  /**
   * Select the next item (wraps around).
   */
  selectNext(): void {
    if (this.completions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.completions.length;
  }

  /**
   * Select the previous item (wraps around).
   */
  selectPrevious(): void {
    if (this.completions.length === 0) return;
    this.selectedIndex =
      (this.selectedIndex - 1 + this.completions.length) % this.completions.length;
  }

  /**
   * Clear completions and reset state.
   */
  clear(): void {
    this.completions = [];
    this.selectedIndex = 0;
  }

  /**
   * Render the menu.
   */
  render(options: MenuRenderOptions = {}): string {
    return renderCompletionMenu(this.completions, this.selectedIndex, options);
  }
}
