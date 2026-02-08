# Development Guide

This document covers development setup and workflows for `get-clam` (the clam CLI).

## Prerequisites

- Node.js >= 22
- [Bun](https://bun.sh/) >= 1.3

## Setup

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Install git hooks
bun run prepare
```

## Development Workflow

### Running the CLI from source

During development, run the CLI directly from TypeScript source (no build needed):

```bash
bun run clam --help
bun run clam
```

### Running the built CLI

To test the production build:

```bash
bun run build
node packages/clam/dist/bin.js --help
```

### Testing the packaged installation

To test the CLI exactly as users would install it from npm:

```bash
# Build, pack, and install globally (like npm install -g get-clam)
bun run test:install

# Test the installed binary
clam --help

# Uninstall when done
bun run test:uninstall
```

This creates an npm tarball and installs from it, validating the full package structure.

### Building

```bash
# Build all packages
bun run build

# Watch mode for development
bun run clam:dev
```

### Testing

```bash
# Run tests
bun run test

# Run tests with coverage
bun run test:coverage

# Watch mode
bun run --filter get-clam test:watch
```

### Formatting and Linting

```bash
# Format code (auto-fix)
bun run format

# Check formatting (CI)
bun run format:check

# Lint with auto-fix
bun run lint

# Lint check only (CI)
bun run lint:check

# Type check
bun run typecheck
```

### Validating Package

```bash
# Validate package.json exports
bun run publint
```

### Pre-commit Checks

Run all checks before committing:

```bash
bun run precommit
```

This runs format, lint, build, and test.

## Git Hooks

Git hooks are managed by lefthook and run automatically:

- **pre-commit**: Format, lint, and typecheck staged files
- **pre-push**: Build and run tests

To skip hooks (emergency only):

```bash
git commit --no-verify
git push --no-verify
```

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Format

```
<type>: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)

### Examples

```
feat: Add shell mode for executing terminal commands

fix: Handle empty input gracefully

docs: Update CLI usage examples

test: Add tests for permission prompt

chore: Update dependencies
```

### Notes

- Keep the first line under 72 characters
- Use imperative mood ("Add feature" not “Added feature”)

## Creating Releases

We use [Changesets](https://github.com/changesets/changesets) for versioning.
See [publishing.md](publishing.md) for the full release process.

### Adding a changeset

When making a change that should be included in a release:

```bash
bun run changeset
```

Follow the prompts to describe your change and select the version bump type.

## Project Structure

```
clam/
├── packages/
│   └── clam/               # Main CLI package (published as get-clam)
│       ├── src/
│       │   ├── bin.ts      # CLI entry point
│       │   ├── index.ts    # Library exports
│       │   ├── commands/   # Slash commands
│       │   └── lib/        # Core library
│       └── tests/
├── docs/
│   ├── development.md      # This file
│   ├── publishing.md       # Release process
│   └── project/            # Project documentation
│       ├── research/       # Research documents
│       └── specs/          # Specifications
├── .github/workflows/      # CI/CD
└── .changeset/             # Changesets config
```

## Architecture

Key concepts:

- **ACP Client**: Uses Agent Client Protocol to communicate with Claude Code
- **Shell-like Interface**: Terminal scrollback instead of TUI re-rendering
- **Slash Commands**: Built-in commands like `/help`, `/config`
- **Permission System**: User approval for agent tool calls

## CLI Patterns

The CLI follows modern TypeScript CLI patterns:

- Semantic terminal colors via picocolors
- Readline-based input with history
- Streaming response display
- Clean stdout/stderr separation
