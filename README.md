# TextScene Inspector

[![CI](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Renders Godot `.tscn` scenes in 3D and 2D, without Godot.

It reads the `.tscn` text and draws it with react-three-fiber over three.js. There is no Godot install, editor cache or import step.

**Try it:** [vortiago.github.io/textscene-inspector](https://vortiago.github.io/textscene-inspector/)

![The web previewer rendering a CSG hallway](./docs/showcase/web/hallway.png)

## Get it

| Tool | Get it | Guide |
| --- | --- | --- |
| VS Code extension (desktop and vscode.dev) | [Marketplace](https://marketplace.visualstudio.com/items?itemName=vortiago.textscene-inspector) | [VS Code guide](./docs/user-guide-vscode.md) |
| Web previewer | [Open in the browser](https://vortiago.github.io/textscene-inspector/) | [Web guide](./docs/user-guide-web.md) |
| CLI linter for `.tscn` and `.tres` | `npm install --global @textscene/linter` | [Linter README](./apps/textscene-linter/README.md) |

The dev edition of the web previewer adds the built-in test scenes and the parity gallery: [textscene-inspector.pages.dev](https://textscene-inspector.pages.dev/).

## What it renders

All 240 of Godot 4.6.3's instantiable node types are parsed and linted. Some draw nothing, because that is correct (a Timer) or because rendering is not done yet. The parity gallery shows which.

| Category | Types |
|---|---|
| Meshes | Box, Sphere, Cylinder, Plane, Capsule, Torus, Prism, Quad, GLB |
| CSG | All CSG shapes, with real union, intersection and subtraction |
| Lights and cameras | Spot, Directional, Omni, Area (with shadows), Camera3D, Camera2D, WorldEnvironment |
| Physics | Bodies, and collision-shape gizmos |
| 2D | Sprite2D, AnimatedSprite2D, Polygon2D, Line2D, TileMap, TileMapLayer, Path2D, parallax |
| 3D | Sprite3D, Label3D, Decal, GridMap, Path3D, navigation regions |
| Viewports | SubViewport, and `ViewportTexture` on 3D surfaces |
| UI | Control nodes, drawn in the WebGL canvas |

Also:

- **Materials:** StandardMaterial3D PBR, with external textures.
- **Resources:** instanced sub-scenes, textures, materials and GLB meshes. A file that arrives late still applies.
- **Animation:** AnimationPlayer, AnimationTree and AnimatedSprite2D, with play, pause and scrub.

## Build from source

Requires Node.js 24 or later and pnpm 9 or later. On Windows, `winget configure scripts/winget-dev-setup.yaml` installs both.

```bash
pnpm install
pnpm build
pnpm dev:web                                # web previewer on localhost
pnpm --filter textscene-inspector package   # VS Code .vsix
pnpm build:linter                           # CLI linter, then: pnpm lint:tscn <files>
```

Install a `.vsix` with **Extensions: Install from VSIX…**.

## Scripts

| Command | Does |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm build:site` | Build the dev edition of the web previewer |
| `pnpm build:pages` | Build the public edition, and check it holds no dev content |
| `pnpm build:linter` | Build the CLI linter |
| `pnpm lint:tscn <paths>` | Lint `.tscn` and `.tres` files or directories |
| `pnpm test` | Unit tests |
| `pnpm test:visual` | Golden images, exact pixel match |
| `pnpm test:visual:update` | Rewrite the golden images. Check them before you commit. |
| `pnpm test:vscode:csp` | Text renders in the real VS Code webview, offline, under its CSP |
| `pnpm --filter textscene-inspector test:integration` | VS Code integration tests |
| `pnpm lint` | ESLint |
| `pnpm type-check` | Type check |
| `pnpm clean` | Remove build output |

[CONTRIBUTING.md](./CONTRIBUTING.md) says how to check a change before a pull request.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): design and project structure
- [CONTRIBUTING.md](./CONTRIBUTING.md): issues, checks and pull requests
- [RELEASING.md](./RELEASING.md): how to release
- [REFERENCES.md](./REFERENCES.md): Godot and three.js links
- [docs/user-flows.md](./docs/user-flows.md): manual verification flows
- [GitHub issues](https://github.com/Vortiago/textscene-inspector/issues): open work

## License

MIT
