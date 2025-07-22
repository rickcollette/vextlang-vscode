#!/bin/bash

# VextLang Extension Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Determine version bump type
VERSION_TYPE=${1:-patch}
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    print_error "Invalid version type. Use: patch, minor, or major"
    exit 1
fi

print_status "Bumping version: $VERSION_TYPE"

# Bump version
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)
NEW_VERSION=${NEW_VERSION#v}  # Remove 'v' prefix

print_success "New version: $NEW_VERSION"

# Build the extension
print_status "Building extension..."
npm run compile

# Package the extension
print_status "Packaging extension..."
npx vsce package --out vextlang.vsix

# Check if git is available
if command -v git &> /dev/null; then
    # Check if we have uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes. Please commit them before releasing."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Commit version bump
    print_status "Committing version bump..."
    git add package.json package-lock.json
    git commit -m "Bump version to $NEW_VERSION"

    # Create and push tag
    print_status "Creating tag v$NEW_VERSION..."
    git tag "v$NEW_VERSION"
    git push origin main
    git push origin "v$NEW_VERSION"

    print_success "Release v$NEW_VERSION created and pushed to GitHub!"
    print_status "GitHub Actions will automatically build and create a release."
else
    print_warning "Git not found. Skipping git operations."
    print_status "Manual steps required:"
    print_status "1. Commit changes: git add . && git commit -m 'Bump version to $NEW_VERSION'"
    print_status "2. Create tag: git tag v$NEW_VERSION"
    print_status "3. Push: git push origin main && git push origin v$NEW_VERSION"
fi

print_success "Release script completed!"
print_status "Extension packaged as: vextlang.vsix"
print_status "Version: $NEW_VERSION" 