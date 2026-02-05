---
title: Plan Spec - Unified Completion System
description: Contextual completers for commands, files, and entities with kash-style ranking
author: Joshua Levy with LLM assistance
---
# Feature: Unified Completion System

**Date:** 2026-02-05

**Status:** Draft

## Overview

A unified completion system with pluggable, contextual completers.
The architecture borrows from [kash](https://github.com/jlevy/kash)'s completion system:
multiple completers run based on context, results are merged and ranked, then displayed.

**Key mechanisms:**

1. **@ trigger** - Shows entity menu (files, future: URLs, symbols)
2. **Tab completion** - Runs contextual completers based on input state
3. **Slash commands** - `/help`, `/quit`, etc.
   (existing)

**Architecture principles:**

- **Pluggable completers** - Each completer handles a specific type (commands, files,
  etc.)
- **Context-driven** - Completers decide relevance based on `InputState`
- **Unified ranking** - All completions scored and ranked consistently
- **Bash isolation** - All shell invocations in one file for easy replacement

## Goals

1. **Contextual completion** - Right completions for the current input state
2. **Unified ranking** - All sources scored and merged like kash
3. **@ entity menu** - Immediate menu when @ pressed
4. **Rich command data** - Descriptions from TLDR for recommended commands
5. **Clean architecture** - Pluggable completers, isolated shell code
6. **No sandboxing** - Uses real bash (sandboxing handled by ACP if needed)

## Non-Goals (This Spec)

- Ghost text / inline suggestions (future)
- Semantic/embedding-based completion (future)
- AI-powered suggestions
- Sandboxed shell execution (ACP handles this)

## Architecture

### Core Principle: InputState as Single Source of Truth

The system is built around a single, well-modeled `InputState` data object:

1. **Keystrokes update InputState** - Every keystroke mutates the shared state
2. **InputState drives rendering** - The renderer uses InputState for coloring/styling
3. **InputState drives completion** - CompletionManager receives InputState to pick
   completers

This follows the pattern used by xonsh (which kash builds on), where `CompletionContext`
contains parsed command structure, cursor position, and mode information.

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌──────────────┐      ┌─────────────────────────────────────────────┐  │
│  │  Keystroke   │─────▶│              InputState                      │  │
│  │  Handler     │      │  (single shared state, updated by keystrokes)│  │
│  └──────────────┘      │                                              │  │
│                        │  • rawText: string        (full input)       │  │
│                        │  • cursorPos: number      (cursor position)  │  │
│                        │  • mode: InputMode        (shell/nl/slash)   │  │
│                        │  • tokens: Token[]        (parsed tokens)    │  │
│                        │  • currentToken: Token    (token at cursor)  │  │
│                        │  • tokenIndex: number     (which arg, 0=cmd) │  │
│                        │  • prefix: string         (text being typed) │  │
│                        │  • isEntityTrigger: bool  (starts with @)    │  │
│                        │  • cwd: string            (working directory)│  │
│                        └─────────────────────────────────────────────┘  │
│                                         │                               │
│                    ┌────────────────────┴────────────────────┐          │
│                    ▼                                         ▼          │
│  ┌─────────────────────────────┐       ┌─────────────────────────────┐  │
│  │       InputRenderer         │       │     CompletionManager       │  │
│  │                             │       │                             │  │
│  │  Uses InputState to:        │       │  Uses InputState to:        │  │
│  │  • Color tokens by type     │       │  • Pick relevant completers │  │
│  │  • Style current token      │       │  • Run completers           │  │
│  │  • Position cursor          │       │  • Merge & rank results     │  │
│  └─────────────────────────────┘       └─────────────────────────────┘  │
│                                                      │                  │
│                              ┌───────────────────────┼───────────┐      │
│                              ▼                       ▼           ▼      │
│                   ┌──────────────┐       ┌──────────────┐ ┌──────────┐  │
│                   │ Command      │       │ Entity       │ │ Slash    │  │
│                   │ Completer    │       │ Completer    │ │ Completer│  │
│                   │              │       │              │ │          │  │
│                   │ isRelevant() │       │ isRelevant() │ │ etc.     │  │
│                   │ checks state │       │ checks state │ │          │  │
│                   └──────────────┘       └──────────────┘ └──────────┘  │
│                              │                       │           │      │
│                              └───────────────────────┼───────────┘      │
│                                                      ▼                  │
│                                        ┌─────────────────────────────┐  │
│                                        │       MenuRenderer          │  │
│                                        │  • Render below input line  │  │
│                                        │  • Handle navigation        │  │
│                                        └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/lib/input/
├── index.ts                 # Public API exports
├── state.ts                 # InputState - the central data model
├── parser.ts                # Parse raw text into tokens
├── renderer.ts              # Render input with coloring/styling
└── handler.ts               # Keystroke handling, updates InputState

src/lib/completion/
├── index.ts                 # Public API exports
├── types.ts                 # Completion, Completer interfaces
├── manager.ts               # CompletionManager - orchestrates completers
├── scoring.ts               # Scoring algorithm (prefix, fuzzy, recency)
├── menu.ts                  # MenuRenderer - ANSI menu rendering
├── completers/
│   ├── command-completer.ts # Shell command completion
│   ├── entity-completer.ts  # @ entity completion (files, future: URLs)
│   └── slash-completer.ts   # Slash command completion
├── data/
│   ├── recommended-commands.ts  # Curated command list with categories
│   └── command-descriptions.ts  # TLDR descriptions (generated or static)
└── shell/
    └── bash-executor.ts     # All bash invocations (isolated, NOT sandboxed)
```

### InputState: The Central Data Model

The `InputState` is the single source of truth for the current input.
It’s updated by keystrokes and drives both rendering and completion.

```typescript
// src/lib/input/state.ts

/**
 * InputState is the central data model for the input system.
 *
 * Updated by: Keystroke handler
 * Used by: InputRenderer (for coloring), CompletionManager (for completers)
 *
 * This follows the pattern used by xonsh's CompletionContext, which provides
 * parsed command structure and cursor position to all completers.
 */
export interface InputState {
  // === Raw Input ===

  /** The complete raw input text */
  rawText: string;

  /** Cursor position (0 = before first char) */
  cursorPos: number;

  /** Text before the cursor */
  textBeforeCursor: string;

  /** Text after the cursor */
  textAfterCursor: string;

  // === Parsed Structure ===

  /** Tokenized input (command + arguments) */
  tokens: Token[];

  /** Index of the token containing the cursor (0 = command position) */
  tokenIndex: number;

  /** The token currently being edited (at cursor) */
  currentToken: Token | null;

  /** The prefix being typed (current token text before cursor) */
  prefix: string;

  // === Mode Detection ===

  /** Current input mode */
  mode: InputMode;

  /** True if current token starts with @ (entity reference) */
  isEntityTrigger: boolean;

  /** True if input starts with / (slash command) */
  isSlashCommand: boolean;

  /** True if input looks like natural language (not a command) */
  isNaturalLanguage: boolean;

  // === Environment ===

  /** Current working directory */
  cwd: string;

  /** Recent command history (for recency scoring) */
  history: HistoryEntry[];
}

export type InputMode = 'shell' | 'nl' | 'slash';

export interface Token {
  /** Token type for rendering */
  type: TokenType;

  /** Token text */
  value: string;

  /** Start position in rawText */
  start: number;

  /** End position in rawText */
  end: number;
}

export type TokenType =
  | 'command'      // First token (the command)
  | 'argument'     // Regular argument
  | 'option'       // Starts with - or --
  | 'entity'       // Starts with @
  | 'path'         // Looks like a file path
  | 'string'       // Quoted string
  | 'operator'     // |, >, >>, etc.
  | 'whitespace';  // Spaces between tokens

export interface HistoryEntry {
  command: string;
  timestamp: Date;
  /** Input mode at time of execution (for correct coloring on history navigation) */
  mode: InputMode;
}
```

### Updating InputState

The keystroke handler updates InputState on every keystroke:

```typescript
// src/lib/input/handler.ts

import { InputState, Token } from './state.js';
import { parseTokens } from './parser.js';
import { detectMode, detectNaturalLanguage } from './mode.js';

/**
 * Update InputState based on new raw text and cursor position.
 *
 * Called on every keystroke. This is the only place InputState is mutated.
 */
export function updateInputState(
  state: InputState,
  rawText: string,
  cursorPos: number
): void {
  // Update raw input
  state.rawText = rawText;
  state.cursorPos = cursorPos;
  state.textBeforeCursor = rawText.slice(0, cursorPos);
  state.textAfterCursor = rawText.slice(cursorPos);

  // Parse into tokens
  state.tokens = parseTokens(rawText);

  // Find current token (containing cursor)
  state.currentToken = null;
  state.tokenIndex = 0;
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i];
    if (cursorPos >= token.start && cursorPos <= token.end) {
      state.currentToken = token;
      state.tokenIndex = i;
      break;
    }
    if (cursorPos < token.start) {
      // Cursor is in whitespace before this token
      state.tokenIndex = i;
      break;
    }
  }

  // Calculate prefix (text in current token before cursor)
  if (state.currentToken) {
    const offsetInToken = cursorPos - state.currentToken.start;
    state.prefix = state.currentToken.value.slice(0, offsetInToken);
  } else {
    state.prefix = '';
  }

  // Detect mode and triggers
  state.mode = detectMode(rawText);
  state.isSlashCommand = rawText.startsWith('/');
  state.isEntityTrigger = state.prefix.startsWith('@');
  state.isNaturalLanguage = detectNaturalLanguage(rawText);
}
```

### Completion Types

```typescript
// src/lib/completion/types.ts

