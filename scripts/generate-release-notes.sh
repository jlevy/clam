#!/bin/bash
# Generate release notes from conventional commits
# Follows tbd release-notes-guidelines format

set -e

VERSION="${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD")}"
PREV_TAG=$(git describe --tags --abbrev=0 "${VERSION}^" 2>/dev/null || echo "")

if [ -z "$PREV_TAG" ]; then
  # First release - get all commits
  RANGE="$VERSION"
  COMPARE_URL=""
else
  RANGE="${PREV_TAG}..${VERSION}"
  REPO_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
  COMPARE_URL="**Full commit history**: ${REPO_URL}/compare/${PREV_TAG}...${VERSION}"
fi

# Collect commits by type
FEATURES=""
FIXES=""
REFACTORING=""
DOCS=""
OTHER=""

while IFS= read -r line; do
  # Extract type and description from conventional commit
  if [[ "$line" =~ ^feat(\(.+\))?:\ (.+)$ ]]; then
    scope="${BASH_REMATCH[1]}"
    desc="${BASH_REMATCH[2]}"
    if [ -n "$scope" ]; then
      scope="${scope:1:-1}"  # Remove parens
      FEATURES+="- **${scope}**: ${desc}"$'\n'
    else
      FEATURES+="- ${desc}"$'\n'
    fi
  elif [[ "$line" =~ ^fix(\(.+\))?:\ (.+)$ ]]; then
    scope="${BASH_REMATCH[1]}"
    desc="${BASH_REMATCH[2]}"
    if [ -n "$scope" ]; then
      scope="${scope:1:-1}"
      FIXES+="- **${scope}**: ${desc}"$'\n'
    else
      FIXES+="- ${desc}"$'\n'
    fi
  elif [[ "$line" =~ ^refactor(\(.+\))?:\ (.+)$ ]]; then
    scope="${BASH_REMATCH[1]}"
    desc="${BASH_REMATCH[2]}"
    if [ -n "$scope" ]; then
      scope="${scope:1:-1}"
      REFACTORING+="- **${scope}**: ${desc}"$'\n'
    else
      REFACTORING+="- ${desc}"$'\n'
    fi
  elif [[ "$line" =~ ^docs(\(.+\))?:\ (.+)$ ]]; then
    scope="${BASH_REMATCH[1]}"
    desc="${BASH_REMATCH[2]}"
    if [ -n "$scope" ]; then
      scope="${scope:1:-1}"
      DOCS+="- **${scope}**: ${desc}"$'\n'
    else
      DOCS+="- ${desc}"$'\n'
    fi
  fi
done < <(git log --pretty=format:"%s" $RANGE 2>/dev/null)

# Generate output
echo "## What's Changed"
echo ""

if [ -n "$FEATURES" ]; then
  echo "### Features"
  echo ""
  echo -n "$FEATURES"
  echo ""
fi

if [ -n "$FIXES" ]; then
  echo "### Fixes"
  echo ""
  echo -n "$FIXES"
  echo ""
fi

if [ -n "$REFACTORING" ]; then
  echo "### Refactoring"
  echo ""
  echo -n "$REFACTORING"
  echo ""
fi

if [ -n "$DOCS" ]; then
  echo "### Documentation"
  echo ""
  echo -n "$DOCS"
  echo ""
fi

if [ -n "$COMPARE_URL" ]; then
  echo "$COMPARE_URL"
fi
