# TextScene Inspector

The shared language for parsing and rendering Godot text-scene (`.tscn`) files with react-three-fiber, across the core library, the VS Code extension and the web previewer. Only concepts specific to this project live here. General programming terms do not.

## Language

### Format & parsing

**TSCN**:
Godot's text scene file format.
A file is a sequence of `[heading key=value]` sections of three kinds: `node`, `ext_resource` and `sub_resource`.
_Avoid_: "scene file", "godot file".

**Node**:
A single entry in a scene tree, with a `type`, `name`, parent path, `properties`, optional `instance` reference and `children`.
The parser emits it as `TscnNode`. The **NodeDispatcher** renders it.
_Avoid_: "element", "entity".

**SceneGraph** (`core/SceneGraph.ts`):
The parsed tree of Nodes for one authored root scene, built at parse time.
The scene-tree builder produces it. Consumers read it from `HierarchyContext`.
_Avoid_: "scene tree" for the data structure. Reserve "scene tree" for the UI panel (`SceneTreeViewer`).

**Live scene tree** (`r3f/liveSceneTree.ts`):
The composed, *runtime* tree the user navigates: the **SceneGraph**'s root Nodes with **PackedScene instancing** folded in (**Instance root merge** plus lazily-loaded sub-scenes) and **GLBSceneRoot** internals descended, in one consistent node-path space with per-sub-scene resource scope — both the **ExtResource** and SubResource pools, so a StyleBox authored inside an instanced sub-scene resolves against that sub-scene's own pool too. Unlike **SceneGraph** (static, parse-time, root-scene only) it depends on the **resource event bus** caches, so it is derived on demand from a cache snapshot. `liveSceneTree.ts` defines the single traversal; the 3D viewport and 2D world (**NodeDispatcher**), the native Control canvas (**ControlCanvasWalker**), the scene tree panel, the inspector resolver (`useLiveNode` → `resolveLiveEntry`), and the cameras/stats panels are its consumers. Every consumer that *renders* a subtree descends this tree — a consumer reading **SceneGraph** children directly sees an instance as a childless node and silently drops everything inside it.
_Avoid_: conflating with **SceneGraph** (the parsed structure) or "scene tree" (the UI panel).

**ExtResource**:
An external file reference, written `ExtResource("id")` and declared by an `[ext_resource]` heading that carries a `uid=` and a `path="res://…"`.
_Avoid_: "asset", "import" (reserve that for the **Import sidecar**, which no scene references).

**Import sidecar**:
The `.import` file Godot writes beside a source asset, recording which importer produced it and with what parameters.
No scene references it. It is found by path convention (`scene.gltf` → `scene.gltf.import`). That is why it is not an **ExtResource**, and why a missing one is an ordinary outcome rather than a **Missing resource**.
_Avoid_: "import file" for the asset itself. Treating absence as an error.

**Project settings**:
`project.godot` at a project's `res://` root: the engine configuration a scene is authored against.
Settings are parsed under the names `ProjectSettings.get_setting()` uses (`[gui]` plus `theme/default_theme_scale` becomes `gui/theme/default_theme_scale`). Like the **Import sidecar** it is found by path convention, so a scene without one renders at Godot's defaults and is never a **Missing resource**. Only settings the previewer honours get a typed reader. Today that is `gui/theme/default_theme_scale`, which scales every metric of the built-in default theme. A node's `theme_override_*` is not scaled, because Godot returns an override as authored.
_Avoid_: "config file" for a `.tscn`. Treating absence as an error. Growing it into a general settings store.

**Asset re-import**:
What this previewer does in place of Godot's import pipeline: it loads the source asset (`.gltf`, `.glb`, `.obj`) and re-derives the scene from it.
It honours a deliberately small allowlist of **Import sidecar** parameters. Godot never loads the source at runtime. It loads a pre-baked artefact under `.godot/imported/`, which is gitignored, binary and hash-named, so a text-scene previewer cannot take it as input. Decision and allowlist: ADR-0028.
_Avoid_: implying we run Godot's importer, or that the source asset is what Godot renders.

**SubResource**:
An embedded resource, written `SubResource("id")` and declared by a `[sub_resource]` heading in the scene's flat internal-resources list.
Meshes, materials, StyleBoxes and collision-shape resources are the common kinds.
_Avoid_: "asset", "inline resource".

