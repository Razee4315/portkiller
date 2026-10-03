# Contributing

Contributions are welcome! Here's how to get started.

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - Rust (stable)
   - Windows 10/11

2. **Clone and install**
   ```bash
   git clone https://github.com/Razee4315/portkiller.git
   cd portkiller
   npm install
   ```

3. **Run in development**
   ```bash
   npm run tauri dev
   ```

4. **Run the unit tests**
   ```bash
   npm test
   ```

5. **Build for production**
   ```bash
   npm run tauri build
   ```

## Releasing

Releases are not automatic. When `main` is ready to ship:

1. Make sure the `[Unreleased]` section of `CHANGELOG.md` describes the changes. It becomes the "What's new" text users see in the update dialog.
2. Run the **Release** workflow from the Actions tab. Leave the version empty for a patch release, or enter one (for example `1.2.0`) for a minor or major release. It builds the installers and publishes the GitHub release.
3. Rename the `[Unreleased]` heading to the published version and start a new empty `[Unreleased]` section.

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- Rust: Follow standard Rust conventions (`cargo fmt`)
- TypeScript: Use existing project style
- Keep commits atomic and well-described

## Reporting Bugs

Open an issue with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Windows version
