# Control nodes render natively in the WebGL canvas; the DOM overlay is retired

- Status: Accepted (2026-08-04). **Supersedes ADR-0003.** **Supersedes ADR-0024** by
  consequence (its own gate, `verify:2d`, retires with the DOM overlay it existed to
  cover).
- Amends ADR-0006 (the 2D workspace's UI layer moves inside the canvas it used to sit
  on top of).
- Related: ADR-0002 (three separate registries — unaffected: the render-domain
  registry still exists as a third registry, only what it holds changes, from DOM
  components to native painter components); ADR-0033 (a sub-viewport is a canvas
  boundary; its Control-only offscreen pass is now native, not a DOM raster).

## Context

ADR-0003 chose the DOM for Godot `Control`/`CanvasLayer` rendering because the browser
gave faithful text shaping, wrapping, scrolling and box layout for free. The price
became measurable: a parallel rendering universe (~3,000 non-test LOC across 17
slices) whose layout was a CSS *approximation* of Godot's container algorithm — never
Godot's own `get_combined_minimum_size` / `fit_child_in_rect` math — invisible to the
visual goldens (ADR-0024 exists only because of that gap), and unable to feed a
`ViewportTexture` without rasterizing DOM into an image first (ADR-0003's 2026-07-29
amendment, and ADR-0033's `verify:raster` gate).

The DOM/WebGL split was also not just a fidelity gap but a **correctness** one: Godot
composites every CanvasItem — 2D world and Control UI alike — in one tree-order draw.
An opaque Control that Godot draws *behind* world content (`demos/2d/pong`'s
background `ColorRect`, first child of the scene) covered the entire canvas here,
because the DOM overlay always painted on top, unconditionally. No layering heuristic
fixes that in general — it breaks the moment a Control sits *between* two `Node2D`
siblings — because interleaving `<div>`s and canvas draws by tree order is exactly what
two rendering technologies cannot do.

## Decision

Render `Control`/`CanvasLayer` subtrees as ordinary three.js objects inside the same
`World2DCanvas` the 2D world already draws into. One canvas, one tree order,
`z_index`/`CanvasLayer.layer` applying uniformly. All 23 Control types (the DOM set,
plus `LineEdit`, `HSlider`/`VSlider`, `HSplitContainer`/`VSplitContainer`,
`SubViewportContainer`) now have a native painter; a conformance test pins registry
coverage at 23/23.

### The Control rect solve

`packages/textscene-core/src/r3f/controls/native/controlRectSolver.ts` replaces the
browser's layout engine with a pure-TS, framework-free port of Godot 4.6.3's own two
phases (`scene/gui/control.cpp`), source-cited line by line:

1. **Bottom-up** `get_combined_minimum_size` — a widget's own minimum size, floored by
   `custom_minimum_size`, merging upward through nested containers.
2. **Top-down** `fit_child_in_rect` — a free/anchored Control resolves against its
   parent's rect (the viewport for a root); a container child resolves through that
   parent's registered `ContainerLayoutFn` instead (`controlSolverRegistry`, the same
   `createTypeRegistry` pattern as every other registry in this codebase — ADR-0002).

`ControlCanvasWalker` (the native analogue of `NodeDispatcher`, replacing the
DOM-emitting `ControlDispatcher`) runs the solve once per generation over
`buildSolveTree`'s live-tree walk, then emits one `<group>` per Control at its solved
rect; a registered `Native` painter draws that node's own chrome — StyleBoxes as
tessellated, vertex-coloured mesh geometry (`styleBoxFlatGeometry.ts` +
`StyleBoxQuad`, porting `StyleBoxFlat::draw`, `border_blend` included) rather than CSS
`background`/`border`.