**Sub-resource path** (`resources/subResourcePath.ts`):
`res://file.tres::SubId` — Godot's own notation for a **SubResource** of some `.tres` OTHER than the previewed scene, and the one string that makes all three kinds of resource reference interchangeable to a consumer (an **ExtResource** `.tres`; a SubResource of the scene, resolved from its own internal-resources list via `SceneResourcesContext`; a SubResource of a `.tres` the scene pulled in). The WHOLE address is the resource identity — the processor cache key, the in-flight dedupe key, `useResource`'s LRU pin — while its `filePath` half is the only thing the **resource event bus**'s byte layer, a host `ResourceProvider` or a **Dependency hot-reload** ever sees, because only real files can be fetched. A FAILED address is reported under the address, so one can surface as a missing-resources row; the panel normalises to `filePath` before handing a host a **Resource upload** or its removal, that being the key the bytes live under. Consumers hold the address as an ordinary path (`ArrayMeshResource.materialPaths`, `MeshLibraryItem.meshPath`, `ExternalMaterialSlot`'s `path`), which keeps the third kind from being a category any CONSUMER has to know about; a producer minting addresses for a new resource type must still honour the id in its processor's `process()`, declared with `addressesSubResources`. Decision: ADR-0032.
_Avoid_: "composite path"/"synthetic path" (it is Godot's grammar, not an invention); treating it as a filename (nothing may `fetch` one); a per-consumer resolver for the third kind.

**ParsedResource** (`parser/parsedResource.ts`):
The one parsed form every Godot resource serialisation normalises to.
It holds the header type, the ext-resource and sub-resource tables, and the `[resource]` body as raw Godot-text value strings.
It is produced from `.tres` text today. A binary `.res` loader must produce the same shape, which is what lets a **Resource slice**'s decoder stay format-agnostic. Values stay raw strings at this layer. The slice's `decode.ts` owns their meaning.
_Avoid_: decoding values at parse time. A name that bakes the text format into a shape binary files will share.

**UID reference**:
Godot 4's stable `uid://…` identifier.
Every ExtResource in this corpus pairs it with a `res://` path, so path resolution is authoritative and the uid is ignored. Uid-only resolution is unsupported.
_Avoid_: "id" (overloaded with the per-scene resource `id=`).

**Lenient parser** (`TscnParser`):
The recovering parser used for rendering.
It logs issues but emits whatever it can, and preserves unknown Node types through the fallback.
_Avoid_: "the parser" (ambiguous with strict).

**Strict parser** (`StrictTscnParser`):
The validating parser used only for linting.
It reports every syntax and format error as a `ParseError` with line and column. It is a thin adapter over the shared scanning loop, through a **ParseObserver**.
_Avoid_: "validator" (reserve for property validators).

**ParseObserver** (`parser/TscnParserCore.ts`):
The optional hook **seam** (`onError`, `onSectionStart`, `onProperty`) on the single shared scanning loop.
Lenient parsing passes no observer, so recovery behaviour is byte-identical. Strict parsing passes an observer that collects `ParseError`s, runs the heading checks and dispatches property validators. One loop, two adapters.
_Avoid_: "callback API", "strict mode flag".

**Value decoder** (`parser/valueParsers.ts`):
The lenient parser's shared primitives for reading a raw property string into a typed scalar or vector.
`intOr`, `floatOr`, `boolOr`, `enumOr` and `vec2Or` take a fallback and always return. `parseOptionalInt`, `parseOptionalFloat` and `parseOptionalVector2` return `undefined` when the property is absent. The grammar is shared, but the absent/error contract may **fork** per slice: `floatOr` and `intOr` warn then fall back for a scalar with a concrete default, `parseOptionalFloat` and `parseOptionalVector2` return `undefined` for an optional property, and `vec2Or` and `parseColor` keep slice-specific fallbacks. `parseVector2` and `parseVector3` (`parser/vectors.ts`) and the canonical `parseColor` (`utils/colorParser.ts`) all use `FLOAT_PATTERN_SOURCE`, the one float regex. It accepts scientific notation (`1e-05`, which Godot emits) and rejects malformed components outright. One-off structured literals (`Vector2i`, `Rect2`, `frame_coords`) stay in their slice, as do slice-specific fallbacks.
The renderer's grammar is finite by choice. `inf`, `-inf`, `inf_neg` and `nan` are legal TSCN literals. A component that reaches three.js as `Infinity` renders NaN geometry, so the decoders treat one like a malformed value. The linter reads Godot's full tokenizer grammar instead, through `TSCN_FLOAT_PATTERN_SOURCE` (`godot/number.ts`, re-exported by `linter/validators/commonValidators.ts`), which adds those four spellings.
_Avoid_: re-declaring per-node `intOr` or `floatOr` copies. "validator" (that is the strict-linter path). `FLOAT_PATTERN_SOURCE` in a validator (it refuses literals Godot writes).

### Linting

**Diagnostic**:
One linter finding: a **Severity**, a message, the node it concerns, the name of the check that produced it and, usually, a line and column.
Parse-phase findings share the `strict-parser` name.
_Avoid_: "error" for a diagnostic of unknown severity. "issue" (ambiguous with the tracker).

**Validator** (format check):
A per-property format or range check that runs during strict parsing, dispatched by the **ParseObserver**, and inherits down the node base-type chain.
Its **Severity** comes from what the engine does. A malformed value, or a bound the setter enforces, is an error. A bound only the property's editor hint states is a warning (`linter/validators/v/grounding.ts`). What makes a check a validator is that it judges one property's value in isolation. That is the sorting principle for where a new check goes.
_Avoid_: deciding a validator's severity per property rather than from the engine. "validator" for the parser-side **Value decoder**s.

**Lint rule** (semantic check):
A per-node-type check that runs on the parsed scene and matches its node type exactly, with no base-type inheritance.
It is the home for conditions no single property's value settles. Its **Severity** is fixed by the engine (ADR-0032), never chosen.
_Avoid_: bare "rule" for a **Validator**. Expecting base-class inheritance from rules (that is the validators' walk).

**Range advisory** (`linter/rangeAdvisory.ts`):
A **Lint rule** that warns when a single numeric property falls outside a plausible `[low, high]` band: the semantic-warning analogue of a format **Validator**.
The shared `rangeAdvisories` combinator emits it from a per-property table of arms. An arm is a too-high or too-low threshold with its own rule name and message. A too-low arm may carry a `floor` that suppresses it at or below a value. The combinator owns the presence check, numeric parse, NaN guard and comparison, so each rule is a declarative table. Always a warning: an out-of-band value is suspicious, never objectively invalid. Error-severity checks (a zero or negative `zoom`) and cross-field checks (`limit_right` below `limit_left`) are not range advisories.
_Avoid_: modelling cross-field or presence-dependency checks as range advisories (different control flow, not just different data). A range advisory that emits an error.

**Severity**:
One of three levels, each fixed by what the engine does with the value (ADR-0032, `severityFixedBy`), never chosen per rule.
An **error** means Godot refuses or alters the value, cannot load the file, or a rule threw and the run cannot vouch for the file. An error fails the CLI and CI, and no committed fixture may carry one. A **warning** means the value is legal but suspect. Either Godot's own editor warns about it, or it sits outside the property's editor hint. Or the claim is about the file rather than the engine (a reference that resolves to nothing). An **info** means the value is legal and the engine reads it and leaves it inert (an `engine-inert` grounding). It also covers a finding about this previewer rather than the scene. Warnings and infos are advisory. Healthy scenes and positive fixtures may carry them and nothing fails.
_Avoid_: advisory conditions as errors (breaks fixtureLint). Severity as presentation (surfaces map it, never redefine it).

**Live lint, settled render**:
The cross-host contract: every lint surface describes the text as currently typed, while the rendered scene follows committed text.
The web gutter reads the raw buffer. VS Code's Problems panel re-lints keystroke-debounced. The render follows **Hold-last-valid** in the web and **Save-driven refresh** in VS Code. Diagnostics may be transiently red mid-edit. The viewport never is.
_Avoid_: gating lint on a clean parse (lint must see the broken text). Rendering the raw mid-edit buffer.

**Instance-opaque linting**:
The rule that existence checks (node names, NodePath targets) never assume visibility into an instanced sub-scene's internals.
A reference that crosses an `instance=` boundary stays silent rather than false-positive. The linter reads the static text of one file, never the composed **Live scene tree**.
_Avoid_: "fixing" the silence by resolving instance internals (the linter must stay file-local and React-free).

### Code organisation

**Vertical slice**:
All code for one Node type co-located in one folder: parser, linter, formatter, render component and tests.
_Avoid_: "module" (reserve for the architecture sense), "feature folder".

**Resource slice**:
All code for one resource type co-located in `resources/<category>/<type>/`: the resource-side sibling of the **Vertical slice**.
A slice carries a registration object declaring the TSCN type names and file extensions it claims plus its bus tag, a `types.ts`, and co-located tests. Two kinds share one contract. A Godot-text slice adds a pure `decode.ts` (a **ParsedResource** section to typed Data) and, where THREE construction exists, a `build.ts`. A foreign-format slice (GLB, images, the **Import sidecar**, **Project settings**) declares its real parser instead of faking that split. One decoder per type: hosts may keep two appliers over it, and the decode never forks (ADR-0031).
_Avoid_: "processor" for the slice (the processor is the loading-side adapter that feeds it). A hollow `decode.ts` on a foreign format. Value-shape sniffing a property bag.

**React-free linter boundary**:
The invariant that the linter bundle never transitively imports React or THREE.
`linter/index.ts` imports only each slice's `index.linter.ts` entry point, which imports `linterParser.ts` and `linter.ts`, never `Component.tsx`. A **conformance guard** checks the import graph.
_Avoid_: "linter isolation" used loosely. This is a specific import-graph constraint.

**Slice entry points**:
The three thin registration files per slice.
`index.ts` registers the parser and formatter and never re-exports the component. `index.linter.ts` registers validators and lint rules and imports only `.ts`. `index.r3f.ts` registers the render component and is the only file allowed to import `./Component`.
_Avoid_: "barrel" for these. Reserve "barrel" for the aggregating files that collect them: `parser/TscnParser.ts`, `r3f/nodes/index.ts`, `linter/index.ts` and `resources/sliceRegistrations.ts`.

**NodeRegistry**:
The parser-domain singleton mapping `typeName` to `{typeGuard, parser, propertyFormatter}`.
Side-effect imports in `TscnParser.ts` populate it.
_Avoid_: "parser registry" loosely.

**NodeComponentRegistry**:
The render-domain singleton mapping `typeName` to a React component.
Side-effect imports in the R3F barrel populate it. `NodeDispatcher` consults it and renders `GenericNodeFallback` when a type is absent.
_Avoid_: "renderer registry".

**ControlComponentRegistry**:
The 2D-UI analogue of NodeComponentRegistry, mapping a Control `typeName → native (WebGL canvas) painter component`; kept separate so the 3D registry stays THREE-typed. A type with no registration draws as `ControlFallback` — an outline at its solved rect — rather than nothing.
_Avoid_: "UI registry"; "DOM component" (there is no DOM path left to register into).

**Seam**:
The place where a module's interface lives, so that behaviour can change behind it without editing the callers.
Two adapters make a seam real. One adapter makes it hypothetical. Examples: the **ParseObserver** (lenient and strict parsing over one loop), the **Viewport mode** context (3D canvas or 2D stage) and `SceneResourcesContext` (ADR-0009).
_Avoid_: "boundary" (overloaded with bounded contexts). Introducing a seam nothing varies across.

**Depth**:
How much behaviour a caller or test can exercise per unit of interface it has to learn.
A module is deep when a large amount of behaviour sits behind a small interface. Deepening moves logic scattered across callers behind one interface, so change, bugs and tests concentrate in one place. ARCHITECTURE.md tracks deepening candidates.
_Avoid_: bare "depth" for a dependency-chain distance or a test suite's size (qualify those). Measuring depth as implementation lines over interface lines.

**Conformance guard**:
A test that walks a registry or scrapes source so that every registered thing carries the shape it promised.
`barrelCompleteness`, `parserBarrelCompleteness`, `resourceSliceConformance`, `baseChainCompleteness`, `reactFree` and `noDependencies` are the idiom. Its failure list is the work list, so the guard is written before a sweep, not after. A green guard proves only what it scraped, so its subject count must be measured against the possible subjects, never assumed.
_Avoid_: a per-slice test as a substitute (it imports its own slice, so it cannot see a barrel that forgot it). "coverage" for a guard.

### Rendering

**NodeDispatcher**:
The recursive walker that turns SceneGraph root Nodes into a react-three-fiber tree.
It wraps each Node in a pickable `<group>` and injects instanced-scene children.
_Avoid_: "renderer".

**ControlCanvasWalker** (`r3f/controls/native/ControlCanvasWalker.tsx`):
The native analogue of NodeDispatcher for Controls — recursively walks a Control subtree (`buildSolveTree`'s live-tree walk into a `SolveNode` forest), runs the **Control rect solve** over it, and emits one named `<group>` per Control at its solved rect (Godot pixels, +Y down, negated once to three's `-y`). A registered `Native` painter (**ControlComponentRegistry**) draws the node's own chrome; `ControlFallback` draws an outline at the solved rect when none is registered. Children render as solved siblings of the painter, never as its React children — the rect solve already gave every child an absolute, parent-relative rect, so no painter arranges its own children. Superseded the DOM-emitting `ControlDispatcher` at cutover (ADR-0037, superseding ADR-0003).
_Avoid_: "UI renderer"; "ControlDispatcher" for current code (retired term — see Flagged ambiguities); assuming a painter positions or arranges its own children.

**Control rect solve** (`r3f/controls/native/controlRectSolver.ts`):
The two-phase pass that computes every Control's `Rect2` before anything paints: bottom-up `get_combined_minimum_size` (a widget's own minimum, `custom_minimum_size`-floored, merging upward through nested containers), then top-down `fit_child_in_rect` (a free/anchored Control resolves against its parent's rect — the viewport for a root — while a container child resolves through that parent's registered `ContainerLayoutFn`). Pure TS, framework-free, ported line-by-line from Godot 4.6.3's `scene/gui/control.cpp`. Runs once per generation over the whole `SolveNode` forest (`buildSolveTree`); **ControlCanvasWalker** is its only caller (ADR-0037).
_Avoid_: "layout solve" — **layout_mode** and its `ContainerLayoutFn` registration (`controlSolverRegistry`) already name a different axis (free vs anchored vs container-managed); this is the rect arithmetic that axis feeds into, not the classification itself.

**Painter view** (`r3f/controls/native/solveTree.ts`'s `painterView`/`PainterView`):
The properties a native Control painter may see: everything its node carries MINUS `modulate` and `selfModulate`. Both fields do exist on the Control — **ControlCanvasWalker** has simply already consumed them (`modulate` folded into the ambient `Modulate2DContext` it wraps the painter in, then `self_modulate` folded onto that as the `tint` prop it hands the painter), so a painter re-reading either would apply it a second time and square it. `painterView<T>(solveNode)` returns a real shallow copy with the two keys rest-destructured out, so a helper handed the whole object cannot find either even by name; a module-level `WeakMap` keyed on the property bag allocates that copy once and hands the same object back on every later call, which is what painters memoizing on props identity need. The BAG keeps both fields — the walker and the solvers read them there through `controlProps` — so `solveNode.node.properties` is still a way around the view, and `painterViewConformance.test.ts` is what closes it, forbidding the spelling anywhere under `nodes/2d/ui` or in a painter outside it (ADR-0037).
_Avoid_: "the painter's props" for this (a painter also takes `rect`/`tint`/`renderOrder`/`theme`/`meta` — this term is only the node's property bag); calling it a subset of the node's DATA (the node has both fields; the painter is what may not see them).

**Solve handoff** (`r3f/controls/native/solveHandoff.ts`):
What a Control's solver computes and hands to its painter rather than either recomputing it. Which of the two forms a slice uses is decided by one question — does the computation read `SolveContext` beyond `theme`? A **share** does not: it reads only the node and the theme, so it is not solve output at all, and the solver and the painter both call one computation memoised per `(SolveNode, theme)`. The theme half of that key is load-bearing: `theme` is not a dependency of `buildSolveTree`'s tree memo, so a `SolveNode` survives a theme change and an unguarded memo would serve a stale answer. A share must also read neither `n.children` (which `sortableView` copies, so the solve and the paint would see different lists) nor `ctx.tentativeRect`/`ctx.combinedMinimumSize` (which differ between the two passes a `registerSizeDependentMinimum` type forces) nor `ctx.measureText` (a READINESS gate whose answer differs between solve and paint — it stays in the solver wrapper, around the call, while the share itself is the unconditional computation the painter already performs). A share's callback is handed a `ShareNode` and no `SolveContext` at all, so the child list is a type error and the three `ctx` reads are out of scope; `solveHandoffConformance.test.ts` is what closes the ways around both. A **channel** is the other form: a value that genuinely is solve output, sealed by the producing `ContainerLayoutFn` and opened by the painter against the same module-level channel object, so reference equality proves the value's provenance rather than merely its shape.
_Avoid_: "meta" for either form (the retired name — its vagueness is what let one `unknown` field carry two unrelated things); "cache" for a share (it is the only computation, not a copy of one); memoising a channel value across solve passes.

**Canvas paint order** (`r3f/canvasPaintOrder.ts`):
Where a canvas item draws in the 2D canvas, as Godot decides it: `(canvas layer, z_final, draw sequence)`, in that precedence. An item's node TYPE is in none of it — a Control and a Sprite2D are both CanvasItems and interleave purely by this key, so "UI draws over the world" is a convention of how scenes are authored, never a rule. Packed into one integer on each item's wrapper group; the pixels inside are ordered among themselves by their own `renderOrder` (ADR-0036).
_Avoid_: "z order" / "z offset" — draw order costs no depth at all, and the fractional-z scheme those words named is retired; **z_final** is only one term of the key.

**Draw sequence**:
An item's position in Godot's single pre-order walk of the canvas — the third and weakest term of **canvas paint order**. Tree order, except that `show_behind_parent` children are visited before their parent and a y-sorted subtree is visited in its sorted order. Handed out as contiguous RANGES, one per subtree, which is what lets the y-sort pass reorder the items it collected by re-packing its own range alone.
_Avoid_: "paint index" (retired term — it counted Controls only, and could not be compared against world content).

**Viewport mode**:
The single `'2D' | '3D'` display state of the center viewport — `3D` mounts the R3F canvas, `2D` mounts the pannable 2D stage (project-viewport frame + the 2D world canvas, which composites the 2D world and every Control/CanvasLayer subtree as canvas items in one Godot-tree-order draw); chosen by an auto-default heuristic on the scene root type, overridable by the toolbar toggle.
_Avoid_: "2D mode" alone (it is one of two values of one state).

**Sub-viewport**:
Godot's `SubViewport` Node — a **canvas boundary, not a world boundary**. It always owns its World2D, so its CanvasItem descendants (2D world *and* Control UI) draw nowhere in the parent; it *shares* the parent's World3D unless `own_world_3d`, so its Node3D descendants draw in the parent's 3D view exactly as through a plain `Node`. Draws nothing itself. Always written hyphenated in prose to keep it distinct from **Viewport mode** (ADR-0033).
_Avoid_: bare "viewport" for the Godot node (that is the previewer's centre panel); "offscreen subtree" as if the whole subtree were hidden — only the canvas half is.

**Viewport surface**:
What displays a **sub-viewport**'s render target: a `SubViewportContainer`, or a `ViewportTexture` consumer.
It is the one place a sub-viewport's canvas subtree is dispatched. The parent's own walkers stop at the boundary. A surface is also the single exception to "the 3D workspace drops CanvasItem subtrees", since a contained sub-viewport's 3D content still shares the parent world.
_Avoid_: "viewport container" for the concept (that is one implementation of it). "render target" for the surface (the target is what it displays).

**ViewportTextureRegistry**:
The `nodePath → { texture, size }` lookup a **sub-viewport** publishes its rendered target into, and every **viewport surface** and `ViewportTexture` consumer resolves against. The same two-context shape as the **AnimationDriverRegistry** (stable register fn, reactive map) because it is the same problem: a node publishing something others resolve by NodePath. Every kind of content — 3D, 2D-canvas, and a Control-only subtree's own native offscreen pass — publishes the same WebGL texture, sampled directly by every consumer, so none of them ever learns which kind produced it.

**ViewportPassRegistry**:
The pass-ordering half of the same seam (`ViewportPassRegistryContext.tsx`): a sub-viewport's offscreen render (3D/2D content, or the native Control-raster pass) registers `{ dependsOn, render }` rather than driving its own `useFrame`. One `<ViewportPassOrchestrator>` per canvas topologically sorts every registered pass (`orderViewportPasses`, dependencies before dependents) and runs them in that order each frame — nesting no longer costs a frame of latency the way per-publisher `useFrame` mount-ordering did. A pass whose dependency chain is unsatisfiable (a cycle) is simply never driven; `useViewportPassCycle` lets a consumer (the native `SubViewportContainer` surface) fall back instead of sampling a frozen texture, and the registry itself `logger.warn`s the offending path once.
_Avoid_: treating it as a resource cache (it is keyed by node path, not by `res://` path, and its value depends on the scene tree rather than a file).

**layout_mode**:
The Godot Control property recording how a node is positioned — `0` free position, `1` anchors, `2` container-managed (the parent lays out the child; anchors ignored); in this corpus `2` is the majority. The **Control rect solve** does **not** branch on this field, though: it is parsed into `ControlProperties.layoutMode` but left unread, and the free-vs-container decision is made structurally from whether the parent has a registered `ContainerLayoutFn` (`controlSolverRegistry`) — a Control is container-managed iff its parent is a layout container.
_Avoid_: treating anchors as the primary path; saying the solve branches on `layout_mode` (it branches on the parent's `ContainerLayoutFn` registration).

**Anchor / offset**:
Godot Control layout properties (`anchors_preset`, `anchor_*`, `offset_*`, `grow_*`) decoded via the full LayoutPreset 0..15 table (`PRESET_ANCHORS`) into a `Rect2` — plain `x`/`y`/`w`/`h` numbers, by the **Control rect solve** — rather than a CSS position string; applied when the **parent has no registered `ContainerLayoutFn`** (a top-level root, or a child of a plain Control/Panel/CanvasLayer rather than a layout container), whose children resolve through that function instead.
_Avoid_: "margin" (reserve for `MarginContainer`, which insets a rect rather than anchoring one); gating this on the child's `layout_mode` value (the gate is the parent's registration); CSS `calc()`/absolute-positioning language.

**StyleBox**:
A Godot Control theme resource (`StyleBoxFlat` / `StyleBoxEmpty`) defining background/border/corner-radius — resolved to a typed `StyleBoxFlatData` (`parseStyleBox.ts`) and drawn as a hand-tessellated, vertex-coloured mesh (`styleBoxFlatGeometry.ts` + `StyleBoxQuad`): fill, per-corner radii, per-edge borders and `border_blend` all realised in geometry and vertex colour, ported from `StyleBoxFlat::draw` (Godot 4.6.3, `scene/resources/style_box_flat.cpp`).
_Avoid_: "style"; CSS `background`/`border`/`border-radius` language.

**Program input** (`r3f/materialProgramInputs.ts`):
A material prop that decides WHICH PROGRAM a material draws with, rather than what that program is handed per draw — texture-slot presence, `defines` (keys *and* values), `side`, the `opaque` composite, `vertexColors`, the physical `> 0` thresholds, an injected shader patch's cache-key contribution. The concept is Godot's own, ported: `BaseMaterial3D::MaterialKey` packs exactly the terms that change the emitted shader, and `_update_shader` looks the packed key up in a shared `shader_map`. three decides the same thing in `WebGLPrograms.getParameters()`, once, at a material's first compile, and `WebGLRenderer.setProgram()` re-derives only on a `material.version` move or for the short list it re-checks itself — so assigning a program input to an already-MOUNTED material, which is what a re-parse does with the dispatcher keying a node on its name, changes the material and not the shader, silently and for the rest of the session. The two keys run OPPOSITE ways: Godot's shares one compiled shader among the materials that agree, ours separates one material from its own past self by remounting it. Two owners, deliberately separate: **materialBag.ts** derives a StandardMaterial3D's class and props once for both adapters, and `materialProgramInputs()` merges whatever bag it is given with the shared blend/facing/lighting recipes and derives the React remount key from the RESULT — so the key and the material cannot describe different programs, and a shader patch cannot travel without the cache-key contribution that identifies it. The contrast is a **uniform** — a colour, an opacity, a texture swapped for another texture — which a mounted material may change freely and which must therefore stay OUT of the key, since remounting for one throws a program away for nothing (ADR-0038, ADR-0039).
_Avoid_: bare "key" for either half of this (see Flagged ambiguities); "recompile" for what is a React remount onto a fresh material; calling `alphaTest`, `blending` alone or `numClippingPlanes` program inputs of *ours* (each self-heals or is re-checked upstream — `materialProgramInputs.ts` states why, per field); reading Godot's key as a shared program cache we also have.

**Collision-shape resource**:
A `[sub_resource]` carrying collision geometry: `BoxShape3D` (`size`), `ConvexPolygonShape3D` (`points`), `ConcavePolygonShape3D` (`data`).
Distinct from the **CollisionShape3D** Node that references one through a `shape` property.
_Avoid_: conflating the Node with the resource. "collision mesh".

**Collision gizmo**:
A toggleable wireframe rendering of a CollisionShape3D's collision-shape resource in the 3D viewport.
Off by default. The viewport-mode context's `showCollisions` flag drives it.
_Avoid_: "debug shape".

**CSG root**:
The `CSGShape3D` whose direct parent is not a `CSGShape3D`: the only node in a CSG subtree that produces a drawn mesh (ADR-0027).
_Avoid_: "CSG parent", "combiner" (`CSGCombiner3D` is one kind of root, not the definition).

**Geometry contributor**:
A CSG node inside a **CSG root**'s subtree.
It is a **transform-only group** that draws nothing itself but supplies its own solid, and its `operation`, to the root's boolean result.
The second invisible-but-not-inert role, alongside the **AnimationPlayer** as animation driver.
_Avoid_: "brush" (reserved for the `three-bvh-csg` type). "child shape".

**Contribution**:
One **geometry contributor**'s solid, baked into CSG-root-local space, carrying its `operation` and its material.
Distinct from `three-bvh-csg`'s `Brush` (the library type we construct from it) and from Godot's `CSGBrush` (the engine face soup our normal algorithm is ported from). Three referents that would otherwise share one word in the same files.
_Avoid_: "brush".

**CSG plan**:
The pure, React-free description of a **CSG root**'s subtree: contributions in evaluation order with matrices, operations, materials and a cache key.
`evaluateCsgPlan` consumes it.
_Avoid_: "CSG tree" (collides with the scene tree).

**CSG-as-primitive**:
The named degraded fallback when boolean evaluation is unavailable: each CSG node draws its own base geometry and `operation` is ignored.
It happens when the CSG library fails to load or the evaluator throws. ADR-0027 supersedes ADR-0004, which once made this the intended behaviour.
_Avoid_: using it to describe intended behaviour.

**Transform-only group**:
A node rendered as an invisible `<group>` that positions its children but draws nothing itself.
This is the render intent for every non-visual type. Physics bodies (`StaticBody3D`, `RigidBody3D`, `CharacterBody3D`, `Area3D`), `Skeleton3D`, `Path3D` and `PathFollow3D`, the `Node3D` and `Node2D` bases, and the fallback for unsupported types all take it. No simulation, and no geometry of its own that it draws (ADR-0005, ADR-0008). A **geometry contributor** is the one kind that has own geometry. It still draws nothing, because its **CSG root** consumes its solid (ADR-0027).
_Avoid_: "physics body" implying simulation. "transform container" (collides with Godot's Container Controls). "placeholder" (there is no visible grey-box placeholder, ADR-0008).

**Render intent**:
Which of the two render outcomes a node type takes — a *visible renderer* (draws geometry/text) or a *transform-only group* (invisible, positions children). "Renders nothing" is an explicit intent, not an unregistered accident; in-viewport text and collision shapes are opt-in toggles (`showLabels`, `showCollisions`) on the viewport-mode seam (ADR-0006, ADR-0008). Three invisible roles are **not** inert: the **AnimationPlayer** draws nothing itself but *drives* sibling objects, a transform-only group that is also an **animation driver** (ADR-0011); a **geometry contributor** draws nothing itself but supplies its solid to its **CSG root** (ADR-0027); and a **sub-viewport** draws nothing itself but *hosts* — scoping its canvas subtree to a **viewport surface** while its 3D subtree stays in the parent world (ADR-0033). All three are roles layered onto the second outcome, not a third outcome.
_Avoid_: "placeholder", "not implemented" — an invisible node may be fully intended; "inert" for AnimationPlayer, a geometry contributor, or a sub-viewport.

**Pending** (render intent):
A node type that is parsed and lint-checked but not drawn yet.
It registers under its base with `renderIntent: 'pending'`, so `visible` and workspace placement survive, and its sheet status is `unimplemented`. It is the one intent that names unfinished work. The `useResource` load status of the same name is a different thing: a resource whose load has not resolved.
_Avoid_: bare "pending" for a resource load (say "load pending"). An unregistered type as a stand-in for pending.

**Editor cursor** (`r3f/godotEditorCursor.ts`):
Godot's `Cursor`: an orbit focus point plus the pitch, yaw and radius of the eye around it.
Every 3D navigation gesture edits it.
The camera transform is rebuilt from it rather than steered directly, which is why orbiting, panning, zooming and freelook compose without drift. Immutable: a gesture is `(cursor, deltas) -> cursor`.
_Avoid_: "camera state" (the camera is derived from the cursor, not the source of it). "orbit target" for the whole cursor (the target is one of its four fields).

**Preview sun**:
The stand-in directional light this previewer supplies so a scene with no light of its own is not a black void.
It is Godot's editor preview sun, with Godot's values. It **yields**: a scene containing any `DirectionalLight3D` gets none. It is not part of the scene, and the running game never renders it (ADR-0025).
_Avoid_: "default light", "fill light" (both hide that it reproduces a specific Godot object that disappears under a specific condition).

**Preview environment**:
The stand-in **WorldEnvironment** this previewer supplies: Godot's editor preview environment, a procedural sky that is both the background and the scene's ambient light.
It yields independently of the **Preview sun**: a scene containing any `WorldEnvironment` gets none, whatever that environment emits (ADR-0025).
_Avoid_: "default environment", "skybox". Treating it as coupled to the **Preview sun**. The two yield separately, and a scene routinely has one and not the other.

**Yield** (of preview lighting):
What a preview element does when the scene supplies its own: it is not mounted at all.
Keyed on the presence of a node type anywhere in the **Live scene tree**. Whether that node is visible, enabled or contributes any light never matters.
_Avoid_: "override", "fallback". Nothing is layered or blended. The preview is present or absent.

**Sky ambient**:
The illumination a sky background contributes to everything in the scene.
In Godot it is a radiance map, so it lights surfaces and is what they reflect, not a directionless constant. Distinct from a flat ambient colour, which is what `AMBIENT_SOURCE_COLOR` specifies.
_Avoid_: "ambient light" alone for the sky case (loses the reflection half). "IBL" in user-facing text.

**Resource event bus** / `useResource`:
The async resource pipeline.
A render component calls `useResource(path, type)`, the host `ResourceLoader` fetches, and a `loaded` or `missing` event resolves the hook. It backs textures, GLB meshes and PackedScene instancing.
_Avoid_: "asset loader" (reserve `ResourceLoader` for the host implementation).

**PackedScene instancing**:
A Node with `instance = ExtResource("scene_id")` whose referenced `.tscn` or `.glb` is loaded and composed into the host tree.
A single-root `.tscn` is folded in through **Instance root merge**. A `.glb`, or any multi-root scene, is injected as children under a nested resources provider.
_Avoid_: "include", "prefab".

**Instance root merge** (`mergeInstanceRoot`, applied through `collapseLiveNode`):
The collapse of the redundant wrapper level for a single-root `.tscn` instance: the instance Node becomes the sub-scene's root.
It adopts the root's `type` and `children` and merges the root's parsed `properties` under the instance's own overrides. The instance wins per key, so the instance `transform` replaces the root's, matching Godot. The instance ref is kept, so the row still carries the 📦 badge and the ⤢ open-standalone affordance. The collapse decision is the shared `collapseLiveNode` in the **Live scene tree** module, wrapping `mergeInstanceRoot` over a `singleSceneCache` of the just-loaded sub-scene. The tree (`TreeNode`), the viewport (`NodeDispatcher`), the inspector (`useLiveNode`) and the panels all call it rather than re-deriving the decision, so node paths stay consistent. `collapseLiveNode(node) !== node` exactly when a merge happened. Skipped for `.glb` synthetic-root instances (`GLBSceneRoot`) and any scene with multiple top-level nodes, which take the nested-injection form.
_Avoid_: "wrapper node", "prefab flattening", "compose" for the transform (it is a replace). Re-deriving the merge decision in a consumer instead of calling `collapseLiveNode`.

**Sprite-frame composition** (`r3f/spriteFrame.ts`):
The shared region_rect plus hframes/vframes UV maths for SpriteBase nodes.
Godot computes a base rect (the region when enabled, else the full texture) and then subdivides it by the frame grid. `composeFrameTexture` windows a texture clone's UVs to the current frame. `frameSizePx` returns the frame's pixel size. Flip handling and world sizing stay per slice. Sprite2D mirrors through mesh scale at 1 px = 1 unit. Sprite3D mirrors through UV negation and scales by `pixel_size`. The wrap mode (`SpriteWrapMode`, a required argument) stays per slice too. Godot never clips an oversized `region_rect`. Neither the region nor the quad shrinks and the UVs leave the texture, so only the sampler decides the overrun. The 2D canvas clamps to the edge texel where Sprite3D's material repeats.
_Avoid_: re-inlining region or frames maths in a sprite slice (hand-syncing is how the two diverged). Defaulting the wrap mode (a default is how the 2D and 3D samplers diverge silently). "clip" or "crop" for an oversized region (Godot does neither).

**Stated-consumer-default wrapping**:
The rule that a shared texture's wrapping is chosen by each consumer at bind time, never by the loader.
The loader (`textureProcessing.ts`) leaves wrapping at three's clamp-to-edge default, because one cached entry serves both a 3D material (Godot's `BaseMaterial3D` constructs with `FLAG_USE_TEXTURE_REPEAT`, so it tiles) and a 2D canvas item (whose `texture_repeat` resolves to the viewport's DISABLED default, so it clamps). `applyTextureState` reads the material's `texture_repeat` and makes the divergence bidirectional: a default material tiles a clamped arrival on a source-shared clone, and `repeat = false` on a tiled entry clamps it back. The panorama sky, sampled with `fract(atan(...))` so u must wrap, states Repeat through the same rule and frees its clone after the cube render. A consumer that binds the shared entry directly (`Decal`, `PointLight2D`) inherits clamp, which is what Godot draws for it.
_Avoid_: setting wrapping in the loader, which cannot know which consumer asks. "The texture repeats" as a property of the image, when it belongs to each consumer's sampler. Mutating a shared cache entry's wrapping in place.

**Synthetic render type**:
A render-only component with no parser and no linter (`GenericNodeFallback`, `GLBSceneRoot`).
Not a user-authorable TSCN type. It lives in `r3f/internal/`, not in a Node slice.
_Avoid_: "default node".

### Shell & editing

**Source pane**:
The web previewer's editable `.tscn` text view, a left sibling of the preview shell, never inside it.
It holds the single editable buffer, fed three ways: fixture select, file upload, or direct paste and typing. That buffer is the source of truth for the **Linter**, surfaced as gutter markers with a hover popover. It is also the source for the shell's rendered scene, gated on a clean **Lenient parser** result (**Hold-last-valid**). Edits are ephemeral and leave the browser only through a "Download .tscn" export. Nothing is written back to disk. A browser reload resets silently. An in-app one-click scene replacement (fixture palette, ⤢ open-sub-scene, scene-replacing drop or upload) of an edited buffer confirms before discarding (ADR-0020).
_Avoid_: "code editor", "Monaco", "CodeMirror" (it is a bare `<textarea>` with no editor library). Conflating it with the **SceneTreeViewer** panel or with the VS Code extension's own text editor.

**Host (app)**:
An embedding application that mounts the shared preview shell over its own resource loader and source-text feed.
It is the web previewer, or the VS Code extension.
Always distinct from VS Code's own "extension host" process, which is always qualified.
_Avoid_: bare "host" for VS Code's extension-host process. Bare "frontend" or "app".

**Hold-last-valid** (web):
The **Source pane**'s edit gate: the viewport keeps rendering the last cleanly parsed buffer while mid-edit text is transiently broken.
Brokenness shows as gutter markers, never as a blanked scene, because the **Linter** reads the raw buffer ungated. The gate applies to the edit loop only. Fixture loads and uploads forward ungated, so a broken file surfaces its parse-error banner.
_Avoid_: "debounce" for the gate (the debounce is timing, the gate is parse cleanliness). Gating the linter (it must see the broken text).

**Preview panel** (VS Code):
The per-document webview the extension opens beside the editor: one per `.tscn` document, pinned to it.
Re-invoking reveals the existing panel. It does not retarget when a different `.tscn` gains editor focus, because big scenes are expensive to render (ADR-0023). It keeps its scene state while hidden. It is the VS Code **Host**'s counterpart of the web shell.
_Avoid_: "preview tab". Bare "webview" (the mechanism, not the user-facing thing). Markdown-preview-style follow mode (rejected, ADR-0023).

**Save-driven refresh** (VS Code):
The **Preview panel**'s update contract: it mirrors the file on disk (ADR-0021).
It refreshes on save and on external disk changes such as a git pull or a branch switch, never on unsaved keystrokes. Keystroke-live preview is the web **Source pane**'s job. A refresh is in place: re-parse and reconcile, so camera, selection and tree expansion survive by node path. A path the refresh removed clears its selection gracefully (the inspector empties, any active **Animation transport** stops) rather than erroring.
_Avoid_: expecting Source-pane-style live typing in the **Preview panel** (a deliberate asymmetry). "reload" for what is an in-place refresh.

**Dependency hot-reload** (VS Code):
A disk change to a dependency refreshes just that resource in every open **Preview panel** that ever resolved it.
A dependency is a texture, a `.tres` material, a GLB or glTF, or an instanced sub-scene. The closure is transitive, at any dependency depth, because every resource a panel renders passes through its own provider. It is relevance-gated, with no full scene refresh. A resource that failed to load still counts as relevant, so creating a **Missing resource**'s file heals it. Hidden panels refresh in the background rather than on re-focus. Distinct from **Save-driven refresh**, which covers the panel's own main scene.
_Avoid_: "HMR". Conflating with the main scene's **Save-driven refresh**. "direct dependencies" (the closure is transitive).

**Progressive fill-in**:
How both **Host**s' screens update after a parse: the scene renders immediately from the parsed text, then resources pop in one by one.
Textures, materials, GLB meshes and sub-scenes each arrive as their **resource event bus** load lands. A failed load flips only its consumers to the magenta missing placeholder. The screen never blocks on, or wholesale-reloads for, resource completion.
_Avoid_: loading-screen framing. Treating a missing resource as a scene error.

**Corpus root** (web):
The active fixture's `res://` namespace.
Each vendored demo project keeps its own. Resource lookups are scoped to it, and switching corpora must never serve the other corpus's bytes for a same-named `res://` path. **Resource upload**s are scoped the same way. They are stored under the corpus root active when added, so an upload made in corpus A is invisible in corpus B. An **Uploaded scene** lives in its own base ('') corpus, so uploading a scene starts the user's own working corpus rather than patching the fixture's.
_Avoid_: "fixture folder" (the root scopes resolution, not just storage). Sharing one resource cache across corpora. Global uploads that shadow every corpus.

### Content intake (web)

**Fixture**:
A built-in scene the web previewer ships as a static file: the demo, test and showcase corpus.
It covers vendored Godot demos and games, examples, edge cases, and the unit fixtures the test suites also exercise. Fixtures exist to feed the tests and to show what the previewer can do. There is no backend. The web build copies the fixture corpus from `scenes/` into `apps/textscene-web/public/fixtures`, and the extension reads files from the workspace.
_Avoid_: "sample", "template". Calling anything user-provided a fixture.

**Fixture catalog**:
The browsable, categorised manifest of every **Fixture**, generated by `pnpm generate:fixtures`.
The optional vendored games corpus appends when present. All kinds stay browsable: unit and edge-case fixtures double as a node-coverage showcase. Deep links may reach unlisted sub-scenes, whose **Corpus root** derives from the path.
_Avoid_: "scene library". Curating unit fixtures out of the public catalog.

**Uploaded scene**:
A user's `.tscn` opened as the active scene. The selector shows it as "(Uploaded: …)".
Uploads live in the browser only: nothing is sent anywhere or stored (ADR-0022). They reset on scene switch and leave the browser only through the Download export.
_Avoid_: "imported scene". Treating an upload as a **Fixture** (a fixture ships with the app, an upload never does).

**Resource upload**:
A user file fulfilling one `res://` reference, added per path from a **Missing resource** row or matched during **Multi-file matching**.
Browser-only like the **Uploaded scene**, and scoped to the corpus active when it was added. A fixture corpus and the user's own files are separate worlds, so an upload never bleeds into another corpus's same-named path. Removing one flips its consumers back to missing.
_Avoid_: conflating with **Uploaded scene** (one replaces the active scene, the other fulfils a reference the scene made). Global uploads that shadow every corpus.

**Multi-file matching**:
The one-gesture drop or select contract: the root-most `.tscn` in the batch becomes the **Uploaded scene**.
The root-most scene is the one no other dropped scene references. Every other file fulfils a `res://` reference by case-insensitive basename. Files are matched against the scene's ExtResources and the current **Missing resource** list, so a sub-scene's own dependencies arrive by repeated drops. A batch with no `.tscn` fulfils missing rows directly. Files matching nothing are ignored.
_Avoid_: "import wizard". Per-file prompts (the gesture is match-by-name, not a dialog flow).

**Missing resource**:
A `res://` reference whose load failed.
Its consumers show the magenta placeholder (**Progressive fill-in**), and it gains a row (path, type, referenced-by) in the missing-resources panel. A **Resource upload** fulfils the row, and removing that upload returns it to missing. Per reference and recoverable, never a scene error.
_Avoid_: "broken scene", "load error" for a single missing reference.

### Animation

**GodotAnimation**:
One named Godot animation: a `[sub_resource type="Animation"]` carrying `length`, `loop_mode`, `step` and value **Track**s.
It is parsed render-side from the scene's SubResources and built into a `THREE.AnimationClip` for playback.
_Avoid_: "AnimationClip" for the parsed form (reserve `THREE.AnimationClip` for the three.js runtime object). Bare "clip".

**Animation library**:
The `[sub_resource type="AnimationLibrary"]` whose `_data` maps clip names to **GodotAnimation**s.
An **AnimationPlayer** references it through `libraries/<name> = SubResource(...)`. The empty-name default library is written `libraries/`.
_Avoid_: bare "library". The Godot 3 `anims/<name>` inline form (out of scope).

**Track**:
One channel of a **GodotAnimation** targeting `NodePath("Node:property")` with ordered **Keyframe**s (time, value, transition).
`value` tracks drive three ways. Transform properties (`position`, `rotation`, `rotation_degrees`, `scale`) go through the `THREE.AnimationMixer`. A discrete `Sprite2D:frame` (sprite-sheet flipbook) is sampled stepped and pushed through the **AnimatedValue push registry** (ADR-0016). Continuous non-transform properties (`Decal:modulate`, `Decal:size`) are sampled by linear interpolation through the same registry (ADR-0017). The mixer binds transforms only, so anything React-derived is sampled at the playhead and pushed to the target. Other track types (`bezier`, `method`, `audio`, `animation`) and unwired properties parse but do not drive.
_Avoid_: "channel".

**AnimatedValue push registry** (`r3f/contexts/AnimatedValueContext.tsx`):
The ref-backed registry through which the active **AnimationPlayer** pushes sampled non-transform **Track** values to their target component.
It is the value-push lane for everything the `THREE.AnimationMixer` cannot bind, since the mixer drives transforms only. Keyed by `${nodePath}:${property}`, so one node animates several properties at once. The target overrides its authored value while a value is pushed and reverts on release. Discrete `frame` is sampled stepped. Continuous `modulate` and `size` are linearly interpolated (ADR-0016, ADR-0017).
_Avoid_: "AnimatedFrame registry" (the `frame`-only form). "mixer" or "central value context" for this path (it is a narrow per-target push, not a tree-wide per-frame recompute, ADR-0011).

**Animation transport**:
The play, pause and scrub state (`AnimationTransportContext`) and its dock-tab UI, bound to the driver currently selected in the scene tree.
A driver is an **AnimationPlayer**, **GLB animation driver**, **AnimatedSprite2D** or **AnimationTree driver**. Selection-driven, one driver at a time, mirroring the Godot editor's Animation panel. It drives the selected node's `THREE.AnimationMixer`. For **AnimatedSprite2D** it advances the displayed frame through `frameAtTime` instead, with no mixer (ADR-0015). It starts stopped, with the authored pose or frame preserved. Play is user-initiated. The tab is shown only while a driver is selected. Deselecting, or selecting a different node, stops playback and restores the authored pose.
_Avoid_: "scene-level transport" (it follows selection, not the whole scene). "timeline" or "player controls" for the whole transport (reserve "timeline" and "scrubber" for the seek widget).

**RESET animation**:
Godot's conventional rest-pose animation, named exactly `RESET`: one keyframe per animated property at t=0 holding its default value, used by the editor for reset-on-save.
It is listed in the clip selector like any animation but skipped when the **Animation transport** picks its default selection. `defaultClip` prefers the `autoplay` clip, else the first non-`RESET` clip. `RESET` becomes the default only when it is the sole clip.
_Avoid_: treating `RESET` as an ordinary playable clip.

**Animation root** (`root_node`):
The THREE object a clip's **Track** NodePaths resolve against and the **AnimationPlayer**'s mixer is rooted on. Default `..`, the player's parent node.
`THREE.PropertyBinding` resolves a Track's target by name through the dispatcher's unnamed pickable wrappers. The named, transform-bearing object the binding finds is the one the mixer overrides.
_Avoid_: "target root".

**GLB-embedded clip**:
An animation authored inside a `.glb` or `.gltf` and surfaced as a ready-made `THREE.AnimationClip` straight from the glTF loader.
Never a **GodotAnimation**: there is no `[sub_resource type="Animation"]` text form and no **Track** parsing of ours. These are the clips a Godot GLB import would carry on the model's own AnimationPlayer node.
_Avoid_: "GodotAnimation" for these (reserve that for the SubResource form). Bare "imported animation".

**GLB animation driver**:
A **GLBSceneRoot** acting as an animation driver.
Godot's glTF importer exposes a model's clips on an AnimationPlayer node inside the imported hierarchy. The tree therefore synthesises a tree-only `GLBAnimationPlayer` row: a selectable node with no parser and no render component. When that row is selected, the GLBSceneRoot component registers the GLB's **GLB-embedded clip**s with the **Animation transport**. It runs a `THREE.AnimationMixer` rooted on the loaded GLB object itself. There is no **Animation root**, because the clips are already bound to the GLB's own node names. It is the GLB counterpart to an **AnimationPlayer**: the same selection-driven transport and shared `usePlaybackLoop`, a different clip source and mixer rooting (ADR-0014).
_Avoid_: "GodotAnimation" for these clips. Treating the synthesised `GLBAnimationPlayer` row as a real **AnimationPlayer** Node, or as the thing that renders (the GLBSceneRoot component does both the driving and the rendering). Saying the GLB root row activates the transport (its synthesised `GLBAnimationPlayer` child does).

**AnimationTree driver**:
An **AnimationTree** acting as a transport driver (ADR-0019). It owns no clips.
It resolves its `tree_root` into an `AnimNode` graph and evaluates that graph at the authored `parameters/*` state into a blend program (`{clip, weight, timeScale}[]`). It resolves its `anim_player` `NodePath` to a driver in the **AnimationDriverRegistry** and drives that driver's object with weighted actions. It processes only when `active = true` and it is the selected node. Godot's game script flips `active` at runtime. A static previewer evaluates the saved state. It has no clip picker, because Godot plays it from parameter state, so it registers a single read-only transport entry (the dominant clip). The runtime blend is approximated: per-bone Blend2 `filter`s are not modelled, and a StateMachine's current state is the authored `current_state`, else the `Start`-transition target.
_Avoid_: calling it an **AnimationPlayer** (it drives one, through `anim_player`). Implying it has a selectable clip list.

**AnimationDriverRegistry** (`AnimationDriverContext`):
The `nodePath` to `{ object, clips }` lookup that an **AnimationPlayer** or **GLB animation driver** publishes into whenever its clips are loaded.
It records availability, decoupled from the selection-driven transport. The **AnimationTree driver** consumes it to find the object to root its blended mixer on and the clips to play. That unifies the two clip sources behind one path lookup. It is two contexts. A stable register function means a publishing driver's effect does not re-fire. A reactive drivers map means a consumer re-renders when an async-loaded driver appears.
_Avoid_: conflating it with the **Animation transport** (the registry is about which driver owns which clips, the transport about play and pause for the selected one).

**Playback step** (`r3f/animation/`):
The pure per-frame transport-actuation decision shared by every **Animation transport** driver.
Its inputs are the previous and current play state, the transport playhead and whether the clip changed. From those it decides which transition fired this frame: ensure-playing, seek, hold-paused, stop-and-restore or none. It also decides whether the driver is freshly re-entering playback (a local clock re-seeds) and whether the pause-edge time flush must fire. Each driver's frame loop is a thin adapter that actuates the decision: single-action mixer, weighted blend program or sprite frame sampling. The decision is written once and tested as data, without a mount.
_Avoid_: re-deriving play, pause, seek and stop edges inside a driver's `useFrame`. "state machine" for the adapters (the machine is the step, adapters only actuate).

**Driver mount** (`r3f/animation/`):
The shared lifecycle by which a clip-owning transport driver (**AnimationPlayer**, **GLB animation driver**) comes online.
It registers clips with the **Animation transport** while selected, publishes `{object, clips}` availability into the **AnimationDriverRegistry**, and builds the `THREE.AnimationMixer` and actions. Clip construction, mixer rooting and pose snapshot and restore stay per driver.
_Avoid_: mounting the **AnimationTree driver** this way (it owns no clips, so it is a registry consumer, not a publisher).

## Relationships

- A **SceneGraph** holds many **Node**s; the active scene's root Nodes feed the **NodeDispatcher** — 3D content always, and the 2D world's CanvasItem content too — while a Control/CanvasLayer subtree, in 2D **viewport mode**, is solved and drawn by the **ControlCanvasWalker** inside that same canvas.
- A **Node** references **ExtResource**s and **SubResource**s by id; the **resource event bus** resolves ExtResources to files. A `.tres` the scene reached may itself reference its OWN SubResources, which the bus resolves under a **Sub-resource path** — fetching the owning file, then building the named body out of it (ADR-0032).
- A **CollisionShape3D** Node references one **collision-shape resource**; the **collision gizmo** reads the latter through the former.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) are keyed by the same `typeName` but kept separate to preserve the **React-free linter boundary**.
- A unified **vertical slice** exposes its behavior through three **slice entry points**, one per registry domain.
- **Label3D** and **Label** / **RichTextLabel** share one shaping engine and one bundled font, but not one painter: which painter draws a run follows the path Godot's own text server takes for it. Label3D's stroked outline is a real contour a distance field cannot encode, so it rasterises to a `CanvasTexture`; 2D Control text draws the same font from the vendored Open Sans MSDF atlas as glyph-quad geometry (ADR-0040).
- An **AnimationPlayer** references one **Animation library** via `libraries/`; the library's **GodotAnimation**s carry **Track**s that the **Animation transport** plays by building a `THREE.AnimationClip` and driving a `THREE.AnimationMixer` rooted at the **Animation root** (ADR-0011).
- An **AnimationTree driver** owns no clips: it evaluates its `tree_root` at the authored `parameters/*` into a **blend program** and drives the **AnimationPlayer** or **GLB animation driver** its `anim_player` resolves to, found via the **AnimationDriverRegistry** (ADR-0019).
- A **sub-viewport** publishes its render target into the **ViewportTextureRegistry**; a **viewport surface** or a `ViewportTexture` consumer resolves it back by node path. The parent's **NodeDispatcher** and **ControlCanvasWalker** both stop at the boundary, so the subtree is dispatched exactly once — by its surface (ADR-0033).
- Both **Host (app)**s mount the same preview shell; what differs is the resource-loading adapter and how source text arrives — **Save-driven refresh** from disk (VS Code) vs the live-typed **Source pane** buffer under **Hold-last-valid** (web). **Progressive fill-in** is shared.

## Example dialogue

> **Dev:** "When `main.tscn` loads — its root is a Node3D with a Hallway plus five CanvasLayer UI scenes — which **viewport mode** do we default to?"
> **Architect:** "3D, because the root is spatial. The five native Control subtrees don't render in 3D mode — same as Godot's own 3D editor viewport — but we surface a 'contains 2D UI' hint so the user can flip the toggle."
> **Dev:** "And a `StaticBody3D` with a `CollisionShape3D` child?"
> **Architect:** "The body is a **transform-only group**. The CollisionShape3D renders nothing unless `showCollisions` is on, in which case its **collision gizmo** draws the **collision-shape resource** as a wireframe."

## Flagged ambiguities

- "Shape" meant both the CollisionShape3D Node and its collision-shape resource — resolved: the Node holds a `shape` reference, the resource carries the geometry.
- "Transform container" collided with Godot's Container Controls (VBoxContainer, …) — resolved: physics bodies are **transform-only groups**; "Container" is reserved for the 2D layout Controls.
- "Registry" was used for three distinct singletons — resolved: **NodeRegistry** (parse), **NodeComponentRegistry** (3D render), **ControlComponentRegistry** (2D render); their multiplicity is the mechanism that keeps the linter React-free, not duplication.
- `uid://` vs the per-scene `id=` both called "id" — resolved: **UID reference** is the global `uid://`, `id=` is the per-file resource handle.
- "AnimationClip" meant both the parsed Godot animation and the three.js runtime object — resolved: parsed = **GodotAnimation**, runtime = `THREE.AnimationClip` (always qualified).
- "GLB AnimationPlayer" was an *avoided* coinage when a GLB instance exposed no AnimationPlayer node (the **GLB animation driver** bound to the GLBSceneRoot root row) — resolved: GLB hierarchy parity now synthesises a tree-only `GLBAnimationPlayer` row (Godot exposes glTF clips on an in-hierarchy AnimationPlayer), and *that* row — not the GLB root — activates the **Animation transport** (ADR-0014).
- "AnimatedFrame" push registry named only the `frame` lane it first carried — resolved: the value-push path is the **AnimatedValue push registry**, keyed by `${nodePath}:${property}`, carrying any non-transform value (stepped `frame`, interpolated `modulate`/`size`); "AnimatedFrame" is retired to the historical `frame`-only form (ADR-0016, ADR-0017).
- "Zoom" means two different quantities in the two viewports — resolved by always qualifying which: in 2D it is a **CSS scale factor** (0.1–4, surfaced as a percentage in the stage's zoom HUD, anchored to the cursor); in 3D it is the **Editor cursor**'s orbit radius in world units (0.01–10000, derived from the camera's clip planes). A wheel zoom anchors to the pointer in both; a touch pinch anchors in 2D but not yet in 3D. "Zoom in" is a smaller number in 3D and a larger one in 2D.
- "Host" meant both the embedding app and VS Code's extension-host process — resolved: **Host (app)** is the embedding application (web previewer / VS Code extension); VS Code's process is always written qualified as "extension host".
- "Viewport" meant the previewer's centre panel (**Viewport mode**, the 2D/3D toggle) and Godot's `SubViewport` Node, which are unrelated referents — resolved: the Godot node is always the hyphenated **sub-viewport**, and the thing displaying it is a **viewport surface**; bare "viewport" stays the previewer's panel (ADR-0033).
- "Offscreen" suggested a sub-viewport's whole subtree is hidden from the parent — resolved: only the **canvas** half is. A sub-viewport always owns its World2D but shares the parent's World3D unless `own_world_3d`, so its 3D descendants render in the parent view exactly as through a plain Node. Measured, not derived (ADR-0033).
- "Key" meant two unrelated things on one material — React's remount key on the element, and three's `customProgramCacheKey` string that tells a patched program apart from a stock one — and the ambiguity is load-bearing: it is how three separate guards for one hazard sat side by side, each looking like the whole answer. Resolved: both are derived by one owner from one merged prop bag, the cache-key contribution being a single term of the remount key, and what either may depend on is a **Program input** (ADR-0038).
- "ControlDispatcher" named the DOM-emitting walker of ADR-0003 — resolved: Control nodes now draw as native canvas items, so the DOM walker and its name are retired; the walker is **ControlCanvasWalker**, which emits `<group>`s positioned by the **Control rect solve** instead of `<div>`s positioned by CSS (ADR-0037).