import type { InputState } from '../input/state.js';

/**
 * A single completion item.
 */
export interface Completion {
  /** The value to insert */
  value: string;

  /** Display text (if different from value) */
  display?: string;

  /** Short description shown alongside */
  description?: string;

  /** Completion group for primary sorting */
  group: CompletionGroup;

  /** Score within group (0-100) */
  score: number;

  /** Which completer produced this */
  source: string;

  /** Icon/prefix for display */
  icon?: string;

  /** If true, replace entire input (not just current token) */
  replaceInput?: boolean;
}

/**
 * Priority groups - lower number = higher priority.
 * Completions are sorted by group first, then by score within group.
 *
 * Ported from kash's CompletionGroup enum.
 */
export enum CompletionGroup {
  /** Highest priority (e.g., exact matches, top suggestions) */
  TopSuggestion = 0,

  /** Internal commands (slash commands) */
  InternalCommand = 1,

  /** Standard completions */
  Standard = 2,

  /** Help/FAQ items */
  Help = 3,

  /** Recommended shell commands (curated list with TLDR) */
  RecommendedCommand = 5,

  /** Regular shell commands (from PATH) */
  RegularCommand = 6,

  /** File/entity completions */
  Entity = 7,

  /** Lowest priority */
  Other = 8,
}

/**
 * A completer generates completions for a specific type of input.
 *
 * Completers receive the full InputState and use it to:
 * 1. Decide if they're relevant (isRelevant)
 * 2. Generate completions based on state properties
 */
