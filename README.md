# TextScene Inspector

Preview **Godot `.tscn` scenes in 3D — inside VS Code or your browser, with no Godot install.** Renders meshes, materials, lights and cameras via react-three-fiber/three.js, plus a scene-tree inspector and a `.tscn` linter. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layout.

## Status

**Active Development** - Core rendering functionality implemented with self-registering node system.

Current release: **0.9.0** — on the road to v1.0; see [CHANGELOG.md](./CHANGELOG.md).

## Features

**Why it's different** (what other `.tscn` tools don't do):
- 🧊 **Real 3D rendering** of the scene — meshes, PBR materials, lights, cameras, environments, and instanced sub-scenes — not just a node tree
- 🚫 **No Godot install or editor cache** — renders straight from the `.tscn` text
- 🌐 **Runs in the browser** via the standalone web previewer
- ✅ **Built-in `.tscn` linter** for catching malformed scenes

**Implemented:**
- ✅ TSCN parsing with full scene tree hierarchy (lenient render parser + strict lint parser sharing one scanning loop)
- ✅ ~45 self-registering node types as unified vertical slices: meshes (Box/Sphere/Cylinder/Plane/Capsule/Torus/Prism), lights (Spot/Directional/Omni with shadows), Camera3D/Camera2D, WorldEnvironment, Label3D, CSG (as primitives), physics bodies + collision gizmos, sprites (2D/3D), and 15 Control types rendered as a DOM overlay
- ✅ StandardMaterial3D PBR (albedo/metallic/roughness/normal/emission/AO, UV transforms, external textures)
- ✅ External resources: PackedScene instancing, textures, materials, GLB meshes — event-driven with late-arrival upload recovery
- ✅ react-three-fiber rendering, Split Dock shell (scene tree, inspector, resources, cameras), 2D/3D viewport modes
- ✅ Linter: CLI (`tscn-lint`) and in-editor diagnostics (VS Code Problems panel), React/THREE-free bundle
- ✅ VS Code extension — desktop **and** web (vscode.dev) entry points, outline, go-to-definition, hot-reload
- ✅ Web previewer with fixture browser and an "Open .tscn" file picker (Ctrl/Cmd+K scene palette)

See [TODO.md](./TODO.md) for the road to v1.0 — AnimationPlayer playback is the headline remaining renderer item.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Developer Environment Setup (Windows)

For Windows developers, you can quickly install Node.js and pnpm using WinGet:

```bash
winget configure scripts/winget-dev-setup.yaml
```

This installs the required versions from the official package sources.

**Requirements:** WinGet v1.6.2631 or later (check with `winget --version`)

### Installation

```bash
pnpm install
pnpm type-check
pnpm test
```

### Development

```bash
# Build all packages
pnpm build

# Web previewer (for fast iteration)
cd apps/textscene-web
pnpm dev

# VS Code extension
cd apps/textscene-vscode
pnpm build        # emits dist/extension.js (desktop), dist/extension.web.js (vscode.dev), and the webview bundles
pnpm test:web     # manual smoke: serves the extension in a headless VS Code for Web instance

# Lint .tscn files from the CLI
pnpm build:linter
pnpm lint:tscn scenes/fixtures/*.tscn
```

## Testing

### Unit Tests

```bash
# Run all unit tests once
pnpm test

# Watch mode for development
pnpm test:watch
```

### Integration Tests

The VS Code extension includes comprehensive integration tests that run in a real VS Code instance:

```bash
# Run integration tests (the bundled fixture suite in a real VS Code instance)
cd apps/textscene-vscode
pnpm test:integration

# Debug integration tests
pnpm test:integration:debug
```

**Debug Configuration**: Add to `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Integration Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/textscene-vscode/out/test/integration/runTests.js",
      "cwd": "${workspaceFolder}/apps/textscene-vscode",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/apps/textscene-vscode/out/**/*.js"]
    }
  ]
}
```

### Continuous Integration

Integration tests run on all platforms (Ubuntu, macOS, Windows) in GitHub Actions:
- Uses `xvfb-run` for headless testing on Linux
- Verifies VSIX installation on all platforms
- Runs the bundled scene-fixture suite automatically

## Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run all unit tests once (`vitest run`; the VS Code integration suite runs separately via `pnpm --filter textscene-inspector test:integration`)
- `pnpm test:watch` - Run unit tests in watch mode
- `pnpm lint` - Lint code
- `pnpm lint:tscn <files>` - Lint .tscn scene files (build first with `pnpm build:linter`)
- `pnpm type-check` - Type check
- `pnpm clean` - Clean artifacts

## Architecture Highlights

**Node Registry Pattern**: New node types self-register - no need to edit central parser/renderer files.

**Event-Driven Resource Loading**: Textures, materials, GLB meshes, and packed scenes flow through a typed event bus with late-arrival upload recovery.

**Feature Parity**: Web previewer and VS Code extension share the same UI components and rendering engine through the shared @textscene/core library.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed explanations.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - AI assistant guidelines
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Project structure and patterns
- [TODO.md](./TODO.md) - Implementation roadmap
- [REFERENCES.md](./REFERENCES.md) - Documentation links

## License

MIT
