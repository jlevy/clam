# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

## Quick Reference

### Adding a changeset

When making a change that should be included in a release:

```bash
pnpm changeset
```

Follow the prompts to describe your change and select the version bump type.

### Version bumps

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes
- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes
- `major` (0.1.0 → 1.0.0): Breaking changes

For the full release process, see [docs/publishing.md](../docs/publishing.md).