export interface Completer {
  /** Unique name for this completer */
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
   */
  getCompletions(state: InputState): Promise<Completion[]>;
}
```

### Completion Icons

Monochrome unicode icons for visual distinction (following kash conventions):

```typescript
// src/lib/completion/types.ts

export const COMPLETION_ICONS = {
  /** Recommended shell commands (curated) */
  recommended: '•',    // U+2022

  /** Regular shell commands */
  shell: '⦊',          // U+298A

  /** Internal/slash commands */
  internal: '⧁',       // U+29C1

  /** File entities */
  file: '◇',           // U+25C7

  /** Directory entities */
  directory: '▪',      // U+25AA

  /** Help/FAQ items */
  help: '?',           // U+003F

  /** Recipe snippets */
  snippet: '❯',        // U+276F
} as const;
```

### CompletionManager

```typescript
// src/lib/completion/manager.ts

import type { InputState } from '../input/state.js';
import type { Completer, Completion } from './types.js';
import { scoreCompletion } from './scoring.js';

/**
 * Orchestrates multiple completers, merges and ranks results.
 *
 * Pipeline (following kash's RankingCompleter):
 * 1. Collect - Run all relevant completers based on InputState
 * 2. Deduplicate - Remove duplicates by normalized value
 * 3. Score - Apply scoring to unscored completions
 * 4. Rank - Sort by group (primary), score (secondary)
 */
export class CompletionManager {
  private completers: Completer[] = [];

  register(completer: Completer): void {
    this.completers.push(completer);
  }

  /**
   * Generate completions for the current input state.
   *
   * @param state - The InputState (single source of truth for input)
   * @param limit - Maximum completions to return
   */
  async complete(state: InputState, limit = 20): Promise<Completion[]> {
    // 1. Collect from all relevant completers
    const allCompletions: Completion[] = [];

    // Each completer checks state to determine relevance
    const relevantCompleters = this.completers.filter(c => c.isRelevant(state));

    const results = await Promise.all(
      relevantCompleters.map(c => c.getCompletions(state))
    );

    for (const completions of results) {
      allCompletions.push(...completions);
    }

    // 2. Deduplicate by normalized value
    const seen = new Set<string>();
    const deduped = allCompletions.filter(c => {
      const key = c.value.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 3. Score unscored completions using state.prefix
    for (const completion of deduped) {
      if (completion.score === 0) {
        completion.score = scoreCompletion(completion, state);
      }
    }

    // 4. Rank: group (ascending), then score (descending)
    deduped.sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      return b.score - a.score;
    });

    return deduped.slice(0, limit);
  }
}
```

### Scoring Algorithm

Port of kash’s scoring with exact prefix, fuzzy matching, and recency:

```typescript
// src/lib/completion/scoring.ts

import type { InputState } from '../input/state.js';
import type { Completion } from './types.js';

/** Minimum score to show a completion */
export const MIN_SCORE_CUTOFF = 70;

/**
 * Score a completion against the input state.
 * Uses state.prefix (the text being typed) to score against completion value.
 * Returns 0-100.
 */
export function scoreCompletion(
  completion: Completion,
  state: InputState
): number {
  const prefix = state.prefix.toLowerCase();
  const text = completion.value.toLowerCase();

  // Try exact prefix first (fast path)
  const prefixScore = scoreExactPrefix(prefix, text);
  if (prefixScore >= MIN_SCORE_CUTOFF) {
    return prefixScore + (completion.description ? 5 : 0);
  }

  // Fall back to fuzzy matching
  const fuzzyScore = scoreFuzzy(prefix, text);

  // Add description bonus
  const descBonus = completion.description ? 5 : 0;

  return Math.min(100, fuzzyScore + descBonus);
}

/**
 * Score exact prefix match.
 * Returns 70-100 for matches, 0 for non-matches.
 */
function scoreExactPrefix(prefix: string, text: string): number {
  if (!text.startsWith(prefix)) return 0;
  if (prefix.length < 2) return 50;

  const completionRatio = prefix.length / text.length;
  const longPrefixBonus = Math.min(10, prefix.length - 2);

  return 70 + (20 * completionRatio) + longPrefixBonus;
}

/**
 * Score fuzzy match using simple character matching.
 * For better fuzzy matching, consider adding 'fuzzball' or 'microfuzz'.
 */
function scoreFuzzy(prefix: string, text: string): number {
  if (prefix.length === 0) return 50;
  if (text.includes(prefix)) return 60 + (10 * prefix.length / text.length);

  // Simple subsequence matching
  let prefixIdx = 0;
  for (const char of text) {
    if (char === prefix[prefixIdx]) {
      prefixIdx++;
      if (prefixIdx === prefix.length) break;
    }
  }

  if (prefixIdx === prefix.length) {
    return 40 + (20 * prefix.length / text.length);
  }

  return 0;
}

/**
 * Calculate recency score with exponential decay.
 * 1 hour ago = 100, 1 year ago = 0.
 */
export function scoreRecency(timestamp: Date): number {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

  const ageMs = Date.now() - timestamp.getTime();

  if (ageMs <= ONE_HOUR) return 100;
  if (ageMs >= ONE_YEAR) return 0;

  const decayConstant = 5.0 / (ONE_YEAR - ONE_HOUR);
  return 100 * Math.exp(-decayConstant * (ageMs - ONE_HOUR));
}
```

## Completers

Each completer receives the full `InputState` and uses it to:
1. Check relevance via `isRelevant(state)` - returns false to skip
2. Generate completions using state properties like `state.prefix`, `state.tokenIndex`

### CommandCompleter

Completes shell commands using a curated list with TLDR descriptions:

```typescript
// src/lib/completion/completers/command-completer.ts

