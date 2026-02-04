# Development Guide

This document covers development setup and workflows for `get-clam` (the clam CLI).

## Prerequisites

- Node.js >= 22
- pnpm (will be installed automatically via corepack)

## Setup

```bash
# Enable corepack (includes pnpm)
corepack enable

# Install dependencies
pnpm install

# Install git hooks
pnpm prepare
```

## Development Workflow

### Running the CLI from source

During development, run the CLI directly from TypeScript source (no build needed):

```bash
pnpm clam --help
pnpm clam
```

### Running the built CLI

To test the production build:

```bash
pnpm build
node packages/clam/dist/bin.mjs --help
```

### Testing the packaged installation

To test the CLI exactly as users would install it from npm:

```bash
# Build, pack, and install globally (like npm install -g get-clam)
pnpm test:install

# Test the installed binary
clam --help

# Uninstall when done
pnpm test:uninstall
```

This creates an npm tarball and installs from it, validating the full package structure.

### Building

```bash
# Build all packages
pnpm build

# Watch mode for development
pnpm clam:dev
```

### Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm --filter get-clam test:watch
```

### Formatting and Linting

```bash
# Format code (auto-fix)
pnpm format

# Check formatting (CI)
pnpm format:check

# Lint with auto-fix
pnpm lint

# Lint check only (CI)
pnpm lint:check

# Type check
pnpm typecheck
```

### Validating Package

```bash
# Validate package.json exports
pnpm publint
```

### Pre-commit Checks

Run all checks before committing:

```bash
pnpm precommit
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
- Use imperative mood ("Add feature" not "Added feature")

## Creating Releases

We use [Changesets](https://github.com/changesets/changesets) for versioning. See [publishing.md](publishing.md) for the full release process.

### Adding a changeset

When making a change that should be included in a release:

```bash
pnpm changeset
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
