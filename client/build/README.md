# Build resources

electron-builder looks here for app icons:

- `icon.ico` — Windows (256×256 minimum, multi-size recommended)
- `icon.icns` — macOS (512×512 base)
- `icon.png` — Linux (512×512 PNG)

If none are present, electron-builder falls back to the default Electron icon.
Add your branded icons here before running `npm run electron:dist` for a release.