import type { InputState } from '../../input/state.js';
import type { Completer, Completion } from '../types.js';
import { CompletionGroup, COMPLETION_ICONS } from '../types.js';
import { RECOMMENDED_COMMANDS } from '../data/recommended-commands.js';
import { getCommandDescription } from '../data/command-descriptions.js';

/**
 * Completes shell commands from a curated list.
 *
 * Uses RECOMMENDED_COMMANDS (ported from kash) with TLDR descriptions.
 * Does NOT discover commands from PATH - that would require bash and be slow.
 */
export class CommandCompleter implements Completer {
  name = 'command';

  isRelevant(state: InputState): boolean {
    // Only for first token (command position) in shell mode
    return (
      state.mode === 'shell' &&
      state.tokenIndex === 0 &&
      !state.isEntityTrigger &&
      !state.isSlashCommand
    );
  }

  async getCompletions(state: InputState): Promise<Completion[]> {
    const prefix = state.prefix.toLowerCase();

    return RECOMMENDED_COMMANDS
      .filter(cmd => cmd.name.toLowerCase().startsWith(prefix))
      .map(cmd => ({
        value: cmd.name,
        description: getCommandDescription(cmd.name) ?? cmd.description,
        group: CompletionGroup.RecommendedCommand,
        score: 0, // Will be scored by manager
        source: this.name,
        icon: COMPLETION_ICONS.recommended,
      }));
  }
}
```

### EntityCompleter

Completes file paths when @ is typed:

```typescript
// src/lib/completion/completers/entity-completer.ts

import type { InputState } from '../../input/state.js';
import type { Completer, Completion } from '../types.js';
import { CompletionGroup, COMPLETION_ICONS } from '../types.js';
import { listProjectFiles } from '../shell/bash-executor.js';

/**
 * Completes entities (files, future: URLs, symbols) for @ mentions.
 *
 * Triggered by @ prefix in state.isEntityTrigger.
 */
export class EntityCompleter implements Completer {
  name = 'entity';

  isRelevant(state: InputState): boolean {
    return state.isEntityTrigger;
  }

  async getCompletions(state: InputState): Promise<Completion[]> {
    // Extract filter text after @ from prefix
    const filter = state.prefix.startsWith('@')
      ? state.prefix.slice(1)
      : state.prefix;

    // Get project files (git-tracked)
    const files = await listProjectFiles(state.cwd, filter, 30);

    return files.map(file => ({
      value: `@${file.path}`,
      display: file.path,
      description: file.isDirectory ? 'directory' : undefined,
      group: CompletionGroup.Entity,
      score: 0,
      source: this.name,
      icon: file.isDirectory ? COMPLETION_ICONS.directory : COMPLETION_ICONS.file,
    }));
  }
}
```

### SlashCompleter

Completes slash commands:

```typescript
// src/lib/completion/completers/slash-completer.ts

import type { InputState } from '../../input/state.js';
import type { Completer, Completion } from '../types.js';
import { CompletionGroup, COMPLETION_ICONS } from '../types.js';

const SLASH_COMMANDS = [
  { name: '/help', description: 'Show help' },
  { name: '/quit', description: 'Exit the shell' },
  { name: '/status', description: 'Show connection status' },
  { name: '/history', description: 'Show command history' },
  { name: '/clear', description: 'Clear the screen' },
  // Add more as needed
];

/**
 * Completes slash commands like /help, /quit.
 */
export class SlashCompleter implements Completer {
  name = 'slash';

  isRelevant(state: InputState): boolean {
    return state.isSlashCommand;
  }

  async getCompletions(state: InputState): Promise<Completion[]> {
    const prefix = state.prefix.toLowerCase();

    return SLASH_COMMANDS
      .filter(cmd => cmd.name.toLowerCase().startsWith(prefix))
      .map(cmd => ({
        value: cmd.name,
        description: cmd.description,
        group: CompletionGroup.InternalCommand,
        score: 0,
        source: this.name,
        icon: COMPLETION_ICONS.internal,
      }));
  }
}
```

## Shell Isolation

All bash invocations are isolated in one file.
This is **not sandboxed** - it runs real bash with full system access.
Sandboxing is handled by ACP if needed.

```typescript
// src/lib/completion/shell/bash-executor.ts

/**
 * Shell execution utilities for completion.
 *
 * SECURITY NOTE: This file executes real bash commands with full system access.
 * It is NOT sandboxed. All commands run as the current user with full privileges.
 *
 * If sandboxing is needed, replace this file with a sandboxed implementation
 * (e.g., using just-bash or running in a container).
 *
 * Sandboxing for AI agent tool execution is handled by ACP (Anthropic Claude Platform),
 * not by this completion system.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FileInfo {
  path: string;
  isDirectory: boolean;
}

/**
 * List project files using git ls-files.
 *
 * TRUSTED: Runs real bash - not sandboxed.
 */
export async function listProjectFiles(
  cwd: string,
  filter: string,
  limit: number
): Promise<FileInfo[]> {
  try {
    // Use git ls-files for tracked files (respects .gitignore)
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      { cwd, maxBuffer: 1024 * 1024 }
    );

    const files = stdout
      .split('\n')
      .filter(line => line.trim())
      .filter(path => !filter || path.toLowerCase().includes(filter.toLowerCase()))
      .slice(0, limit);

    // Check which are directories (simplified - could stat each)
    return files.map(path => ({
      path,
      isDirectory: path.endsWith('/'),
    }));
  } catch {
    // Fallback if not a git repo or git not available
    return [];
  }
}

