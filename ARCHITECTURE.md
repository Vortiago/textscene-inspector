# Architecture

## Technology Stack

- TypeScript 6 (strict mode)
- pnpm workspaces with catalog dependency versions
- Vitest 4.1 (with `@react-three/test-renderer` and `@testing-library/react`)
- React 19 + react-three-fiber 9 + @react-three/drei
- three.js 0.184
- Vite 6 (web app) + esbuild (VS Code extension)

## Project Structure

```
/
├── packages/
│   └── textscene-core/          # Core library: parser, linter, R3F components
│       └── src/
│           ├── parser/          # Lenient TSCN parser used for rendering
│           ├── linter/          # Strict parser + lint rule registry
│           ├── nodes/           # Per-node-type parser + linter + formatter
│           │   ├── node/
│           │   ├── base/node3d/
│           │   └── 3d/
│           │       ├── meshinstance3d/
│           │       ├── camera3d/
│           │       ├── lights/{directional,omni,spot}light3d/
│           │       ├── worldenvironment/
│           │       └── label3d/
│           ├── core/            # SceneGraph + immutable resolution helpers
│           │   ├── NodeRegistry.ts        # Parser + formatter registry
│           │   ├── SceneGraph.ts          # Immutable resolved scene
│           │   ├── SceneGraphBuilder.ts   # Builder for SceneGraph
│           │   └── nodeDependsOnPath.ts   # Dependency-walk predicate
│           ├── r3f/             # react-three-fiber UI surface
│           │   ├── TscnCanvas.tsx         # <Canvas> + NodeDispatcher
│           │   ├── NodeDispatcher.tsx     # SceneGraph -> React tree
│           │   ├── NodeComponentRegistry.ts
│           │   ├── nodes/{node,node3d,meshinstance3d,...}/Component.tsx
│           │   ├── contexts/{Selection,Hierarchy,CameraControl,NodePath}Context.tsx
│           │   ├── components/{TscnPreviewShell,SceneTreeViewer,NodeDetailsPanel,ViewportSelector}/
│           │   └── hooks/useViewportSelection.tsx
│           └── resources/       # Async resource loading
│               ├── FileEventBus.ts        # request(path) -> loaded/failed
│               ├── ResourceEventBus.ts    # typed processor events
│               ├── ResourceLoader.ts      # Texture/Material/GLB/Scene
│               ├── useResource.ts         # React hook over the event bus
│               ├── ResourceLoaderContext.tsx
│               ├── meshes/                # Primitive mesh parsers
│               └── materials/standardmaterial3d/  # Material parser + renderer
└── apps/
    ├── textscene-vscode/         # VS Code extension (esbuild)
    ├── textscene-web/            # Web previewer (Vite)
    └── textscene-linter/         # CLI linter (Node)
```

## Key Concepts

### React-Three-Fiber Rendering

Rendering is owned by `<TscnCanvas>`, which mounts an R3F `<Canvas>`,
reads the active `SceneGraph` from `HierarchyContext`, and delegates
the node tree to `<NodeDispatcher>`. The dispatcher walks the scene
recursively: for each `TscnNode` it looks up the component in
`nodeComponentRegistry`, renders it with the node's pre-walked children,
and wraps the subtree in pointer handlers from `useViewportSelection`
plus a `<NodePathProvider>` so descendants can read their own TSCN path.

Each node type owns a folder under `packages/textscene-core/src/r3f/nodes/`
with a `Component.tsx` (the R3F render) and an `index.ts` that
self-registers the component with `nodeComponentRegistry`. Unknown
types render as `<GenericNodeFallback>` (a labeled placeholder cube).

### Two-Parser Architecture

Two parsers serve different use cases:

- **`packages/textscene-core/src/parser/TscnParser.ts`** — lenient
  parser used by the renderer. Recovers from errors, logs warnings,
  keeps rendering whatever it can.
- **`packages/textscene-core/src/linter/StrictTscnParser.ts`** — strict
  parser used by the CLI linter and the language-feature providers.
  Reports every syntax/format error with line/column information.

The lenient parser uses `NodeRegistry` to convert raw TSCN body
properties (snake_case strings) into the strongly-typed shape declared
by each node type's `parser.ts`. Each node-type's `index.ts` registers
its parser + property formatter on module load via side-effect
imports declared in `parser/TscnParser.ts`.

### Resource Loading

External resources (textures, materials, GLB meshes, packed scenes)
flow through a layered event-bus pipeline:

1. **`FileEventBus`** (app layer): hosts implement `ResourceProvider`
   and the bus turns `request(path)` into a `loaded`/`failed` event.
2. **`ResourceEventBus`** (core layer): typed `texture:loaded`,
   `material:loaded`, `glb:loaded`, `scene:loaded` events with their
   processed payloads.
3. **`ResourceLoader`**: coordinates per-type processors
   (`textures`, `materials`, `glbMeshes`, `sceneLoader`). The host
   calls `provideFile(path)` after the user uploads a previously-missing
   file, which clears the failed-cache and re-routes through the right
   processor.

