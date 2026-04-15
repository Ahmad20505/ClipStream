#!/bin/bash
cd ~/Desktop/ClipStream

# Bump the patch version (1.0.0 → 1.0.1 → 1.0.2 etc.)
npm version patch --no-git-tag-version

# Get the new version number
VERSION=$(node -p "require('./package.json').version")
echo "Releasing v$VERSION..."

# Commit, tag, and push — GitHub Actions builds Mac + Windows in the cloud
git add .
git commit -m "Release v$VERSION"
git tag "v$VERSION"
git push && git push --tags

echo ""
echo "========================================"
echo "v$VERSION is building on GitHub Actions!"
echo "Check github.com/Ahmad20505/ClipStream/actions"
echo "Users will be auto-notified when it's ready."
echo "========================================"
