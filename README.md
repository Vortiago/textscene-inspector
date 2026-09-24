# TextScene Inspector

[![CI/CD](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Renders Godot `.tscn` scenes in 3D, without Godot.

TextScene Inspector parses the `.tscn` text and draws it with
react-three-fiber over three.js: meshes, PBR materials, lights, cameras,
environments, and instanced sub-scenes. There is no Godot install, no editor
cache, and no import step. It ships as a VS Code extension (desktop and
vscode.dev), a standalone web previewer, and a linter for Godot's text formats
(`.tscn` scenes and `.tres` resources). The linter runs both as a CLI and as
in-editor diagnostics.

Try it without installing anything: **[textscene-inspector.pages.dev](https://textscene-inspector.pages.dev/)**.

![The web previewer rendering a CSG hallway mockup in the Split Dock UI](./docs/showcase/web/hallway.png)

*The web previewer's Split Dock chrome: the Source pane on the left, and a
right dock that holds the scene tree above the Inspector, Resources and Cameras
tabs. The scene is a self-contained CSG
corridor of floor, walls, ceiling, portrait frames and Label3D name plates, all
built from primitive nodes.*

## What it renders

All 240 of Godot 4.6.3's instantiable node types, each a self-registering
vertical slice.

Coverage is broader than what draws. Some node types are parsed and fully
lint-checked while drawing nothing, either because that is correct (a Timer, a
skeleton modifier, an XR tracker) or because rendering is not implemented. The
parity gallery shows which of the two applies to each node type.

| Category | Types |
|---|---|
| Meshes | Box, Sphere, Cylinder, Plane, Capsule, Torus, Prism, Quad |
| CSG | CSGBox3D, CSGCylinder3D, CSGSphere3D, CSGTorus3D, CSGMesh3D, CSGPolygon3D, CSGCombiner3D, with real union, intersection and subtraction |
| Lights & camera | Spot, Directional, Omni, Area (with shadows), Camera3D, Camera2D, WorldEnvironment |
| Physics | Bodies plus collision-shape gizmos. Casts, spring arms, ragdoll bones, vehicle bodies and joints are lint-checked |
| 2D | Sprite2D, AnimatedSprite2D, Polygon2D, Line2D, TileMap, TileMapLayer, NavigationRegion2D, Marker2D, Path2D, PathFollow2D, ParallaxBackground, ParallaxLayer |
| 3D scene | Sprite3D, Label3D, Decal, GridMap, NavigationRegion3D, Marker3D, Path3D, PathFollow3D |
| Viewports | SubViewport, SubViewportContainer: nested viewports, with `ViewportTexture` composited onto 3D surfaces |
| UI | Control nodes, drawn natively in the WebGL canvas |

Beyond the node set:

- **Materials.** StandardMaterial3D PBR: albedo, metallic, roughness, normal,
  emission, AO, heightmap, clearcoat, rim and UV transforms, with external
  textures.
- **External resources.** PackedScene instancing, textures, materials and GLB
  meshes flow through a typed event bus that recovers when a file arrives after
  the scene that references it. A resource a `.tres` declares inside itself (a
  mesh's own surface materials, a MeshLibrary's embedded meshes) is addressed
  the same way, by Godot's `res://file.tres::SubId` path.
- **Animation.** AnimationPlayer (transform tracks through `THREE.AnimationMixer`,
  plus value tracks such as sprite frames and Decal modulate and size),
  AnimationTree blend trees and state machines, GLB-embedded clips, and
  AnimatedSprite2D frames, all behind one selection-driven play, pause and
  scrub transport.
- **Linting.** A React- and THREE-free bundle powers both `tscn-lint` on the
  command line and the VS Code Problems panel.

## Surfaces

**VS Code extension**: desktop and web (vscode.dev) entry points, scene
outline, go-to-definition on `SubResource` and `ExtResource` ids within the
file, and hot reload on save. It is not yet published to the Marketplace.
Build it from source (below).

**Web previewer**: a fixture browser, an "Open .tscn" picker with a
<kbd>Ctrl/Cmd+K</kbd> scene palette, drag-and-drop multi-file upload (drop a
scene and its textures in one gesture), and shareable `?fixture=` deep links.
Add `&camera=<node path>` (for example `&camera=Root/Camera3D`) to open looking
through a scene's own Camera3D. An editable Source pane renders `.tscn` text as
you type, with a linter gutter (error and warning dots, hover popover,
problem-count badge), a file-level section for findings no line holds, and a
"Download .tscn" export.

**CLI linter**: `pnpm lint:tscn <files>`, after `pnpm build:linter`.

## Quick start

Requires Node.js 24 or later and pnpm 9 or later.

```bash
pnpm install
pnpm build
pnpm dev:web          # web previewer on localhost
```

For the VS Code extension:

```bash
pnpm --filter textscene-inspector build     # dist/extension.js (desktop),
                                            # dist/extension.web.js (vscode.dev),
                                            # plus the webview bundles
pnpm --filter textscene-inspector package   # .vsix
```

Install the `.vsix` with **Extensions: Install from VSIX…** in the command
palette, then open any `.tscn` file.

<details>
<summary>Windows: installing Node and pnpm with WinGet</summary>

```bash
winget configure scripts/winget-dev-setup.yaml
```

Installs the required versions from the official package sources. Needs WinGet
v1.6.2631 or later (`winget --version`).
</details>

## Tests

```bash
pnpm test                # full vitest suite
pnpm test:watch          # watch mode
pnpm test:visual         # golden images, headless chromium, exact pixel compare
pnpm test:visual:update  # rewrite baselines after an intentional change: eyeball, then commit
```

The VS Code extension carries its own integration suite, run in a real VS Code
instance and separate from the vitest run:

```bash
pnpm --filter textscene-inspector test:integration
```

CI runs that suite on Ubuntu, macOS and Windows (`xvfb-run` for headless
Linux) and verifies VSIX installation on each.

That suite runs *in* the extension host, which cannot see inside the preview's
sandboxed webview. A second gate does:

```bash
pnpm test:vscode:csp     # glyphs paint in the real webview, offline, under the real CSP
```

It opens a Control fixture through the extension's own preview command in a real
desktop VS Code, reads the WebGL canvas back over CDP, and requires ink from the
text pipeline, exactly zero ink from the same scene with every label emptied, and
zero CSP violations or network attempts inside the preview frame. CI runs it on
Linux only.

<details>
<summary>Debugging the integration tests</summary>

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Integration Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/textscene-vscode/dist/test/integration/runTests.js",
      "cwd": "${workspaceFolder}/apps/textscene-vscode",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/apps/textscene-vscode/dist/**/*.js"]
    }
  ]
}
```
</details>

## Scripts

| Command | Does |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm build:site` | Deployable web build. Vendors the games and ld-58 corpora (script-stripped, never committed) and builds `apps/textscene-web/dist` |
| `pnpm build:linter` | Build the standalone linter bundle |
| `pnpm test` | Full unit suite |
| `pnpm lint` | ESLint |
| `pnpm lint:tscn <paths>` | Lint `.tscn` scenes and `.tres` resources (files or directories) |
| `pnpm type-check` | Type check |
| `pnpm clean` | Remove build output |

## Architecture

Two parsers share one scanning loop: a lenient parser renders whatever it can
salvage, and a strict parser lints and reports everything. Node types
self-register on import, so adding one touches its own directory and three
aggregation imports, never a central parser or renderer file. The web previewer
and the VS Code extension are thin shells over the same `@textscene/core`
library, which keeps them at feature parity.

[ARCHITECTURE.md](./ARCHITECTURE.md) has the details.

## Documentation

- [docs/user-guide-web.md](./docs/user-guide-web.md): viewport controls, scene tree, inspector
- [docs/user-guide-vscode.md](./docs/user-guide-vscode.md): VS Code extension guide
- [ARCHITECTURE.md](./ARCHITECTURE.md): project structure and patterns
- [REFERENCES.md](./REFERENCES.md): Godot and three.js documentation links
- [CONTRIBUTING.md](./CONTRIBUTING.md): issues, gates and pull requests
- [GitHub issues](https://github.com/Vortiago/textscene-inspector/issues): roadmap and open work

## License

MIT
