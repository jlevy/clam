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
# From npm (when published)
npm install -g get-clam

# Or run directly
npx get-clam
```

## Usage

```bash
# Start clam
clam

# With options
clam --verbose              # Enable debug output
clam --timestamps           # Show timestamps on tool outputs
clam --cwd /path/to/project # Set working directory
```

## Commands

During a session, use slash commands:

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `/help`            | Show available commands           |
| `/quit` or `/exit` | Exit clam                         |
| `/status`          | Show session status               |
| `/config`          | Show current configuration        |
| `/edit`            | Open $EDITOR for multi-line input |
| `/clear`           | Clear the terminal                |

## Multi-line Input

Two ways to enter multi-line prompts:

1. **Backslash continuation** - End a line with `\` to continue on the next line:

   ```
   > Write a function that \
   ... calculates the factorial \
   ... of a number
   ```

2. **Editor integration** - Use `/edit` to compose prompts in your editor

## Configuration

Configuration is stored in `~/.clam/`:

- `config.json` - User configuration
- `permissions.json` - Saved permission decisions

### config.json Options

```json
{
  "truncateAfter": 10,
  "showTimestamps": false,
  "verbose": false,
  "agentCommand": "claude-code-acp"
}
```

### Environment Variables

| Variable                 | Description                               |
| ------------------------ | ----------------------------------------- |
| `CLAM_VERBOSE=1`         | Enable verbose output                     |
| `CLAM_SHOW_TIMESTAMPS=1` | Show timestamps                           |
| `CLAM_TRUNCATE_AFTER`    | Max lines before truncating (default: 10) |
| `CLAM_AGENT_COMMAND`     | Agent command to spawn                    |

## Requirements

- Node.js 22+
- `claude-code-acp` installed (`npm install -g @zed-industries/claude-code-acp`)

## Architecture

`clam` uses a semantic output interface (`OutputWriter`) that:

1. Renders to ANSI-colored text in standard terminals
2. Guarantees NO cursor positioning codes (true scrollback)

See the [clam spike spec](../../docs/project/specs/active/plan-2026-02-03-clam-acp-client-spike.md) for full architecture details.

## Development

```bash
# Run in development
pnpm dev

# Run tests
pnpm test

# Type check
pnpm run typecheck
```

## License

MIT
