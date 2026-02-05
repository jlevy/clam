---
title: Plan Spec - Input Completion System
description: @ trigger for entity mentions, Tab completion, and future ghost text
author: Joshua Levy with LLM assistance
---
# Feature: Input Completion System

**Date:** 2026-02-04 (last updated 2026-02-04)

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

## Overview

A comprehensive input completion system for clam-code with three distinct mechanisms:

1. **@ trigger** - Pressing `@` shows a menu of “inputs” (files, named entities in
   scope)
2. **Tab completion** - Expands likely completions of what’s currently being typed
3. **Ghost text** - (Future) Inline suggestions that appear automatically as you type

These mechanisms interplay but serve different purposes:

- **@** = “I want to reference something” → scoped menu of referenceable entities
- **Tab** = “Complete what I’m typing” → general completion of current input
- **Ghost text** = “Show me what you think I’ll type” → passive, non-blocking hints

## Goals

1. **@ shows entity menu** - Immediate menu when @ is pressed, scoped to “inputs”
2. **Tab completes current input** - Works as today, expands partial text
3. **Clear interplay** - @ and Tab work together naturally
4. **Mode-aware** - Completion sources appropriate to current mode
5. **Scrollback-safe** - No corruption of terminal scrollback buffer

## Non-Goals (This Spec)

- Ghost text / inline suggestions (separate Phase 3)
- Semantic/embedding-based completion
- AI-powered suggestions from Claude
- Rich formatting in menus (plain text for now)

## Background

### Current State

clam-code currently has Tab-triggered completion in
[input.ts](../../../../packages/clam/src/lib/input.ts):

- Type `@src/` then press **Tab** → shows file completions
- Type `/h` then press **Tab** → shows `/help`, `/history`, etc.

**Problem:** Users expect `@` itself to trigger a menu (like in Slack, GitHub, VSCode).
Currently, `@` is just a character and requires Tab to show completions.

### Desired Behavior

| Trigger | What Happens | Use Case |
| --- | --- | --- |
| Press `@` | Immediately show menu of files/entities | "I want to mention something" |
| Type partial + Tab | Complete current text | "Finish what I'm typing" |
| `@` + type + Tab | Filter @ menu by typed text | "Find specific entity" |

### What Are “Inputs”?

The @ menu shows things that can be **inputs** to the conversation.

**Phase 1 (this spec):**

- **Files** - Source files, configs, docs in the project

**Future extensions:**

- URLs - Recently mentioned or bookmarked URLs
- Symbols - Functions, classes, variables in scope
- History items - Previous conversation references

These are distinct from general completions (commands, arguments, etc.).

## Design

### Trigger Behaviors

| Trigger | Behavior | Menu Contents |
| --- | --- | --- |
| `@` alone | Show full @ menu immediately | Files, entities in scope |
| `@` + typing | Filter @ menu as user types | Filtered files/entities |
| `@` + Tab | Select from filtered @ menu | Same as above |
| `/` alone | Show slash command menu | Slash commands |
| `/` + Tab | Complete slash command | Filtered commands |
| Tab (no prefix) | Complete current input | Mode-dependent |

### @ Menu vs Tab Completion

**@ Menu** (Entity References):
- Triggered by pressing `@`
- Shows things you can **reference/mention**
- Scoped to “inputs”: files, URLs, symbols
- Selection inserts `@path/to/file` into input

**Tab Completion** (Input Expansion):
- Triggered by pressing Tab
- Completes what you’re **currently typing**
- Mode-dependent: commands, arguments, paths
- Selection replaces/extends current word

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  InputReader                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Keystroke Handler                                        │  │
│  │  - Detects @ keypress → trigger EntityMenu                │  │
│  │  - Detects Tab → trigger Completer                        │  │
│  │  - Detects / at start → trigger SlashMenu                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                   │
│              ▼               ▼               ▼                   │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐        │
│  │  EntityMenu (@) │ │  Completer  │ │  SlashMenu (/)  │        │
│  │  - Files        │ │  - History  │ │  - /help        │        │
│  │  (future: URLs, │ │  - Commands │ │  - /quit        │        │
│  │   symbols)      │ │  - Args     │ │  - /status      │        │
│  └─────────────────┘ └─────────────┘ └─────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. EntityMenu (@ trigger)

