# Architecture

## Technology Stack

- TypeScript 6 (strict mode)
- pnpm workspaces with catalog dependency versions
- Vitest 4.1 (with `@react-three/test-renderer` and `@testing-library/react`)
- React 19 + react-three-fiber 9 + @react-three/drei
- three.js 0.184
- Vite 6 (web app) + esbuild (VS Code extension)

## Domain language & decisions

- **[CONTEXT.md](./CONTEXT.md)** — the shared glossary (Node, SceneGraph, vertical slice, viewport mode, Control overlay, collision gizmo, …). Use these terms exactly.
- **[docs/adr/](./docs/adr/)** — architecture decision records. The load-bearing ones: [0001 unified slice + React-free linter](./docs/adr/0001-unified-slice-react-free-linter.md), [0002 three registries](./docs/adr/0002-three-separate-registries.md), [0003 2D-UI DOM overlay](./docs/adr/0003-2d-ui-dom-overlay.md), [0004 CSG-as-primitive](./docs/adr/0004-csg-as-primitive.md), [0005 physics = transform-only](./docs/adr/0005-physics-bodies-transform-only.md), [0006 viewport-mode seam](./docs/adr/0006-viewport-mode-seam.md), [0007 ld-58 fixtures](./docs/adr/0007-ld58-fixture-assets.md).

## System Overview

### Render pipeline (lenient parser → R3F)

```mermaid
flowchart LR
  TSCN[".tscn text"] --> LP["Lenient parser<br/>TscnParser"]
  NR["NodeRegistry<br/>(parser + formatter)"] -. side-effect imports .-> LP
  LP --> SG["SceneGraph<br/>(TscnNode tree)"]
  SG --> HC["HierarchyContext"]
  HC --> ND["NodeDispatcher<br/>(recursive walk,<br/>pickable &lt;group&gt; per node)"]
  ND -->|lookup typeName| NCR["NodeComponentRegistry"]
  NCR --> COMP["node Component.tsx (R3F)"]
  NCR -. type absent .-> GNF["GenericNodeFallback"]
  COMP --> CANVAS["&lt;Canvas&gt; three.js"]
  COMP -->|useResource path,type| REB["Resource event bus"]
  REB --> RL["ResourceLoader (host adapter)"]
  RL --> FILES["textures · GLB · PackedScene"]
```

### Linter pipeline (strict parser, React/THREE-free bundle)

```mermaid
flowchart LR
  TSCN2[".tscn text"] --> SP["Strict parser<br/>StrictTscnParser"]
  SP --> P1["Phase 1<br/>ParseError[]"]
  subgraph free["linter bundle — never imports React/THREE"]
    SP
    RR["ruleRegistry"]
    VR["validatorRegistry"]
  end
  RR --> P2["Phase 2<br/>Diagnostic[]"]
  VR --> P2
  P1 --> OUT["diagnostics"]
  P2 --> OUT
```

The render and linter pipelines are **separately bundleable** because the parse, lint, and render domains use three distinct registries keyed by the same `typeName` (see [ADR-0002](./docs/adr/0002-three-separate-registries.md)). The linter never transitively imports a `Component.tsx` (see [ADR-0001](./docs/adr/0001-unified-slice-react-free-linter.md)).

## Project Structure