`useResource(path, type)` is the only thing R3F components see. The hook
subscribes to the bus and returns `{ value, status, error? }` where
`status` is `'pending' | 'loaded' | 'missing' | 'error'`. Missing files
do NOT suspend the subtree; components branch on `status` and render
placeholders for missing resources. Object3D-typed values (`GLBMesh`)
are cloned per consumer per CLAUDE.md's three.js single-parent rule.

### Linter Bundle Isolation

The linter package stays React-free. `packages/textscene-core/src/
linter/index.ts` imports each node type's `linterValidators.ts` and
`linter.ts` directly, never the `r3f/` tree or `nodes/**/Component.tsx`.
This keeps the linter CLI bundle small.

### Self-Registration Patterns

Two parallel registries:

- `nodeRegistry` (`core/NodeRegistry.ts`): node-type parser + formatter.
  Used by `TscnParser` to convert TSCN body properties.
- `nodeComponentRegistry` (`r3f/NodeComponentRegistry.ts`): node-type
  React component. Used by `NodeDispatcher` to render the SceneGraph.

Each node type registers itself in both registries via side-effect
imports — `parser/TscnParser.ts` and `r3f/index.ts` import every node
type's `index.ts` / `nodes/index.ts` for the registration.

### Multi-Panel State Isolation

Each `<TscnPreviewShell>` instance creates its own `HierarchyContext`,
`SelectionContext`, and `CameraControlContext`. Two panels open in the
same VS Code window cannot corrupt each other's selection state because
the React context is scoped per shell. The `panelId` prop is the stable
key for log correlation and (future) multi-panel coordination.

### Camera Switching

`CameraControlContext` exposes `activeCameraPath` plus `switchToCamera`
/ `returnToFreeView` actions. The `<NodeDetailsPanel>` renders a "Use
This Camera" / "Reset Camera" button when the selected node is a
Camera3D. The `<TscnCanvas>` houses an `ActiveCameraSwitcher` that
swaps the R3F active camera via `useThree(state => state.set)` based on
the `userData.tscnPath` tag the Camera3D component writes to its
three.js camera.

### VS Code Editor Features

- `TscnDefinitionProvider`: Ctrl/Cmd-click on a `res://` path navigates
  to that resource file (text-layer feature, unaffected by R3F).
- `TscnDocumentSymbolProvider`: scene tree appears in the VS Code
  Outline panel.
- File watcher: when a `.tscn` file changes, the extension host posts
  a fresh `loadTscn` message to the webview, which re-parses and
  re-renders. The R3F canvas DOM node is preserved across content
  changes so OrbitControls camera state survives hot-reload.

### Dependency Versions (Phase 14)

Spike-validated stack:

- React 19.2, react-dom 19.2, @react-three/fiber 9.6, @react-three/drei 10.7
- @react-three/test-renderer 9.1, @testing-library/react 16.3
- three 0.184, @types/three 0.184
- Vitest 4.1, jsdom 29, @vitejs/plugin-react 5 (workspace is on Vite 6)
- TypeScript 6.0.3

### Bundle Size Target

The PRD acceptance for WI-R3F-6 was "VS Code webview bundle no larger
than `main + 200 KB gzipped`". Measured:

- `main` baseline:  1,429,646 B raw / 247,543 B gzipped
- `feat/r3f-migration` after WI-R3F-6:  3,691,702 B raw / 638,980 B gzipped
- Delta: +2.16 MB raw / **+382 KB gzipped** — **+182 KB over budget**.

The overshoot is intrinsic to the React + R3F + drei + full three.js
surface that the migration adds. esbuild bundles everything into one
IIFE entry for the VS Code webview; code-splitting drei or three would
require switching the webview build to ESM output, which Code's
webview shell does support but is invasive to land alongside this PR.
The cleanup work in this WI reclaimed ~362 KB raw / 61 KB gzipped from
the WI-R3F-5 peak; further reductions would need either:

1. **Subset three.js imports**: only pull in the constructors actually
   referenced, instead of the full namespace. Three is the largest
   contributor.
2. **Lazy-load the R3F panels**: split `<NodeDetailsPanel>` and
   `<SceneTreeViewer>` into separate chunks that load after the
   canvas. Modest impact since they're not the largest weight.
3. **Switch the webview to ESM build**: would let esbuild emit
   multiple chunks; combine with `await import(...)` in `<TscnCanvas>`
   to defer drei.

This is intentionally documented rather than fixed because each option
above is a follow-up WI in its own right and the user / team should
decide which trade-off matches the priority.

### Known limitations

**Web app: content-only hot-reload is not implemented.** When the user
edits a fixture's TSCN content out-of-band (e.g. via the dev server
filesystem watcher) the web app does not detect the change. The
workaround is to re-select the fixture from the dropdown, which
re-fetches and re-mounts the shell. The VS Code extension does NOT
share this limitation — there the editor's `onDidSaveTextDocument`
fires `loadTscn` and the React shell reconciles cleanly.

Fixing this on the web side would mean either:
1. Subscribing to the Vite HMR `import.meta.hot.on('update')` event
   when in dev mode, then re-fetching the active fixture, or
2. Polling the fixture URL with `ETag` / `Last-Modified` and
   re-fetching on change.

Neither is implemented; deferred to a follow-up WI. The current v1
flow expects users to edit fixtures via the VS Code extension where
hot-reload works.
