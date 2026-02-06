# Publishing (npm)

This project uses [Changesets](https://github.com/changesets/changesets) for version
management and tag-based releases with provenance attestation to npm.

For daily development workflow, see [development.md](development.md).

## One-Time Setup

Before the first release, complete these steps:

### 1. Manual First Publish

The package must exist on npm before automated releases can work.

```bash
cd packages/clam

# 1. Create and push the tag FIRST
git tag v0.1.0
git push --tags

# 2. Build
bun run build

# 3. Publish
npm publish --access public
```

This will prompt for web-based authentication in your browser.

### 2. Configure NPM_TOKEN Secret

1. Generate an npm access token at https://www.npmjs.com/settings/~/tokens
   - Select “Automation” type for CI/CD use
2. Add the token as a repository secret:
   - Go to https://github.com/jlevy/clam/settings/secrets/actions
   - Add secret named `NPM_TOKEN` with the token value

### 3. Verify Repository Setup

- Repository must be public for provenance attestation
- Ensure the release workflow at `.github/workflows/release.yml` has `id-token: write`
  permission

## During Development

Merge PRs to `main` without creating changesets.
Changesets are created only at release time.

## Release Workflow

Follow these steps to publish a new version.

### Step 1: Prepare

```bash
git checkout main
git pull
git status  # Must be clean
```

### Step 2: Determine Version

Review changes since last release:

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --oneline
```

Choose version bump:

- `patch` (0.1.0 → 0.1.1): Bug fixes, docs, internal changes
- `minor` (0.1.0 → 0.2.0): New features, non-breaking changes
- `major` (0.1.0 → 1.0.0): Breaking changes

### Step 3: Create Changeset

Run the interactive changeset command:

```bash
bun run changeset
```

This prompts for package selection, bump type (patch/minor/major), and a summary.

Commit:

```bash
git add .changeset
git commit -m "chore: add changeset for vX.X.X"
```

### Step 4: Version Packages

Run changesets to bump version and update CHANGELOG:

```bash
bun run changeset version
```

Review and commit:

```bash
git diff  # Verify package.json and CHANGELOG.md
git add .
git commit -m "chore: release get-clam vX.X.X"
```

### Step 5: Push and Tag

```bash
git push
git tag vX.X.X
git push --tags
```

### Step 6: Verify

```bash
gh release view vX.X.X -R jlevy/clam
npm view get-clam
```

## Quick Reference

```bash
git checkout main && git pull
bun run changeset  # Interactive: select package, bump type, summary
git add .changeset && git commit -m "chore: add changeset for v0.2.0"
bun run changeset version
git add . && git commit -m "chore: release get-clam v0.2.0"
git push && git tag v0.2.0 && git push --tags
```

## How Publishing Works

This project uses npm token-based publishing with provenance:

- **NPM_TOKEN secret**: Repository secret containing npm automation token
- **Provenance attestation**: `NPM_CONFIG_PROVENANCE=true` adds signed build provenance

The release workflow (`.github/workflows/release.yml`) triggers on `v*` tags and
publishes automatically.

## GitHub Releases

The release workflow automatically creates a GitHub Release when a tag is pushed:

- **Release name**: Matches the tag (e.g., `v0.2.0`)
- **Release notes**: Initially extracted from CHANGELOG
- **Pre-release flag**: Automatically set for versions containing `-` (e.g.,
  `1.0.0-beta.1`)

## Troubleshooting

**Release workflow not running?**

- Ensure tag format is `v*` (e.g., `v0.2.0`)
- Check tag was pushed: `git ls-remote --tags origin`

**npm publish failing with 401/403?**

- Verify `NPM_TOKEN` secret is configured in repository settings
- Check the token hasn’t expired
- Ensure token has publish permissions for `get-clam`

**First publish?**

- The package must already exist on npm before the workflow can publish
- Do a manual `npm publish --access public` first from `packages/clam` directory