```
/
├── packages/
│   └── textscene-core/          # Core library: parser, linter, R3F components
│       └── src/
│           ├── parser/          # Lenient TSCN parser used for rendering
│           ├── linter/          # Strict parser + lint rule registry
│           ├── nodes/           # UNIFIED vertical slices — one folder per node type,
│           │   │                #   each holding parser + linter + formatter + Component
│           │   │                #   + 3 entry points (index.ts / index.linter.ts / index.r3f.ts)
│           │   ├── node/
│           │   ├── base/node3d/
│           │   ├── 3d/
│           │   │   ├── meshinstance3d/      # parser.ts, linter.ts, Component.tsx, index{,.linter,.r3f}.ts
│           │   │   ├── camera3d/
│           │   │   ├── lights/{directional,omni,spot}light3d/  (+ lightHelpers, lightShared)
│           │   │   ├── worldenvironment/
│           │   │   └── label3d/
│           │   ├── audio/audiostreamplayer3d/
│           │   ├── animation/{animationplayer,animationtree}/
│           │   └── physics/3d/{staticbody3d,area3d,collisionshape3d,...}/  # parser+linter (render WIP)
│           ├── core/            # SceneGraph + immutable resolution helpers
│           │   ├── NodeRegistry.ts        # Parser + formatter registry
│           │   ├── SceneGraph.ts          # Immutable resolved scene
│           │   ├── SceneGraphBuilder.ts   # Builder for SceneGraph
│           │   └── nodeDependsOnPath.ts   # Dependency-walk predicate
│           ├── r3f/             # react-three-fiber UI surface (render infrastructure)
│           │   ├── TscnCanvas.tsx         # <Canvas> + NodeDispatcher
│           │   ├── NodeDispatcher.tsx     # SceneGraph -> React tree
│           │   ├── NodeComponentRegistry.ts
│           │   ├── nodeTransform.ts        # Node3D properties -> THREE transform
│           │   ├── nodes/index.ts          # barrel: imports every slice's index.r3f
│           │   ├── internal/{generic-node-fallback,glb-scene-root}/  # synthetic render-only types
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

Each node type owns one unified vertical slice under
`packages/textscene-core/src/nodes/<category>/<type>/` containing its
`parser.ts`, `linterParser.ts`, `linter.ts`, `propertyFormatter.ts`,
`types.ts`, `Component.tsx`, co-located tests, and three registration
entry points: `index.ts` (parser/formatter → `NodeRegistry`),
`index.linter.ts` (validators + rules → linter registries), and
`index.r3f.ts` (render component → `nodeComponentRegistry`). The
`r3f/nodes/index.ts` barrel imports each slice's `index.r3f` for its
side effect. Unknown types render as `<GenericNodeFallback>` (a labeled
placeholder cube) from `r3f/internal/`. See [ADR-0001](./docs/adr/0001-unified-slice-react-free-linter.md).

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

External resources (textures, materials, GLB meshes, packed scenes) flow through
a **two-bus, event-driven pipeline** — *not* promises/Suspense at the component
boundary. `request(path)` is fire-and-forget (returns `void`); a component learns
a resource loaded by **receiving an event**, not by awaiting a promise. (Promises
do the async I/O underneath — see the note below.)

**The layers, host → component:**

1. **`ResourceProvider`** (app layer): the host's file access —
   `WebResourceProvider` (HTTP `fetch`) or `VSCodeResourceProvider` (the
   extension's `res://` bridge, CSP-honoring). `loadResource(path)` returns
   `string | ArrayBuffer | null` (async).
2. **`FileEventBus`** — type-agnostic raw bytes: `request(path) →`
   `loaded(path, bytes) | failed(path, err)`. Calls the provider, caches bytes,
   dedupes in-flight requests.
3. **Per-type processors** (`createResourceProcessor`): one
   cache + in-flight + emit machine per type. On raw bytes it runs `process()`
   (async), caches the result (**failures cached as `null`** so they don't
   retry), and emits on the…
4. **`ResourceEventBus`** (core layer): typed events namespaced
   `texture|material|glb|scene` × `requested|loading|loaded|failed`, carrying the
   processed payload. Scenes load "directly" (the parser needs path + content
   together) but emit the same events.
5. **`ResourceLoader`**: owns the `MetadataStore` + the four processors
   (`textures`, `materials`, `glbMeshes`, `scenes` — WI-ARCH-2 collapsed the old
   standalone `SceneLoader` into a `createSceneProcessor`). `register()` records
   `ExtResource` id↔path; `provideFile(path)` drives the late-arrival flow below.
