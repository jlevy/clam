# clam

A shell-like interface for Claude Code and other agents.

## Overview

`clam` is a terminal-based client for Claude Code that uses true terminal scrollback instead of TUI re-rendering. All output flows into your terminal's native scrollback buffer, giving you:

- **Instant scrolling** - Native terminal performance
- **Preserved history** - Output remains after exiting
- **SSH compatible** - Works identically over remote connections
- **Semantic output** - Clean, structured output

## Installation

```bash
npm install -g get-clam
```

## Usage

```bash
clam
```

See `clam --help` for all options.

## Development

This is a pnpm monorepo. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run type checking
pnpm typecheck

# Run CLI in development
pnpm clam
```

## Project Structure

```
packages/
  clam/        # Main CLI package (published as get-clam)
docs/
  project/     # Project documentation
    research/  # Research documents
    specs/     # Specifications
```

## License

MIT
