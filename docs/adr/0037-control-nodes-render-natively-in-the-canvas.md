# Control nodes render natively in the WebGL canvas; the DOM overlay is retired

- Status: Accepted. **Supersedes ADR-0003.** **Supersedes ADR-0024** by consequence (its
  gate, `verify:2d`, retires with the DOM overlay it covered).
- Amends ADR-0006 (the 2D workspace's UI layer moves inside the canvas instead of on top
  of it).
- Related: ADR-0002 (three separate registries, unaffected: the render-domain registry
  is still a third registry, and it holds native painter components in place of DOM
  components), ADR-0033 (a sub-viewport is a canvas boundary; its Control-only offscreen
  pass is native, not a DOM raster).

## Context

A DOM rendering of Godot `Control`/`CanvasLayer` gives text shaping, wrapping, scrolling
and box layout from the browser (ADR-0003). Its cost is a parallel rendering universe
whose layout is a CSS *approximation* of Godot's container algorithm, never Godot's own
`get_combined_minimum_size` / `fit_child_in_rect` maths. The visual goldens cannot see it
(ADR-0024 exists for that gap), and it cannot feed a `ViewportTexture` without first
rasterising DOM into an image (ADR-0003's amendment, and ADR-0033's `verify:raster`
gate).

The DOM/WebGL split is also a **correctness** gap. Godot composites each CanvasItem, 2D
world and Control UI alike, in one tree-order draw. An opaque Control that Godot draws
*behind* world content (`demos/2d/pong`'s background `ColorRect`, the scene's first
child) covers the whole canvas under a DOM overlay that always paints on top. No layering
heuristic fixes that in general: it breaks when a Control sits between two `Node2D`
siblings, because two rendering technologies cannot interleave `<div>`s and canvas draws
by tree order.

## Decision

Render `Control`/`CanvasLayer` subtrees as ordinary three.js objects inside the same
`World2DCanvas` that the 2D world draws into: one canvas, one tree order, with
`z_index`/`CanvasLayer.layer` applying uniformly. Each Control type has a native painter,
and a conformance test pins the registry coverage.

### The Control rect solve

`packages/textscene-core/src/r3f/controls/native/controlRectSolver.ts` replaces the
browser's layout engine with a pure-TS, framework-free port of Godot 4.6.3's own two
phases (`scene/gui/control.cpp`), cited line by line:

1. **Bottom-up** `get_combined_minimum_size`: a widget's own minimum size, floored by
   `custom_minimum_size`, merged upward through nested containers.
2. **Top-down** `fit_child_in_rect`: a free or anchored Control resolves against its
   parent's rect (the viewport for a root). A container child resolves through that
   parent's registered `ContainerLayoutFn` instead (`controlSolverRegistry`, the same
   `createTypeRegistry` pattern as each other registry in this codebase, ADR-0002).

`ControlCanvasWalker`, the native analogue of `NodeDispatcher`, runs the solve once per
generation over `buildSolveTree`'s live-tree walk. It then emits one `<group>` per
Control at its solved rect. A registered `Native` painter draws that node's own chrome:
StyleBoxes as tessellated, vertex-coloured mesh geometry (`styleBoxFlatGeometry.ts` +
`StyleBoxQuad`, a port of `StyleBoxFlat::draw` with `border_blend`), not CSS
`background`/`border`.

