#!/bin/bash
cd ~/Desktop/ClipStream

# Bump the patch version (1.0.0 → 1.0.1 → 1.0.2 etc.)
npm version patch --no-git-tag-version

# Get the new version number
VERSION=$(node -p "require('./package.json').version")
echo "Releasing v$VERSION..."

# Also rebuild locally
sh ~/Desktop/ClipStream/build.sh

# Commit, tag, and push — this triggers GitHub Actions
git add package.json
git commit -m "Release v$VERSION"
git tag "v$VERSION"
git push && git push --tags

echo ""
echo "========================================"
echo "v$VERSION is building on GitHub Actions!"
echo "Users will be notified to update automatically."
echo "========================================"
