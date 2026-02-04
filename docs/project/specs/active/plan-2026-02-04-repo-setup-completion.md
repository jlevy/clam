# Feature: Repository Setup Completion

**Date:** 2026-02-04

**Author:** Claude (with Joshua Levy)

**Status:** In Progress

## Overview

Complete the clam repository setup to match the patterns established in the tbd project. This includes GitHub Actions CI/CD, changesets for version management, git hooks, and developer documentation.

## Goals

- Set up GitHub Actions CI to run tests, lint, and typecheck on PRs
- Set up GitHub Actions release workflow for automated npm publishing
- Configure changesets for version management
- Add git hooks via lefthook for pre-commit quality checks
- Create comprehensive developer documentation

## Non-Goals

- Publishing the first version to npm (separate task after repo setup)
- Benchmark workflow (clam doesn't have benchmarks yet)
- Coverage reporting in CI (can be added later)

## Background

The clam project was extracted from the kermg monorepo and restructured as a standalone pnpm monorepo. While the core codebase, TypeScript configuration, ESLint, Prettier, and tests are all working, several important repository infrastructure elements are missing:

1. No GitHub Actions workflows
2. No changeset configuration
3. No git hooks for pre-commit quality checks
4. No developer documentation (development.md, publishing.md)

These elements are essential for a production-quality open source project.

## Design

### Approach

Mirror the patterns from the tbd repository, adapted for clam's simpler structure:

- Single package monorepo (no coverage reports yet)
- Similar CI matrix (ubuntu, macos, windows)
- Same changesets workflow
- Same lefthook configuration (minus flowmark)

### Components

1. **GitHub Actions Workflows**
   - `ci.yml`: Test matrix, lint, typecheck, publint
   - `release.yml`: npm publish on version tags

2. **Changesets**
   - `.changeset/config.json`: Standard configuration
   - `.changeset/README.md`: Quick reference

3. **Git Hooks**
   - `lefthook.yml`: pre-commit (format, lint, typecheck), pre-push (test)

4. **Documentation**
   - `docs/development.md`: Development workflow guide
   - `docs/publishing.md`: Release process documentation

## Implementation Plan

### Phase 1: GitHub Actions CI

- [x] Create `.github/workflows/ci.yml`
  - Test job with ubuntu/macos/windows matrix
  - Lint & typecheck job on ubuntu
  - Use pnpm/action-setup@v4 and actions/setup-node@v4
  - Node.js 22

### Phase 2: GitHub Actions Release

- [x] Create `.github/workflows/release.yml`
  - Trigger on `v*` tags
  - Build, publint, publish to npm with provenance
  - Create GitHub release with changelog extraction

### Phase 3: Changesets Configuration

- [x] Create `.changeset/config.json`
- [x] Create `.changeset/README.md`

### Phase 4: Git Hooks

- [x] Add lefthook as devDependency
- [x] Create `lefthook.yml`
- [x] Add `prepare` script to package.json

### Phase 5: Documentation

- [x] Create `docs/development.md`
- [x] Create `docs/publishing.md`

## Testing Strategy

1. Run `pnpm ci` locally to verify all checks pass
2. Push to branch and verify CI workflow runs successfully
3. Verify lefthook installs and runs on commit

## Rollout Plan

1. Implement all changes on feature branch
2. Create PR with validation plan
3. Merge and verify CI runs on main
4. First npm publish will be done separately

## Open Questions

- **DECIDED**: No coverage reporting in initial CI (can be added later when there's more test coverage)
- **DECIDED**: No benchmark job (clam doesn't have benchmarks)
- **DECIDED**: Skip flowmark in lefthook (markdown formatting not critical for this project)

## References

- [tbd/.github/workflows/ci.yml](https://github.com/jlevy/tbd/blob/main/.github/workflows/ci.yml)
- [tbd/.github/workflows/release.yml](https://github.com/jlevy/tbd/blob/main/.github/workflows/release.yml)
- [tbd/docs/development.md](https://github.com/jlevy/tbd/blob/main/docs/development.md)
- [tbd/docs/publishing.md](https://github.com/jlevy/tbd/blob/main/docs/publishing.md)
