# Research: Shell UX and TypeScript Performance

**Date:** 2026-02-04

**Author:** Claude (research assistant)

**Status:** Complete

## Overview

This research brief explores shell experiences and shell UI in TypeScript, investigating existing systems, performance optimization techniques, and options for making CLI applications feel more responsive. Key areas include TypeScript shell frameworks, modern shell alternatives, readline performance, Rust-based CLI editors, and the potential benefits of migrating to Bun.

## Questions to Answer

1. What TypeScript shell frameworks and bash wrappers exist?
2. Are there modern shells (beyond bash/zsh) that could inspire or integrate with TypeScript?
3. How can we optimize readline/input performance in TypeScript?
4. Would delegating to Rust-based CLI editors improve responsiveness?
5. Would migrating to Bun improve startup time and I/O performance?

## Scope

**Included:**

- TypeScript/JavaScript shell frameworks and scripting tools
- Modern shell alternatives (nushell, fish, etc.)
- Node.js readline performance optimization
- Rust-based line editors (reedline, rustyline)
- Bun vs Node.js performance benchmarks
- Terminal emulator latency considerations

**Excluded:**

- Full terminal emulator implementation
- Operating system shell integration details
- Security models for untrusted code execution (brief coverage only)

---

## Findings

### 1. TypeScript Shell Frameworks and Wrappers

#### Google zx