Those vertex colours stay in **sRGB** all the way to the fragment shader, which decodes
them there — not on the attribute. For a constant colour the two are the same number;
they diverge exactly where the rasterizer interpolates between two different ones,
which is what a `border_blend` ring is. Godot ramps `border_color` to
`border_color_blend` in sRGB, so linearising the endpoints first ramps through the
wrong space — measured at 38 counts on red at the ramp's midpoint while both endpoints
stayed exact. Subdividing the ring so a linear ramp tracks the sRGB one is the
alternative and converges as the square of the step count: 16 radial bands still leave
1.3 counts, for 32x the vertices. The decode is injected into `MeshBasicMaterial`'s
own `<color_fragment>` rather than written as a `ShaderMaterial`, so clipping, the
tone curve and the output encode all stay inherited — three stages a hand-written
shader has to re-declare, and whose omission is silent (`msdfMaterial.ts`'s own header
records all three being missed once already).

This is also a **testability upgrade**, not just a fidelity one: happy-dom has no
layout, so the DOM-era unit tests could assert a Control was in the DOM but never
where it was. A rect solve is asserted in plain vitest against exact values, some
derived from Godot's own source, some read back from a throwaway Godot project's
`Control.get_rect()` via engine introspection (an oracle that reads rects for nodes
that draw nothing, which pixel-probing cannot) — the rect solve for the vboxcontainer
fixture predicted every child rect to 0 px this way.

### The painter view: a narrowed type, not an import boundary

A painter must never re-apply its own node's `modulate`. `ControlCanvasWalker` folds
it into the ambient `Modulate2DContext` it wraps the painter in, so applying it again
squares it — invisible at Godot's opaque-white default, a four-fold error at 0.5. The
rule was restated in prose in a dozen painter headers and enforced by nothing: the
tests named for it only ever set an ambient context plus `self_modulate`, never the
node's own `modulate`, so a painter carrying the exact defect passed all of them.

`painterView<T>(solveNode)` (`solveTree.ts`) now hands a painter
`Omit<T, 'modulate' | 'selfModulate'>`, and the walker resolves the own-pixel tint
itself — `self_modulate` folded onto the inherited value it already holds, handed
down as the required `tint` prop, the shape `CanvasItem2D` has always had for the
Node2D family — so neither field has a spelling a painter can reach. The narrowing is
STRUCTURAL rather than an import boundary — a separate painter-facing module
re-exporting a stripped copy of each property type — and it is REAL at runtime: the
returned object is a shallow copy of the bag with the two keys rest-destructured out,
so a helper handed the whole object cannot find either even by name.

The copy is allocated once per property bag and held in a module-level `WeakMap` keyed
on the bag, so repeated calls return the same object and a painter memoizing on props
identity (`label/Component.tsx`, `checkbox/Component.tsx`) does not thrash across the
renders of one solve generation. `WeakMap` rather than a cache with a lifetime of its
own: a re-parse's discarded bags take their views with them.

The bag itself is untouched — the walker and every solver read `modulate`/
`self_modulate` there through `controlProps` — so `solveNode.node.properties` remains
reachable from any file that has the `SolveNode`, painters included, and a solver
helper reached through it (`buttonIconColor`, `resolveCheckBoxDrawState`,
`labelTextTheme`) is back to the whole object. `painterViewConformance.test.ts` closes
that door with three source scans: no painter reaches `.node.properties`, no painter
calls the wide tint hooks (`useCanvasItemTint`), and no source under `nodes/2d/ui/**`
outside `parser.ts`/`linterParser.ts`/`types.ts` — nor a painter living outside that
tree, such as the shared `PanelChrome` — names `modulate` in code at all. The first
two take a `painter-view-exempt:` opt-out with a stated reason (`CanvasLayer` is a
`Node`, not a Control, and keeps its own cast); the laundering scan takes none.

### `renderOrder`, not a fractional z offset, for draw order

**Superseded in part by ADR-0036** — read that for the rule in force. What stands:
every 2D canvas material here is `transparent` + `depthWrite={false}`, so three's
transparent-object sort decides paint order outright, at no frustum cost, and a
fractional-z scheme cannot express it — the 2D world camera sits at
`position:[0,0,1000]`, `near:0.1`, `far:4000`, leaving usable z `(-3000, 999.9)`
against world content already spanning `±409.6`.

