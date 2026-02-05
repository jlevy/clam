/**
 * Completion types - Types for the unified completion system.
 *
 * This module defines the core types used by completers and the CompletionManager.
 */

import type { InputState } from '../input/state.js';

/**
 * A single completion item returned by a completer.
 */
export interface Completion {
  /** The value to insert when this completion is accepted */
  value: string;

  /** Display text (if different from value) */
  display?: string;

  /** Short description shown next to the completion */
  description?: string;

  /** Priority group for ranking (lower = higher priority) */
  group: CompletionGroup;

  /** Score within group (0-100, higher = better match) */
  score: number;

  /** Which completer produced this completion */
  source: string;

  /** Icon/prefix for display (unicode character) */
  icon?: string;

  /** If true, replace entire input (not just current token) */
  replaceInput?: boolean;
}

/**
 * Priority groups for completion ranking.
 *
 * Completions are sorted by group first (ascending), then by score within group (descending).
 * Lower group number = higher priority.
 *
 * Ported from kash's CompletionGroup enum.
 */
export enum CompletionGroup {
  /** Highest priority (e.g., exact matches, top suggestions) */
  TopSuggestion = 0,

  /** Internal commands (slash commands) */
  InternalCommand = 1,

  /** Shell builtins (cd, echo, etc.) */
  Builtin = 2,

  /** Highly recommended commands from curated list */
  RecommendedCommand = 3,

  /** Commands found on PATH but not in recommended list */
  OtherCommand = 4,

  /** Local files and directories */
  File = 5,

  /** Git branches, remotes, etc. */
  GitRef = 6,

  /** Entity references (@ mentions) */
  Entity = 7,

  /** Lowest priority (catch-all) */
  Other = 8,
}

/**
 * Monochrome unicode icons for visual distinction in completion menus.
 *
 * Following kash conventions for consistency.
 */
export const COMPLETION_ICONS = {
  /** Shell commands */
  command: '\u25b8', // ▸

  /** Internal/slash commands */
  internal: '\u2318', // ⌘

  /** Files */
  file: '\u25a1', // □

  /** Directories */
  directory: '\u25a0', // ■

  /** Entity references */
  entity: '\u0040', // @

  /** Git references */
  git: '\u2442', // ⑂
} as const;

/**
 * A completer generates completions for a specific type of input.
 *
 * Completers receive the full InputState and use it to:
 * 1. Decide if they're relevant (isRelevant)
 * 2. Generate completions based on state properties
 *
 * The CompletionManager orchestrates multiple completers, running only those
 * that are relevant for the current input state.
 */
export interface Completer {
  /** Unique name for this completer (used in Completion.source) */
  name: string;

  /**
   * Check if this completer should run for the given input state.
   * Return false to skip entirely (fast path).
   *
   * Example checks:
   * - CommandCompleter: state.tokenIndex === 0 && state.mode === 'shell'
   * - EntityCompleter: state.isEntityTrigger
   * - SlashCompleter: state.isSlashCommand
   */
  isRelevant(state: InputState): boolean;

  /**
   * Generate completions for the input state.
   * Only called if isRelevant() returns true.
   *
   * @param state - The current InputState
   * @returns Array of completions (may be empty)
   */
  getCompletions(state: InputState): Promise<Completion[]>;
}