Those vertex colours stay in **sRGB** up to the fragment shader, which decodes them
there, not on the attribute. For a constant colour the two are the same number. They
diverge where the rasteriser interpolates between two different ones, which is what a
`border_blend` ring is. Godot ramps `border_color` to `border_color_blend` in sRGB, so
linearised endpoints ramp through the wrong space: measured at 38 counts on red at the
ramp's midpoint, with both endpoints exact. The alternative, to subdivide the ring so a
linear ramp tracks the sRGB one, converges as the square of the step count: 16 radial
bands still leave 1.3 counts, for 32x the vertices. The decode is injected into
`MeshBasicMaterial`'s own `<color_fragment>`, not written as a `ShaderMaterial`, so
clipping, the tone curve and the output encode stay inherited. A hand-written shader
must re-declare those three stages, and it fails silently when it omits one
(`msdfMaterial.ts`'s header records all three).

The solve is also more testable. happy-dom has no layout, so a DOM test can assert that a
Control is in the DOM, but not where. A rect solve is asserted in plain vitest against
exact values. Some come from Godot's own source. Others are read back from a throwaway
Godot project's `Control.get_rect()` through engine introspection, an oracle that reads
rects for nodes that draw nothing, which pixel probes cannot.

### The painter view: a narrowed type, not an import boundary

A painter must never re-apply its own node's `modulate`. `ControlCanvasWalker` folds it
into the ambient `Modulate2DContext` it wraps the painter in, so a second application
squares it: invisible at Godot's opaque-white default, a four-fold error at 0.5. A test
that sets only an ambient context plus `self_modulate`, and never the node's own
`modulate`, passes a painter that carries this defect.

`painterView<T>(solveNode)` (`solveTree.ts`) gives a painter
`Omit<T, 'modulate' | 'selfModulate'>`, and the walker resolves the own-pixel tint
itself: `self_modulate` folded onto the inherited value it holds, passed down as the
required `tint` prop, the shape `CanvasItem2D` has for the Node2D family. Neither field
has a spelling a painter can reach. The narrowing is structural, not an import boundary
(a separate painter-facing module that re-exports a stripped copy of each property
type), and it is real at runtime: the returned object is a shallow copy of the bag with
the two keys rest-destructured out, so a helper given the whole object cannot find either
by name.

The copy is allocated once per property bag and held in a module-level `WeakMap` keyed on
the bag. Repeated calls return the same object, so a painter that memoises on props
identity (`label/Component.tsx`, `checkbox/Component.tsx`) does not thrash across the
renders of one solve generation. A `WeakMap`, not a cache with its own lifetime: a
re-parse's discarded bags take their views with them.

The bag itself is untouched. The walker and each solver read `modulate`/`self_modulate`
there through `controlProps`, so `solveNode.node.properties` stays reachable from any
file that has the `SolveNode`, painters included, and a solver helper reached through it
(`buttonIconColor`, `resolveCheckBoxDrawState`, `labelTextTheme`) gets the whole object.
`painterViewConformance.test.ts` closes that door with three source scans. No painter
reaches `.node.properties`. No painter calls the wide tint hooks (`useCanvasItemTint`).
No source under `nodes/2d/ui/**` outside `parser.ts`/`linterParser.ts`/`types.ts`, and no
painter outside that tree such as the shared `PanelChrome`, names `modulate` in code. The
first two scans take a `painter-view-exempt:` opt-out with a stated reason (`CanvasLayer`
is a `Node`, not a Control, and keeps its own cast). The laundering scan takes none.

### `renderOrder`, not a fractional z offset, for draw order

**Superseded in part by ADR-0036**, which has the rule in force. What stands: each 2D
canvas material here is `transparent` + `depthWrite={false}`, so three's
transparent-object sort decides paint order outright, at no frustum cost. A fractional-z
scheme cannot express it: the 2D world camera sits at `position:[0,0,1000]`, `near:0.1`,
`far:4000`, which leaves usable z `(-3000, 999.9)` against world content that spans
`±409.6`.

ADR-0036 replaces the Control band this ADR chose, one stride above world content. A
`Control` is a `CanvasItem` and interleaves with its Node2D siblings in tree order, so
that band inverts each scene with a Control authored before world content.
`CanvasLayer.layer` reaches the canvas's draw order, and ADR-0036 extends it to world
content too.

### Clip planes, not the stencil buffer, for `ScrollContainer`

The on-screen 2D `<Canvas>` requests **no stencil buffer** (`World2DCanvas.tsx`'s `gl`
props do not ask for one, and three defaults it off), so a stencil-based clip is a silent
no-op everywhere, not a fallback. Clip planes are verified: 81/81 boundary samples exact
across 4 nesting levels. `ScrollContainer` builds its own subtree's 4 axis-aligned "keep
inside" planes from its own full rect (`Control::clip_contents` clips to
`Rect2(Point2(), get_size())` regardless of scrollbar reservation), transforms them into
world space through its own group's `matrixWorld`, and merges them onto what it inherited
(`withAdditionalClipPlanes`). Planes are per-*material* state
(`THREE.Material.clippingPlanes`), not per-geometry, so each leaf material
(`controlQuad.tsx`, `StyleBoxQuad.tsx`) reads `useControlClipPlanes` and spreads it. That
lets a ScrollContainer's own scrollbar chrome and each descendant Control inherit the
clip. Container children cannot rotate (`fit_child_in_rect` resets rotation/scale), so
axis-aligned planes suffice.

### Text: a vendored MSDF atlas, not troika

