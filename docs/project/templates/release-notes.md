---
title: Release Notes Template
description: Template for writing release notes following tbd guidelines
---
<!-- INSTRUCTIONS FOR AGENTS:

1. Copy this template to create release notes for a new version
2. Review all commits since the last release: git log <prev-tag>..HEAD --oneline
3. Describe the AGGREGATE DELTA - what’s different now vs before
4. Consolidate related changes under parent features
5. Write from user’s perspective - what can they do differently?
6. Skip internal-only changes (tests, CI, refactoring with no user impact)

See: tbd guidelines release-notes-guidelines -->

## What’s Changed

### Features

<!-- New capabilities users can now do.
Bold the feature name, describe the benefit.
-->
<!-- Consolidate sub-features and related fixes under the parent feature.
-->

- **Feature name**: Description of what users can now do
  - Sub-capability or detail
  - Another sub-capability

### Fixes

<!-- Bug fixes that affect users.
Include the impact, not just the implementation.
-->

- **Issue description**: What was broken → what works now

### Refactoring

<!-- Only include if there's user-visible impact (performance, stability, etc.)
-->

- **Area**: Description of improvement and user-facing benefit

### Documentation

<!-- Only notable documentation improvements -->

- Description of doc improvement

**Full commit history**: https://github.com/jlevy/clam/compare/vX.X.X...vY.Y.Y
