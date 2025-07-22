# VextLang Extension Release Guide

## Automated Release Process

The VextLang extension uses GitHub Actions for automated releases. There are two ways to trigger a release:

### Method 1: GitHub Actions UI (Recommended)

1. Go to your GitHub repository
2. Navigate to **Actions** tab
3. Select **Release VextLang Extension** workflow
4. Click **Run workflow**
5. Choose version bump type:
   - **patch**: Bug fixes and minor improvements (0.0.1 → 0.0.2)
   - **minor**: New features (0.0.1 → 0.1.0)
   - **major**: Breaking changes (0.0.1 → 1.0.0)
6. Click **Run workflow**

### Method 2: Git Tags

1. Create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. GitHub Actions will automatically trigger and create a release

### Method 3: Local Script

Use the provided release script:

```bash
# Patch release (bug fixes)
npm run release:patch

# Minor release (new features)
npm run release:minor

# Major release (breaking changes)
npm run release:major

# Or use the interactive script
npm run release
```

## What Happens During Release

1. **Version Bump**: Automatically increments version in `package.json`
2. **Build**: Compiles TypeScript and builds the extension
3. **Package**: Creates `.vsix` file
4. **GitHub Release**: Creates a new release with:
   - Release notes
   - Downloadable `.vsix` file
   - Git tag
5. **Auto-Update**: Extension will auto-update from GitHub releases

## Auto-Update Configuration

The extension is configured to auto-update from GitHub releases:

```json
{
  "updateUrl": "https://github.com/rickcollette/vext-lang-vscode/releases/latest/download/vextlang.vsix"
}
```

Users can:
1. **Manual Update**: Download `.vsix` from GitHub releases
2. **Auto-Update**: Extension checks for updates automatically
3. **IDE Integration**: Install directly from VS Code/Cursor

## Release Notes Template

Each release includes:
- Version number
- What's new
- Installation instructions
- Feature list
- Requirements

## Publishing to VS Code Marketplace

To publish to the official marketplace:

1. **Get Publisher Account**: Sign up at https://marketplace.visualstudio.com/
2. **Create Publisher**: Create publisher ID "rickcollette"
3. **Publish Extension**:
   ```bash
   npx vsce publish
   ```

## Version Management

- **Current Version**: 0.0.1
- **Publisher ID**: rickcollette
- **Extension ID**: vextlang
- **Auto-Update**: Enabled via GitHub releases

## Troubleshooting

### Release Fails
- Check GitHub Actions logs
- Ensure all tests pass
- Verify package.json is valid

### Auto-Update Not Working
- Verify `updateUrl` in package.json
- Check GitHub release assets
- Ensure `.vsix` file is properly uploaded

### Manual Installation
If auto-update fails, users can:
1. Download `.vsix` from GitHub releases
2. Install via VS Code Extensions panel
3. Use "Install from VSIX..." option 