Godot 4's default theme font is Open Sans SemiBold. The two candidates are runtime SDF
through troika-three-text (in the dependency tree through drei's lazy `<Text>`), or a
pre-baked MSDF atlas drawn by a dedicated quad shader. Troika is **impossible** under the
VS Code webview's CSP, twice over: `worker-src` blocks its blob-URL SDF worker, and
`connect-src` blocks its font *fetch* for `data:` and `blob:` alike, so inlined font bytes
cannot help. Widening only `connect-src` to add `blob:` isolates this: the same page goes
from a timeout to 3407 opaque rendered pixels. To enable troika means widening the
extension's CSP, a change of security posture this ADR does not take.

**This corrects ADR-0003's `font-src` framing.** ADR-0003 attributes the DOM overlay's
system-fonts-only limitation to the webview CSP having no `font-src`. That is true, but
`font-src` governs CSS `@font-face`, not a font consumed as raw bytes by a WebGL text
pipeline. The blocker for that alternative is `worker-src` + `connect-src`.

The chosen pipeline: `OpenSans_SemiBold.woff2` (Godot's own file), vendored and baked at
build time into a PNG atlas + per-glyph JSON table (`scripts/fonts/bake-metrics.mjs`,
`packages/textscene-core/src/r3f/controls/native/text/`). It is committed with a
`--check` mode so the artefacts cannot drift from the font, licensed OFL-1.1 and noticed
in `THIRD-PARTY-NOTICES.md`. No worker, no runtime font parse, byte-deterministic for
goldens. Line pitch ceiling-rounds ascent and descent to whole pixels *independently*
before it sums them (`getLinePitchPx`), as Godot's TextServer reads FreeType's
pixel-quantised metrics and does not scale `hhea` directly. A raw float sum undershoots
line pitch by about a pixel everywhere.

### One ordered viewport pass driver

`packages/textscene-core/src/r3f/contexts/ViewportPassRegistryContext.tsx` drives each
offscreen pass (one per `SubViewport`, one for the native Control-subtree publisher) from
a single ordered driver, not a `useFrame` per publisher. R3F runs default-priority
`useFrame` subscribers in mount order, parent before child, so a publisher nested inside
another (a `ViewportTexture` that samples a nested `SubViewport`) renders one frame
stale: the outer pass runs before the inner one it samples has produced anything that
frame. Each pass registers `{ dependsOn, render }`. `orderViewportPasses` sorts
dependencies topologically before dependents, and a single
`<ViewportPassOrchestrator>` drives them in that order from one `useFrame`.

A cycle (two passes that each depend on the other, directly or transitively) has no valid
render order. The affected passes are never driven, and their target keeps what it last
held, so the output is deterministic frame over frame and does not flicker.
`logger.warn` names the offending sampler once per detected cycle, and
`useViewportPassCycle` lets the consuming surface fall back to its own placeholder and
not show a frozen or uninitialised texture. The same registry is the seam through which
the native Control-only offscreen pass publishes into `ViewportTextureRegistry`
(ADR-0033), in place of the `<foreignObject>`-based `rasterizeControlSubtree` DOM
rasteriser. No consumer of that registry changes.

### A Control under a `Node2D` ancestor

Godot composes the full CanvasItem transform chain through each `Node2D` above a
Control. The walker composes the skipped `Node2D` ancestors' transforms
(`SolveNode.skippedAncestors`) onto the Control's group, with their `modulate` and
`z_index` steps.

## Considered options

**Textured quads driven by the same CSS-flavoured layout.** Rejected: it keeps layout as
a CSS approximation and adds the cost of a second geometry pipeline. It is neither
cheaper nor more faithful than solving Godot's own container maths.

**A heuristic canvas/DOM interleaving rule** (for example "layer Control subtrees that
precede all world content below the canvas"). Rejected: it fixes one case
(`demos/2d/pong`) and breaks when a Control sits between two `Node2D` siblings. Two
rendering technologies cannot share one tree-order draw, whatever the heuristic.

## Consequences

- `ControlOverlay`, `ControlDispatcher`, `styleBoxToCss.ts`, `imageToDataUrl.ts`,
  `createContainerComponent.tsx`'s CSS flex/grid emission and the inline-SVG
  `feColorMatrix` modulate filter are deleted, not built on.
- `verify:2d` (ADR-0024) and `verify:raster` (ADR-0003's amendment, ADR-0033) retire. The
  visual-golden harness is the only rendering gate 2D UI needs, since native Controls are
  renderer pixels like everything else it covers. 2D-UI fixtures join the golden set
  behind the `mode: '2d'` parity capture (`scripts/visual/scenes.mjs`), not a bespoke
  DOM-stats harness.
- `CanvasLayer.layer` reaches the canvas draw order.
- A `SubViewport`'s Control-only content publishes into `ViewportTextureRegistry` from a
  native offscreen pass, not a DOM raster. `SubViewport`/`SubViewportContainer`/
  `ViewportTexture` consumers do not change (ADR-0033's seam holds).
- The linter bundle is untouched: `index.linter.ts` never imports `Component.tsx`
  (ADR-0001), so this swap is invisible to `apps/textscene-linter`.
- Non-goals: interactivity (hover/pressed/focus states, click-element→tree selection)
  stays deferred, as under ADR-0003. bbcode support stays a subset.
- The DOM-versus-native choice is hard to reverse (a whole parallel dispatcher, registry
  and rect-solve engine).
