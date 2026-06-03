# TextScene Inspector

Preview **Godot `.tscn` scenes in 3D — inside VS Code or your browser, with no Godot install.** Renders meshes, materials, lights and cameras via react-three-fiber/three.js, plus a scene-tree inspector and a `.tscn` linter. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layout.

## Status

**Active Development** - Core rendering functionality implemented with self-registering node system.

## Features

**Why it's different** (what other `.tscn` tools don't do):
- 🧊 **Real 3D rendering** of the scene — meshes, PBR materials, lights, cameras, environments, and instanced sub-scenes — not just a node tree
- 🚫 **No Godot install or editor cache** — renders straight from the `.tscn` text
- 🌐 **Runs in the browser** via the standalone web previewer
- ✅ **Built-in `.tscn` linter** for catching malformed scenes

**Also implemented:**
- ✅ Full scene-tree hierarchy parsing with an interactive, searchable tree viewer
- ✅ Node property inspector with click-to-select in the 3D viewport
- ✅ Self-registering node system: Node3D, MeshInstance3D, Camera3D, lights, WorldEnvironment
- ✅ Mesh primitives: Box, Sphere, Cylinder, Plane, Capsule, Torus, Prism
- ✅ StandardMaterial3D PBR with external textures, normal maps, emission, and UV transforms
- ✅ Spot, Directional, and Omni lights with shadows
- ✅ External scene instancing (PackedScene) and external textures
- ✅ VS Code extension (webview preview, outline, jump-to-definition, hot-reload) + web previewer

See [TODO.md](./TODO.md) for the complete roadmap.

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
pnpm build
```

## Testing

### Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Watch mode for development
cd packages/textscene-core
pnpm test:watch
```

### Integration Tests

The VS Code extension includes comprehensive integration tests that run in a real VS Code instance:

```bash
# Run integration tests (45 tests covering all fixtures)
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
- Tests all 42 scene fixtures automatically

## Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run all tests (unit + integration)
- `pnpm test:unit` - Run unit tests only
- `pnpm lint` - Lint code
- `pnpm type-check` - Type check
- `pnpm clean` - Clean artifacts

## Architecture Highlights

**Node Registry Pattern**: New node types self-register - no need to edit central parser/renderer files.

**Generic Resource Resolution**: Type-safe resource loading eliminates code duplication.

**Feature Parity**: Web previewer and VS Code extension share the same UI components and rendering engine through the textscene-renderer library.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed explanations.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - AI assistant guidelines
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Project structure and patterns
- [TODO.md](./TODO.md) - Implementation roadmap
- [REFERENCES.md](./REFERENCES.md) - Documentation links

## License

MIT