6. **`useResource(path, type)`** — the only thing R3F components see. It **never
   suspends**; it returns `{ value, status, error? }` with
   `status ∈ 'pending' | 'loaded' | 'missing' | 'error'`. On mount it does a
   synchronous cache check, then **subscribes** to the bus and fires `request()`
   *after* subscribing (so a synchronous cache-hit emit isn't missed). Object3D
   values (`GLBMesh`) are cloned per consumer (three.js single-parent rule,
   CLAUDE.md). Components branch on `status` and render placeholders for missing
   resources — the subtree never suspends.

**Late arrival — why it's events, not a one-shot promise.** When a load fails the
hook flips to `missing` and reports the path to `MissingResourcesContext`, which
lists it in the Inspector's **Resources** tab. **The hook keeps its subscription
while `missing`.** When the user supplies the file the host calls
`provider.addUploadedFile(path, file)` + **`loader.provideFile(path)`**, which
clears the file/processor caches for that path and **re-requests** it. The fresh
bytes → `process()` → a new `loaded` event → the still-subscribed hook flips
`missing → loaded` and the component re-renders **with no remount**. A promise
resolves once; a live subscription lets a node that was missing for minutes wake
up the instant its file appears.

**Where promises live (supporting role only):** the actual fetch/parse is async
(`loadResource`, `process()`, the scene `loadDirectly`); `finishLoad` awaits them
then emits. One deliberate event→promise *adapter*: when a material needs an
inline texture, `ResourceLoader` does `await eventBus.once('texture','loaded',id)`
— a linear `await` over a single event. The component contract stays a pure
`(status, value)` reacting to events.

```mermaid
flowchart TD
  COMP["R3F node component"] -->|"useResource(path, type)"| HOOK["useResource()<br/>status: pending·loaded·missing·error<br/>(never suspends)"]
  HOOK -->|"request(path) — void, fire-and-forget"| PROC["per-type Processor<br/>cache + in-flight dedupe<br/>failures cached as null"]
  HOOK -->|"subscribe loaded/failed<br/>(kept even while 'missing')"| REB[["ResourceEventBus<br/>type × requested·loading·loaded·failed"]]
  PROC -->|"request bytes"| FEB[["FileEventBus<br/>request → loaded·failed"]]
  FEB -->|"loadResource(path) ⟨async⟩"| PROV["ResourceProvider<br/>Web: fetch · VS Code: ext bridge"]
  PROV -->|"bytes | null"| FEB
  FEB -->|"loaded(path, bytes)"| PROC
  PROC -->|"process() ⟨async⟩ → emit"| REB
  REB -->|"loaded / failed event"| HOOK
  HOOK -->|"setState → re-render"| COMP

  HOOK -. "status = missing → report(path)" .-> MRC["MissingResourcesContext<br/>Inspector ▸ Resources tab"]
  MRC -. "user supplies file" .-> UP["provider.addUploadedFile()<br/>loader.provideFile(path)"]
  UP == "clear caches + re-request" ==> PROC
```

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
than `main + 200 KB gzipped`". History:

- `main` baseline: 1,429,646 B raw / **247,543 B gzipped**
- WI-R3F-6 (iife, no code-splitting): 3,691,702 B raw / **638,980 B gzipped** — +382 KB gz, **+182 KB over budget**
- **WI-R3F-18 (ESM + splitting + React.lazy panels)**: initial-paint static-import closure is **1,357,273 B raw / 390,322 B gzipped** — **+143 KB gz vs main**, **57 KB under the +200 KB budget** ✅

WI-R3F-18 closed the gap with three combined changes:

1. **Webview build flipped from `iife` to `esm` + `splitting`**
   (`apps/textscene-vscode/esbuild.config.mjs`). iife couldn't
   code-split — every transitive import landed in one bundle. ESM
   with splitting emits `dist/webview/webview.js` (entry) plus
   `dist/webview/chunks/*.js` (shared + lazy chunks).
2. **DOM panels lazy-loaded via `React.lazy` + `<Suspense>`**
   (`packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx`).
   `<SceneTreeViewer>` and `<NodeDetailsPanel>` are no longer in the
   initial static-import closure; they load on demand with a
   `Loading tree…` / `Loading details…` fallback while resolving.
3. **CSP + html template updated for ESM** — `<script type="module">`
   and `script-src ${cspSource}` (in addition to the nonce'd entry)
   so the webview can fetch chunk URIs.

The initial chunk now contains: React, react-three-fiber, drei
runtime, three.js, the scene canvas (`<TscnCanvas>`), the node
component registry (registers all node types on import), the
resource pipeline, contexts, and selection. The lazy chunks
contain: the tree viewer, the details panel, and the CSS modules
they own.

**Bundle-size guard.** `scripts/check-bundle-size.mjs` walks the
static-import closure starting at `webview.js`, gzips the
concatenation, and compares against `main + 200 KB`. Wired into
`pnpm validate` and runs informationally (warn-only) for now. Once
follow-up WIs land without regressing the figure, flip to
`--enforce` for hard-fail in CI.

**Status of the budget gate.** As of this commit, the build PASSes
with 55.9 KB headroom under the budget. The recommendation for
PR-merge readiness: the gate is already structurally enforceable.
The reason to keep it warn-only until at least one follow-up WI
lands is that the headroom is thin (~14% of the budget) and any
of these would push back over: a drei addition (e.g. effects
postprocessing), a new top-level component import in
`<TscnCanvas>`, or a node type that pulls in a new dependency at
the registry-load step. Flipping to `--enforce` should happen after
WI-R3F-16 (audio/animation) lands and the budget is re-verified.

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

## Planned Evolution — full ld-58 support

This section is **forward-looking** and is updated phase-by-phase as the work lands. Goal: render all 44 scenes of the ld-58 Godot project in both apps. See [CONTEXT.md](./CONTEXT.md) and [docs/adr/](./docs/adr/).

### Unified vertical slice (P1 — [ADR-0001](./docs/adr/0001-unified-slice-react-free-linter.md))

Each Node type collapses from the current **split slice** (parser/linter in `nodes/`, component in `r3f/nodes/`) into one folder with three registration entry points — one per registry domain — so the linter stays React/THREE-free by construction:

```mermaid
flowchart TB
  subgraph slice["nodes/&lt;category&gt;/&lt;type&gt;/ — one folder per Node type"]
    parser["parser.ts"]
    lintp["linterParser.ts"]
    lint["linter.ts"]
    fmt["propertyFormatter.ts"]
    comp["Component.tsx"]
    idx["index.ts"]
    idxl["index.linter.ts"]
    idxr["index.r3f.ts"]
  end
  idx -->|"parser + formatter (never imports Component)"| parser
  idxl -->|".ts only"| lint
  idxr -->|"the only importer of ./Component"| comp
  B1["parser/TscnParser.ts"] --> idx --> NR2["NodeRegistry"]
  B2["linter/index.ts"] --> idxl --> RR2["rule / validator registries"]
  B3["r3f/nodes/index.ts"] --> idxr --> NCR2["NodeComponentRegistry"]
```

A module-graph guard test (over both `linter/index.ts` and `parser/TscnParser.ts`) plus an ESLint `no-restricted-imports` rule turn the React-free invariant from discipline into a red/green signal. Synthetic render-only types (`GenericNodeFallback`, `GLBSceneRoot`) move to `r3f/internal/` — they are not Node types.

### Viewport mode + app chrome (P3/P4/P6 — [ADR-0003](./docs/adr/0003-2d-ui-dom-overlay.md), [ADR-0006](./docs/adr/0006-viewport-mode-seam.md), [ADR-0007](./docs/adr/0007-adopt-split-dock-shell.md))

**Status:** the 2D-UI Control set, the viewport toggle, and the **Split Dock** chrome (which replaced the 3-column DCC layout — ADR-0007) are all **shipped**.

- **P3 — Control set (done).** All 15 Control types ld-58 uses are registered DOM components: `Control`, `ColorRect`, `Label`, `VBoxContainer`, `HBoxContainer`, `GridContainer`, `CenterContainer`, `MarginContainer`, `ScrollContainer`, `Panel`, `PanelContainer`, `Button`, `TextureRect`, `RichTextLabel`, and the passthrough `CanvasLayer`. Each is a unified slice whose `index.r3f.ts` registers into `ControlComponentRegistry`; `ControlDispatcher` walks the subtree and `controlLayoutStyle` + `styleBoxToCss` + `resolveStyleBoxCss` map Godot layout/theme to CSS. `TextureRect` loads images host-agnostically via `useResource` (type-only `THREE` import — no runtime three in the slice).
- **P4 — viewport toggle (done).** `TscnPreviewShell` is wrapped in `<ViewportModeProvider>`; a shared `<ViewportToolbar>` (3D/2D switch + Collisions checkbox) writes through `useViewportMode()`, and `<ViewportArea>` renders `TscnCanvas` (3D) or the lazy-loaded `ControlOverlay` (2D, fed the root scene's nodes + resources). The overlay is a separate lazy chunk, so the 15 components stay out of the initial canvas-paint bundle.
- **P5 — 3-column DCC chrome (superseded by P6).** The first chrome was a full-width top bar over three columns: a left **Scene** dock (SceneInfoCard + tree), the center viewport, and a right **Inspector** dock. Resizable + collapsible docks, stacked vertically under 768px. Replaced by the Split Dock (P6).
- **P6 — Split Dock chrome (done, [ADR-0007](./docs/adr/0007-adopt-split-dock-shell.md)).** A prototype exploration (5 fresh-eyes designs → A+B hybrids → "Split Dock") landed the user-chosen layout: a slim top bar (file/brand + host toolbar + scene-stat chips + `ViewportToolbar`) over **two** columns — a large center viewport and a single right dock. **No left rail** (a VS Code webview sits right of VS Code's own activity bar + Explorer, so a left rail clashes + wastes width). The dock is a vertical **master-detail**: `SceneTreeViewer` on top over a tabbed detail (**Inspector / Resources / Cameras**) — selecting a node updates the inspector with no tab hop; the on-pane tab strip switches only the lower section; the Cameras tab lists `Camera3D` nodes with a one-click "use". `SceneInfoCard` is gone (node count moved to the top bar + tree header). Resizable width (`<Splitter>`) + a draggable master/detail handle; collapsible to a full-width viewport; stacks under 768px. In 2D mode the viewport becomes a framed pan/zoom `Canvas2DStage` wrapping the live `ControlOverlay`. The web app's scene picker is a command-palette `SceneSwitcher` ("Open .tscn" primary; the built-in fixtures it lists are dev-only scaffolding). Restyled via the shared `--tsi-*` tokens (VS Code-theme-aware).

A single `ViewportModeContext` chooses between the 3D canvas and the 2D Control overlay (a sibling DOM layer, never inside `<Canvas>`), and drives the collision gizmo. The Split Dock shell is shared by both apps:

```mermaid
flowchart TB
  VM["ViewportModeContext<br/>{ mode: 2D|3D, showCollisions }"]
  subgraph shell["TscnPreviewShell — Split Dock (ADR-0007)"]
    TOP["top bar<br/>file · scene stats · camera · 3D/2D"]
    CENTER["center<br/>viewport region"]
    subgraph DOCK["right dock — master-detail (no left rail)"]
      TREE["SceneTreeViewer (master)"]
      DETAIL["tabs: Inspector · Resources · Cameras"]
    end
  end
  TREE --> DETAIL
  VM -->|mode = 3D| TC["TscnCanvas → NodeDispatcher → R3F"]
  VM -->|mode = 2D| CO["Canvas2DStage → ControlOverlay → &lt;div&gt; tree<br/>(framed 1152×648, zoom/pan)"]
  TC -. showCollisions .-> GZ["Collision gizmo<br/>(wireframe per collision-shape resource)"]
  CENTER --- TC
  CENTER --- CO
```

The 2D overlay maps `layout_mode = 2` (container-managed, the majority case) to CSS flex/grid, the LayoutPreset 0..15 table to absolute positioning, and StyleBox resources to CSS; system fonts only, images via the host file provider (`useResource`, so VS Code webview CSP is honored). Per-app mode persistence behind a `usePersistedMode()` hook (`localStorage` web / webview state API) is **deferred** — the switch is per-session today.

### Scope (P2 — [ADR-0004](./docs/adr/0004-csg-as-primitive.md), [ADR-0005](./docs/adr/0005-physics-bodies-transform-only.md))

Scoped to exactly the types ld-58 uses: CSGBox3D/CSGCylinder3D (base primitive, all union), StaticBody3D/Area3D (transform-only groups), CollisionShape3D + BoxShape3D/ConvexPolygonShape3D/ConcavePolygonShape3D (toggleable wireframe gizmos), plain AudioStreamPlayer (zero-geometry node), and a ShaderMaterial→translucent-standard-material fallback.

### Tracked deepening candidates (not yet scheduled)

- **Lenient parser depends on `three` via transform decomposition.** `nodes/node/parser.ts` → `utils/transform.ts` uses `THREE.Matrix4`/`Euler` to decompose a Transform3D at parse time. Acceptable today (the parser ships only alongside the renderer; the linter uses its own three-free strict parser), but moving decomposition to render time would make the lenient parser pure-data. The `reactFree.test.ts` guard documents and deliberately permits this edge while forbidding react/react-three in the parser and any `.tsx`/three in the linter.
