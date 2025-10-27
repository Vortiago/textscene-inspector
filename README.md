# TextScene Inspector

View and navigate text-based 3D scene (.tscn) files in VS Code using three.js rendering.

## Status

**Active Development** - Core rendering functionality implemented with self-registering node system.

## Features

**Implemented:**
- ✅ TSCN file parsing with full scene tree hierarchy
- ✅ Node3D and MeshInstance3D node types (self-registering)
- ✅ BoxMesh, CylinderMesh, SphereMesh primitives
- ✅ StandardMaterial3D with PBR properties
- ✅ Three.js rendering with orbit controls
- ✅ Interactive scene tree viewer
- ✅ Node property inspector
- ✅ VS Code extension with webview preview
- ✅ Web previewer for debugging

**In Progress:**
- 🔄 Additional light types (SpotLight3D, DirectionalLight3D)
- 🔄 External resource loading and scene instancing
- 🔄 Camera3D support

See [TODO.md](./TODO.md) for complete roadmap.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

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

## Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
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