/**
 * Get command description from tldr (if available).
 *
 * TRUSTED: Runs real bash - not sandboxed.
 */
export async function getTldrDescription(command: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('tldr', [command], {
      timeout: 2000,
    });

    // Extract description (lines starting with '>')
    const lines = stdout.split('\n');
    const descLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) {
        if (trimmed.includes('More information:')) break;
        descLines.push(trimmed.slice(1).trim());
      } else if (descLines.length > 0) {
        break;
      }
    }

    return descLines.join(' ') || null;
  } catch {
    return null;
  }
}
```

## Data: Recommended Commands

Curated command list ported from kash (135 commands):

```typescript
// src/lib/completion/data/recommended-commands.ts

export interface CommandInfo {
  name: string;
  description: string;
  category: CommandCategory;
  isModernAlternative?: boolean;
  alternativeTo?: string;
}

export type CommandCategory =
  | 'file'
  | 'search'
  | 'text'
  | 'system'
  | 'network'
  | 'git'
  | 'node'
  | 'python'
  | 'container'
  | 'compression'
  | 'editor'
  | 'shell';

/**
 * Curated list of recommended shell commands.
 * Ported from kash's recommended_commands.py.
 */
export const RECOMMENDED_COMMANDS: CommandInfo[] = [
  // Core file operations
  { name: 'ls', description: 'List directory contents', category: 'file' },
  { name: 'cd', description: 'Change directory', category: 'file' },
  { name: 'pwd', description: 'Print working directory', category: 'file' },
  { name: 'cp', description: 'Copy files', category: 'file' },
  { name: 'mv', description: 'Move/rename files', category: 'file' },
  { name: 'rm', description: 'Remove files', category: 'file' },
  { name: 'mkdir', description: 'Create directory', category: 'file' },
  { name: 'rmdir', description: 'Remove directory', category: 'file' },
  { name: 'touch', description: 'Create empty file', category: 'file' },
  { name: 'cat', description: 'Concatenate and print files', category: 'file' },
  { name: 'less', description: 'View file with paging', category: 'file' },
  { name: 'head', description: 'Output first lines', category: 'file' },
  { name: 'tail', description: 'Output last lines', category: 'file' },
  { name: 'tree', description: 'Display directory tree', category: 'file' },
  { name: 'chmod', description: 'Change file permissions', category: 'file' },
  { name: 'chown', description: 'Change file owner', category: 'file' },

  // Modern alternatives
  { name: 'eza', description: 'Modern ls alternative', category: 'file', isModernAlternative: true, alternativeTo: 'ls' },
  { name: 'bat', description: 'Modern cat with syntax highlighting', category: 'file', isModernAlternative: true, alternativeTo: 'cat' },
  { name: 'fd', description: 'Modern find alternative', category: 'search', isModernAlternative: true, alternativeTo: 'find' },
  { name: 'rg', description: 'Modern grep (ripgrep)', category: 'search', isModernAlternative: true, alternativeTo: 'grep' },
  { name: 'z', description: 'Smart cd (zoxide)', category: 'file', isModernAlternative: true, alternativeTo: 'cd' },
  { name: 'delta', description: 'Modern diff viewer', category: 'git', isModernAlternative: true, alternativeTo: 'diff' },
  { name: 'dust', description: 'Modern du alternative', category: 'system', isModernAlternative: true, alternativeTo: 'du' },
  { name: 'duf', description: 'Modern df alternative', category: 'system', isModernAlternative: true, alternativeTo: 'df' },
  { name: 'btm', description: 'Modern top alternative', category: 'system', isModernAlternative: true, alternativeTo: 'top' },
  { name: 'procs', description: 'Modern ps alternative', category: 'system', isModernAlternative: true, alternativeTo: 'ps' },

  // Search
  { name: 'grep', description: 'Search text patterns', category: 'search' },
  { name: 'find', description: 'Find files', category: 'search' },
  { name: 'fzf', description: 'Fuzzy finder', category: 'search' },
  { name: 'which', description: 'Locate a command', category: 'search' },

  // Text processing
  { name: 'awk', description: 'Text processing', category: 'text' },
  { name: 'sed', description: 'Stream editor', category: 'text' },
  { name: 'sort', description: 'Sort lines', category: 'text' },
  { name: 'uniq', description: 'Filter duplicate lines', category: 'text' },
  { name: 'wc', description: 'Word/line count', category: 'text' },
  { name: 'jq', description: 'JSON processor', category: 'text' },

  // System
  { name: 'ps', description: 'List processes', category: 'system' },
  { name: 'top', description: 'Process monitor', category: 'system' },
  { name: 'htop', description: 'Interactive process viewer', category: 'system' },
  { name: 'df', description: 'Disk space usage', category: 'system' },
  { name: 'du', description: 'Directory size', category: 'system' },
  { name: 'free', description: 'Memory usage', category: 'system' },
  { name: 'uptime', description: 'System uptime', category: 'system' },
  { name: 'uname', description: 'System info', category: 'system' },
  { name: 'kill', description: 'Terminate process', category: 'system' },
  { name: 'killall', description: 'Kill processes by name', category: 'system' },
  { name: 'lsof', description: 'List open files', category: 'system' },
  { name: 'sudo', description: 'Execute as superuser', category: 'system' },

  // Network
  { name: 'ping', description: 'Test network connectivity', category: 'network' },
  { name: 'curl', description: 'Transfer data from URLs', category: 'network' },
  { name: 'wget', description: 'Download files', category: 'network' },
  { name: 'ssh', description: 'Secure shell', category: 'network' },
  { name: 'scp', description: 'Secure copy', category: 'network' },
  { name: 'sftp', description: 'Secure FTP', category: 'network' },
  { name: 'nc', description: 'Netcat', category: 'network' },
  { name: 'dig', description: 'DNS lookup', category: 'network' },
  { name: 'traceroute', description: 'Trace route to host', category: 'network' },
  { name: 'netstat', description: 'Network statistics', category: 'network' },
  { name: 'ifconfig', description: 'Network interface config', category: 'network' },

  // Git
  { name: 'git', description: 'Version control', category: 'git' },

  // Node/JavaScript
  { name: 'node', description: 'JavaScript runtime', category: 'node' },
  { name: 'npm', description: 'Node package manager', category: 'node' },
  { name: 'npx', description: 'Execute npm packages', category: 'node' },
  { name: 'yarn', description: 'Package manager', category: 'node' },
  { name: 'pnpm', description: 'Fast package manager', category: 'node' },
  { name: 'bun', description: 'Fast JS runtime', category: 'node' },
  { name: 'fnm', description: 'Fast Node manager', category: 'node' },

  // Python
  { name: 'python', description: 'Python interpreter', category: 'python' },
  { name: 'python3', description: 'Python 3 interpreter', category: 'python' },
  { name: 'pip', description: 'Python package manager', category: 'python' },
  { name: 'pipx', description: 'Install Python apps', category: 'python' },
  { name: 'pyenv', description: 'Python version manager', category: 'python' },
  { name: 'poetry', description: 'Python dependency manager', category: 'python' },

  // Containers
  { name: 'docker', description: 'Container platform', category: 'container' },
  { name: 'podman', description: 'Container engine', category: 'container' },
  { name: 'kubectl', description: 'Kubernetes CLI', category: 'container' },

  // Compression
  { name: 'tar', description: 'Archive utility', category: 'compression' },
  { name: 'gzip', description: 'Compress files', category: 'compression' },
  { name: 'zip', description: 'Create zip archives', category: 'compression' },
  { name: 'unzip', description: 'Extract zip archives', category: 'compression' },

  // Editors
  { name: 'vim', description: 'Vi improved editor', category: 'editor' },
  { name: 'nano', description: 'Simple text editor', category: 'editor' },

  // Shell/system admin
  { name: 'bash', description: 'Bash shell', category: 'shell' },
  { name: 'zsh', description: 'Z shell', category: 'shell' },
  { name: 'man', description: 'Manual pages', category: 'shell' },
  { name: 'tldr', description: 'Simplified man pages', category: 'shell' },

  // macOS specific
  { name: 'open', description: 'Open files/URLs (macOS)', category: 'system' },
  { name: 'pbcopy', description: 'Copy to clipboard (macOS)', category: 'system' },
  { name: 'pbpaste', description: 'Paste from clipboard (macOS)', category: 'system' },
  { name: 'brew', description: 'Homebrew package manager', category: 'system' },

  // Rust
  { name: 'cargo', description: 'Rust package manager', category: 'system' },
];
```

## Menu Rendering

```typescript
// src/lib/completion/renderer.ts

