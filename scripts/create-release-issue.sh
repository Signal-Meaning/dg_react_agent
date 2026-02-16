#!/bin/bash

# Script to create a GitHub issue for a new release and create a working branch
# Usage: ./scripts/create-release-issue.sh <version> [type]
# Example: ./scripts/create-release-issue.sh 0.5.0 minor

set -e

# Check if version is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <version> [type]"
    echo "Example: $0 0.5.0 minor"
    echo "Types: patch, minor, major (default: minor)"
    exit 1
fi

VERSION="$1"
TYPE="${2:-minor}"

# Validate version format (basic check)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in format X.Y.Z (e.g., 0.5.0)"
    exit 1
fi

# Validate type
if [[ ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "Error: Type must be one of: patch, minor, major"
    exit 1
fi

RELEASE_BRANCH="release/v$VERSION"

# Reject if release branch already exists (avoids releasing again without bumping version)
if git ls-remote --exit-code origin "refs/heads/$RELEASE_BRANCH" 2>/dev/null; then
    echo "❌ Error: Release branch $RELEASE_BRANCH already exists on remote."
    echo "   This usually means v$VERSION was already released. Bump the version in package.json"
    echo "   (and packages/voice-agent-backend/package.json if releasing the backend), then"
    echo "   run this script again with the new version (e.g. 0.9.2)."
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Working directory is dirty (has uncommitted changes)"
    echo "Please commit or stash your changes before creating a release issue"
    exit 1
fi

# Determine release description based on type
case $TYPE in
    "patch")
        DESCRIPTION="bug fixes and minor improvements"
        ;;
    "minor")
        DESCRIPTION="new features and improvements"
        ;;
    "major")
        DESCRIPTION="major new features and potentially breaking changes"
        ;;
esac

echo "Creating release issue for v$VERSION ($TYPE release)..."
echo "Description: $DESCRIPTION"

# Switch to main branch and ensure it's up to date
echo "🔄 Switching to main branch..."
git checkout main
git pull origin main

# Require package.json version to match (ensures version was bumped and committed on main)
ROOT_VER=$(node -e "console.log(require('./package.json').version)")
if [ "$ROOT_VER" != "$VERSION" ]; then
    echo "❌ Error: Root package.json version on main is $ROOT_VER but you specified v$VERSION."
    echo "   Bump the version in package.json (and packages/voice-agent-backend/package.json"
    echo "   if needed) to $VERSION, commit on main, then run this script again."
    exit 1
fi

# Create the issue using GitHub CLI and capture the issue number
# For patch releases, use the quick-release template
if [ "$TYPE" = "patch" ]; then
    ISSUE_URL=$(gh issue create \
        --title "Quick Release v$VERSION: Patch Release" \
        --body-file .github/ISSUE_TEMPLATE/quick-release.md \
        --label "release")
else
    ISSUE_URL=$(gh issue create \
        --title "Release v$VERSION: Complete Release Process and Documentation" \
        --body-file .github/ISSUE_TEMPLATE/release-checklist.md \
        --label "release,documentation")
fi

echo "✅ Release issue created successfully!"
echo "🔗 Issue URL: $ISSUE_URL"

# Extract issue number from URL
ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -o '[0-9]*$')

# Create and switch to new release branch
echo "🌿 Creating release branch: $RELEASE_BRANCH"
git checkout -b "$RELEASE_BRANCH"
git push -u origin "$RELEASE_BRANCH"

echo "✅ Ready to work on release v$VERSION!"
echo "📍 You are now on branch: $RELEASE_BRANCH"
echo "🔗 Issue: $ISSUE_URL"
