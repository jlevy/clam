# Research: Shell UX and TypeScript Performance

**Date:** 2026-02-04

**Author:** Claude (research assistant)

**Status:** Complete

## Overview

This research brief explores shell experiences and shell UI in TypeScript, investigating
existing systems, performance optimization techniques, and options for making CLI
applications feel more responsive.
Key areas include TypeScript shell frameworks, modern shell alternatives, readline
performance, Rust-based CLI editors, and the potential benefits of migrating to Bun.

## Questions to Answer

1. What TypeScript shell frameworks and bash wrappers exist?
2. Are there modern shells (beyond bash/zsh) that could inspire or integrate with
   TypeScript?
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

* * *

## Findings

### 1. TypeScript Shell Frameworks and Wrappers

#### Google zx

[Google zx](https://github.com/google/zx) is the most mature and widely-used solution
for shell scripting in JavaScript/TypeScript (~1.2M weekly downloads).

**Key Features:**

- `$` tagged template literals for shell commands
- Cross-platform child process management with proper escaping
- Built-in utilities: `cd()`, `question()`, `which()`, access to `chalk`, `minimist`,
  `fetch`, `fs-extra`, `glob`, `os`, `path`
- TypeScript definitions included
- Async/await support throughout
- Multi-runtime support: Node.js, Bun, Deno, GraalVM

**Example:**

```typescript
#!/usr/bin/env zx
await $`cat package.json | grep name`;

const branch = await $`git branch --show-current`;
await $`deploy --branch=${branch}`; // Auto-escaped

cd('/tmp');
const pythonPath = await which('python');
```

**Limitations:**

- Still spawns real shell processes
- Platform-dependent behavior for some commands
- Not a shell replacement, just better scripting
- Heavy dependencies (many npm packages bundled)

**Variant:**
[zx@lite](https://dev.to/antongolub/zxlite-minimalistic-shell-scripting-with-tsjs-superpowers-1j50)
offers a minimalistic version with fewer dependencies.

#### Vercel just-bash

[just-bash](https://github.com/vercel-labs/just-bash) is a 2026 TypeScript
reimplementation of bash, primarily designed for AI agents.
It’s the most complete pure-TypeScript bash implementation available.

**Architecture:** Pure TypeScript with in-memory virtual filesystem.
No subprocess spawning—runs entirely in JavaScript.

**Implemented Commands (comprehensive!):**

| Category | Commands |
| --- | --- |
| **File Operations** | `cat`, `cp`, `file`, `ln`, `ls`, `mkdir`, `mv`, `readlink`, `rm`, `rmdir`, `split`, `stat`, `touch`, `tree` |
| **Text Processing** | `awk`, `base64`, `column`, `comm`, `cut`, `diff`, `expand`, `fold`, `grep`/`egrep`/`fgrep`, `head`, `join`, `md5sum`, `nl`, `od`, `paste`, `printf`, `rev`, `rg`, `sed`, `sha1sum`, `sha256sum`, `sort`, `strings`, `tac`, `tail`, `tr`, `unexpand`, `uniq`, `wc`, `xargs` |
| **Data Tools** | `jq` (JSON), `sqlite3`, `xan` (CSV), `yq` (YAML/XML/TOML), optional `python3` |
| **Compression** | `gzip`, `gunzip`, `zcat`, `tar` |
| **Navigation** | `basename`, `cd`, `dirname`, `du`, `echo`, `env`, `export`, `find`, `hostname`, `printenv`, `pwd`, `tee` |
| **Utilities** | `alias`, `bash`, `chmod`, `clear`, `date`, `expr`, `false`, `help`, `history`, `seq`, `sh`, `sleep`, `time`, `timeout`, `true`, `unalias`, `which`, `whoami` |
| **Network** | `curl` (when enabled), `html-to-markdown` |

**Shell Features Supported:**

- Pipes (`|`), redirections (`>`, `>>`, `2>`, `2>&1`, `<`)
- Command chaining (`&&`, `||`, `;`)
- Variable expansion (`$VAR`, `${VAR:-default}`)
- Positional parameters (`$1`, `$@`, `$#`)
- Glob patterns (`*`, `?`, `[...]`)
- Conditionals (`if`/`then`/`else`)
- Functions and local variables
- Loops (`for`, `while`, `until`)
- Symbolic and hard links

**Security Model:**

- Filesystem access restricted to virtual filesystem only
- No binary execution or WASM support
- Network disabled by default
- Configurable execution limits (DOS protection):
  - `maxCallDepth`, `maxCommandCount`, `maxLoopIterations`

**API Example:**

```typescript
import { Bash } from "just-bash";

const env = new Bash({
  files: { "/data/config.json": '{"key": "value"}' },
  executionLimits: { maxCommandCount: 10000 },
});

const result = await env.exec('cat /data/config.json | jq ".key"');
console.log(result.stdout); // "value"
console.log(result.exitCode); // 0
```

**Filesystem Options:**

- `InMemoryFs` (default): Pure in-memory, no disk access
- `OverlayFs`: Copy-on-write over real directories
- `ReadWriteFs`: Direct disk access
- `MountableFs`: Multi-filesystem mounting

**Limitations:**

- No `compgen` for bash completion
- Each `exec()` call is isolated (env vars don’t persist between calls, but FS does)
- Python/SQLite unavailable in browser environments

**Use Case:** Ideal for AI agent sandboxing where you need shell-like behavior without
host system access. Ideal for applications that need to sandbox agent tool execution.

#### Bun Shell

[Bun Shell](https://bun.com/blog/the-bun-shell) is an embedded shell
language/interpreter in Bun.

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

**Compelling Advantage:** Eliminates the need for cross-platform polyfills like rimraf
(60M downloads/week).

**Limitations:**

- Missing `grep`, `sed`, `awk`, `find`, `compgen`
- Bun-only (can’t use in Node.js projects)
- Newer, less battle-tested than alternatives

#### Execa

[Execa](https://github.com/sindresorhus/execa) is the most popular subprocess library
for Node.js (~105M weekly downloads), built on `child_process` but optimized for
programmatic use.

**Key Features:**

- Promise-based API with template string syntax (like zx)
- No escaping or quoting needed—auto-escapes by default
- Execute locally installed binaries without `npx`
- Enhanced Windows support (shebangs, `PATHEXT`, graceful termination)
- Advanced piping with intermediate result retrieval
- IPC message exchange between processes
- Stream conversion (readable/writable/duplex)
- Best TypeScript support of any shell library

**Example:**

```typescript
import { execa, $ } from 'execa';

// Template string syntax
const { stdout } = await $`npm run build`;

// Piping with intermediate access
const { stdout, pipedFrom } = await execa`npm run build`
  .pipe`sort`
  .pipe`head -n 2`;
console.log(pipedFrom[0].stdout); // sort output

// Transform output with generators
const transform = function*(line) {
  if (!line.includes('secret')) yield line;
};
await execa({ stdout: transform })`npm run build`;

// IPC between processes
const subprocess = execaNode`child.js`;
await subprocess.sendMessage({ type: 'start' });
```

**Error Handling:**

```typescript
try {
  await execa`unknown command`;
} catch (error) {
  if (error instanceof ExecaError) {
    console.log(error.shortMessage, error.exitCode);
    console.log(error.stdout, error.stderr);
  }
}
```

**Limitations:**

- Still spawns subprocesses (not sandboxed)
- Depends on system shell availability
- No built-in command implementations

**Use Case:** Best choice for programmatic subprocess control with excellent TypeScript
support. Ideal for user-facing shell mode where full bash compatibility is needed.

#### dax (Deno/Node)

[dax](https://github.com/dsherret/dax) is a cross-platform shell library that “makes
more code work on Windows” with native command implementations.

**Key Features:**

- Cross-platform shell with built-in Windows compatibility
- Native implementations: `cp`, `mv`, `rm`, `mkdir`, `touch`, `cat`, `cd`, `pwd`,
  `echo`, `sleep`, `which`, `export`, `printenv`
- Environment export capability (shell changes can affect parent process)
- Shell options: `pipefail`, `nullglob`, `globstar`
- Clean builder pattern API

**Example:**

```typescript
import $ from "@david/dax";

await $`mkdir -p ./nested/dir`; // Works on Windows!
await $`cp source.txt dest.txt`;

// Output handling
const text = await $`echo hello`.text();
const json = await $`echo '{"x": 1}'`.json();
const lines = await $`echo -e "a\nb"`.lines();

// Error handling
const result = await $`exit 1`.noThrow();
console.log(result.code); // 1
```

**Limitations:**

- Primarily Deno-focused (Node.js support secondary)
- No grep, sed, awk implementations
- Smaller community than execa/zx

**Use Case:** Best for cross-platform scripts that need to work reliably on Windows.

#### ShellJS

[ShellJS](https://www.npmjs.com/package/shelljs) is a synchronous JavaScript
implementation of Unix commands (~10M weekly downloads).

**Key Features:**

- Synchronous API (simple control flow)
- Built-in: `cat`, `chmod`, `echo`, `find`, `grep`, `head`, `ln`, `ls`, `mkdir`, `mv`,
  `pwd`, `rm`, `sed`, `sort`, `tail`, `touch`, `uniq`, `which`
- Familiar shell-like API

**Example:**

```javascript
const shell = require('shelljs');

shell.cd('/tmp');
shell.mkdir('-p', 'output');
shell.cp('-R', 'src/*', 'output/');

const result = shell.grep('TODO', 'src/**/*.js');
const files = shell.find('src').filter(f => f.match(/\.ts$/));
```

**Limitations:**

- **Synchronous only**—blocks event loop
- Older syntax (pre-async/await)
- Slower than alternatives in benchmarks
- Less actively maintained

**Use Case:** Legacy codebases or simple synchronous scripts.
Not recommended for new projects.

#### Other Options

| Project | Description | Status |
| --- | --- | --- |
| [tish](https://github.com/shqld/tish) | Emulates shell script in TypeScript | Experimental |
| [vl (Violet)](https://github.com/japiirainen/vl) | Deno-based shell scripting | Active |
| [bashscript](https://github.com/niieani/bashscript) | TypeScript to bash transpiler | Niche use case |

#### Comprehensive Comparison Table

| Feature | just-bash | Execa | zx | Bun Shell | dax | ShellJS |
| --- | --- | --- | --- | --- | --- | --- |
| **Architecture** | Pure TS reimpl | child_process | child_process | Zig reimpl | child_process | JS reimpl |
| **Weekly Downloads** | New | 105M | 1.2M | Built-in | Smaller | 10M |
| **No subprocess** | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Auto-escape** | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| **grep** | ✅ | ❌* | ❌* | ❌ | ❌ | ✅ |
| **sed** | ✅ | ❌* | ❌* | ❌ | ❌ | ✅ |
| **awk** | ✅ | ❌* | ❌* | ❌ | ❌ | ❌ |
| **jq** | ✅ | ❌* | ❌* | ❌ | ❌ | ❌ |
| **find** | ✅ | ❌* | ❌* | ❌ | ❌ | ✅ |
| **which** | ✅ | ❌* | ✅ | ✅ | ✅ | ✅ |
| **compgen** | ❌ | ❌* | ❌ | ❌ | ❌ | ❌ |
| **Pipes** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Redirects** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Loops/conditionals** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Functions** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Virtual FS** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Sandboxed** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cross-platform** | ✅ | ✅ | ✅ | ✅ | ✅✅ | ✅ |
| **TypeScript** | ✅ | ✅✅ | ✅ | ✅ | ✅ | ⚠️ |
| **Node.js** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Bun** | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **Performance** | Fast | Fast | Fast | Fastest | Fast | Slow |

*\* = delegates to system command via subprocess*

**Key Takeaway:** No single library is perfect.
just-bash has the most built-in commands but lacks `compgen`. Execa has the best
TypeScript support but spawns subprocesses.
Bun Shell is fastest but Bun-only.
The choice depends on your use case—see Options D-G for guidance.

### 2. Modern Shell Alternatives

#### Nushell

[Nushell](https://www.nushell.sh/) is a modern shell with structured data at its core.

**Key Features:**

- Everything is structured data (tables, records)—no need for jq
- Proper typing, validated at parse-time
- Powerful plugin system
- Cross-platform (Linux, macOS, Windows, BSD)
- Inspiration from PowerShell and functional programming

**Relevance:** Nushell’s approach of treating output as structured data could inspire
how shell applications present command output to users and agents.

**Drawback:** Interactive completions lag behind fish shell.

#### Fish Shell

[Fish](https://fishshell.com/) is known for its user-friendly design.

**Key Features:**

- Excellent out-of-box experience with minimal configuration
- Syntax highlighting, autosuggestions, tab completions
- Recently rewritten in Rust (improved performance)
- Widely regarded as having the best interactive experience

**Relevance:** Fish’s completion and autosuggestion UX is the gold standard for
interactive shells.

#### Key Insight

> “In 2023 if someone asked us to design a system, we wouldn’t design POSIX. If someone
> asked us to design a shell language, we wouldn’t design bash/zsh.”

Modern shells prioritize:

1. Structured data over text streams
2. Better error messages and type checking
3. Superior interactive experience (completions, highlighting)
4. Cross-platform consistency

### 3. Shell/Readline Performance Optimization

#### Node.js Readline Limitations

From [Node.js documentation](https://nodejs.org/api/readline.html):

> “Performance is not on par with the traditional ‘line’ event API. Use ‘line’ instead
> for performance-sensitive applications.”

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

From [Dan Luu’s terminal latency research](http://danluu.com/term-latency/):

| Terminal | Latency |
| --- | --- |
| xterm | ~3.5ms |
| Alacritty | ~4.2ms |
| Kitty | ~5-7ms (with `input_delay=0`) |
| iTerm2 | ~10-15ms |
| Hyper (Electron) | ~40ms |
| Terminus (Electron) | ~100ms |

**Key Findings:**

- GNOME/Mutter compositing adds ~20ms latency
- Electron/web-based terminals are significantly slower
- GPU acceleration helps throughput but doesn’t necessarily reduce input latency
- Target: <20ms for perceptible responsiveness, <10ms for optimal feel

### 4. Rust-Based CLI Editors

#### Reedline

[Reedline](https://github.com/nushell/reedline) powers Nushell’s interactive experience.

**Features:**

- Configurable keybindings (emacs and vi modes)
- Syntax highlighting with content awareness
- Autocompletion with graphical menu or inline cycling
- Persistent history with SQLite or plaintext backends
- Multiline editing support
- Undo support
- “Full duplex” mode: background output while input prompt is active

**Integration Approach:** Could be wrapped as a native Node.js addon using napi-rs or
Neon.

#### Rustyline

[Rustyline](https://github.com/kkawakam/rustyline) is a readline implementation in Rust
based on linenoise.

**Simpler than reedline** but still provides:

- History management
- Completion support
- Hint display
- Unicode support

#### Integration Options for Node.js

| Approach | Pros | Cons |
| --- | --- | --- |
| **napi-rs** | Stable ABI, no node-gyp | Build complexity |
| **Neon** | Good DX, active development | Additional dependency |
| **WebAssembly** | Browser compatible | Performance overhead for I/O |
| **FFI** | Direct calls | Unsafe, complex setup |

**Performance Reality Check:**

> “Native addons are the ‘last 10x’ move, not the first.
> If your performance issue is I/O latency, native addons won’t help.
> If you haven’t profiled, you’re guessing.”

Rust can be 3-10x faster for CPU-bound operations, but readline is largely I/O bound.

### 5. Bun vs Node.js Performance

#### Startup Time

| Runtime | Typical Startup |
| --- | --- |
| Node.js | ~5 seconds (cold) |
| Bun | ~2 seconds (cold) |

> “V8 optimizes for long-running processes.
> JavaScriptCore optimizes for fast startup.
> This single difference explains most benchmark results.”

#### HTTP Server Throughput (Various Benchmarks)

| Runtime | Requests/sec |
| --- | --- |
| Node.js 22 | 52,000-65,000 |
| Deno 2.0 | 48,000-75,000 |
| Bun 1.1 | 89,000-180,000 |

#### I/O Performance

- Bun uses io_uring on Linux for significant I/O advantages
- This benefit is Linux-specific

#### Package Installation

- `bun install`: 2-3 seconds
- `npm install`: 20-60+ seconds (even with warm cache)

#### Test Execution

- `bun test` can be 5-10x faster than Jest on Node.js

#### Key Consideration

> “Bun is fastest. Deno is most secure.
> Node.js is most compatible.
> All three are production-ready in 2026.”

**Note:** Anthropic acquired Bun in December 2025, though it remains open-source.

### 6. Alternative: Ink for Terminal UI

[Ink](https://github.com/vadimdemedes/ink) provides React-based terminal UIs.

**Performance Features:**

- Frame rate control to prevent excessive re-rendering
- Incremental rendering (only update changed lines)
- `<Static>` component for efficient rendering of large lists

**Used by:** Gatsby, Parcel, Yarn, Terraform, Prisma, Shopify, NYT

**Relevance:** Could provide a more declarative approach to terminal UI rendering,
though may add overhead for simple input/output loops.

### 7. Completion Without Bash

A key insight: **we don’t need `compgen`** if we implement completion ourselves.
This provides better control, customization, and removes the bash dependency entirely.

#### 7.1 Command Completion

**Option A: Static Command List with Metadata**

Rather than using `compgen -c`, maintain a curated list of common commands with
docstrings:

```typescript
const COMMANDS = [
  { name: 'ls', desc: 'List directory contents', priority: 10 },
  { name: 'cd', desc: 'Change directory', priority: 10 },
  { name: 'git', desc: 'Version control', priority: 9 },
  { name: 'npm', desc: 'Node package manager', priority: 8 },
  // ... ~200 common commands
];
```

**Benefits:**

- Prioritize well-known commands (ls, cd, git) over obscure ones
- Add helpful docstrings shown during completion
- Consistent cross-platform behavior
- No subprocess for completion

**Option B: tldr-pages Integration**

[tldr-pages](https://github.com/tldr-pages/tldr) provides community-maintained,
simplified help for 2000+ commands.

```bash
npm install tldr
```

```typescript
import { list } from 'tldr';

// Get all known commands with descriptions
const commands = await list({ platform: 'common' });
// Returns: [{ name: 'tar', desc: 'Archive utility' }, ...]
```

**Benefits:**

- 2000+ commands with practical descriptions
- Community-maintained and updated
- Cross-platform aware (linux, osx, windows, common)

#### 7.2 Fuzzy Search Libraries

For matching user input to commands/files:

| Library | Size | Speed | Best For |
| --- | --- | --- | --- |
| [Fuse.js](https://www.fusejs.io/) | 20KB | Fast | Feature-rich fuzzy search |
| [microfuzz](https://github.com/Nozbe/microfuzz) | 2KB | Very Fast | Simple lists < 10K items |
| [simple-fuzzy](https://www.npmjs.com/package/simple-fuzzy) | <1KB | Fastest | Lists < 1K items |
| [fuzzysort](https://github.com/farzher/fuzzysort) | 6KB | Very Fast | File paths specifically |

**Fuse.js Example:**

```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(commands, {
  keys: ['name', 'desc'],
  threshold: 0.4,
  includeScore: true,
});

const results = fuse.search('gti'); // Matches 'git'
```

**microfuzz Example (2KB, no deps):**

```typescript
import { createFuzzySearch } from 'microfuzz';

const search = createFuzzySearch(commands, { key: 'name' });
const results = search('gti'); // [{ item: { name: 'git', ... }, score: 0.8 }]
```

**Recommendation:** Use **microfuzz** for command completion (small, fast) and
**fuzzysort** for file paths (optimized for paths).

#### 7.3 File Path Completion

For file/directory completion without bash:

| Library | Speed | Notes |
| --- | --- | --- |
| [fast-glob](https://github.com/mrmlnc/fast-glob) | Fast | Most popular, micromatch-based |
| [tiny-glob](https://github.com/terkelg/tiny-glob) | Fastest | 4x faster than fast-glob |
| [glob](https://github.com/isaacs/node-glob) | Moderate | Most bash-compatible |
| Bun's `Glob` | Native | Built-in, fastest on Bun |

**fast-glob Example:**

```typescript
import fg from 'fast-glob';

async function completeFilePath(partial: string): Promise<string[]> {
  // Handle partial path: "src/lib/in" → "src/lib/in*"
  const pattern = partial.endsWith('/')
    ? `${partial}*`
    : `${partial}*`;

  return fg(pattern, {
    onlyFiles: false, // Include directories
    dot: true,        // Include hidden files
    limit: 20,        // Limit results
  });
}
```

**tiny-glob Example (fastest):**

```typescript
import glob from 'tiny-glob';

const files = await glob(`${partial}*`, { filesOnly: false });
```

#### 7.4 Implementation Strategy

**Recommended Architecture:**

```typescript
// lib/completion.ts

import { createFuzzySearch } from 'microfuzz';
import fg from 'fast-glob';
import { COMMANDS } from './command-database.js';

const commandSearch = createFuzzySearch(COMMANDS, {
  key: 'name',
  strategy: 'smart', // Prefix matching first
});

export async function getCompletions(
  input: string,
  cursorPos: number
): Promise<Completion[]> {
  const beforeCursor = input.slice(0, cursorPos);
  const words = beforeCursor.split(/\s+/);
  const currentWord = words[words.length - 1] ?? '';
  const isFirstWord = words.length === 1;

  if (isFirstWord) {
    // Command completion with fuzzy matching
    const matches = commandSearch(currentWord);
    return matches.slice(0, 20).map(m => ({
      value: m.item.name,
      description: m.item.desc,
    }));
  } else {
    // File path completion
    const files = await fg(`${currentWord}*`, {
      onlyFiles: false,
      limit: 20
    });
    return files.map(f => ({ value: f }));
  }
}
```

**Command Database Format:**

```typescript
// lib/command-database.ts

export interface Command {
  name: string;
  desc: string;
  priority: number; // Higher = shown first
  category?: 'file' | 'git' | 'npm' | 'system' | 'network';
}

export const COMMANDS: Command[] = [
  // File operations (priority 10)
  { name: 'ls', desc: 'List directory contents', priority: 10, category: 'file' },
  { name: 'cd', desc: 'Change directory', priority: 10, category: 'file' },
  { name: 'cat', desc: 'Concatenate and print files', priority: 9, category: 'file' },
  { name: 'cp', desc: 'Copy files', priority: 9, category: 'file' },
  { name: 'mv', desc: 'Move/rename files', priority: 9, category: 'file' },
  { name: 'rm', desc: 'Remove files', priority: 9, category: 'file' },
  { name: 'mkdir', desc: 'Create directory', priority: 9, category: 'file' },
  { name: 'touch', desc: 'Create empty file', priority: 8, category: 'file' },

  // Git (priority 9)
  { name: 'git', desc: 'Version control system', priority: 9, category: 'git' },

  // Node/npm (priority 8)
  { name: 'npm', desc: 'Node package manager', priority: 8, category: 'npm' },
  { name: 'node', desc: 'JavaScript runtime', priority: 8, category: 'npm' },
  { name: 'npx', desc: 'Execute npm packages', priority: 8, category: 'npm' },
  { name: 'pnpm', desc: 'Fast package manager', priority: 7, category: 'npm' },
  { name: 'bun', desc: 'Fast JS runtime', priority: 7, category: 'npm' },

  // Text processing (priority 7)
  { name: 'grep', desc: 'Search text patterns', priority: 7, category: 'file' },
  { name: 'sed', desc: 'Stream editor', priority: 6, category: 'file' },
  { name: 'awk', desc: 'Text processing', priority: 6, category: 'file' },
  { name: 'head', desc: 'Output first lines', priority: 7, category: 'file' },
  { name: 'tail', desc: 'Output last lines', priority: 7, category: 'file' },
  { name: 'wc', desc: 'Word/line count', priority: 6, category: 'file' },

  // ... expand to ~200 common commands
];
```

**Benefits of This Approach:**

1. **No bash dependency** - Pure TypeScript
2. **Customizable priorities** - Show common commands first
3. **Rich docstrings** - Help users discover commands
4. **Fuzzy matching** - Typo tolerance ("gti" → “git”)
5. **Cross-platform** - Same behavior everywhere
6. **Fast** - No subprocess overhead
7. **Extensible** - Easy to add categories, aliases, examples

#### 7.5 Advanced: Subcommand Completion

For commands like `git`, `npm`, `docker`, provide subcommand completion:

```typescript
const SUBCOMMANDS: Record<string, Command[]> = {
  git: [
    { name: 'status', desc: 'Show working tree status', priority: 10 },
    { name: 'add', desc: 'Add files to staging', priority: 10 },
    { name: 'commit', desc: 'Record changes', priority: 10 },
    { name: 'push', desc: 'Update remote refs', priority: 9 },
    { name: 'pull', desc: 'Fetch and merge', priority: 9 },
    { name: 'checkout', desc: 'Switch branches', priority: 8 },
    { name: 'branch', desc: 'List/create branches', priority: 8 },
    // ...
  ],
  npm: [
    { name: 'install', desc: 'Install packages', priority: 10 },
    { name: 'run', desc: 'Run package script', priority: 10 },
    { name: 'test', desc: 'Run tests', priority: 9 },
    // ...
  ],
};

function getCompletions(input: string, cursorPos: number): Completion[] {
  const words = input.slice(0, cursorPos).split(/\s+/);

  if (words.length === 1) {
    // Complete commands
    return commandSearch(words[0]);
  } else if (words.length === 2 && SUBCOMMANDS[words[0]]) {
    // Complete subcommands
    const subSearch = createFuzzySearch(SUBCOMMANDS[words[0]], { key: 'name' });
    return subSearch(words[1]);
  } else {
    // Complete file paths
    return filePathCompletion(words[words.length - 1]);
  }
}
```

### 8. Python prompt_toolkit Reference

[prompt_toolkit](https://github.com/prompt-toolkit/python-prompt-toolkit) is considered
the gold standard for Python CLI input.

**Features:**

- Pure Python, no external dependencies (except Pygments)
- Syntax highlighting while typing
- Multi-line editing
- Advanced completion
- Emacs and Vi keybindings
- Mouse support
- Auto-suggestions (like fish)

**Performance Note:** Version 2.0+ supports vt100 escape codes natively on Windows 10,
enabling “much faster rendering.”

**Relevance:** Demonstrates that a high-quality interactive experience is achievable
without native code.
A TypeScript equivalent with similar design philosophy could be valuable.

* * *

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

- Test under Bun for compatibility
- Use Bun Shell for shell command execution
- Leverage Bun’s faster test runner

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

**Description:** Use Vercel’s just-bash for shell command execution within TypeScript.

**When to use:** This option is designed for applications that need to sandbox AI agent
shell execution themselves.
However, if you’re building on top of an agent coding tool (like Claude Code, Cursor,
etc.), that tool likely handles its own sandboxing and permissions—you may not need to
add another layer.

**Actions:**

- Integrate just-bash for safe shell command parsing
- Use for AI agent tool execution
- Fall back to real shell for unsupported commands

**Pros:**

- No shell process spawning
- Secure by design
- Consistent cross-platform behavior
- Good for sandboxing when you control the agent execution

**Cons:**

- Not a complete bash implementation—reimplementations have subtle incompatibilities
- May need real shell for complex commands
- Additional dependency
- **For full-powered shells**: Users expect real bash behavior; any deviation is a bug
- **If using agent tools**: Often redundant since they handle their own sandboxing

### Option E: Hybrid just-bash + Execa

**Description:** Use just-bash for AI agent sandboxed execution and Execa for
user-facing shell mode, combining the best of both worlds.

**When to use:** This hybrid approach only makes sense if your application is directly
responsible for sandboxing AI agent shell execution.
If you’re building on top of an agent coding tool that handles its own sandboxing
(Claude Code, Cursor, Aider, etc.), this adds complexity without benefit—just use Execa
(see Option G).

**Actions:**

- Use just-bash for AI agent tool execution (sandboxed, no subprocess)
- Use Execa for user shell mode (full bash compatibility, best types)
- Fall back to real bash only for `compgen` (completion)

**Architecture:**

```typescript
// For AI agent tool execution (sandboxed)
import { Bash } from "just-bash";
const agentBash = new Bash({
  executionLimits: { maxCommandCount: 100 }
});
const result = await agentBash.exec('grep -r "TODO" src/');

// For user shell mode (full power)
import { $ } from 'execa';
const output = await $({ shell: true })`${userCommand}`;

// For completion (fall back to real bash)
import { exec } from 'node:child_process';
exec(`compgen -c -- '${partial}' | head -20`, callback);
```

**Pros:**

- Best security for agent execution (just-bash sandboxing)
- Full bash compatibility for user shell mode (Execa)
- Best TypeScript support (Execa)
- Most built-in commands without subprocess (just-bash grep, sed, awk, jq)
- Clear separation of concerns

**Cons:**

- Two dependencies instead of one
- Different APIs for different modes
- Still need bash fallback for `compgen`

### Option F: Pure TypeScript Completion (No Bash)

**Description:** Implement completion entirely in TypeScript without any bash
dependency, using fuzzy search and file globbing libraries.

**Actions:**

- Create curated command database with priorities and docstrings (~200 commands)
- Use microfuzz for fuzzy command matching
- Use fast-glob or tiny-glob for file path completion
- Add subcommand completion for git, npm, docker, etc.
- Optionally integrate tldr-pages for richer command descriptions

**Architecture:**

```typescript
// Pure TypeScript completion - no bash needed
import { createFuzzySearch } from 'microfuzz';
import fg from 'fast-glob';
import { COMMANDS, SUBCOMMANDS } from './command-database.js';

const commandSearch = createFuzzySearch(COMMANDS, { key: 'name' });

async function getCompletions(input: string, cursorPos: number) {
  const words = input.slice(0, cursorPos).split(/\s+/);
  const current = words[words.length - 1] ?? '';

  if (words.length === 1) {
    // Fuzzy command completion with priorities
    return commandSearch(current)
      .sort((a, b) => b.item.priority - a.item.priority)
      .slice(0, 20);
  } else if (words.length === 2 && SUBCOMMANDS[words[0]]) {
    // Subcommand completion (git status, npm install, etc.)
    const subSearch = createFuzzySearch(SUBCOMMANDS[words[0]], { key: 'name' });
    return subSearch(current);
  } else {
    // File path completion
    return fg(`${current}*`, { onlyFiles: false, limit: 20 });
  }
}
```

**Pros:**

- **Zero bash dependency** - Pure TypeScript
- **Customizable** - Prioritize common commands, add docstrings
- **Fuzzy matching** - Typo tolerance ("gti" → “git”)
- **Rich UX** - Show descriptions during completion
- **Cross-platform** - Same behavior on Windows/Linux/macOS
- **Fast** - No subprocess overhead (~~1-5ms vs ~~50-100ms for compgen)
- **Extensible** - Easy to add command categories, aliases

**Cons:**

- Requires maintaining command database
- May miss obscure system commands
- No dynamic discovery of user-installed commands

**Note:** This option handles completion only.
Combine with Execa (Option G) for a complete shell solution.

### Option G: Execa + Pure TypeScript Completion (Recommended for Full-Powered Shells)

**Description:** Use Execa for full-powered shell execution and pure TypeScript for
completion. This is the optimal approach for applications that need a full-powered shell
where sandboxing is handled elsewhere (or not needed).

**When to use:**

- Building a shell/terminal application where users expect real bash behavior
- Building on top of agent coding tools that handle their own sandboxing
- Any case where you want full bash compatibility without maintaining a reimplementation
- Execa provides the best TypeScript support for subprocess management
- Pure TypeScript completion removes the `compgen` dependency without sacrificing UX

**Actions:**

- Use Execa for all shell command execution (full bash compatibility)
- Use pure TypeScript completion (microfuzz + fast-glob)
- No just-bash—it adds complexity without benefit for this use case

**Architecture:**

```typescript
// Shell execution with Execa (full power)
import { execa, $ } from 'execa';

// Template syntax for simple commands
const { stdout } = await $`git status`;

// Full control when needed
const result = await execa('bash', ['-c', userCommand], {
  shell: true,
  reject: false, // Don't throw on non-zero exit
});

// Completion with pure TypeScript (no bash dependency)
import { createFuzzySearch } from 'microfuzz';
import fg from 'fast-glob';
import { COMMANDS } from './command-database.js';

const commandSearch = createFuzzySearch(COMMANDS, { key: 'name' });

async function getCompletions(input: string, cursorPos: number) {
  const words = input.slice(0, cursorPos).split(/\s+/);
  const current = words[words.length - 1] ?? '';

  if (words.length === 1) {
    return commandSearch(current).slice(0, 20);
  }
  return fg(`${current}*`, { onlyFiles: false, limit: 20 });
}
```

**Pros:**

- **Full bash compatibility** - Real bash, no reimplementation quirks
- **Best TypeScript support** - Execa has excellent types and error handling
- **No bash dependency for completion** - Pure TypeScript with fuzzy matching
- **Simple architecture** - One approach for execution, one for completion
- **Correct responsibility boundary** - Don’t duplicate sandboxing that’s handled
  elsewhere

**Cons:**

- Spawns subprocesses (but this is expected/correct for a full-powered shell)
- Requires maintaining command database for completion

* * *

## Recommendations

### Short-term (v0.2)

1. **Profile First**: Before any optimization, instrument the current codebase to
   identify actual bottlenecks.
   The issue may not be where expected.

2. **Switch to Event-based Readline**: Change from async iterators to `'line'` event
   listeners per Node.js recommendations.

3. **Batch Terminal Writes**: Accumulate escape sequences and write in batches to reduce
   syscall overhead.

### Medium-term (v0.3-v0.4)

4. **Evaluate Bun Migration**: Create a compatibility branch and benchmark:
   - Startup time improvement
   - Shell command execution with Bun Shell
   - Overall responsiveness feel

   This is likely the highest-impact change for perceived performance.

5. **Implement Execa + Pure TypeScript Completion (Option G)**: This is the recommended
   approach for full-powered shell applications:

   **Why not just-bash or hybrid?** If you’re building on top of agent coding tools
   (Claude Code, Cursor, etc.)
   that handle their own sandboxing, adding just-bash is redundant complexity.
   For full-powered shells, users expect real bash behavior—any deviation from a
   reimplementation is a bug, not a feature.

   **Shell Execution with Execa:**
   - Replace `child_process.spawn('bash', ...)` with Execa
   - Better error handling and structured results
   - Auto-escaping (prevent injection)
   - Best TypeScript types
   - Full bash compatibility—users get real bash behavior

   **Pure TypeScript Completion (no bash dependency):**
   - Create command database with ~200 common commands + priorities + docstrings
   - Use microfuzz (2KB) for fuzzy command matching
   - Use fast-glob for file path completion
   - Add subcommand completion for git, npm, docker, etc.
   - Optional: Integrate tldr-pages for richer descriptions
   - Removes `compgen` dependency entirely

### Long-term (v1.0+)

6. **Consider Rust Line Editor**: Only if profiling shows readline is the bottleneck AND
   Bun migration doesn’t resolve it, consider wrapping reedline via napi-rs.

7. **Design Structured Output**: Take inspiration from nushell’s structured data
   approach. When possible, provide structured output that tools can consume directly
   rather than text that needs parsing.

8. **Evaluate Bun Shell if Migrating to Bun**: If migrating to Bun runtime, evaluate
   replacing Execa with Bun Shell for even faster execution (no subprocess).
   Note that Bun Shell lacks grep/sed/awk, but this is acceptable—users have these
   installed on their systems.

### Not Recommended

- **Electron-based UI**: Would add 40-100ms latency, opposite of goal
- **Full shell reimplementation**: just-bash and Bun Shell already exist
- **Ink/React for input loop**: Overhead not justified for simple input/output
- **ShellJS**: Synchronous API blocks event loop, slower than alternatives
- **Spawning bash for completion**: ~~50-100ms latency vs ~~1-5ms for pure TypeScript
- **readline-completer npm package**: Abandoned (9 years old), use native readline

* * *

## Kash Completion System Analysis

This section documents findings from reviewing the kash codebase (`repos/kash/`) which
has a mature implementation of command completion with TLDR integration, recommended
commands, and priority-based ranking.

### 9. Kash Architecture Overview

Kash (a Python/xonsh-based shell) implements a sophisticated completion system with the
following components:

| Component | File | Purpose |
| --- | --- | --- |
| **TLDR Integration** | `help/tldr_help.py` | Extracts descriptions and snippets from tldr-pages |
| **Recommended Commands** | `help/recommended_commands.py` | Curated list of 135 shell commands |
| **Completion Types** | `shell/completions/completion_types.py` | Priority groups and data structures |
| **Scoring Algorithm** | `shell/completions/completion_scoring.py` | Fuzzy matching with `thefuzz` |
| **Shell Completions** | `shell/completions/shell_completions.py` | Completion orchestration |
| **Ranking Completer** | `xonsh_custom/xonsh_ranking_completer.py` | Final ranking and deduplication |
| **Recipe Data** | `docs_base/recipes/tldr_standard_commands.sh` | 109 commands, 2126 lines |

### 9.1 Recommended Commands List

Location: `repos/kash/src/kash/help/recommended_commands.py`

A curated set of **135 standard shell commands** organized by category:

```python
STANDARD_SHELL_COMMANDS = {
    # Core navigation and file operations
    "ls", "cd", "pwd", "cp", "mv", "rm", "mkdir", "rmdir", "touch", "man", "git", "poetry",

    # Modern alternatives to core commands
    "eza",    # modern ls alternative
    "z",      # modern cd alternative (zoxide)
    "fd",     # modern find alternative
    "bat",    # modern cat alternative
    "rg",     # modern grep alternative
    "dust",   # modern du alternative
    "duf",    # modern df alternative
    "btm",    # modern top alternative
    "procs",  # modern ps alternative
    "delta",  # modern diff alternative

    # Search and filtering
    "grep", "find", "fzf", "sk",

    # File inspection and manipulation
    "cat", "less", "head", "tail", "chmod", "chown", "tree",

    # System information
    "ps", "top", "df", "du", "uptime", "uname", "free",

    # Network tools
    "ping", "curl", "wget", "ssh", "nc", "traceroute", "dig", "ifconfig", "scp", "sftp",

    # Development tools
    "vim", "nano", "jq",

    # Documentation and help
    "tldr", "which",

    # Compression
    "tar", "gzip", "zip", "unzip", "bzip2", "xz",

    # Python
    "pip", "pyenv", "virtualenv", "pipenv", "pipx",

    # Rust
    "cargo",

    # JavaScript
    "npm", "npx", "yarn", "fnm", "node",

    # Process management
    "htop", "kill", "killall",

    # Text processing and editing
    "awk", "sed", "sort", "uniq", "wc",

    # System monitoring and diagnostics
    "ncdu", "lsof", "strace", "glances", "nmap", "netstat",

    # Container and virtualization
    "docker", "podman", "kubectl", "vagrant",

    # macOS specific
    "open", "pbcopy", "pbpaste", "brew",

    # Package management (Linux)
    "apt", "yum", "dnf", "pacman",

    # System administration
    "sudo", "su", "zsh", "bash",
}

DROPPED_TLDR_COMMANDS = {
    "less",     # has keyboard examples, not command line
    "license",  # confusing
    "hello",    # confusing
}

RECOMMENDED_TLDR_COMMANDS = sorted(STANDARD_SHELL_COMMANDS - DROPPED_TLDR_COMMANDS)
```

### 9.2 TLDR Integration

Location: `repos/kash/src/kash/help/tldr_help.py`

Uses the Python `tldr` library (wraps tldr-pages cache) with these key functions:

| Function | Purpose |
| --- | --- |
| `tldr_refresh_cache()` | Auto-refreshes cache every 14 days |
| `tldr_page_from_cache(cmd)` | Retrieves cached tldr page for a command |
| `tldr_description(cmd)` | Extracts just the short description (lines starting with `>`) |
| `tldr_snippets(cmd)` | Parses examples into `CommentedCommand` objects |
| `tldr_descriptions(cmds)` | Returns `CommandInfo` objects for all recommended commands |
| `dump_all_tldr_snippets()` | Generates `tldr_standard_commands.sh` recipe file |

**Description Extraction Logic:**

```python
def tldr_description(command: str) -> str | None:
    """Extract description from lines starting with '>' (before 'More information')"""
    page_str = tldr_help(command)
    if not page_str:
        return None

    lines = []
    for line in page_str.splitlines():
        line = line.strip()
        if line.startswith(">"):
            if "More information:" in line:
                break
            lines.append(line[1:].strip())  # Remove '>' prefix
        elif lines:
            break

    return _clean_tldr_comment(" ".join(lines))
```

**Snippet Extraction Logic:**

```python
def tldr_snippets(command: str) -> list[CommentedCommand]:
    """Parse TLDR page into comment/command pairs"""
    # Lines starting with "- " are descriptions
    # Indented lines following descriptions are commands
    # Skip headers (#) and description blocks (>)
```

### 9.3 Priority Groups

Location: `repos/kash/src/kash/shell/completions/completion_types.py`

Nine priority levels from highest to lowest:

```python
class CompletionGroup(int, Enum):
    top_suggestion = 0   # Highest priority (e.g., "?" for help)
    kash = 1             # Internal kash commands/actions
    standard = 2         # Standard xonsh completions
    help = 3             # Help/FAQ completions
    relev_opt = 4        # Relevant options
    rec_cmd = 5          # Recommended shell commands (with TLDR)
    reg_cmd = 6          # Regular shell commands
    python = 7           # Python completions
    other = 8            # Lowest priority
```

**Visual Styling (monochrome unicode icons):**

```python
EMOJI_RECOMMENDED = "•"   # U+2022 Recommended shell commands
EMOJI_SHELL = "⦊"         # U+298A Other shell commands
EMOJI_COMMAND = "⧁"       # U+29C1 Internal commands
EMOJI_ACTION = "⛭"        # U+26ED Actions
EMOJI_SNIPPET = "❯"       # U+276F Recipe snippets
EMOJI_HELP = "?"          # U+003F FAQ/help items
```

### 9.4 Scoring Algorithm

Location: `repos/kash/src/kash/shell/completions/completion_scoring.py`

**Key Constants:**

```python
MIN_CUTOFF = Score(70)  # Minimum score to show completion
```

**Scoring Components:**

| Component | Score Range | Description |
| --- | --- | --- |
| Exact prefix | 70-100 | Higher for longer/more complete matches |
| Fuzzy phrase | 0-100 | Blended ratio + token_set_ratio using `thefuzz` |
| Subphrase | 0-100 | For FAQs/recipes with >4 word queries |
| Semantic boost | +200% | When embeddings relatedness available |
| Description boost | +5 | If TLDR description exists |
| Recency | 0-100 | Exponential decay: 1 hour (100) → 1 year (0) |

**Exact Prefix Scoring:**

```python
def score_exact_prefix(prefix: str, text: str) -> Score:
    if not text.startswith(prefix):
        return Score(0)
    if len(prefix) < 2:
        return Score(50)

    completion_ratio = len(prefix) / len(text)
    long_prefix_bonus = len(prefix) - 2
    score = 70 + (20 * completion_ratio) + min(10, long_prefix_bonus)
    return Score(score)
```

**Fuzzy Phrase Scoring (uses thefuzz):**

```python
def score_phrase(prefix: str, text: str) -> Score:
    if len(prefix) > 5:
        return Score(
            0.4 * fuzz.ratio(prefix, text)
            + 0.3 * fuzz.token_set_ratio(prefix, text)
            + 0.3 * fuzz.partial_ratio(prefix, text)
        )
    else:
        return Score(
            0.6 * fuzz.ratio(prefix, text)
            + 0.4 * fuzz.token_set_ratio(prefix, text)
        )
```

**Recency Decay:**

```python
def decaying_recency(age_seconds: float) -> Score:
    """Exponential decay from 1 hour (100) to 1 year (0)"""
    if age_seconds <= ONE_HOUR:
        return Score(100.0)
    if age_seconds >= ONE_YEAR:
        return Score(0.0)

    decay_constant = 5.0 / (ONE_YEAR - ONE_HOUR)
    return Score(100.0 * math.exp(-decay_constant * (age_seconds - ONE_HOUR)))
```

### 9.5 Recipe Data Files

Location: `repos/kash/src/kash/docs_base/recipes/`

| File | Commands | Lines | Description |
| --- | --- | --- | --- |
| `tldr_standard_commands.sh` | 109 | 2126 | Generated from TLDR pages |
| `general_system_commands.sh` | ~5 | 11 | Additional system snippets |
| `python_dev_commands.sh` | ~3 | 7 | Python development snippets |

**Format:** Shell script with comment/command pairs:

```bash
# apt

# Update the list of available packages
sudo apt update

# Search for a given package
apt search {{package}}
```

### 9.6 Ranking Completer

Location: `repos/kash/src/kash/xonsh_custom/xonsh_ranking_completer.py`

The `RankingCompleter` orchestrates the full completion pipeline:

1. **Collect**: Gather completions from all registered completers
2. **Deduplicate**: Remove duplicates based on normalized values
3. **Enrich**: Add TLDR descriptions to standard completions
4. **Score**: Apply scoring algorithm to unscored completions
5. **Rank**: Sort by group (primary) and score (secondary)

```python
class RankingCompleter(Completer):
    def complete_from_context(self, context):
        completions = list(self._collect_completions(context))
        self._deduplicate_completions(completions)
        self._enrich_completions(completions)    # Adds TLDR descriptions
        self._score_unscored_completions(completions, context)
        self._rank_completions(completions, context)
        return tuple(completions), lprefix
```

### 9.7 Porting Plan to TypeScript

**Phase 1: Data Files (can reuse directly)**

| Kash File | TypeScript Port | Notes |
| --- | --- | --- |
| `recommended_commands.py` | `src/data/recommended-commands.ts` | Direct port of 135 commands |
| `tldr_standard_commands.sh` | `src/data/tldr-snippets.json` | Convert to JSON for TypeScript |

**Phase 2: TypeScript Implementation**

| Kash Module | TypeScript Module | Dependencies |
| --- | --- | --- |
| `tldr_help.py` | `src/completion/tldr-help.ts` | `tldr` npm package |
| `completion_types.py` | `src/completion/types.ts` | None |
| `completion_scoring.py` | `src/completion/scoring.ts` | `fuzzball` (thefuzz for JS) |
| `shell_completions.py` | `src/completion/completions.ts` | `fast-glob` |

**Phase 3: Integration**

1. **Command Database**: Create `src/data/commands.ts`:

   ```typescript
   export interface Command {
     name: string;
     description: string;
     priority: number;        // 0-10, higher = shown first
     category: CommandCategory;
     isModernAlternative?: boolean;
     alternativeTo?: string;  // e.g., eza is alternative to ls
   }
   ```

2. **Priority Groups**: Port to TypeScript enum:

   ```typescript
   export enum CompletionGroup {
     TopSuggestion = 0,
     InternalCommand = 1,
     Standard = 2,
     Help = 3,
     RecommendedCmd = 5,
     RegularCmd = 6,
     Other = 8,
   }
   ```

3. **Fuzzy Matching**: Use `fuzzball` (JavaScript port of thefuzz):

   ```typescript
   import fuzz from 'fuzzball';
   
   function scorePhrase(prefix: string, text: string): number {
     if (prefix.length > 5) {
       return 0.4 * fuzz.ratio(prefix, text)
            + 0.3 * fuzz.token_set_ratio(prefix, text)
            + 0.3 * fuzz.partial_ratio(prefix, text);
     }
     return 0.6 * fuzz.ratio(prefix, text)
          + 0.4 * fuzz.token_set_ratio(prefix, text);
   }
   ```

4. **TLDR Integration**: Use `tldr` npm package:

   ```typescript
   import { getPage } from 'tldr';
   
   async function getTldrDescription(command: string): Promise<string | null> {
     const page = await getPage(command);
     if (!page) return null;
   
     // Extract lines starting with '>'
     const descLines = page.split('\n')
       .filter(line => line.startsWith('>'))
       .map(line => line.slice(1).trim())
       .filter(line => !line.includes('More information:'));
   
     return descLines.join(' ') || null;
   }
   ```

**Benefits of Porting:**

1. **Curated command list** - 135 vetted commands vs.
   discovering from system
2. **Clean descriptions** - Extracted TLDR descriptions are concise
3. **Modern alternatives** - Highlights eza, fd, bat, rg over legacy commands
4. **Category organization** - Commands grouped by purpose
5. **Proven scoring** - Battle-tested fuzzy matching algorithm
6. **No bash dependency** - Pure TypeScript completion

### 9.8 Styled Completion Rendering

Xonsh uses prompt-toolkit’s `RichCompletion` class to render completions with distinct
styling for the command name vs.
description. This creates a polished UX where:

- **Command name**: Bold with category emoji prefix
- **Description**: Dimmer text alongside the command

**RichCompletion Parameters:**

| Parameter | Purpose | Example |
| --- | --- | --- |
| `value` | Actual completion text inserted | `"git"` |
| `display` | Styled text shown in menu | `"⧁ git"` (with style) |
| `description` | Dim help text alongside | `"Version control system"` |
| `style` | PTK style string | `"bold black"` |
| `append_space` | Add space after completion | `True` |
| `prefix_len` | Characters to replace | `3` |

**Kash Style Definitions:**

```python
# From kash/config/text_styles.py
STYLE_KASH_COMMAND = "bold black"      # Internal commands
STYLE_HELP_QUESTION = "italic bold black"  # FAQ questions
STYLE_HINT = "italic dim"              # Descriptions

# Unicode icons for command types (all monochrome)
EMOJI_RECOMMENDED = "•"   # U+2022 Recommended shell commands
EMOJI_SHELL = "⦊"         # U+298A Other shell commands
EMOJI_COMMAND = "⧁"       # U+29C1 Internal commands (alternatives: ⦿⧀⦾⟐⟡)
EMOJI_ACTION = "⛭"        # U+26ED Actions
EMOJI_SNIPPET = "❯"       # U+276F Recipe snippets
EMOJI_HELP = "?"          # U+003F FAQ/help items
```

**Completion Display Format:**

```
┌────────────────────────────────────────────────────────────┐
│ • git         Version control system                       │
│ • npm         Node package manager                         │
│ ⧁ help        Show help for internal commands              │
│ ⦊ awk         Text processing                              │
│ ❯ git status  Show working tree status                     │
│ ? How do I... FAQ question                                 │
└────────────────────────────────────────────────────────────┘
  ^emoji ^cmd    ^description (dimmer)
  └──────────┘
   bold style
```

**TypeScript Implementation for Clam:**

Node.js readline doesn’t support rich completions natively.
Options:

1. **Custom rendering with ANSI codes**: Render styled text manually

   ```typescript
   import pc from 'picocolors';
   
   interface StyledCompletion {
     value: string;
     display: string;      // Command with emoji
     description: string;  // Help text
     style: 'recommended' | 'shell' | 'internal';
   }
   
   function formatCompletion(c: StyledCompletion): string {
     const emoji = c.style === 'recommended' ? '•' :
                   c.style === 'internal' ? '⧁' : '⦊';
     const cmd = pc.bold(`${emoji} ${c.value}`);
     const desc = pc.dim(c.description);
     return `${cmd.padEnd(20)} ${desc}`;
   }
   ```

2. **Use Ink for React-based terminal UI**: Declarative rendering

   ```typescript
   import { Text, Box } from 'ink';
   
   const Completion = ({ cmd, desc, type }) => (
     <Box>
       <Text bold>{getEmoji(type)} {cmd}</Text>
       <Text dimColor> {desc}</Text>
     </Box>
   );
   ```

3. **Use @clack/prompts**: Modern prompts with built-in styling

   ```typescript
   import { select } from '@clack/prompts';
   
   const result = await select({
     message: 'Complete:',
     options: completions.map(c => ({
       value: c.value,
       label: `${c.emoji} ${c.value}`,
       hint: c.description,  // Shown dimmer
     })),
   });
   ```

**Recommendation for Clam:**

Use ANSI escape codes via `picocolors` for inline completion rendering:

- Bold + emoji for command name
- Dim for description
- Consistent column alignment using `padEnd()`

This matches Node.js CLI conventions while achieving similar UX to xonsh/prompt-toolkit.

**References:**

- [xonsh RichCompletion](https://xon.sh/api/_autosummary/cmd/xonsh.completers.tools.html)
- [xonsh Completers Tutorial](https://xon.sh/tutorial_completers.html)
- [prompt-toolkit Completion Styles](https://github.com/xonsh/xonsh/issues/2840)

### 10. ANSI Color Output in Subprocesses

When running commands through a shell wrapper (like a TypeScript shell application), the
command’s stdout is typically piped rather than connected to a TTY. Many commands check
`isatty()` and disable color output when not connected to a terminal.

#### 10.1 The Problem

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│ Shell App   │────▶│    Pipe     │────▶│   Command    │
│ (TypeScript)│     │ (not a TTY) │     │ (ls, grep)   │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                           ▼
              Command detects !isatty(stdout)
              → Disables color output
```

Commands like `ls`, `grep`, `git diff`, and many CLI tools check if their stdout is a
TTY before outputting ANSI color codes.

#### 10.2 How Xonsh Solves This: PTY (Pseudo-Terminal)

Xonsh uses `pty.openpty()` on POSIX systems to create real pseudo-terminals for
subprocess stdout/stderr.
This makes commands think they’re running in an interactive terminal.

**From `xonsh/procs/specs.py` (lines 938, 958, 979):**

```python
# Line 938: Use TTY for external commands on POSIX
use_tty = xp.ON_POSIX and not callable_alias

# Line 958: Create PTY instead of pipe for stdout
r, w = xli.pty.openpty() if use_tty else os.pipe()

# Line 979: Same for stderr
r, w = xli.pty.openpty() if use_tty else os.pipe()
```

Xonsh also properly sets the PTY window size to match the parent terminal (lines
862-875), which is important for commands that wrap output based on terminal width.

**Benefits:**

- Commands automatically output colors without special flags
- Works with all commands, even those without `--color` flags
- Proper terminal size propagation for formatting

**Drawbacks:**

- Requires native PTY support (POSIX-specific)
- More complex implementation
- Windows support requires different approach (conpty)

#### 10.3 Environment Variables for Forcing Color

Two competing de facto standards exist for controlling terminal color:

| Variable | Value | Effect | Supported By |
| --- | --- | --- | --- |
| `FORCE_COLOR` | `1` | Force colors on | chalk, supports-color, many npm tools |
| `CLICOLOR_FORCE` | `1` | Force colors on | BSD/macOS tools (ls, grep) |
| `CLICOLOR` | `1` | Enable colors (TTY only) | BSD/macOS tools |
| `NO_COLOR` | (any) | Disable colors | Many tools (opposite purpose) |

**Priority order (recommended by
[bixense.com/clicolors](http://bixense.com/clicolors/)):**

1. If `NO_COLOR` is set → disable colors
2. If `CLICOLOR_FORCE` is set → enable colors (even when not a TTY)
3. If `CLICOLOR` is set → enable colors only if output is a TTY
4. Command-line flags (`--color=always`) override environment variables

**Example usage with Execa:**

```typescript
import { execa } from 'execa';

// Set environment variables to force color output
const result = await execa('ls', ['-la'], {
  env: {
    FORCE_COLOR: '1',
    CLICOLOR_FORCE: '1',
  },
});
```

#### 10.4 Command-Specific Flags

Many commands support explicit color flags:

| Command | Flag | Example |
| --- | --- | --- |
| `ls` | `--color=always` | `ls --color=always -la` |
| `grep` | `--color=always` | `grep --color=always pattern file` |
| `git diff` | `--color=always` | `git diff --color=always` |
| `git log` | `--color=always` | `git log --color=always` |
| `diff` | `--color=always` | `diff --color=always a b` |
| `gcc`/`clang` | `-fdiagnostics-color=always` | `gcc -fdiagnostics-color=always` |

**Note:** Using `--color=always` is explicit and always works, but requires knowing each
command’s specific flag.

#### 10.5 Node.js Implementation Options

**Option A: Use `node-pty` (Full PTY)**

The [node-pty](https://github.com/microsoft/node-pty) package provides `forkpty(3)`
bindings for Node.js, allowing you to spawn processes with real pseudo-terminals.

```typescript
import * as pty from 'node-pty';

const ptyProcess = pty.spawn('ls', ['-la'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env,
});

ptyProcess.onData((data) => {
  console.log(data); // Includes ANSI colors
});
```

**Pros:**

- Commands automatically output colors
- Works with all commands
- Proper terminal emulation

**Cons:**

- Native dependency (requires compilation)
- Windows support requires Windows 10 1809+ (conpty API)
- More complex error handling

**Option B: Environment Variables (Simple)**

```typescript
import { execa } from 'execa';

// Create subprocess with color-forcing environment
async function runWithColors(cmd: string, args: string[]) {
  return execa(cmd, args, {
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      CLICOLOR_FORCE: '1',
      // Preserve TERM for proper color support detection
      TERM: process.env.TERM || 'xterm-256color',
    },
  });
}
```

**Pros:**

- Simple, no native dependencies
- Works with most modern CLI tools
- Cross-platform

**Cons:**

- Not all commands support these variables
- Some commands only check `isatty()` regardless

**Option C: stdio: ‘inherit’ (Pass-through)**

```typescript
import { execa } from 'execa';

// Pass parent's TTY directly to subprocess
await execa('ls', ['-la'], { stdio: 'inherit' });
```

**Pros:**

- Perfect color support (uses real TTY)
- Simple

**Cons:**

- Cannot capture output for processing
- Output goes directly to terminal

#### 10.6 Recommended Approach for Clam

For a TypeScript shell application, use a **hybrid approach**:

1. **For interactive commands** (where output goes directly to user):
   - Use `stdio: 'inherit'` when possible
   - Falls back to PTY via `node-pty` if output needs processing

2. **For captured commands** (where output is processed):
   - Set `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` environment variables
   - Add `--color=always` for known commands (git, grep, ls)
   - Consider `node-pty` if color support is critical

3. **Environment variable setup:**

```typescript
// lib/shell/color-env.ts
export const COLOR_FORCING_ENV = {
  FORCE_COLOR: '1',
  CLICOLOR_FORCE: '1',
  // Don't set CLICOLOR alone - it only works with TTY
};

export function getColorEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...COLOR_FORCING_ENV,
    TERM: process.env.TERM || 'xterm-256color',
  };
}
```

4. **Command-specific handling:**

```typescript
// lib/shell/color-commands.ts
const COLOR_ALWAYS_COMMANDS: Record<string, string[]> = {
  ls: ['--color=always'],
  grep: ['--color=always'],
  egrep: ['--color=always'],
  fgrep: ['--color=always'],
  diff: ['--color=always'],
  git: [], // git subcommands need --color individually
};

const GIT_COLOR_SUBCOMMANDS = ['diff', 'log', 'show', 'status', 'branch'];

export function addColorFlags(cmd: string, args: string[]): string[] {
  if (cmd === 'git' && args.length > 0 && GIT_COLOR_SUBCOMMANDS.includes(args[0])) {
    // Insert --color=always after the subcommand
    return [args[0], '--color=always', ...args.slice(1)];
  }

  const extraFlags = COLOR_ALWAYS_COMMANDS[cmd];
  if (extraFlags) {
    return [...extraFlags, ...args];
  }

  return args;
}
```

#### 10.7 Testing Color Output

To verify color output is working:

```bash
# Should show colors even when piped
ls --color=always | cat

# Test FORCE_COLOR
FORCE_COLOR=1 npm test 2>&1 | cat

# Test with a Node.js script
node -e "console.log('\x1b[31mRed\x1b[0m')" | cat
```

* * *

## Next Steps

### Performance Investigation

- [ ] Profile current input loop with timestamps at each stage
- [ ] Create Bun compatibility branch and run full test suite
- [ ] Benchmark startup time: Node.js vs Bun
- [ ] Benchmark interactive input latency: Node.js readline vs Bun
- [ ] Evaluate just-bash for sandboxed shell mode
- [ ] Document findings and make migration decision

### Kash Completion System Porting

- [ ] Port `recommended_commands.py` → `src/data/recommended-commands.ts` (135 commands)
- [ ] Convert `tldr_standard_commands.sh` → `src/data/tldr-snippets.json` (109 commands)
- [ ] Implement `CompletionGroup` enum and priority system
- [ ] Port scoring algorithm using `fuzzball` (thefuzz for JavaScript)
- [ ] Implement TLDR description extraction using `tldr` npm package
- [ ] Create completion orchestration pipeline (collect → dedupe → enrich → score →
  rank)
- [ ] Add subcommand completion for git, npm, docker (from kash’s subcommand data)

### Styled Completion Rendering

- [ ] Implement `StyledCompletion` interface with value, display, description, style
- [ ] Add emoji prefixes by command type (• recommended, ⧁ internal, ⦊ shell)
- [ ] Render completions with picocolors: bold command + dim description
- [ ] Implement column alignment for consistent completion menu appearance
- [ ] Consider @clack/prompts or Ink for more sophisticated completion UX

### Alternative Pure TypeScript Approach

- [ ] Benchmark microfuzz vs fuzzball vs fuse.js for command completion
- [ ] Evaluate tiny-glob vs fast-glob for file path completion
- [ ] Consider hybrid: kash data files + microfuzz for simpler implementation

### ANSI Color Output

- [ ] Implement `getColorEnv()` helper to set `FORCE_COLOR` and `CLICOLOR_FORCE`
- [ ] Create `addColorFlags()` for command-specific `--color=always` injection
- [ ] Evaluate `node-pty` for PTY-based color support (if env vars insufficient)
- [ ] Test color output with common commands (ls, grep, git diff)
- [ ] Consider Windows support via conpty if using `node-pty`

* * *

## References

### TypeScript Shell Frameworks

- [Google zx](https://github.com/google/zx) - A tool for writing better scripts
- [zx@lite](https://dev.to/antongolub/zxlite-minimalistic-shell-scripting-with-tsjs-superpowers-1j50)
  \- Minimalistic variant of zx
- [Execa](https://github.com/sindresorhus/execa) - Process execution for humans (105M
  weekly downloads)
- [Execa 9 Release Notes](https://medium.com/@ehmicky/execa-9-release-d0d5daaa097f) -
  Detailed feature overview
- [Vercel just-bash](https://github.com/vercel-labs/just-bash) - Bash for Agents
- [just-bash Documentation](https://justbash.dev/) - Official docs
- [Vercel bash-tool](https://github.com/vercel-labs/bash-tool) - AI SDK integration
- [Bun Shell](https://bun.com/blog/the-bun-shell) - Cross-platform shell scripting
- [Bun Shell Documentation](https://bun.sh/docs/runtime/shell) - Official docs
- [dax](https://github.com/dsherret/dax) - Cross-platform shell for Deno and Node.js
- [ShellJS](https://www.npmjs.com/package/shelljs) - Unix shell commands for Node.js
- [tish](https://github.com/shqld/tish) - Shell script emulation in TypeScript
- [vl (Violet)](https://github.com/japiirainen/vl) - Shell scripting in TypeScript for
  Deno

### Comparisons & Guides

- [npm-compare: execa vs shelljs vs zx](https://npm-compare.com/child_process,execa,shelljs,shx)
  \- Feature comparison
- [npm trends: execa vs shelljs vs zx](https://npmtrends.com/execa-vs-shelljs-vs-zx) -
  Download trends
- [Writing Shell Scripts with TypeScript](https://scott.willeke.com/writing-shell-scripts-with-typescript-instead-of-bash/)
  \- Tutorial
- [Shell scripting with Node.js](https://exploringjs.com/nodejs-shell-scripting/) -
  Comprehensive book
- [Vercel: Bash for Agents](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash)
  \- AI agent use case

### Modern Shells

- [Nushell](https://www.nushell.sh/) - A new type of shell
- [Fish Shell](https://fishshell.com/) - The user-friendly command line shell
- [The case for Nushell](https://www.sophiajt.com/case-for-nushell/) - Why modern shells
  matter
- [Shell Comparison](https://gist.github.com/pmarreck/b7bd1c270cb77005205bf91f80c4e130)
  \- Bash vs Elvish vs NuShell vs others

### Rust CLI Editors

- [Reedline](https://github.com/nushell/reedline) - A feature-rich line editor
- [Rustyline](https://github.com/kkawakam/rustyline) - Readline implementation in Rust
- [napi-rs](https://github.com/napi-rs/napi-rs) - Rust Node.js native addon framework
- [Neon](https://github.com/neon-bindings/neon) - Rust bindings for Node.js

### Performance & Benchmarks

- [Bun vs Node.js 2025](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide)
  \- Performance comparison
- [Bun vs Deno vs Node.js 2026](https://dev.to/jsgurujobs/bun-vs-deno-vs-nodejs-in-2026-benchmarks-code-and-real-numbers-2l9d)
  \- Benchmarks and real numbers
- [Terminal Latency](http://danluu.com/term-latency/) - Dan Luu’s terminal latency
  research
- [Node.js Readline](https://nodejs.org/api/readline.html) - Official documentation

### Terminal UI

- [Ink](https://github.com/vadimdemedes/ink) - React for interactive CLI apps
- [terminal-kit](https://github.com/cronvel/terminal-kit) - Terminal utilities for
  Node.js
- [Python prompt_toolkit](https://github.com/prompt-toolkit/python-prompt-toolkit) -
  Python CLI reference

### Security

- [Deno Security](https://docs.deno.com/runtime/fundamentals/security/) - Permission
  model
- [just-bash Security](https://github.com/vercel-labs/just-bash#security) - Sandboxed
  execution

### Fuzzy Search & Completion

- [Fuse.js](https://www.fusejs.io/) - Lightweight fuzzy-search library
- [microfuzz](https://github.com/Nozbe/microfuzz) - Tiny (2KB) fuzzy search
- [simple-fuzzy](https://www.npmjs.com/package/simple-fuzzy) - Ultra-lightweight fuzzy
- [fuzzysort](https://github.com/farzher/fuzzysort) - Fast fuzzy search for file paths
- [node-fzf](https://github.com/talmobi/node-fzf) - fzf-inspired CLI selection

### File System Globbing

- [fast-glob](https://github.com/mrmlnc/fast-glob) - Fast and efficient glob library
- [tiny-glob](https://github.com/terkelg/tiny-glob) - Fastest glob (4x faster than
  fast-glob)
- [glob](https://github.com/isaacs/node-glob) - Most bash-compatible glob
- [Bun Glob](https://bun.com/docs/runtime/glob) - Bun’s built-in glob

### Command Documentation

- [tldr-pages](https://github.com/tldr-pages/tldr) - Simplified man pages (2000+
  commands)
- [tldr-node-client](https://github.com/tldr-pages/tldr-node-client) - Node.js client
- [cheat.sh](https://github.com/chubin/cheat.sh) - Unified cheat sheet access

### Terminal Color & PTY

- [node-pty](https://github.com/microsoft/node-pty) - Fork pseudoterminals in Node.js
  (Microsoft)
- [CLICOLOR Standard](http://bixense.com/clicolors/) - De facto standard for CLI color
  control
- [NO_COLOR](https://no-color.org/) - Standard for disabling ANSI color output
- [FORCE_COLOR](https://force-color.org/) - Standard for forcing ANSI color output
- [chalk](https://github.com/chalk/chalk) - Terminal string styling for Node.js
  (supports FORCE_COLOR)
- [supports-color](https://github.com/chalk/supports-color) - Detect terminal color
  support
- [colors.js Piping Issue](https://github.com/Marak/colors.js/issues/127) - Discussion
  of color loss when piping
- [Node.js FORCE_COLOR Issue](https://github.com/nodejs/node/issues/37404) - Request to
  document FORCE_COLOR/NO_COLOR