import type { Completion } from './types.js';
import pc from 'picocolors';

const MAX_MENU_HEIGHT = 10;

/**
 * Renders completion menu below the input line.
 */
export class MenuRenderer {
  private itemCount = 0;

  /**
   * Render menu with completions.
   */
  render(completions: Completion[], selectedIndex: number): void {
    this.clear();

    const items = completions.slice(0, MAX_MENU_HEIGHT);
    this.itemCount = items.length;

    // Save cursor position
    process.stdout.write('\x1b[s');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isSelected = i === selectedIndex;

      process.stdout.write('\n');

      const icon = item.icon ?? ' ';
      const value = item.display ?? item.value;
      const desc = item.description ? pc.dim(` ${item.description}`) : '';
      const line = `${icon} ${value}${desc}`;

      if (isSelected) {
        process.stdout.write(pc.inverse(` ${line} `));
      } else {
        process.stdout.write(`  ${line}`);
      }
    }

    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  /**
   * Clear the menu.
   */
  clear(): void {
    if (this.itemCount === 0) return;

    // Save cursor position
    process.stdout.write('\x1b[s');

    // Clear each menu line
    for (let i = 0; i < this.itemCount; i++) {
      process.stdout.write('\n\x1b[2K');
    }

    // Restore cursor position
    process.stdout.write('\x1b[u');

    this.itemCount = 0;
  }
}
```

## Menu Navigation

| Key | Action |
| --- | --- |
| `@` | Open entity menu immediately |
| `/` at start | Open slash command menu |
| Tab | Show/cycle completions |
| Up/Down | Navigate menu items |
| Enter | Insert selected completion with trailing space (for adding arguments) |
| Escape | Close menu |
| Continue typing | Filter completions |
| Backspace | Update filter (close menu if empty) |

**Cursor Management:** The menu is rendered below the input line using ANSI escape
sequences. Cursor position is preserved using `\x1b[s` (save) before rendering and
`\x1b[u` (restore) after, so the cursor stays next to the input text rather than jumping
to the end of menu content.

**Completion Acceptance:** When Enter is pressed to accept a completion (for both
Tab-triggered command completions and @-triggered entity completions), the selected
value is inserted with a trailing space.
The command is NOT executed - the prompt stays open so the user can add arguments.
This is achieved by intercepting the Enter key and re-prompting with the completion text
pre-filled.

**@ Trigger Behavior:** The @ key is purely a trigger for entity (file) completion - it
should never appear in the actual input.
Design:
- @ triggers entity completion at the current cursor position (same as Tab triggers
  command completion)
- The @ character itself is NOT added to the input line
- If a completion is selected, insert the file path at cursor position (no @ prefix in
  result)
- If dismissed without selection, input is unchanged (@ was never added)
- Works identically in shell mode and NL/agent mode for consistency
- In NL mode, @ indicates explicitly looking for a file mention

## InputRenderer (Coloring/Styling)

The `InputRenderer` uses `InputState` to color and style the input line.
Each token is rendered according to its type.

```typescript
// src/lib/input/renderer.ts

import type { InputState, Token, TokenType } from './state.js';
import pc from 'picocolors';

const TOKEN_COLORS: Record<TokenType, (s: string) => string> = {
  command: pc.bold,
  argument: pc.white,
  option: pc.cyan,
  entity: pc.green,
  path: pc.yellow,
  string: pc.magenta,
  operator: pc.red,
  whitespace: s => s,
};

/**
 * Renders the input line with syntax highlighting.
 *
 * Uses InputState.tokens to color each token by type.
 */
export function renderInput(state: InputState): string {
  let result = '';

  for (const token of state.tokens) {
    const colorFn = TOKEN_COLORS[token.type] ?? pc.white;
    result += colorFn(token.value);
  }

  return result;
}
```

## Integration Example

This shows how InputState flows through the system as the single source of truth.

```typescript
// src/lib/input/handler.ts
// Main input handler - coordinates InputState, rendering, and completion

import { InputState, createInputState, updateInputState } from './state.js';
import { renderInput } from './renderer.js';
import { CompletionManager } from '../completion/manager.js';
import { MenuRenderer } from '../completion/menu.js';
import { CommandCompleter } from '../completion/completers/command-completer.js';
import { EntityCompleter } from '../completion/completers/entity-completer.js';
import { SlashCompleter } from '../completion/completers/slash-completer.js';

export class InputHandler {
  // Single shared state, updated by keystrokes
  private state: InputState;

  // Completion system
  private completionManager: CompletionManager;
  private menuRenderer: MenuRenderer;

  // Menu state
  private completions: Completion[] = [];
  private selectedIndex = 0;
  private menuVisible = false;

  constructor(cwd: string) {
    // Initialize the single shared InputState
    this.state = createInputState('', 0, 'shell', cwd);

    // Set up completion system
    this.completionManager = new CompletionManager();
    this.completionManager.register(new CommandCompleter());
    this.completionManager.register(new EntityCompleter());
    this.completionManager.register(new SlashCompleter());

    this.menuRenderer = new MenuRenderer();
  }

  /**
   * Handle a keystroke - this is the main entry point.
   * Updates InputState, then re-renders and potentially shows completions.
   */
  async handleKey(key: string): Promise<void> {
    // 1. Update the shared InputState based on the keystroke
    this.state = updateInputState(this.state, key);

    // 2. Render the input line using InputState (colors tokens)
    this.renderInputLine();

    // 3. Decide if we need to show/update completions
    if (key === '\t') {
      // Tab pressed - trigger completion
      await this.triggerCompletion();
    } else if (this.state.isEntityTrigger && this.state.prefix === '@') {
      // Just typed @ - show entity menu immediately
      await this.triggerCompletion();
    } else if (this.menuVisible) {
      // Menu is visible - update it with new completions
      await this.updateCompletions();
    }
  }

  /**
   * Render the input line with syntax coloring.
   * InputState.tokens drives the coloring.
   */
  private renderInputLine(): void {
    const coloredInput = renderInput(this.state);
    // Write to terminal (implementation depends on terminal library)
    process.stdout.write(`\r${coloredInput}`);
  }

  /**
   * Trigger completion using the current InputState.
   * InputState drives which completers are relevant.
   */
  private async triggerCompletion(): Promise<void> {
    // Pass InputState to CompletionManager
    this.completions = await this.completionManager.complete(this.state);
    this.selectedIndex = 0;

    if (this.completions.length > 0) {
      this.menuVisible = true;
      this.menuRenderer.render(this.completions, this.selectedIndex);
    }
  }

  /**
   * Update completions (called when menu is already visible).
   */
  private async updateCompletions(): Promise<void> {
    this.completions = await this.completionManager.complete(this.state);
    this.selectedIndex = 0;

    if (this.completions.length > 0) {
      this.menuRenderer.render(this.completions, this.selectedIndex);
    } else {
      this.hideMenu();
    }
  }

  /**
   * Handle menu navigation.
   */
  handleMenuKey(key: string): void {
    if (!this.menuVisible) return;

    if (key === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.menuRenderer.render(this.completions, this.selectedIndex);
    } else if (key === 'down') {
      this.selectedIndex = Math.min(this.completions.length - 1, this.selectedIndex + 1);
      this.menuRenderer.render(this.completions, this.selectedIndex);
    } else if (key === 'enter') {
      this.acceptCompletion();
    } else if (key === 'escape') {
      this.hideMenu();
    }
  }

  /**
   * Accept the currently selected completion.
   */
  private acceptCompletion(): void {
    const completion = this.completions[this.selectedIndex];
    if (!completion) return;

    // Apply the completion to InputState
    const newText = this.state.textBeforeCursor.slice(0, -this.state.prefix.length)
      + completion.insertText
      + this.state.textAfterCursor;
    const newCursorPos = newText.length - this.state.textAfterCursor.length;

    // Update InputState with the completed text
    this.state = updateInputState(
      { ...this.state, rawText: '', cursorPos: 0 },
      newText
    );
    this.state = { ...this.state, cursorPos: newCursorPos };

    this.hideMenu();
    this.renderInputLine();
  }

  private hideMenu(): void {
    this.menuVisible = false;
    this.completions = [];
    this.menuRenderer.clear();
  }
}
```

**Key points demonstrated:**

1. **Single shared `InputState`** - Created once, updated by every keystroke
2. **InputState drives rendering** - `renderInput(state)` uses `state.tokens` for
   coloring
3. **InputState drives completion** - `completionManager.complete(state)` uses state for
   context
4. **No separate context building** - InputState IS the context

## Implementation Plan

### Phase 1: Core Infrastructure

- [ ] Create `src/lib/input/` and `src/lib/completion/` directory structure
- [ ] Implement `input/state.ts` - InputState types and `updateInputState()`
- [ ] Implement `input/parser.ts` - tokenize input text
- [ ] Implement `input/renderer.ts` - render input with syntax coloring
- [ ] Implement `completion/types.ts` - Completion, Completer interfaces
- [ ] Implement `completion/scoring.ts` - prefix and fuzzy scoring
- [ ] Implement `completion/manager.ts` - CompletionManager orchestration
- [ ] Implement `completion/menu.ts` - ANSI menu rendering

### Phase 2: Completers

- [ ] Implement `completers/slash-completer.ts` (simplest)
- [ ] Implement `data/recommended-commands.ts` (port from kash)
- [ ] Implement `completers/command-completer.ts`
- [ ] Implement `shell/bash-executor.ts` with security comments
- [ ] Implement `completers/entity-completer.ts`

### Phase 3: Input Integration

- [ ] Integrate with existing input handler
- [ ] Add @ keypress detection for immediate menu
- [ ] Add Tab handling to trigger completion
- [ ] Handle menu navigation (up/down/enter/escape)
- [ ] Ensure scrollback is not corrupted

### Phase 4: Polish

- [ ] Add TLDR description caching in `data/command-descriptions.ts`
- [ ] Add recency scoring using command history
- [ ] Tune scoring algorithm thresholds
- [ ] Test in various terminals (iTerm, Terminal.app, Ghostty)
- [ ] Add tests for completers and scoring

### Future Phases

- [ ] **FAQ Completer** - Complete from FAQ database
- [ ] **History Completer** - Complete from command history
- [ ] **Subcommand Completer** - git status, npm install, etc.
- [ ] **Ghost Text** - Passive inline suggestions
- [ ] **Semantic Matching** - Embedding-based completion

## Testing Strategy

### Unit Tests

- InputState parsing from various input strings
- Token parsing (commands, arguments, options, entities)
- Input rendering produces correct ANSI coloring
- Scoring algorithm (prefix, fuzzy, recency)
- Each completer returns correct completions
- Menu renderer produces correct ANSI sequences
- Deduplication works correctly

### Integration Tests

- Tab triggers completion correctly
- @ triggers entity menu immediately
- / triggers slash command completion
- Menu navigation works (up/down/select)
- Menu clears on selection/escape

### Manual Testing

- Verify scrollback not corrupted
- Test over SSH
- Test in various terminals
- Performance with large file lists
- Verify @ menu appears instantly (no delay)

## Related Issues (Beads)

### Open

- `clam-jdny` - Spec: Unified Completion System (tracking issue)
- `clam-4qfe` - Port kash completion scoring algorithm with fuzzy matching and priority
  groups
- `clam-7ni5` - Implement styled completion rendering with bold commands, dim
  descriptions, and emoji prefixes
- `clam-7re1` - Add TLDR description caching for command completions
- `clam-t0i9` - Detect invalid shell-like input (nothing mode)

### Bugs (Epic: clam-welh)

- `clam-1eha` - **Bug**: Extra newline appears before prompt after accepting completion.
  Cursor management during completion acceptance needs refinement.
- `clam-wpbn` - **Bug**: History navigation shows pink color - need to store input mode
  with history entries
- `clam-qwuf` - **Bug**: @ should not be added to input - it’s purely a trigger like
  Tab. Currently @ is added to the line by readline before triggering completion.
- `clam-yqqz` - **Bug**: Completion acceptance replaces whole line instead of inserting
  at cursor position. Should preserve existing input and insert completion at cursor.
- `clam-jida` - **Bug**: Tab after command should trigger entity completion.
  E.g., "ls <tab>" should show file completions, similar to @ trigger behavior.

### Closed

- `clam-dpf8` - Command completions now include PATH commands (fixed)

### Completed

- `clam-begv` - Create input/ and completion/ directory structure
- `clam-68q0` - Implement Completion and Completer types in completion/types.ts
- `clam-yuq9` - Implement scoring algorithm in completion/scoring.ts
- `clam-lauj` - Add file path tab completion for @path/to/file mentions
- `clam-dfmq` - Create shell module (lib/shell.ts) with which, exec, getCompletions
- `clam-2vrk` - Add Down Arrow navigation for slash command completion menu
- `clam-y5ni` - Skip input recoloring when completion menu is visible
- `clam-r25h` - Real-time input coloring based on detected mode (shell/NL/slash)

## References

- [Shell UX Research](../../research/active/research-2026-02-04-shell-ux-typescript.md)
  \- Kash analysis, completion strategies
- [kash completion_scoring.py](https://github.com/jlevy/kash) - Scoring algorithm
  reference
- [kash recommended_commands.py](https://github.com/jlevy/kash) - Command list reference
- [fzf](https://github.com/junegunn/fzf) - Menu rendering reference
- [Current input.ts](../../../../packages/clam/src/lib/input.ts) - Existing
  implementation
