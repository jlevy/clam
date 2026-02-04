---
cwd: ..
env:
  NO_COLOR: "1"
---
# Test: --help shows usage

```console
$ node dist/bin.mjs --help
clam - True terminal scrollback ACP client for Claude Code

USAGE:
  clam [options]

OPTIONS:
  -h, --help        Show this help message
  -v, --version     Show version
  --verbose         Enable verbose/debug output
  --timestamps      Show timestamps on tool outputs
  --cwd <path>      Set working directory

CONFIGURATION:
  Config files are stored in ~/.clam/code/
  - config.json: User configuration
  - permissions.json: Saved permission decisions

ENVIRONMENT VARIABLES:
  CLAM_CODE_VERBOSE=1          Enable verbose output
  CLAM_CODE_SHOW_TIMESTAMPS=1  Show timestamps
  CLAM_CODE_TRUNCATE_AFTER     Max lines before truncating (default: 10)
  CLAM_CODE_AGENT_COMMAND      Agent command to spawn

COMMANDS (during session):
  /help    Show available commands
  /quit    Exit clam
  /status  Show session status
  /config  Show current configuration
  /clear   Clear the terminal

MULTI-LINE INPUT:
  Type and press Enter to add lines
  Press Enter on empty line to submit (two Enters)
? 0
```

# Test: --version shows version

```console
$ node dist/bin.mjs --version
clam [..]
? 0
```

# Test: Embedded adapter is resolvable

This test verifies that the embedded @zed-industries/claude-code-acp adapter can be
resolved from node_modules.

```console
$ node -e "const { createRequire } = require('module'); const r = createRequire(require.resolve('./dist/bin.mjs')); console.log(r.resolve('@zed-industries/claude-code-acp/dist/index.js').includes('node_modules') ? 'ok' : 'fail')"
ok
? 0
```
