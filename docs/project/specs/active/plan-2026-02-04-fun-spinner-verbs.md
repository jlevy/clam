# Feature: Fun Spinner Verbs

**Date:** 2026-02-04 (last updated 2026-02-04)

**Author:** Joshua Levy

**Status:** Draft

## Overview

Implement a whimsical, aquatic-themed spinner with animated progress verbs for Clam.
Similar to Claude Code’s spinner words feature, but with a distinct personality that
reflects Clam’s shell/ocean theme.

## Goals

- Create a visually engaging spinner that reflects the “clam” branding
- Display randomly-selected aquatic-themed verbs while processing
- Animate the verb display with a typewriter-style effect followed by ellipsis
- Make the experience delightful and memorable

## Non-Goals

- User customization of spinner verbs (future enhancement)
- Fetching dynamic verbs from a server
- Spinner themes or color customization

## Background

Claude Code uses ~90 whimsical “thinking” verbs (like “Cogitating...”, “Pondering...”,
“Brewing...”) displayed during processing.
This creates a playful, human-like feel.
Clam should have its own personality - all verbs should have an aquatic/marine/shell
theme to reinforce the product identity.

## Design

### Approach

1. **Spinner Character**: Use an aquatic-themed spinner character set (e.g., shell
   stages, wave, bubbles, or fish)
2. **Verb Animation**:
   - Display verb (e.g., “Swimming”)
   - Quick fade/disappear animation
   - Typewriter-style re-typing of a new random verb
   - Animate ellipsis appearing (dot by dot)
   - Brief pause, then repeat with a different verb
3. **Verb Selection**: Randomly select from a curated list of ~80-100 aquatic-themed
   verbs

### Spinner Character Options

Option A - Shell opening/closing:
```
🦪 ◖ ◗ ◖ ◗
```

Option B - Bubble/wave cycle:
```
∘ ○ ◯ ● ◯ ○ ∘
```

Option C - Simple wave (recommended):
```
─ ~ ≈ ≋ ≈ ~
```
(calm → ripple → waves → strong → waves → ripple → repeat)

Option D - Unicode shell/marine:
```
🐚 🦪 🐚 🦪
```

Option E - ASCII pearl in shell:
```
(  ) ( .) (. ) (  )
```

**Recommendation**: Use Option C (wave characters: `─ ~ ≈ ≋ ≈ ~`) as they render
reliably across terminals and convey a natural wave cycle (calm → crest → calm).

### Animation Timing

```
Frame 1: "Swimming"     (200ms)
Frame 2: "Swimming."    (150ms)
Frame 3: "Swimming.."   (150ms)
Frame 4: "Swimming..."  (400ms hold)
Frame 5: [quick clear]  (50ms)
Frame 6: [new verb types in char by char] (30ms per char)
Repeat
```

### Verb Categories

All verbs should have creative connections to:
- Water movement (swimming, flowing, drifting)
- Marine creatures (clamming, crabling, jellyfishing)
- Ocean phenomena (tiding, waving, currenting)
- Shell/mollusk behaviors (filtering, pearling, burrowing)
- Aquatic environments (reefing, kelping, coralizing)

## Aquatic Verb List

### Movement & Flow

- Swimming
- Drifting
- Floating
- Gliding
- Undulating
- Swirling
- Eddying
- Streaming
- Cascading
- Surging
- Rippling
- Welling
- Billowing
- Cresting
- Ebbing
- Flowing

### Marine Creature Behaviors

- Filtering (like clams filter water)
- Siphoning (clam feeding)
- Burrowing (clams burrow in sand)
- Pearling (pearl formation)
- Schooling
- Shoaling
- Sounding (whale diving)
- Breaching
- Spouting
- Finning
- Tentacling
- Jellying
- Inking
- Scuttling
- Sidling
- Pinching
- Clacking

### Ocean Phenomena

- Tiding
- Waving
- Foaming
- Frothing
- Misting
- Spraying
- Splashing
- Lapping
- Roiling
- Churning
- Swelling
- Plunging
- Surfing

### Shell & Mollusk Specific

- Shelling
- Clamming
- Oystering
- Valving
- Hingling
- Nacring (nacre = mother of pearl)
- Calcifying
- Encrusting
- Anchoring
- Secreting

### Nautical & Maritime

- Charting
- Fathoming
- Sounding
- Keelhauling
- Barnacling
- Docking
- Mooring
- Harboring
- Navigating
- Helming

### Aquatic Environment

- Reefing
- Kelping
- Coralizing
- Abyssing
- Trenching
- Shallowing
- Deepening
- Tidepooling

### Whimsical & Playful

- Bubbling
- Gurgling
- Burbling
- Plinking
- Plopping
- Splooshing
- Whooshing
- Shimmering
- Glinting
- Glistening
- Iridescencing

### Obscure but Real English Words

- Brackishing (becoming brackish)
- Brining
- Salting
- Marinading
- Steeping
- Percolating (water through)
- Seeping
- Wicking
- Imbibing
- Suffusing
- Permeating
- Saturating
- Infusing

### Creature-Inspired Verbs

- Anemoning
- Urchining
- Starfishing
- Seahorsing
- Octopusing
- Squidding
- Shrimping
- Lobstering
- Crabbing
- Mantising (mantis shrimp)
- Nautilusing
- Conching

### Shell Double Meanings (Aquatic Shell + Command Shell)

- Shelling (both shells!)
- Spawning (processes + fish)
- Forking (processes + rivers)
- Piping (Unix pipes + underwater pipes)
- Streaming (data + water)
- Buffering (memory + waves)
- Flushing (I/O + water)
- Sourcing (shell scripts + springs)
- Scripting (shell scripts + messages in bottles)
- Executing (commands + precision)
- Parsing (code + currents)
- Echoing (shell echo + sonar)
- Aliasing (shell aliases + marine pseudonyms)
- Exporting (env vars + shipping)
- Queuing (process queues + fish lines)
- Channeling (data channels + water channels)
- Routing (network + navigation)
- Polling (events + fishing)
- Signaling (Unix signals + whale calls)
- Terminating (processes + shore)
- Backgrounding (jobs + deep sea)
- Suspending (processes + floating)

### Scientific/Technical (Aquatic)

- Osmoregulating
- Thermoregulating
- Photosynthesizing (like algae)
- Bioluminescing
- Echolocating
- Sonarping

## Implementation Plan

### Phase 1: Core Spinner Infrastructure

- [ ] Create spinner character set and rotation logic
- [ ] Implement verb selection system with random shuffling
- [ ] Build typewriter animation for verb display
- [ ] Add ellipsis animation sequence
- [ ] Integrate with existing processing state

### Phase 2: Polish & Testing

- [ ] Fine-tune animation timings for natural feel
- [ ] Test across different terminal emulators
- [ ] Add fallback for terminals without Unicode support
- [ ] Verify ANSI escape sequences work correctly

## Testing Strategy

- Manual testing across macOS Terminal, iTerm2, VS Code terminal
- Verify animation timing feels natural and not distracting
- Check spinner clears properly on completion
- Test interrupt behavior (Ctrl+C) cleans up spinner state

## Open Questions

1. Which spinner character set looks best in practice?
2. Should the verb animation speed adapt to processing time?
3. Minimum number of verbs to avoid obvious repetition?

## References

- Claude Code spinner implementation (90 hardcoded words)
- [Existing spinner.tsx implementation](../../src/ui/spinner.tsx)