```typescript
interface EntityMenu {
  // Get entities to show in @ menu
  getEntities(filter: string): Entity[];

  // Render menu below current line
  renderMenu(entities: Entity[], selectedIndex: number): void;

  // Handle navigation (up/down/enter/escape)
  handleKey(key: string): MenuAction;
}

interface Entity {
  type: 'file';        // Only files for now; future: 'url' | 'symbol'
  name: string;        // Display name
  value: string;       // What gets inserted
  description?: string; // Optional context (future)
}
```

#### 2. File Entity Source

```typescript
// File source - project files (only entity type for Phase 1)
class FileEntitySource {
  getEntities(filter: string, limit = 20): Entity[] {
    // List files matching filter
    // Start simple: git-tracked files in project
  }
}
```

Future entity sources (URLs, symbols) would implement the same interface.

#### 3. Menu Rendering

Menus are rendered **below the input line** using ANSI sequences:

```typescript
function renderMenu(items: string[], selected: number): void {
  // Save cursor position
  process.stdout.write('\x1b[s');

  // Move to next line and render menu
  for (let i = 0; i < items.length; i++) {
    process.stdout.write('\n');
    if (i === selected) {
      process.stdout.write(`\x1b[7m ${items[i]} \x1b[0m`); // Inverted
    } else {
      process.stdout.write(`  ${items[i]}`);
    }
  }

  // Restore cursor position
  process.stdout.write('\x1b[u');
}

function clearMenu(itemCount: number): void {
  // Clear menu lines below input
  process.stdout.write('\x1b[s'); // Save position
  for (let i = 0; i < itemCount; i++) {
    process.stdout.write('\n\x1b[2K'); // Next line, clear it
  }
  process.stdout.write('\x1b[u'); // Restore position
}
```

### Menu Navigation

| Key | Action |
| --- | --- |
| `@` | Open @ menu (or insert @ if menu open) |
| Up/Down | Navigate menu items |
| Tab/Enter | Select current item |
| Escape | Close menu, keep @ in input |
| Continue typing | Filter menu items |
| Backspace past @ | Close menu, remove @ |

### Interplay: @ + Tab

When @ menu is open:
- **Tab** = Select highlighted item (same as Enter)
- **Typing** = Filter menu items
- **Tab with no menu** = Falls through to regular Tab completion

Example flow:
```
you> @              ← @ pressed, menu appears
    ┌──────────────────┐
    │ src/lib/input.ts │  ← highlighted
    │ src/lib/output.ts│
    │ src/bin.ts       │
    └──────────────────┘

you> @inp            ← user types "inp", menu filters
    ┌──────────────────┐
    │ src/lib/input.ts │  ← only match
    └──────────────────┘

you> @src/lib/input.ts  ← Tab pressed, item inserted
```

## Implementation Plan

### Phase 1: @ Menu Trigger

**Goal:** Pressing @ immediately shows a menu of files/entities.

- [ ] Intercept `@` keypress in InputReader (requires raw mode or readline
  customization)
- [ ] Create `EntityMenu` component with menu rendering
- [ ] Implement `FileEntitySource` - list project files
- [ ] Menu navigation: Up/Down to select, Tab/Enter to confirm, Escape to cancel
- [ ] Filter menu as user types after @
- [ ] Insert selected entity as `@path/to/file` into input
- [ ] Clear menu when selection made or cancelled
- [ ] Preserve existing Tab completion behavior (interplay)

### Phase 2: Enhanced File Menu (Future)

**Goal:** Improve the file menu UX.

- [ ] Add relevance ranking (recently used, file type priority)
- [ ] Smart filtering (fuzzy match, path segments)
- [ ] Limit menu height, add scroll indicators
- [ ] Add file type icons/indicators (optional, if terminal supports)

### Phase 2b: Additional Entity Types (Future)

**Goal:** Extend @ menu beyond files.

- [ ] Add `UrlEntitySource` - recently mentioned URLs
- [ ] Add `SymbolSource` - functions, classes in scope
- [ ] Add description/context for entities in menu

### Phase 3: Prompt Suggesters (Future)

**Goal:** Pluggable APIs that return suggestions for prompts based on input and context.

A prompt suggester is a module that:
1. Receives the current input text and context
2. Returns ranked suggestions that could complete or replace the input
3. Can use lexical matching, semantic matching, or external APIs

**Interface:**

```typescript
interface PromptSuggester {
  name: string;

  // Return suggestions for the current input
  getSuggestions(input: string, context: SuggestionContext): Promise<Suggestion[]>;

  // Optional: preload/warm up (e.g., load embeddings)
  initialize?(): Promise<void>;
}

interface SuggestionContext {
  mode: InputMode;           // shell | nl | slash
  cwd: string;               // Current working directory
  history: string[];         // Recent inputs
  conversationContext?: string; // Summary of recent conversation
}

interface Suggestion {
  value: string;             // The suggestion text
  display?: string;          // Display text (if different)
  description?: string;      // Brief description
  score: number;             // 0-100 ranking score
  replaceInput: boolean;     // Replace entire input vs extend
  source: string;            // Which suggester provided this
}
```

**Built-in suggesters:**

| Suggester | Input | Output | Use Case |
| --- | --- | --- | --- |
| `HistorySuggester` | Partial input | Matching history entries | "git sta" → "git status" |
| `FaqSuggester` | NL question | Matching FAQ questions | "how do I" → "How do I list files?" |
| `CommandSuggester` | Partial command | Shell commands from PATH | "doc" → "docker", "docker-compose" |

**Example: FAQ Suggester**

```typescript
class FaqSuggester implements PromptSuggester {
  name = 'faq';
  private faqs: FaqEntry[];

  async getSuggestions(input: string, context: SuggestionContext): Promise<Suggestion[]> {
    if (context.mode !== 'nl') return [];

    // Lexical matching first (fast)
    const lexicalMatches = this.faqs
      .filter(faq => faq.question.toLowerCase().includes(input.toLowerCase()))
      .map(faq => ({
        value: faq.question,
        description: faq.shortAnswer,
        score: this.scoreMatch(input, faq.question),
        replaceInput: true,
        source: 'faq',
      }));

    return lexicalMatches.slice(0, 10);
  }
}
```

**Future: Semantic matching**

Like kash’s `HelpIndex`, we could add embedding-based semantic matching:

```typescript
class SemanticFaqSuggester implements PromptSuggester {
  name = 'semantic-faq';
  private embeddings: EmbeddingIndex;

  async getSuggestions(input: string, context: SuggestionContext): Promise<Suggestion[]> {
    // Only for longer NL inputs
    if (input.length < 10 || context.mode !== 'nl') return [];

    // Rank by embedding similarity
    const hits = await this.embeddings.rankByRelatedness(input, { max: 5, minScore: 0.25 });
    return hits.map(hit => ({
      value: hit.doc.question,
      score: hit.relatedness * 100,
      replaceInput: true,
      source: 'semantic-faq',
    }));
  }
}
```

**Integration with completion system:**

```typescript
class SuggestionManager {
  private suggesters: PromptSuggester[] = [];

  register(suggester: PromptSuggester): void {
    this.suggesters.push(suggester);
  }

  async getSuggestions(input: string, context: SuggestionContext): Promise<Suggestion[]> {
    // Run all suggesters in parallel
    const results = await Promise.all(
      this.suggesters.map(s => s.getSuggestions(input, context))
    );

    // Merge and rank by score
    return results.flat().sort((a, b) => b.score - a.score);
  }
}
```

**Tasks:**

- [ ] Define `PromptSuggester` interface
- [ ] Create `SuggestionManager` to orchestrate multiple suggesters
- [ ] Implement `HistorySuggester` (lexical matching against history)
- [ ] Implement `FaqSuggester` with static FAQ list
- [ ] Integrate suggestions with Tab completion and @ menu
- [ ] (Future) Add `SemanticFaqSuggester` with embedding support

### Phase 4: Ghost Text (Future)

**Goal:** Passive inline suggestions as you type.

- [ ] Switch to raw mode for character-by-character input
- [ ] Implement ghost text rendering (dimmed text after cursor)
- [ ] Use `SuggestionManager` to get suggestions
- [ ] Accept with Right-arrow or Tab (when no menu open)
- [ ] Ensure readline keybindings still work
- [ ] Config option to disable

**Note:** Ghost text is a separate concern and may be implemented independently or
deferred to Clam overlay support.

* * *

## Learnings from kash/xonsh Completion System

Researched [kash](https://github.com/jlevy/kash) completion implementation for patterns
to adopt.

### Architecture Patterns

**1. Pluggable Completers**

kash/xonsh registers multiple completers, each handling specific contexts:

```python
add_one_completer("command_completer", command_completer, "start")
add_one_completer("help_completer", help_completer, "start")
add_one_completer("at_prefix_completer", at_prefix_completer, "start")
```

Each completer is a function decorated with `@contextual_completer` that receives
context and returns completions or `None`.

**2. Completion Groups and Scoring**

Completions are grouped and scored for ranking:

```python
class CompletionGroup(Enum):
    top_suggestion = 0  # Highest priority
    kash = 1
    standard = 2
    help = 3
    # ...
```

Each completion has a `score` (0-100) and `group` for sorting.

**3. Two-Stage Completion (Lexical → Semantic)**

```python
# First Tab: Fast lexical matching
lex_completions = get_help_completions_lexical(query)

# Second Tab: Slower semantic matching (embeddings)
if state.more_results_requested:
    semantic_completions = get_help_completions_semantic(query)
```

This provides fast results immediately, with richer results on demand.

**4. NL Detection**

```python
def is_nl_words(context) -> bool:
    """Check if input looks like natural language."""
    return looks_like_nl(full_commandline(context))

def is_assist_request(context) -> bool:
    """Check if starts with space or '?'."""
    return text.startswith(" ") or text.startswith("?")
```

**5. Embedding-Based Semantic Search**

```python
class HelpIndex:
    def rank_docs(self, query: str, max: int = 10, min_cutoff: float = 0.5):
        ranked_docs = rank_by_relatedness(query, self.embeddings)
        # Filter by min_cutoff and return top matches
```

Embeddings are pre-computed and cached for performance.

### Key Takeaways for clam-code

| Pattern | kash Implementation | clam-code Approach |
| --- | --- | --- |
| Pluggable completers | `add_one_completer()` | `SuggestionManager.register()` |
| Scored completions | `ScoredCompletion` class | `Suggestion` interface |
| Two-stage completion | Lexical first, semantic on 2nd Tab | Same pattern |
| NL detection | `looks_like_nl()` heuristics | Reuse mode detection |
| Embeddings | `HelpIndex` with cached embeddings | Future phase |
| Context object | `CompletionContext` | `SuggestionContext` |

## Testing Strategy

### Unit Tests

- EntityMenu renders correct ANSI sequences
- FileEntitySource returns filtered files correctly
- Menu navigation (up/down/select) works
- @ insertion produces correct output

### Integration Tests

- Press @, verify menu appears
- Type filter text, verify menu filters
- Select item, verify inserted into input
- Escape closes menu without inserting
- Tab still works for regular completion when @ menu not open

### Manual Testing

- Verify scrollback not corrupted by menu rendering
- Test over SSH connection
- Test in various terminals (iTerm, Terminal.app, Ghostty)
- Verify menu appears/disappears cleanly
- Test with large file lists (performance)

## Open Questions

1. **How to intercept @ keypress?**
   - Option A: Raw mode (full control, more complex)
   - Option B: Readline hook/extension (if available)
   - Recommendation: Try readline first, fall back to raw mode

2. **What files to show in @ menu?**
   - All files? Only src/? Respect .gitignore?
   - Recommendation: Git-tracked files only, limit to 20
   - Future: Add relevance ranking, recently used files first

3. **Menu position - below input or inline?**
   - Below is simpler and standard (like fzf)
   - Recommendation: Below input line

4. **Should @ work mid-line?**
   - Example: `please read @src/file.ts and fix it`
   - Recommendation: Yes, detect @ anywhere in input

## References

- [Terminal UI Libraries Research](../../research/active/research-2026-02-03-terminal-ui-libraries-for-typescript.md)
- [Richer Terminal Shell UIs Research](../../research/active/research-2026-02-03-richer-terminal-shell-uis.md)
- [clam-code ACP Client Spike](./plan-2026-02-03-clam-acp-client-spike.md) - Current
  input implementation
- [Current input.ts](../../../../packages/clam/src/lib/input.ts) - Existing Tab
  completion code
- [fzf](https://github.com/junegunn/fzf) - Reference for menu rendering below input
- [Slack @ mentions](https://slack.com) - Reference for @ trigger UX
- [GitHub @ mentions](https://github.com) - Reference for @ entity menus
