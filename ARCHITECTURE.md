# Architecture

## Technology Stack

- TypeScript 6 (strict mode)
- pnpm workspaces with catalog dependency versions
- Vitest 4.1 (with `@react-three/test-renderer` and `@testing-library/react`)
- React 19 + react-three-fiber 9 + @react-three/drei
- three.js 0.184
- Vite 6 (web app) + esbuild (VS Code extension)

## Domain language & decisions

- **[CONTEXT.md](./CONTEXT.md)** — the shared glossary (Node, SceneGraph, vertical slice, viewport mode, Control rect solve, collision gizmo, …). Use these terms exactly.
- **[docs/adr/](./docs/adr/)** — architecture decision records, one per load-bearing decision, sequentially numbered with self-describing filenames (the directory is the source of truth — read it rather than a list mirrored here). Start with [0001 unified slice + React-free linter](./docs/adr/0001-unified-slice-react-free-linter.md) and [0002 three registries](./docs/adr/0002-three-separate-registries.md), which fix the overall shape; the rest record feature-level decisions (viewport-mode seam, render intent, animation drivers, instance-root merge, …).

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
│           │   ├── base/{node2d,node3d}/
│           │   ├── 2d/
│           │   │   ├── ui/                  # 23 Control slices (control, label, button, containers, ...) — native canvas painters (ADR-0037)
│           │   │   ├── tiles/{tilemap,tilemaplayer}/    # + shared/ — TileSet/atlas decoding
│           │   │   ├── cpuparticles2d/      # frozen pose at `preprocess` — no clock (ADR-0008)
│           │   │   └── {sprite2d,camera2d,animatedsprite2d,polygon2d,line2d,
│           │   │        marker2d,path2d,pathfollow2d,navigationregion2d,
│           │   │        pointlight2d,lightoccluder2d,canvasmodulate,
│           │   │        remotetransform2d}/
│           │   ├── 3d/
│           │   │   ├── meshinstance3d/      # parser.ts, linter.ts, Component.tsx, index{,.linter,.r3f}.ts
│           │   │   ├── camera3d/
│           │   │   ├── csg/{csgbox3d,csgcylinder3d,csgsphere3d,     # real booleans (ADR-0027)
│           │   │   │        csgtorus3d,csgmesh3d,csgpolygon3d,
│           │   │   │        csgcombiner3d}/
│           │   │   ├── lights/{directional,omni,spot,area}light3d/  (+ shared/ — parser, formatter, lint checks, lightShared/lightHelpers render code)
│           │   │   ├── {sprite3d,skeleton3d,particles/gpuparticles3d,marker3d,
│           │   │   │     gridmap,navigationregion3d,decal}/
│           │   │   ├── worldenvironment/
│           │   │   └── label3d/
│           │   ├── audio/audiostreamplayer{,2d,3d}/
│           │   ├── animation/{animationplayer,animationtree}/
│           │   ├── paths/{path3d,pathfollow3d}/
│           │   ├── physics/2d/{staticbody2d,rigidbody2d,characterbody2d,area2d,collisionshape2d}/
│           │   └── physics/3d/{staticbody3d,area3d,collisionshape3d,...}/  # transform-only render + collision gizmo (ADR-0005/0008)
│           ├── core/            # SceneGraph + immutable resolution helpers
│           │   ├── NodeRegistry.ts        # Parser + formatter registry
│           │   ├── SceneGraph.ts          # Immutable resolved scene + buildSceneGraph()
│           │   └── createTypeRegistry.ts  # Shared Map-backed registry factory (ADR-0002)
│           ├── r3f/             # react-three-fiber UI surface (render infrastructure)
│           │   ├── TscnCanvas.tsx         # <Canvas> + NodeDispatcher
│           │   ├── NodeDispatcher.tsx     # SceneGraph -> React tree
│           │   ├── NodeComponentRegistry.ts
│           │   ├── nodeTransform.ts        # Node3D properties -> THREE transform
│           │   ├── nodes/index.ts          # barrel: imports every slice's index.r3f
│           │   ├── internal/{generic-node-fallback,glb-scene-root}/  # synthetic render-only types
│           │   ├── contexts/{Selection,Hierarchy,CameraControl,NodePath}Context.tsx,
│           │   │             {AnimationTransport,AnimationDriver,AnimatedValue}Context.tsx
│           │   ├── controls/               # Native 2D-UI Control canvas (ADR-0037, supersedes ADR-0003):
│           │   │                           #   ControlComponentRegistry, native/ControlCanvasWalker,
│           │   │                           #   native/ControlCanvasLayer, native/controlRectSolver
│           │   │                           #   (rect solve), native/text/ (vendored MSDF atlas + layout)
│           │   ├── lighting2d/             # Godot's canvas light pass (see below):
│           │   │                           #   CanvasLighting2D (accumulator + pre-pass),
│           │   │                           #   lightQuad (producer), canvasItemLighting (consumer)
│           │   ├── components/{TscnPreviewShell,Canvas2DStage,
│           │   │               SceneTreeViewer,NodeDetailsPanel,ViewportSelector,...}/
│           │   │   # TscnPreviewShell is a thin composition root; ViewportArea,
│           │   │   # CamerasPanel, and DockChrome are files inside TscnPreviewShell/;
│           │   │   # the 2D stage and viewport switch are sibling focused units
│           │   └── hooks/{useViewportSelection.tsx,useParsedScene.ts}
│           └── resources/       # Async resource loading + RESOURCE SLICES (ADR-0031):
│               │                #   one folder per resource type — index.ts (registration,
│               │                #   THREE-free) · decode.ts (pure bag → Data) · build.ts
│               │                #   (Data + deps → THREE, only where THREE construction
│               │                #   exists) · types.ts · co-located tests. Foreign formats
│               │                #   (formats/{glb,image,packedscene}) declare their real
│               │                #   parser instead of a decode/build split. Routing derives
│               │                #   from sliceRegistrations.ts + sliceRegistration.ts;
│               │                #   guards: resourceSlice{Conformance,Isolation}.test.ts
│               ├── FileEventBus.ts        # request(path) -> loaded/failed
│               ├── ResourceEventBus.ts    # typed processor events
│               ├── ResourceLoader.ts      # Texture/Material/GLB/Scene
│               ├── useResource.ts         # React hook over the event bus
│               ├── ResourceLoaderContext.tsx
│               ├── meshes/                # Primitive mesh parsers
│               ├── curve/                 # Godot's 1D Curve — cubic Bezier sample()
│               └── materials/standardmaterial3d/  # Material parser + renderer
└── apps/
    ├── textscene-vscode/         # VS Code extension (esbuild)
    ├── textscene-web/            # Web previewer (Vite) — owns the Source pane (ADR-0020)
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
placeholder cube) from `r3f/internal/`. Not every slice carries every
file: `propertyFormatter.ts` is present only for types with non-default
Inspector formatting, and linter entry points exist only for types with
validators/rules (most 2D UI slices carry no validators/rules beyond
`Control`'s own base-type chain, so they have no `index.linter.ts`).
Registration granularity also varies deliberately: the five 2D physics bodies share
one loop-based registration (`nodes/physics/2d/`) because they are
five identical transform-only slices, while the 3D physics types keep
per-type folders because each carries real per-type lint rules. See
[ADR-0001](./docs/adr/0001-unified-slice-react-free-linter.md).

### Two-Parser Architecture

Two parsers serve different use cases, but they share ONE scanning loop:
`packages/textscene-core/src/parser/TscnParserCore.ts`. The core loop
takes an optional `ParseObserver` (`onError` / `onSectionStart` /
`onProperty` hooks) — strict behavior is an observer adapter, lenient
behavior is the bare loop:

- **`packages/textscene-core/src/parser/TscnParser.ts`** — lenient
  parser used by the renderer. Runs the core loop with NO observer:
  recovers from errors, logs warnings, keeps rendering whatever it can.
- **`packages/textscene-core/src/linter/StrictTscnParser.ts`** — strict
  parser used by the CLI linter and the language-feature providers. A
  thin adapter that runs the SAME core loop with an observer that
  collects every syntax/format error (with line/column information),
  performs strict heading checks (missing node name/identifier), and
  runs `validatorRegistry` property validators.

The observer is purely additive — it never changes what the lenient
loop parses or recovers, so renderer behavior is identical with or
without it. `TscnParserCore` stays three.js-free, preserving the
React-free linter boundary (ADR-0001).

The lenient parser uses `NodeRegistry` to convert raw TSCN body
properties (snake_case strings) into the strongly-typed shape declared
by each node type's `parser.ts`. Each node-type's `index.ts` registers
its parser + property formatter on module load via side-effect
imports declared in `parser/TscnParser.ts`.

### Godot → three.js orientation conversions

Godot and three.js disagree on three axis conventions. Each is converted at the
boundary where Godot data becomes a three.js object — never in the parsers or
decoders, which stay faithful readers of what the file says:

- **Texture V.** Godot's UV origin is the image's **top**-left. Textures load
  with three's default `flipY=true` (only the alpha-border replacement below
  sets it, and only by carrying the decoded texture's own value forward), which
  uploads the image bottom-up, so a Godot V must be mirrored: `v → 1 - v`.
  Textures are shared **by identity** between 2D and 3D consumers, so this is
  converted per consumer, never by flipping the texture:
  `resources/meshes/arraymesh/build.ts` (mesh UV attribute),
  `resources/tileset/tileGeometry.ts` (`pxRectToUv`) and `r3f/spriteFrame.ts`
  (region/frame windowing via texture offset+repeat). The shapes differ enough
  that the shared part is only the `1 -`; there is deliberately no helper.
  The material UV transform (`uv1_scale`/`uv1_offset`) does **not** convert —
  see the `uv1 V-anchoring` note in the StandardMaterial3D comparison sheet
  ([packages/textscene-core/src/resources/materials/standardmaterial3d/comparison.md](./packages/textscene-core/src/resources/materials/standardmaterial3d/comparison.md)).
- **Triangle winding.** Godot fronts triangles clockwise, three.js expects
  counter-clockwise — every decoded index triple is reversed (`meshes/arraymesh/build.ts`).
  Without it, flat meshes vanish and closed meshes render inside-out.
- **2D Y.** Godot's 2D Y grows downward; the Y negation lives in
  `r3f/node2dTransform.ts`.

A regression here is invisible to most fixtures — an untextured mesh, or a
vertically symmetric texture, cannot show a V error at all. `unit-arraymesh-uv.tscn`
exists to pin it: a four-band atlas whose green band must read at the TOP.

### The 2D canvas light pass

`r3f/lighting2d/` ports `drivers/gles3/shaders/canvas.glsl`. A Godot 2D light
paints nothing on the canvas: it is multiplied into every lit CanvasItem
beneath it. The shader captures each item's albedo BEFORE the canvas tint and
folds it into every light term, which collapses the whole pass to

    color.rgb = albedo × S

where `S` starts at the CanvasModulate and each light applies one blend to it
(`+= light·a` for ADD, `-= light·a` for SUB, `mix(S, light, a)` for MIX). `S`
depends on the item only through WHICH LIGHTS REACH IT, so it is accumulated
once per distinct light set, and the three modules split along that seam:

- **`CanvasLighting2D`** owns the accumulators and the pre-pass. Lights live on
  camera layers, so collecting them needs no second scene graph: each pass just
  points the camera at one layer. `S` is seeded by a full-NDC quad rather than a
  clear colour, keeping the seed out of any colour-management path and leaving
  the renderer's global clear state untouched.
- **`lightQuad`** is the producer: one PointLight2D's cookie, emitting the light
  term in rgb and the cookie coverage in alpha, with one fixed-function blend per
  `Light2D.BlendMode`.
- **`canvasItemLighting`** is the consumer: an `onBeforeCompile` injection that
  makes an ordinary `meshBasicMaterial` read the accumulator.

Three properties are load-bearing and easy to undo by accident:

- **The accumulator is half-float and unclamped.** Godot clamps only after the
  light is multiplied into the albedo. A light blended straight onto the canvas
  is clamped to [0, 1] BEFORE that multiply, which flattens any `energy > 1`
  light into a saturated disc with no falloff.
- **The light path compiles unconditionally**, gated by the
  `uLightClassWeight` uniform rather than by whether the scene has lights. A
  light registers only once its cookie resolves, which is always after the items
  around it have compiled, and R3F never bumps `material.needsUpdate` when
  `onBeforeCompile` changes, so an item compiled without the path would never
  get it. Godot's own shader is shaped the same way: zero lights is data, not a
  different program.
- **The buffer is read in DEVICE pixels** (`gl.getDrawingBufferSize`), because
  the lookup is `gl_FragCoord / resolution`. Sizing from the CSS size is correct
  only at `devicePixelRatio` 1, which is exactly what the capture harness uses —
  so the goldens cannot see that mistake.

Two things make an item read a DIFFERENT accumulation, and both are one more
target and one more seeded pass over the same quads:

- `light_mode = Light Only` skips the canvas tint, so it needs the same lights
  over an unmodulated seed. Allocated only when such an item exists.
- **The cull tuple.** Godot applies a light to an item only when the item's
  `light_mask` shares a bit with the light's `range_item_cull_mask`, the item's
  accumulated `z_final` is inside `range_z_min..max`, and the item's CANVAS layer
  is inside `range_layer_min..max` (`lightCullKey`). Those five light-side values
  are the whole test, so lights that agree on all five are indistinguishable to
  every item and the lights partition into CLASSES by that TUPLE: one
  accumulation per class, on its own camera layer, with the seed quad on a layer
  of its own that every pass enables. The partition can be no finer, because the
  buffer is a screen-space sum no fragment can subtract one light back out of;
  and it is no coarser in practice, because every light that leaves the range
  windows at their Godot defaults carries the same tail. An item reads the
  classes it is not culled from, summed over one shared seed: exact for a single
  class (the ordinary canvas) and for any number of ADD/SUB classes. The
  item-side lookup unrolls one sampler per class because GLSL ES 1.00 (what
  three compiles an `onBeforeCompile` injection as) cannot index a sampler by a
  runtime value, which also caps the count (`MAX_LIGHT_CLASSES`) and is why the
  cull test itself runs on the CPU: that GLSL has no bitwise operators at all.
  The item's two non-mask operands are threaded down the tree by
  `canvasItemPlacement` — `z_index` accumulates through `CanvasItem2D`, and a
  `CanvasLayer` publishes its own `layer` (Godot default 1) to its subtree, which
  is why an untouched light lights the world canvas and never a HUD.

Parity is measured, not derived: `pnpm ref:godot <scene> --probe x,y` prints the
engine's exact pixels, and the `unit-pointlight2d*` comparison sheets carry the
resulting numbers.

### The native Control canvas (2D UI)

`r3f/controls/native/` renders Godot `Control`/`CanvasLayer` subtrees as ordinary
three.js objects inside the same `World2DCanvas` the 2D world draws into
([ADR-0037](./docs/adr/0037-control-nodes-render-natively-in-the-canvas.md),
superseding ADR-0003's DOM overlay) — no `<div>`, no CSS, no second rendering
technology.

**The Control rect solve** (`controlRectSolver.ts`) replaces the browser's layout
engine with a pure-TS port of Godot 4.6.3's own two phases: bottom-up
`get_combined_minimum_size` (a widget's minimum, `custom_minimum_size`-floored,
merged upward through nested containers), then top-down `fit_child_in_rect` (a
free/anchored Control resolves against its parent's rect — the viewport for a
root — a container child through that parent's registered `ContainerLayoutFn` in
`controlSolverRegistry`). `ControlCanvasWalker` runs the solve once per
generation over `buildSolveTree`'s live-tree walk, then emits one `<group>` per
Control at its solved rect; a registered `Native` painter draws that node's own
chrome, `ControlFallback` an outline when none is registered.

**Draw order is ONE integer per canvas item, shared by every 2D node**
(`canvasPaintOrder.ts`). Godot draws a canvas in a single pre-order walk that
appends each item to a list indexed by its `z_final`, then draws those lists in
z order (`renderer_canvas_cull.cpp`), so the key is `(canvas layer, z_final,
position in the walk)` — and the item's node TYPE is in none of it. A `Control`
and a `Sprite2D` interleave purely by that key; "UI draws over the world" is a
convention of how scenes are authored, not a rule of the renderer.

That key is packed into `THREE.Object3D.renderOrder` on each canvas item's
wrapper group. Every 2D material here is `transparent` + `depthWrite={false}`,
so three's transparent sort decides paint order outright, and it compares
`groupOrder` — the nearest enclosing group's `renderOrder` — before anything
else. The meshes INSIDE an item keep their own small `renderOrder` for the
item's private layering (an atlas batch's source index, a ScrollContainer's
bars). Two ordinal levels, which is exactly what the two rules need. A group
that sits between an item and its pixels must therefore carry the item's key
too, or it resets those pixels to the front of the canvas.

Draw sequence is handed out as contiguous RANGES: a node owns
`[base, base + size)` and its descendants are allocated inside it, which is what
lets the y-sort pass re-order the items it collected by re-packing its own range
alone. `buildSolveTree` allocates the same ranges over the same live tree for
Controls, so the two walks agree without talking to each other.

This replaced a fractional `+Z` scheme (`z_index × 0.1`, with y-sort ranks and
tile sub-steps dividing what was left of each step). That scheme could only
approximate the order — the budget shrank with every level of nesting, so the
machinery rationing it grew alongside, and the plain un-y-sorted case had no
draw sequence at all, falling back to `Object3D.id` mount order. That is why a
Control mounted in its own pass could never interleave with the world.

**Clipping is clip planes, not the stencil buffer** (`controlClipping.tsx`). The
on-screen 2D `<Canvas>` requests no stencil buffer at all (`World2DCanvas.tsx`'s
`gl` props never ask for one, and three defaults it off), so a stencil-based clip
would be a silent no-op everywhere — a spike measured 81/81 boundary samples
exact across 4 nesting levels using planes instead. `ScrollContainer` builds its
own subtree's 4 axis-aligned planes from its full rect, transforms them into
world space via its own group's `matrixWorld`, and merges them onto whatever it
inherited; every leaf material (`controlQuad.tsx`, `StyleBoxQuad.tsx`) spreads
the accumulated list, since three's clip planes are per-material state.

**Text is a vendored MSDF atlas plus this engine's own layout** (`native/text/`),
not troika-three-text (already in the dependency tree via drei's lazy `<Text>`).
A spike found troika impossible under the VS Code webview's CSP twice over:
`worker-src` blocks its blob-URL SDF worker, and `connect-src` blocks its font
*fetch* — for `data:` and `blob:` alike, so inlining the font bytes cannot help
either. Godot's own default-theme font (`OpenSans_SemiBold.woff2`) is vendored
and baked at build time into a PNG atlas + glyph table
(`scripts/fonts/bake-metrics.mjs`, `--check` mode so the artifacts cannot drift
from the font); line pitch ceiling-rounds ascent and descent to whole pixels
independently before summing, matching Godot's FreeType-quantized metrics rather
than a raw float scale.

A scene may also author **its own** font (a `Theme` `.tres` `default_font`, or a
node's `font` / `theme_override_fonts/*`), whose bytes do not exist until a scene
opens — so no build-time bake can cover them, and runtime MSDF generation needs
the same worker the CSP blocks. Those render through a **second painter**:
`new FontFace(name, bytes)` + `document.fonts.add`, rasterised via canvas-2D, with
no fetch, worker or blob URL anywhere on the path. Dispatch is internal to
`TextRun.tsx`, on a `kind: 'atlas' | 'canvas'` discriminant, so no per-slice
component knows a second path exists.

**The split is in the painter only — shaping is never duplicated.** `textLayout.ts`
is parameterised over a `FontMetrics` contract and shapes both paths; an
implementation supplies only raw design-unit data, and every conversion to pixels
(the line-pitch quantization above included) lives once in `fontMetrics.ts`, where a
second font cannot silently reimplement and drop it. See
[ADR-0034](./docs/adr/0034-two-text-painters-one-shaping-engine.md) for the measured
CSP findings and the `.woff2` limitation.

**One ordered pass driver, not per-publisher `useFrame`s**
(`r3f/contexts/ViewportPassRegistryContext.tsx`). A `SubViewport`'s offscreen
render and the native Control-only offscreen pass (the `ViewportTextureRegistry`
publisher a `ViewportTexture` samples) each register `{ dependsOn, render }`
instead of driving their own per-frame hook; `<ViewportPassOrchestrator>`
topologically sorts every registered pass and runs them in that order from a
single `useFrame`, so a pass nested inside another never renders a frame stale
the way per-publisher mount-order driving did. A pass whose dependencies form a
cycle is simply never driven — its target keeps whatever it last held,
deterministic rather than flickering — `logger.warn` names it once, and
`useViewportPassCycle` lets the sampling surface fall back to a placeholder.

**Known limitation, not a regression:** a Control nested under a `Node2D`
ancestor is positioned from its solved rect against the viewport; Godot composes
the full CanvasItem transform chain through every `Node2D` parent above it. The
DOM overlay was equally blind to a `Node2D` ancestor's transform, so this is
unchanged behaviour, not new fallout from going native.

### Resource Loading

Every resource type is a **Resource slice** (ADR-0031, CONTEXT.md):
`resources/<category>/<type>/` with a THREE-free `index.ts` that registers the
slice's claims (TSCN type names, extensions, bus tag, failure label) into
`sliceRegistration.ts`'s registry via the `sliceRegistrations.ts` barrel.
Routing derives from those claims — nothing sniffs a type name by substring.
Godot-text slices carry a pure `decode.ts` (a **ParsedResource** section → typed
Data) and, only where THREE construction exists, a `build.ts`; foreign-format
slices (`formats/{glb,image,packedscene}`) declare their real parser openly.
`resourceSliceConformance.test.ts` and `resourceSliceIsolation.test.ts` enforce
the shape.

A texture is not simply the file's bytes: Godot's editor **imports** every image
before its renderer ever samples one, and reading `res://foo.png` off disk skips
that. `resources/processing/fixAlphaEdges.ts` reproduces the one import step that
changes pixels for an unattended texture — `process/fix_alpha_border`, on by
default, which rewrites each transparent texel's RGB with its nearest opaque
neighbour's so a magnified bilinear sample cannot bleed a hidden key colour into
the visible fringe. `applyAlphaBorderFix` runs it once at decode, on images whose
alpha the canvas readback carries losslessly, and returns the original texture
untouched otherwise.

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
   dedupes in-flight requests. `tryLoad(path)` is the same fetch for a file found
   by CONVENTION rather than declared by a scene — the **Import sidecar**
   (ADR-0028) and `project.godot` (**Project settings**) — answering the caller
   alone and firing neither handler set, so a miss is an ordinary "use Godot's
   defaults" instead of a **Missing resource**.
3. **Per-type processors** (`createResourceProcessor`): one
   cache + in-flight + emit machine per type. On raw bytes it runs `process()`
   (async), caches the result (**failures cached as `null`** so they don't
   retry), and emits on the… (One documented edge: a path that **no**
   processor's `shouldProcess` claims stays pending forever — by design,
   since sibling processors share one `FileEventBus`; pinned in
   `createResourceProcessor.test.ts`.)
4. **`ResourceEventBus`** (core layer): typed events namespaced
   `texture|material|glb|scene` × `requested|loading|loaded|failed|invalidated`,
   carrying the processed payload. Scenes load "directly" (the parser needs path +
   content together) but emit the same events. `invalidated` fires per
   formerly-cached path on `ResourceLoader.clearCaches()` (corpus switch) —
   mounted hooks hold their value in React state, so without it they would keep
   serving the cleared corpus's resource forever; on receiving it they
   re-request under whatever provider state the HOST has arranged (the host must
   repoint the provider/URL modifier before clearing — **and must clear only with
   the outgoing corpus's scene already torn down**, since every consumer still
   mounted answers the announcement by re-requesting its own `res://` paths out
   of the incoming corpus, downloading an unrelated fixture's files). The LOADER
   owns the announcement, emitting only after every cache layer is reset and
   before metadata clears (scene loads validate registration synchronously); a
   processor's own full clear is silent. Both the `FileEventBus` and each
   processor also carry a clear **generation**: a fetch that departed before a
   full clear finishes under the cleared era and its result (success or
   failure) is dropped, never cached or announced.
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

**A resource path is not always a file path.** A `.tres` can declare the resources it
uses as its own `[sub_resource]` blocks — a mesh's per-surface materials, a
MeshLibrary's embedded item meshes — and those are addressed with Godot's own
`res://file.tres::SubId` notation (**Sub-resource path**, ADR-0032). The layers above
split on that: the **whole address is the resource identity** (processor cache key,
in-flight key, what `useResource` pins and subscribes to), while layer 3 normalises it
to its `filePath` before touching layer 2. So the `FileEventBus`, the
`ResourceProvider`s and the hot-reload watcher only ever see real files — a
sub-resource's bytes *are* its owning file's bytes — and one arrival settles every
address waiting on that file. `shouldProcess` is asked about the file, so extension
checks read unchanged.

That containment holds **downward**. Coming back up it needs help: a failed load is
reported under the address, so a missing-resources row can carry one, and the panel
hands its host the `filePath` for both upload and remove (ADR-0022) while `provideFile`
normalises whatever it is given. Because the normalisation sits in
`createResourceProcessor`, every processor type gains the fetch/cache/dedupe
**plumbing** — but not the semantics: a `process()` that ignored its path would hand
back the whole file's resource under the address, so `addressesSubResources` is opt-in
and the factory refuses an address without it. Only the material and ArrayMesh
processors declare it today. So the third kind of reference is invisible to any
**consumer** holding a path string, while a **producer** minting addresses for a new
resource type must honour the id in its own `process()`. The
`resources/subResourcePath.ts` grammar is the only place `::` is written.

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
linter/index.ts` imports each slice's `index.linter.ts` entry point
(which pulls only `linterParser.ts` + `linter.ts`) plus the
resource-level `linterValidators.ts` files — never the `r3f/` tree or
`nodes/**/Component.tsx`. This keeps the linter CLI bundle small.

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

### Animation

Godot's animation system drives *other* nodes' properties, deliberately
breaking the "each component renders itself" invariant (ADR-0011): an
`AnimationPlayer` renders as an invisible transform-only group but is also an
**animation driver**. Each `[sub_resource type="Animation"]` (a
**GodotAnimation** — `length`/`loop_mode`/`step` plus **Track**s targeting
`NodePath("Node:property")`) is parsed render-side and built into a
`THREE.AnimationClip`. Two paths carry values, split by what a
`THREE.AnimationMixer` can bind:

- **Transform tracks** (`position`/`rotation`/`rotation_degrees`/`scale`) drive
  a mixer rooted at the player's **Animation root** (`root_node`, default
  `..`); `THREE.PropertyBinding` resolves each target by name through the
  dispatcher's unnamed pickable wrappers (ADR-0011).
- **Non-transform tracks** (a discrete `Sprite2D:frame`, continuous
  `Decal:modulate`/`Decal:size`) can't go through the mixer, so the player
  samples the live mixer playhead and pushes values through the
  **AnimatedValue push registry** (`r3f/contexts/AnimatedValueContext.tsx`) —
  a ref-backed registry keyed by `${nodePath}:${property}` that the target
  component subscribes to, overriding its authored value while a value is
  pushed (ADR-0016, ADR-0017).

Playback is owned by one **Animation transport** (`AnimationTransportContext`)
that follows the **currently selected node** — one driver plays at a time,
mirroring the Godot editor's Animation panel. Three node types can act as a
driver, unified behind the same transport and `usePlaybackLoop`:

- **`AnimationPlayer`** — the GodotAnimation path above.
- **`GLBSceneRoot`** acting as a **GLB animation driver** (ADR-0014): a GLB's
  own **GLB-embedded clip**s (ready-made `THREE.AnimationClip`s straight from
  the glTF loader — never parsed as a GodotAnimation) surface on a
  synthesized, tree-only `GLBAnimationPlayer` row; selecting that row runs a
  mixer rooted on the GLB object itself (no `root_node`).
- **`AnimatedSprite2D`** (ADR-0015) — no mixer; the transport advances a
  displayed frame directly via `frameAtTime`.
- **`AnimationTree`** (ADR-0019) owns no clips itself: it resolves its
  `tree_root` `AnimNode` graph at the authored `parameters/*` state into a
  **blend program** (`{clip, weight, timeScale}[]`), looks up the driver its
  `anim_player` NodePath names in the **AnimationDriverRegistry**
  (`AnimationDriverContext` — the `nodePath → {object, clips}` map every
  AnimationPlayer/GLB driver publishes on load), and drives that object with
  weighted actions. It evaluates only while `active = true` (Godot parity) AND
  selected, and exposes a single read-only transport entry (no clip picker).

Playback starts **stopped** (authored pose/frame preserved); play is
user-initiated. `RESET` (Godot's conventional rest-pose animation) lists like
any clip but is skipped by the transport's default-clip heuristic (prefers the
`autoplay` clip, else the first non-`RESET` clip) unless it is the only clip.
Because playback is non-deterministic over time, playback fixtures are
excluded from the visual-regression manifest; the default (stopped) render
stays byte-stable.

### VS Code Editor Features

- `TscnDefinitionProvider`: Ctrl/Cmd-click (Go to Definition) on a
  `SubResource("id")` / `ExtResource("id")` reference jumps to that id's
  `[sub_resource]` / `[ext_resource]` heading **within the same file**
  (text-layer feature, unaffected by R3F). It does **not** resolve an
  `ExtResource`'s `res://` path to the external file it points at — see
  `docs/user-guide-vscode.md` (VSCODE-04) for that gap.
- `TscnDocumentSymbolProvider`: scene tree appears in the VS Code
  Outline panel.
- File watcher: when a `.tscn` file changes, the extension host posts
  a fresh `loadTscn` message to the webview, which re-parses and
  re-renders. The R3F canvas DOM node is preserved across content
  changes so the viewport camera state survives hot-reload.

### Web Source Pane

The web app — only the web app; VS Code has its own real text editor — mounts
an editable **Source pane** (ADR-0020): a left sibling of
`<TscnPreviewShell>`, wired entirely through the shell's existing `toolbar`
slot and `content` prop so the shared shell's API and VS Code parity stay
untouched. A bare, forced-monospace `<textarea>` (`apps/textscene-web/src/r3f-main.tsx`)
holds the buffer — no Monaco/CodeMirror — fed by fixture selection, file
upload, or direct paste/type.

Edits reach the shell only through a debounced (~250 ms) gate
(`apps/textscene-web/src/sourceGate.ts` → `resolveForwardedContent`): the
buffer is forwarded when it still parses under the **Lenient parser** (the
same `parseTscnContent` the shell renders with, so gate and render can never
drift apart); otherwise the shell keeps its last-good content, so a mid-edit
file that transiently breaks holds the viewport on its last valid render
instead of blanking. Pane visibility and width persist in `localStorage`
(mirroring the existing active-fixture persistence); a draggable splitter
resizes it. Edits are ephemeral — switching scene or reloading resets the
buffer to the file's content, and nothing is written back to disk.

The web app is the first browser consumer of `@textscene/core/linter`
(`apps/textscene-web/src/r3f-main.tsx`): the buffer is linted continuously,
debounced independently of the render-forward gate above (a buffer that
fails to render can still be linted — the gutter is what explains why). A
pure helper (`lineDiagnostics.ts`) groups `Diagnostic[]` by line — highest
severity per line, every message kept — feeding a `<SourceGutter>` column
(`SourceGutter.tsx`) that renders an error/warning/info dot per offending
line, scroll-synced with the textarea, with a hover/focus popover listing
that line's message(s). The pane's toggle carries a compact problem-count
badge (`✖ 1 / ⚠ 2`) so a collapsed pane still nudges. A "Download .tscn"
button (Blob + anchor, no write-back to disk) sits in a small pane header;
the textarea carries a native placeholder for the empty state. When a
from-scratch paste/type never produces a valid render (`forwardedContent`
never leaves `''`), the web app shows its own "nothing has rendered yet"
notice layered over the viewport — the shared shell has no such state to
expose, so this lives entirely in the web app's own layer, never touching
`TscnPreviewShell`.

The web app also surfaces a missing-resource count badge in the toolbar:
`<Toolbar>` is rendered through the shell's `toolbar` prop, i.e. as a
descendant of the shell's own `<MissingResourcesProvider>`, so calling
`useMissingResources()` directly inside it reads the exact same live
`missingPaths` set the Resources tab's `<MissingResourcesPanel>`
aggregates — no new plumbing. A loading overlay covers the viewport while
a fixture's `fetch()` is in flight. `?fixture=` is now written back to the
URL via `history.replaceState` on every scene switch (never `pushState`),
so reloading or sharing the URL reopens the same scene. The app root
accepts a dropped `.tscn` (with a drop-zone hint while dragging), and the
toolbar's file input accepts multiple files at once; a shared
`handleFilesUpload` (backed by the pure, unit-tested
`multiFileUpload.ts`) picks the first `.tscn` as the scene and matches
every other file to one of its external-resource `res://` paths by
basename, so a scene and its textures can open in one gesture.

### Dependency Versions (Phase 14)

Spike-validated stack:

- React 19.2, react-dom 19.2, @react-three/fiber 9.6, @react-three/drei 10.7
- @react-three/test-renderer 9.1, @testing-library/react 16.3
- three 0.184, @types/three 0.184
- Vitest 4.1, happy-dom 20, @vitejs/plugin-react 5 (workspace is on Vite 6);
  `jsdom` also sits in the catalog as a devDependency but no vitest config
  actually selects it as a test `environment` — every DOM-needing project uses
  happy-dom, and node-only projects (CLI linter, VS Code extension host) use
  `environment: 'node'`.
- TypeScript 6.0.3

### Bundle Size Target

**Extension HOST bundles** (separate from the webview budget below): the
extension-host import graph uses only React-free core subpaths
(`@textscene/core/parser`, `/linter`, `/logger`, plus targeted resource
utils) — never the root barrel, whose React/CSS side effects defeat
tree-shaking. That keeps `dist/extension.js` ≈ 204 KB and
`dist/extension.web.js` (the vscode.dev worker host) ≈ 204 KB with zero
`react`/`three` occurrences. If a host file imports the root
`@textscene/core` barrel again, the host bundle balloons ~4× — check
sizes after touching host imports. This is no longer just a documented
claim: `scripts/check-bundle-size.mjs`'s host-bundle guard scans both
built files for a word-boundaried `react`/`three` token and hard-fails
unconditionally (never gated behind `--enforce`, unlike the webview
budget below) — wired into `pnpm check:bundle-size`, `pnpm validate`,
and CI (issue #215).

The PRD acceptance for WI-R3F-6 was "VS Code webview bundle no larger
than `main + 200 KB gzipped`". History:

- `main` baseline: 1,429,646 B raw / **247,543 B gzipped**
- WI-R3F-6 (iife, no code-splitting): 3,691,702 B raw / **638,980 B gzipped** — +382 KB gz, **+182 KB over budget**
- WI-R3F-18 (ESM + splitting + React.lazy panels): initial-paint static-import closure is 1,357,273 B raw / 390,322 B gzipped — +143 KB gz vs main, 57 KB under the +200 KB budget ✅
- Post-WI-R3F-18 feature growth (GLB support — GLTFLoader/KTX2Loader/DRACOLoader/MeshoptDecoder — plus further node/animation coverage) pushed the closure back over budget: **536,997 B gzipped, 87.4 KB OVER budget**. Part of that regrowth was drei's `<Text>` (troika-three-text + bidi-js + its sdf-generator worker, statically imported by `InternalTextLabel` for the empty-state placeholder label) baked directly into `webview.js`.
- **Issue #215: `InternalTextLabel`'s drei `<Text>` converted to `React.lazy`.** It no longer sits in `webview.js`; it resolves in its own on-demand chunk the first time it actually renders. Result: **492,801 B gzipped — still 44.2 KB OVER budget**, a ~44 KB gz reduction from the troika split alone.
- **Issue #241: GLTFLoader + SkeletonUtils converted to dynamic `import()` in `glbProcessing.ts`.** Both modules are now split into on-demand lazy chunks (`GLTFLoader-*.js`, `SkeletonUtils-*.js`) that only load on the first actual GLB resource request. Scenes without any GLB references pay no loading cost for the loader chain at all. Result (measured on PR #286): **496,404 B gzipped before the split, 484,921 B gzipped after**, an 11.2 KB gz reduction; that left the closure 36.5 KB OVER the original 447,543 B budget. Investigation confirmed DRACOLoader, KTX2Loader, and MeshoptDecoder are NOT imported anywhere in source — they only appear as string plugin-name literals inside GLTFLoader; none of the vendored fixture GLBs use Draco or Meshopt compression.
- **Budget renegotiated (2026-07-14, PR #286): absolute ceiling of 600,000 B (600 kB) gzipped.** The original `main + 200 KB` criterion (447,543 B gz) came from the WI-R3F-6 PRD acceptance and predates GLB support becoming a committed, shipped feature. With the realistic lazy-loading landed (drei `<Text>`/troika in issue #215, GLTFLoader + SkeletonUtils in issue #241), the remaining closure is legitimate feature cost, so growth is accepted for now. Current closure of **484,921 B gz leaves ~115 KB headroom** under the new ceiling. Longer term the plan is to evaluate lighter rendering technologies to shrink the webview, not to squeeze this stack further.
- **Budget renegotiated again: absolute ceiling of 1,000,000 B (1 MB) gzipped.** The native 2D-UI work left the closure at **579,655 B gz**, 6 KB under the previous 600 kB ceiling. The growth was audited rather than assumed: the Control painters, the MSDF atlas, the glyph metrics and the theme icons all sit OUTSIDE the initial-paint closure, behind the controls barrel's dynamic import, so the lazy split held. What grew is the parser/linter chunk, which must know every node type name to parse a scene at all and therefore cannot be deferred. The ceiling is set well clear of the current closure deliberately: three.js (~184 KB gz) and react-three-fiber (~52 KB gz) are together ~40% of it and cannot be deferred — nothing paints without them — and that stack is not being replaced in the foreseeable future, so a ceiling needing renegotiation every few months is friction rather than a guard. **Know what the number no longer does:** with this much slack it is a catastrophe stop, not an early warning, and it will not notice a lazy chunk quietly becoming eager — the regression this closure is actually prone to. The instrument for that is a growth check against a recorded current size, not a lower ceiling.

WI-R3F-18 closed the gap (at the time) with three combined changes:

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

The initial chunk now contains: React, react-dom/react-reconciler
(react-three-fiber's runtime), drei's non-`Text` runtime, three.js core,
the scene canvas (`<TscnCanvas>`), the node component registry (registers
all node types on import), the resource pipeline, contexts, and selection.
The lazy chunks contain: the tree viewer, the details panel, drei's
`<Text>` (troika-three-text + bidi-js + its sdf-generator worker),
GLTFLoader + SkeletonUtils (loaded on the first GLB resource request),
and the CSS modules the DOM panels own. The native Control canvas
(`r3f/controls/native/`, all 23 painters, and the vendored MSDF font atlas)
is lazy-loaded the same way, through the barrel `ControlCanvasLayer`
imports (`r3f/controls/index.js`) — its side-effect registrations, and the
atlas, only enter a bundle once a scene actually mounts the 2D stage, same
as GLTFLoader only loads on an actual GLB request.

**Bundle-size guard.** `scripts/check-bundle-size.mjs` walks the
static-import closure starting at `webview.js`, gzips the
concatenation, and compares against the renegotiated absolute budget of
**1,000,000 B gzipped**; it also runs the host-bundle react/three guard
described above. Wired into `pnpm validate` and CI
(`.github/workflows/ci.yml`, issue #215), and the repo's
`check:bundle-size` script passes `--enforce` (issue #241), so a budget
breach is a hard failure everywhere the script runs.

**Status of the budget gate: ENFORCED.** On 2026-07-14 (PR #286,
closing issue #241) the webview budget was renegotiated from
`main + 200 KB` (447,543 B gz) to an absolute ceiling, since raised again
to **1,000,000 B gzipped** (see the bullet above), and
`pnpm check:bundle-size` now passes `--enforce`, so `pnpm validate`, the
pre-push hook, and CI hard-fail whenever the initial-paint closure
exceeds it. Rationale: the original
criterion predates GLB support and react-three-fiber becoming committed
shipped features, and with the realistic lazy-loading done (troika
`<Text>`, GLTFLoader/SkeletonUtils) the remaining closure is legitimate
feature cost: React + react-dom/react-reconciler, three.js core,
react-three-fiber's runtime, and drei's non-Text helpers account for
the bulk of the ~232 KB gz delta over the plain-JS `main` baseline. The
closure currently sits at **484,921 B gz, ~115 KB under the ceiling**.
Rather than squeezing this stack further, the forward-looking direction
is to evaluate lighter rendering technologies later if the webview
needs to shrink.

### Known limitations

**Web app: content-only hot-reload from disk is not implemented.** When a
fixture's TSCN content changes out-of-band on disk (e.g. via the dev server
filesystem, or an external editor touching the file the browser fetched it
from) the web app does not detect the change — it only re-fetches a fixture
on an explicit dropdown re-selection. The **Source pane** (ADR-0020,
above) does not close this gap: it holds an in-memory buffer, not a
filesystem watch, so it re-renders on every keystroke made *inside the pane*
but is blind to edits made anywhere else. What the pane does change is the
workaround available to a user: rather than re-selecting the fixture, they
can paste the updated `.tscn` text straight into the pane and see it render
immediately (gated on the lenient parser, same as any other pane edit). The
VS Code extension does NOT share the disk-level limitation — there the
editor's `onDidSaveTextDocument` fires `loadTscn` and the React shell
reconciles cleanly on save, from any editor or external tool.

Actually watching disk from the browser would mean either:
1. Subscribing to the Vite HMR `import.meta.hot.on('update')` event
   when in dev mode, then re-fetching the active fixture, or
2. Polling the fixture URL with `ETag` / `Last-Modified` and
   re-fetching on change.

Neither is implemented; deferred to a follow-up WI. The v1 flow expects
users who need true filesystem hot-reload to use the VS Code extension;
the web app's Source pane covers the "I have new text, show me the result"
case without it.

## Planned Evolution — real-world scene corpus breadth

This section is **forward-looking** and is updated phase-by-phase as the work lands. Goal: render a full real-world Godot project — not just isolated per-feature fixtures — end to end in both apps, exercising the mesh/CSG/physics/lighting/2D-UI breadth an actual shipped game touches rather than a synthetic sampler. See [CONTEXT.md](./CONTEXT.md) and [docs/adr/](./docs/adr/).

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

### Viewport mode + app chrome (P3/P4/P6 — [ADR-0037](./docs/adr/0037-control-nodes-render-natively-in-the-canvas.md) (supersedes [ADR-0003](./docs/adr/0003-2d-ui-dom-overlay.md)), [ADR-0006](./docs/adr/0006-viewport-mode-seam.md), [ADR-0007](./docs/adr/0007-adopt-split-dock-shell.md))

**Status:** the 2D-UI Control set, the viewport toggle, and the **Split Dock** chrome (which replaced the 3-column DCC layout — ADR-0007) are all **shipped**.

- **P3 — Control set (done, superseded by native rendering — [ADR-0037](./docs/adr/0037-control-nodes-render-natively-in-the-canvas.md)).** All 23 Control types the target real-world corpus uses are registered as native (WebGL canvas) painters: `Control`, `ColorRect`, `Label`, `VBoxContainer`, `HBoxContainer`, `GridContainer`, `CenterContainer`, `MarginContainer`, `ScrollContainer`, `Panel`, `PanelContainer`, `Button`, `TextureRect`, `RichTextLabel`, `CheckBox`, `OptionButton`, `LineEdit`, `HSlider`/`VSlider`, `HSplitContainer`/`VSplitContainer`, `SubViewportContainer`, and the passthrough `CanvasLayer`. Each is a unified slice whose `index.r3f.ts` registers a `Native` painter into `ControlComponentRegistry`; `ControlCanvasWalker` walks the live subtree and runs the **Control rect solve** (`native/controlRectSolver.ts`, a two-phase port of Godot 4.6.3's `Control::get_combined_minimum_size` + `fit_child_in_rect`) to place every node before a painter draws its own chrome — StyleBoxes as tessellated, vertex-coloured meshes (`StyleBoxQuad`) and text as vendored MSDF glyph geometry (`native/text/`), never CSS. `TextureRect` loads images host-agnostically via `useResource`.
- **P4 — viewport toggle (done).** `TscnPreviewShell` is wrapped in `<ViewportModeProvider>`; a shared `<ViewportToolbar>` (3D/2D switch + Collisions checkbox) writes through `useViewportMode()`, and `<ViewportArea>` renders `TscnCanvas` (3D) or `Canvas2DStage` (2D). The native Control canvas (`ControlCanvasLayer`, mounted inside `Canvas2DStage`'s `World2DCanvas`) is lazy-loaded through the same barrel that registers all 23 painters, so that registration weight — and the vendored MSDF atlas — stay out of the initial canvas-paint bundle until a 2D scene actually needs them.
- **P5 — 3-column DCC chrome (superseded by P6).** The first chrome was a full-width top bar over three columns: a left **Scene** dock (SceneInfoCard + tree), the center viewport, and a right **Inspector** dock. Resizable + collapsible docks, stacked vertically under 768px. Replaced by the Split Dock (P6).
- **P6 — Split Dock chrome (done, [ADR-0007](./docs/adr/0007-adopt-split-dock-shell.md)).** A prototype exploration (5 fresh-eyes designs → A+B hybrids → "Split Dock") landed the user-chosen layout: a slim top bar (file/brand + host toolbar + scene-stat chips) over **two** columns — a large center viewport (with the `ViewportToolbar` floated over its top-right corner) and a single right dock. **No left rail** (a VS Code webview sits right of VS Code's own activity bar + Explorer, so a left rail clashes + wastes width). The dock is a vertical **master-detail**: `SceneTreeViewer` on top over a tabbed detail (**Inspector / Resources / Cameras**) — selecting a node updates the inspector with no tab hop; the on-pane tab strip switches only the lower section; the Cameras tab lists `Camera3D` nodes with a one-click "use". `SceneInfoCard` was removed (node count moved to the top bar + tree header). Resizable width (`<Splitter>`) + a draggable master/detail handle; collapsible to a full-width viewport; stacks under 768px. In 2D mode the viewport becomes a framed pan/zoom `Canvas2DStage` compositing the 2D world and the native Control canvas in one draw. The web app's scene picker is a Ctrl/Cmd+K command palette in the web toolbar (`apps/textscene-web/src/r3f-main.tsx`; "Open .tscn" primary — the built-in fixtures it lists are dev-only scaffolding). Restyled via the shared `--tsi-*` tokens (VS Code-theme-aware).

A single `ViewportModeContext` chooses between the 3D canvas and the 2D stage's own canvas (native Controls draw inside it, never a sibling DOM layer), and drives the collision gizmo. The Split Dock shell is shared by both apps:

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
  VM -->|mode = 2D| CO["Canvas2DStage → World2DCanvas →<br/>NodeDispatcher + ControlCanvasWalker<br/>(one canvas, one tree order; framed 1152×648, zoom/pan)"]
  TC -. showCollisions .-> GZ["Collision gizmo<br/>(wireframe per collision-shape resource)"]
  CENTER --- TC
  CENTER --- CO
```

The native Control canvas resolves `layout_mode = 2` (container-managed, the majority case) through the parent's registered `ContainerLayoutFn`, the LayoutPreset 0..15 table into a solved `Rect2`, and StyleBox resources into tessellated mesh geometry — see [ADR-0037](./docs/adr/0037-control-nodes-render-natively-in-the-canvas.md) and CONTEXT.md's **Control rect solve** entry. Text draws from a vendored Open Sans MSDF atlas rather than the host's system fonts, so it renders identically under the VS Code webview and the web app; a scene that authors its own font is rasterised at runtime through a second painter instead, sharing the one shaping engine ([ADR-0034](./docs/adr/0034-two-text-painters-one-shaping-engine.md)); images load via the host file provider (`useResource`, so VS Code webview CSP is honored) straight into a GL texture, with no `data:`-URL laundering step. Per-app mode persistence behind a `usePersistedMode()` hook (`localStorage` web / webview state API) is **deferred** — the switch is per-session today.

### Scope (P2 — [ADR-0004](./docs/adr/0004-csg-as-primitive.md), [ADR-0005](./docs/adr/0005-physics-bodies-transform-only.md))

Scoped to exactly the types the target real-world corpus uses: CSGBox3D/CSGCylinder3D (since extended to all seven CSG types with real boolean evaluation, ADR-0027), StaticBody3D/Area3D (transform-only groups), CollisionShape3D + BoxShape3D/ConvexPolygonShape3D/ConcavePolygonShape3D (toggleable wireframe gizmos), plain AudioStreamPlayer (zero-geometry node), and a ShaderMaterial→translucent-standard-material fallback.

### Tracked deepening candidates (not yet scheduled)

None currently tracked. (The lenient parser's transform decomposition — `nodes/node/parser.ts` → `utils/transform.ts` — used to depend on `THREE.Matrix4`/`Euler`; it was rewritten as pure math, so `parser/TscnParser.ts` value-imports no `three`/`react` end to end. `three` now enters the picture only through the `r3f/` render layer, pinned by `reactFree.test.ts`; `transform.threeEquivalence.test.ts` keeps a THREE-based cross-check purely as a test-only bit-equivalence oracle.)