What was WRONG, and what ADR-0036 replaces: this ADR put Controls in a band one whole
stride ABOVE world content, on the belief that "an ordinary UI root on the default
canvas still paints after the 2D world within it" matched Godot. It does not — a
`Control` is a `CanvasItem` and interleaves with its Node2D siblings in tree order, so
the band inverted every scene with a Control authored before world content.

`CanvasLayer.layer` reaching the canvas's draw order at all (the Control half of issue
#358) dates from here and survives; ADR-0036 extends it to world content too.

### Clip planes, not the stencil buffer, for `ScrollContainer`

The decisive fact: the on-screen 2D `<Canvas>` requests **no stencil buffer at all**
(`World2DCanvas.tsx`'s `gl` props never ask for one, and three defaults it off), so a
stencil-based clip would be a silent no-op everywhere, not a fallback. A spike
verified clip planes instead: 81/81 boundary samples exact across 4 nesting levels.
`ScrollContainer` builds its own subtree's 4 axis-aligned "keep inside" planes from
its own full rect (`Control::clip_contents` clips to `Rect2(Point2(), get_size())`
regardless of scrollbar reservation), transforms them into world space via its own
group's `matrixWorld`, and merges them onto whatever it inherited
(`withAdditionalClipPlanes`). Planes are per-*material* state
(`THREE.Material.clippingPlanes`), not per-geometry, so every leaf material
(`controlQuad.tsx`, `StyleBoxQuad.tsx`) reads `useControlClipPlanes` and spreads it —
which is what lets a ScrollContainer's own scrollbar chrome and every descendant
Control inherit the clip for free. Container children cannot rotate
(`fit_child_in_rect` resets rotation/scale), so axis-aligned planes suffice; no
Control subtree needs oriented clipping.

### Text: a vendored MSDF atlas, not troika

Godot 4's default theme font is Open Sans SemiBold. Two pipelines were candidates:
runtime SDF via troika-three-text (already in the dependency tree via drei's lazy
`<Text>`), or a pre-baked MSDF atlas drawn by a dedicated quad shader. A spike found
troika **impossible** under the VS Code webview's CSP, twice over: `worker-src` blocks
its blob-URL SDF worker, and `connect-src` blocks its font *fetch* — for `data:` and
`blob:` alike, so inlining the font bytes cannot help either. This was isolated by
widening only `connect-src` to add `blob:`, which flipped the same page from a timeout
to 3407 opaque rendered pixels. Enabling troika would mean widening the extension's
CSP — a security-posture change this issue does not take.

**This corrects ADR-0003's `font-src` framing.** ADR-0003 attributed the DOM overlay's
system-fonts-only limitation to the webview CSP having no `font-src` — true, but
`font-src` governs CSS `@font-face`, not a font consumed as raw bytes by a WebGL text
pipeline. The real, twice-over blocker for that alternative is `worker-src` +
`connect-src`, discovered only once a non-CSS text pipeline was actually attempted.

The winning pipeline: `OpenSans_SemiBold.woff2` (Godot's own file) vendored and baked
at build time into a PNG atlas + per-glyph JSON table
(`scripts/fonts/bake-metrics.mjs`, `packages/textscene-core/src/r3f/controls/native/text/`),
committed with a `--check` mode so the artifacts cannot drift from the font, licensed
OFL-1.1 and noticed in `THIRD-PARTY-NOTICES.md`. No worker, no runtime font parse,
byte-deterministic for goldens. Line pitch ceiling-rounds ascent and descent to whole
pixels *independently* before summing (`getLinePitchPx`), matching Godot's TextServer
reading FreeType's pixel-quantized metrics rather than scaling `hhea` directly — a raw
float sum undershoots line pitch by roughly a pixel system-wide.

### One ordered viewport pass driver

`packages/textscene-core/src/r3f/contexts/ViewportPassRegistryContext.tsx` replaces
per-publisher `useFrame` driving (one per `SubViewport` offscreen pass, one for the
native Control-subtree publisher) with a single ordered driver. R3F runs
default-priority `useFrame` subscribers in mount order — parent before child — so a
publisher nested inside another (a `ViewportTexture` sampling a nested `SubViewport`)
rendered one frame stale: the outer pass ran before the inner one it samples had
produced anything that frame. Every pass instead registers `{ dependsOn, render }`;
`orderViewportPasses` topologically sorts dependencies before dependents, and a single
`<ViewportPassOrchestrator>` drives them in that order from one `useFrame`.

A cycle (two passes each depending on the other, directly or transitively) has no
valid render order: the affected passes are simply never driven — their target keeps
whatever it last held, which is what makes the output deterministic frame over frame
rather than flickering — `logger.warn` names the offending sampler once per detected
cycle, and `useViewportPassCycle` lets the consuming surface fall back to its own
placeholder instead of showing a frozen or uninitialised texture. This same registry
is also the seam by which the native Control-only offscreen pass now publishes into
`ViewportTextureRegistry` (ADR-0033), replacing the `<foreignObject>`-based
`rasterizeControlSubtree` DOM rasterizer entirely — no consumer of that registry
changed.

## Known limitation, not a regression

A Control positioned under a `Node2D` ancestor is solved and positioned from its
rect against the *viewport* directly; Godot composes the full CanvasItem transform
chain through every `Node2D` parent above it, so a rotated/scaled/translated `Node2D`
ancestor does not reach a Control beneath it here. The DOM overlay was equally blind
to this (a DOM tree has no concept of a Godot `Node2D`'s transform at all), so this is
unchanged behaviour carried forward, not new fallout from going native — recorded so
it reads as a stated limitation rather than an implied, unearned parity claim.

## Considered options

**Textured quads driven by the same CSS-flavoured layout.** Rejected: it would keep
authoring layout as a CSS approximation while paying the cost of a second geometry
pipeline — neither cheaper nor more faithful than solving Godot's own container math
directly.

**A heuristic canvas/DOM interleaving rule** (e.g. "layer Control subtrees that
precede all world content below the canvas"). Rejected: fixes the one reproduced case
(`demos/2d/pong`) and breaks the moment a Control sits between two `Node2D` siblings —
two rendering technologies cannot share one tree-order draw regardless of the
heuristic.

## Consequences

- `ControlOverlay`, `ControlDispatcher`, `styleBoxToCss.ts`, `imageToDataUrl.ts`,
  `createContainerComponent.tsx`'s CSS flex/grid emission, and the inline-SVG
  `feColorMatrix` modulate filter are deleted, not built upon.
- `verify:2d` (ADR-0024) and `verify:raster` (ADR-0003's 2026-07-29 amendment,
  ADR-0033) retire: the visual-golden harness is now the only rendering gate 2D UI
  needs, since native Controls are renderer pixels like everything else it already
  covers. 2D-UI fixtures join the golden set behind the existing `mode: '2d'` parity
  capture (`scripts/visual/scenes.mjs`) rather than a bespoke DOM-stats harness.
- `CanvasLayer.layer` reaches the canvas draw order for the first time (the Control
  half of issue #358); previously it existed only in the DOM Control registry.
- A `SubViewport`'s Control-only content publishes into `ViewportTextureRegistry`
  from a native offscreen pass instead of a DOM raster; `SubViewport`/
  `SubViewportContainer`/`ViewportTexture` consumers are unchanged (ADR-0033's seam
  held).
- The linter bundle is untouched: `index.linter.ts` never imported `Component.tsx`
  (ADR-0001), so this swap is invisible to `apps/textscene-linter`.
- Non-goals carried forward unchanged: interactivity (hover/pressed/focus states,
  click-element→tree selection) stays deferred, as it was under ADR-0003; loading full
  `Theme` resources stays out of scope (the default theme + `theme_override_*` only);
  bbcode support stays the existing `[b]`/`[i]`/`[color]` subset.

Recorded because the DOM-vs-native choice is hard to reverse (a whole parallel
dispatcher + registry + rect-solve engine), because the CSP finding corrects a
previous ADR's stated rationale, and because the arithmetic behind `renderOrder` and
the no-stencil-buffer finding are exactly the kind of fact a future reader would
otherwise have to rediscover by regression.