[Google zx](https://github.com/google/zx) is the most mature and widely-used solution for shell scripting in JavaScript/TypeScript.

**Key Features:**

- `$` tagged template literals for shell commands
- Cross-platform child process management with proper escaping
- Built-in utilities: `cd()`, `question()`, access to `chalk`, `minimist`, `fetch`, `fs-extra`
- TypeScript definitions included
- Async/await support throughout

**Limitations:**

- Still spawns real shell processes
- Platform-dependent behavior for some commands
- Not a shell replacement, just better scripting

#### Vercel just-bash

[just-bash](https://github.com/vercel-labs/just-bash) is a recent (2026) TypeScript reimplementation of bash, primarily for AI agents.

**Key Features:**

- From-scratch TypeScript implementation of common commands (grep, sed, awk, jq, cat, ls)
- In-memory virtual filesystem
- No shell process spawning—runs entirely in JavaScript
- Secure by default: no network access, protected against infinite loops
- Optional URL-filtered network access via curl

**Use Case:** Ideal for sandboxed environments where you need shell-like behavior without host system access. Could be useful for clam's shell simulation mode.

#### Bun Shell

[Bun Shell](https://bun.com/blog/the-bun-shell) is an embedded shell language/interpreter in Bun.

**Key Features:**

- Cross-platform (Windows, Linux, macOS)
- Native implementations of common commands (ls, cd, rm)
- Bash-like syntax with `$` template literals
- Glob patterns, pipes, redirection, environment variables
- Auto-escaping prevents shell injection
- Commands run concurrently (unlike sequential bash)

**Example:**

```typescript
import { $ } from 'bun';
await $`ls *.js`;
```

**Compelling Advantage:** Eliminates the need for cross-platform polyfills like rimraf (60M downloads/week).

#### Other Options

| Project                                             | Description                         | Status         |
| --------------------------------------------------- | ----------------------------------- | -------------- |
| [tish](https://github.com/shqld/tish)               | Emulates shell script in TypeScript | Experimental   |
| [vl (Violet)](https://github.com/japiirainen/vl)    | Deno-based shell scripting          | Active         |
| [bashscript](https://github.com/niieani/bashscript) | TypeScript to bash transpiler       | Niche use case |

### 2. Modern Shell Alternatives

#### Nushell

[Nushell](https://www.nushell.sh/) is a modern shell with structured data at its core.

**Key Features:**

- Everything is structured data (tables, records)—no need for jq
- Proper typing, validated at parse-time
- Powerful plugin system
- Cross-platform (Linux, macOS, Windows, BSD)
- Inspiration from PowerShell and functional programming

**Relevance to clam:** Nushell's approach of treating output as structured data could inspire how clam presents command output to users and agents.

**Drawback:** Interactive completions lag behind fish shell.

#### Fish Shell

[Fish](https://fishshell.com/) is known for its user-friendly design.

**Key Features:**

- Excellent out-of-box experience with minimal configuration
- Syntax highlighting, autosuggestions, tab completions
- Recently rewritten in Rust (improved performance)
- Widely regarded as having the best interactive experience

**Relevance to clam:** Fish's completion and autosuggestion UX is the gold standard for interactive shells.

#### Key Insight

> "In 2023 if someone asked us to design a system, we wouldn't design POSIX. If someone asked us to design a shell language, we wouldn't design bash/zsh."

Modern shells prioritize:

1. Structured data over text streams
2. Better error messages and type checking
3. Superior interactive experience (completions, highlighting)
4. Cross-platform consistency

### 3. Shell/Readline Performance Optimization

#### Node.js Readline Limitations

From [Node.js documentation](https://nodejs.org/api/readline.html):

> "Performance is not on par with the traditional 'line' event API. Use 'line' instead for performance-sensitive applications."

**Best Practices:**

- Use event-based `'line'` listener, not async iterators
- Set `terminal: false` for non-interactive processing
- Avoid readline-sync for interactive use (uses slow file piping)
- ANSI escape sequences may not parse correctly on Windows CMD

**Latency Considerations:**

- Node.js readline adds measurable latency compared to native solutions
- TTY raw mode processing has inherent overhead
- Each keypress involves JavaScript event loop processing

#### Terminal Emulator Impact

From [Dan Luu's terminal latency research](http://danluu.com/term-latency/):

| Terminal            | Latency                       |
| ------------------- | ----------------------------- |
| xterm               | ~3.5ms                        |
| Alacritty           | ~4.2ms                        |
| Kitty               | ~5-7ms (with `input_delay=0`) |
| iTerm2              | ~10-15ms                      |
| Hyper (Electron)    | ~40ms                         |
| Terminus (Electron) | ~100ms                        |

**Key Findings:**

- GNOME/Mutter compositing adds ~20ms latency
- Electron/web-based terminals are significantly slower
- GPU acceleration helps throughput but doesn't necessarily reduce input latency
- Target: <20ms for perceptible responsiveness, <10ms for optimal feel

### 4. Rust-Based CLI Editors

#### Reedline

[Reedline](https://github.com/nushell/reedline) powers Nushell's interactive experience.

**Features:**

- Configurable keybindings (emacs and vi modes)
- Syntax highlighting with content awareness
- Autocompletion with graphical menu or inline cycling
- Persistent history with SQLite or plaintext backends
- Multiline editing support
- Undo support
- "Full duplex" mode: background output while input prompt is active

**Integration Approach:** Could be wrapped as a native Node.js addon using napi-rs or Neon.

#### Rustyline

[Rustyline](https://github.com/kkawakam/rustyline) is a readline implementation in Rust based on linenoise.

**Simpler than reedline** but still provides:

- History management
- Completion support
- Hint display
- Unicode support

#### Integration Options for Node.js

| Approach        | Pros                        | Cons                         |
| --------------- | --------------------------- | ---------------------------- |
| **napi-rs**     | Stable ABI, no node-gyp     | Build complexity             |
| **Neon**        | Good DX, active development | Additional dependency        |
| **WebAssembly** | Browser compatible          | Performance overhead for I/O |
| **FFI**         | Direct calls                | Unsafe, complex setup        |

**Performance Reality Check:**

> "Native addons are the 'last 10x' move, not the first. If your performance issue is I/O latency, native addons won't help. If you haven't profiled, you're guessing."

Rust can be 3-10x faster for CPU-bound operations, but readline is largely I/O bound.

### 5. Bun vs Node.js Performance

#### Startup Time

| Runtime | Typical Startup   |
| ------- | ----------------- |
| Node.js | ~5 seconds (cold) |
| Bun     | ~2 seconds (cold) |

> "V8 optimizes for long-running processes. JavaScriptCore optimizes for fast startup. This single difference explains most benchmark results."

#### HTTP Server Throughput (Various Benchmarks)

| Runtime    | Requests/sec   |
| ---------- | -------------- |
| Node.js 22 | 52,000-65,000  |
| Deno 2.0   | 48,000-75,000  |
| Bun 1.1    | 89,000-180,000 |

#### I/O Performance

- Bun uses io_uring on Linux for significant I/O advantages
- This benefit is Linux-specific

#### Package Installation

- `bun install`: 2-3 seconds
- `npm install`: 20-60+ seconds (even with warm cache)

#### Test Execution

- `bun test` can be 5-10x faster than Jest on Node.js

#### Key Consideration

> "Bun is fastest. Deno is most secure. Node.js is most compatible. All three are production-ready in 2026."

**Note:** Anthropic acquired Bun in December 2025, though it remains open-source.

### 6. Alternative: Ink for Terminal UI

[Ink](https://github.com/vadimdemedes/ink) provides React-based terminal UIs.

**Performance Features:**

- Frame rate control to prevent excessive re-rendering
- Incremental rendering (only update changed lines)
- `<Static>` component for efficient rendering of large lists

**Used by:** Gatsby, Parcel, Yarn, Terraform, Prisma, Shopify, NYT

**Relevance:** Could provide a more declarative approach to clam's UI rendering, though may add overhead for simple input/output loops.

### 7. Python prompt_toolkit Reference

[prompt_toolkit](https://github.com/prompt-toolkit/python-prompt-toolkit) is considered the gold standard for Python CLI input.

**Features:**

- Pure Python, no external dependencies (except Pygments)
- Syntax highlighting while typing
- Multi-line editing
- Advanced completion
- Emacs and Vi keybindings
- Mouse support
- Auto-suggestions (like fish)

**Performance Note:** Version 2.0+ supports vt100 escape codes natively on Windows 10, enabling "much faster rendering."

**Relevance:** Demonstrates that a high-quality interactive experience is achievable without native code. A TypeScript equivalent with similar design philosophy could be valuable.

---

## Options Considered

### Option A: Optimize Current Node.js + readline Approach

**Description:** Keep current architecture, apply performance optimizations.

**Actions:**

- Use event-based readline API instead of async iterators
- Profile and optimize keypress handling
- Consider batching terminal writes
- Minimize work in the event loop hot path

**Pros:**

- No migration risk
- Maintains Node.js ecosystem compatibility
- Simpler deployment

**Cons:**

- Fundamental readline performance ceiling
- Limited improvement potential (~10-20% at best)

### Option B: Migrate to Bun

**Description:** Switch runtime from Node.js to Bun for improved startup and I/O.

**Actions:**

- Test clam under Bun for compatibility
- Use Bun Shell for shell command execution
- Leverage Bun's faster test runner

**Pros:**

- 2-3x faster startup time
- Significantly faster I/O on Linux (io_uring)
- Cross-platform shell built-in
- Faster package installation for users
- Anthropic owns Bun (strategic alignment)

**Cons:**

- Newer ecosystem, potential edge cases
- Some npm packages may not work
- Documentation still catching up

### Option C: Hybrid Rust/TypeScript with Native Addon

**Description:** Implement line editing in Rust (reedline/rustyline), expose via NAPI.

**Actions:**

- Create napi-rs bindings for reedline
- Handle input in Rust, pass completed lines to TypeScript
- Keep business logic in TypeScript

**Pros:**

- Best possible input latency
- Access to mature line editing features
- Type-safe FFI boundary

**Cons:**

- Significant development effort
- Binary distribution complexity
- Build toolchain requirements for users
- May not address actual bottlenecks

### Option D: Leverage just-bash for Sandboxed Shell

**Description:** Use Vercel's just-bash for shell command execution within TypeScript.

**Actions:**

- Integrate just-bash for safe shell command parsing
- Use for AI agent tool execution
- Fall back to real shell for unsupported commands

**Pros:**

- No shell process spawning
- Secure by design
- Consistent cross-platform behavior
- Perfect for agent sandboxing

**Cons:**

- Not a complete bash implementation
- May need real shell for complex commands
- Additional dependency

---

## Recommendations

### Short-term (v0.2)

1. **Profile First**: Before any optimization, instrument the current codebase to identify actual bottlenecks. The issue may not be where expected.

2. **Switch to Event-based Readline**: Change from async iterators to `'line'` event listeners per Node.js recommendations.

3. **Batch Terminal Writes**: Accumulate escape sequences and write in batches to reduce syscall overhead.

### Medium-term (v0.3-v0.4)

4. **Evaluate Bun Migration**: Create a compatibility branch and benchmark:
   - Startup time improvement
   - Shell command execution with Bun Shell
   - Overall responsiveness feel

   This is likely the highest-impact change for perceived performance.

5. **Integrate just-bash for Agent Mode**: When clam is used by AI agents, use just-bash for sandboxed shell execution. This provides security without sacrificing capability for the common commands agents use.

### Long-term (v1.0+)

6. **Consider Rust Line Editor**: Only if profiling shows readline is the bottleneck AND Bun migration doesn't resolve it, consider wrapping reedline via napi-rs.

7. **Design Structured Output**: Take inspiration from nushell's structured data approach. When possible, provide structured output that tools can consume directly rather than text that needs parsing.

### Not Recommended

- **Electron-based UI**: Would add 40-100ms latency, opposite of goal
- **Full shell reimplementation**: just-bash and Bun Shell already exist
- **Ink/React for input loop**: Overhead not justified for simple input/output

---

## Next Steps

- [ ] Profile current clam input loop with timestamps at each stage
- [ ] Create Bun compatibility branch and run full test suite
- [ ] Benchmark startup time: Node.js vs Bun
- [ ] Benchmark interactive input latency: Node.js readline vs Bun
- [ ] Evaluate just-bash for sandboxed shell mode
- [ ] Document findings and make migration decision

---

## References

### TypeScript Shell Frameworks

- [Google zx](https://github.com/google/zx) - A tool for writing better scripts
- [Vercel just-bash](https://github.com/vercel-labs/just-bash) - Bash for Agents
- [Bun Shell](https://bun.com/blog/the-bun-shell) - Cross-platform shell scripting
- [tish](https://github.com/shqld/tish) - Shell script emulation in TypeScript
- [vl (Violet)](https://github.com/japiirainen/vl) - Shell scripting in TypeScript for Deno

### Modern Shells

- [Nushell](https://www.nushell.sh/) - A new type of shell
- [Fish Shell](https://fishshell.com/) - The user-friendly command line shell
- [The case for Nushell](https://www.sophiajt.com/case-for-nushell/) - Why modern shells matter
- [Shell Comparison](https://gist.github.com/pmarreck/b7bd1c270cb77005205bf91f80c4e130) - Bash vs Elvish vs NuShell vs others

### Rust CLI Editors

- [Reedline](https://github.com/nushell/reedline) - A feature-rich line editor
- [Rustyline](https://github.com/kkawakam/rustyline) - Readline implementation in Rust
- [napi-rs](https://github.com/napi-rs/napi-rs) - Rust Node.js native addon framework
- [Neon](https://github.com/neon-bindings/neon) - Rust bindings for Node.js

### Performance & Benchmarks

- [Bun vs Node.js 2025](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide) - Performance comparison
- [Bun vs Deno vs Node.js 2026](https://dev.to/jsgurujobs/bun-vs-deno-vs-nodejs-in-2026-benchmarks-code-and-real-numbers-2l9d) - Benchmarks and real numbers
- [Terminal Latency](http://danluu.com/term-latency/) - Dan Luu's terminal latency research
- [Node.js Readline](https://nodejs.org/api/readline.html) - Official documentation

### Terminal UI

- [Ink](https://github.com/vadimdemedes/ink) - React for interactive CLI apps
- [terminal-kit](https://github.com/cronvel/terminal-kit) - Terminal utilities for Node.js
- [Python prompt_toolkit](https://github.com/prompt-toolkit/python-prompt-toolkit) - Python CLI reference

### Security

- [Deno Security](https://docs.deno.com/runtime/fundamentals/security/) - Permission model
- [just-bash Security](https://github.com/vercel-labs/just-bash#security) - Sandboxed execution
