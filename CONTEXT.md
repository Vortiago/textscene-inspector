# TextScene Inspector

The shared language for parsing and rendering Godot text-scene (`.tscn`) files with react-three-fiber, across the core library, the VS Code extension, and the web previewer. Only concepts specific to this project live here; general programming terms do not.

## Language

### Format & parsing

**TSCN**:
Godot's text scene file format — `[heading key=value]` sections of three kinds (`node`, `ext_resource`, `sub_resource`) that this tool parses and renders.
_Avoid_: "scene file", "godot file".

**Node**:
A single entry in a scene tree with a `type`, `name`, parent path, `properties`, optional `instance` reference, and `children`; the unit the parser emits (`TscnNode`) and the dispatcher renders.
_Avoid_: "element", "entity".

**SceneGraph**:
The parsed-and-built tree of Nodes for one or more scenes; produced by the scene-tree builder and read from `HierarchyContext`.
_Avoid_: "scene tree" for the data structure — reserve "scene tree" for the UI panel (`SceneTreeViewer`).

**Live scene tree** (`r3f/liveSceneTree.ts`):
The composed, *runtime* tree the user navigates: the **SceneGraph**'s root Nodes with **PackedScene instancing** folded in (**Instance root merge** plus lazily-loaded sub-scenes) and **GLBSceneRoot** internals descended, in one consistent node-path space with per-sub-scene resource scope — both the **ExtResource** and SubResource pools, so a StyleBox authored inside an instanced sub-scene resolves against that sub-scene's own pool too. Unlike **SceneGraph** (static, parse-time, root-scene only) it depends on the **resource event bus** caches, so it is derived on demand from a cache snapshot. `liveSceneTree.ts` defines the single traversal; the 3D viewport and 2D world (**NodeDispatcher**), the native Control canvas (**ControlCanvasWalker**), the scene tree panel, the inspector resolver (`useLiveNode` → `resolveLiveEntry`), and the cameras/stats panels are its consumers. Every consumer that *renders* a subtree descends this tree — a consumer reading **SceneGraph** children directly sees an instance as a childless node and silently drops everything inside it.
_Avoid_: conflating with **SceneGraph** (the parsed structure) or "scene tree" (the UI panel).

**ExtResource**:
An external file reference written `ExtResource("id")` and declared by an `[ext_resource]` heading carrying both a `uid=` and a `path="res://…"`.
_Avoid_: "asset"; "import" (reserve that for the **Import sidecar**, which no scene ever references).

**Import sidecar**:
The `.import` file Godot writes beside a source asset, recording which importer produced it and with what parameters. Never referenced by any scene — it is found by path convention (`scene.gltf` → `scene.gltf.import`), which is why it is not an **ExtResource** and why a missing one is an ordinary outcome rather than a **Missing resource**.
_Avoid_: "import file" for the asset itself; treating absence as an error.

**Project settings**:
`project.godot` at a project's `res://` root — the engine configuration a scene is authored against, parsed into settings named as `ProjectSettings.get_setting()` names them (`[gui]` + `theme/default_theme_scale` → `gui/theme/default_theme_scale`). Like the **Import sidecar** it is found by path convention rather than referenced by any scene, so a scene without one is ordinary and renders at Godot's defaults, never a **Missing resource**. Only settings the previewer actually honours get a typed reader; today that is `gui/theme/default_theme_scale`, which scales every metric of the built-in default theme (font sizes, corner radii, content margins, container separations) and is the one setting any corpus project sets. A node's `theme_override_*` is NOT scaled — Godot returns an override as the scene authored it.
_Avoid_: "config file" for a `.tscn`; treating absence as an error; growing it into a general settings store.

**Asset re-import**:
What this previewer does in place of Godot's import pipeline: load the *source* asset (`.gltf`/`.glb`/`.obj`) and re-derive the scene from it, honouring a deliberately small allowlist of **Import sidecar** parameters. Godot never loads the source at runtime — it loads a pre-baked artifact under `.godot/imported/`, which is gitignored, binary and hash-named, so it is not an input a text-scene previewer can have. Decision and allowlist: ADR-0028.
_Avoid_: implying we run Godot's importer, or that the source asset is what Godot renders.

**SubResource**:
An embedded resource written `SubResource("id")` and declared by a `[sub_resource]` heading stored in the scene's flat internal-resources list (meshes, materials, StyleBoxes, collision-shape resources).
_Avoid_: "asset", "inline resource".

**Sub-resource path** (`resources/subResourcePath.ts`):
`res://file.tres::SubId` — Godot's own notation for a **SubResource** of some `.tres` OTHER than the previewed scene, and the one string that makes all three kinds of resource reference interchangeable to a consumer (an **ExtResource** `.tres`; a SubResource of the scene, resolved from its own internal-resources list via `SceneResourcesContext`; a SubResource of a `.tres` the scene pulled in). The WHOLE address is the resource identity — the processor cache key, the in-flight dedupe key, `useResource`'s LRU pin — while its `filePath` half is the only thing the **resource event bus**'s byte layer, a host `ResourceProvider` or a **Dependency hot-reload** ever sees, because only real files can be fetched. A FAILED address is reported under the address, so one can surface as a missing-resources row; the panel normalises to `filePath` before handing a host a **Resource upload** or its removal, that being the key the bytes live under. Consumers hold the address as an ordinary path (`ArrayMeshResource.materialPaths`, `MeshLibraryItem.meshPath`, `ExternalMaterialSlot`'s `path`), which keeps the third kind from being a category any CONSUMER has to know about; a producer minting addresses for a new resource type must still honour the id in its processor's `process()`, declared with `addressesSubResources`. Decision: ADR-0032.
_Avoid_: "composite path"/"synthetic path" (it is Godot's grammar, not an invention); treating it as a filename (nothing may `fetch` one); a per-consumer resolver for the third kind.

**ParsedResource** (`parser/parsedResource.ts`):
The one parsed form every Godot resource serialization normalizes to — header type, ext/sub-resource tables, and the `[resource]` body as raw Godot-text value strings. Produced today from `.tres` text; a binary `.res` loader (#110) must produce the same shape, which is what lets a **Resource slice**'s decoder stay format-agnostic. Values stay raw strings at this layer — the slice's `decode.ts` owns their meaning.
_Avoid_: "ParsedTresFile" (the pre-rename name — it baked the text format into a shape binary files will share); decoding values at parse time.

**UID reference**:
Godot 4's stable `uid://…` identifier; in this corpus every ExtResource pairs it with a `res://` path, so path resolution is authoritative and the uid is currently ignored. Uid-only resolution is unsupported.
_Avoid_: "id" (overloaded with the per-scene resource `id=`).

**Lenient parser** (`TscnParser`):
The recovering parser used for rendering — logs issues but emits whatever it can, preserving unknown Node types via the fallback.
_Avoid_: "the parser" (ambiguous with strict).

**Strict parser** (`StrictTscnParser`):
The validating parser used only for linting — reports every syntax/format error as a `ParseError` with line/column. Since 2026-06 it is a thin adapter over the shared scanning loop via a **ParseObserver**.
_Avoid_: "validator" (reserve for property validators).

**ParseObserver** (`parser/TscnParserCore.ts`):
The optional hook seam (`onError` / `onSectionStart` / `onProperty`) on the single shared scanning loop. Lenient parsing passes no observer (byte-identical recovery behavior); strict parsing passes an observer that collects `ParseError`s, runs the heading checks, and dispatches property validators. One loop, two adapters.
_Avoid_: "callback API", "strict mode flag".

**Value decoder** (`parser/valueParsers.ts`):
The lenient parser's shared primitives for reading a raw property string into a typed scalar/vector — `intOr`/`floatOr`/`boolOr`/`enumOr`/`vec2Or` (take a fallback, always return) and `parseOptionalInt` (returns `undefined` when unset). One contract: fall back **silently when absent**, **warn-then-fall-back when present but unparseable**. Wraps only the canonical `parseVector2` leaf scanner (via `vec2Or`); `parseVector2`/`parseVector3` (`parser/vectors.ts`) and the canonical `parseColor` (`utils/colorParser.ts`), which the slices call directly, share `FLOAT_PATTERN_SOURCE` — the one float regex accepting scientific notation (`1e-05`, which Godot emits) and rejecting malformed components outright; one-off structured literals (`Vector2i`, `Rect2`, `frame_coords`) and the throwing `parseColor` in `standardmaterial3d` stay in their slice, while Control's `custom_minimum_size` now reads through the shared `parseOptionalVector2`. The grammar (`FLOAT_PATTERN_SOURCE`) is shared; the absent/error contract may **fork** per slice — `floatOr`/`intOr` warn-then-fallback for concrete-default scalars, `parseOptionalFloat`/`parseOptionalVector2` return `undefined` for optional properties, and `vec2Or`/`parseColor` keep their slice-specific fallbacks.
_Avoid_: re-declaring per-node `intOr`/`floatOr` copies (the pattern this replaced); "validator" (that is the strict-linter path).

### Linting

**Diagnostic**:
One linter finding: a **Severity**, a message, the node it concerns, the name of the check that produced it, and (usually) a line/column. Parse-phase findings currently share the `strict-parser` name; per-property identity arrives with the property-descriptor work.
_Avoid_: "error" for a diagnostic of unknown severity; "issue" (ambiguous with the tracker).

**Validator** (format check):
A per-property format/range check that runs during strict parsing (dispatched by the **ParseObserver**) and inherits down the node base-type chain. A validator failure is **always an error** — a format violation is objectively invalid; that is the sorting principle for where a new check goes.
_Avoid_: advisory/warning conditions as validators (they belong in a **Lint rule**); "validator" for the parser-side **Value decoder**s.

**Lint rule** (semantic check):
A per-node-type check that runs on the parsed scene, matches its node type exactly (no base-type inheritance), and chooses its own **Severity** — the only home for advisory conditions.
_Avoid_: bare "rule" for a **Validator**; expecting base-class inheritance from rules (that is the validators' walk).

**Range advisory** (`linter/rangeAdvisory.ts`):
A **Lint rule** that warns when a single numeric property falls outside a plausible `[low, high]` band — the semantic-warning analogue of a format **Validator**. Emitted by the shared `rangeAdvisories` combinator from a per-property table of **arms** (a too-high or too-low threshold, each with its own rule name and message; a too-low arm may carry a `floor` that suppresses it at/below a value). The combinator owns the presence check, numeric parse, NaN guard, and comparison, so each rule is a declarative table rather than hand-written branching. **Always a warning** — an out-of-band value is suspicious, never objectively invalid; that severity is the sorting principle for what belongs: error-severity checks (a zero/negative `zoom`) and cross-field consistency checks (`limit_right` below `limit_left`) are **not** range advisories.
_Avoid_: modelling cross-field consistency or presence-dependency checks as range advisories (different control flow, not just different data); a range advisory that emits an **error**.

**Severity**:
Two levels. **error** — the file is objectively invalid per the TSCN format; fails the CLI and CI, and no committed fixture may carry one. **warning** — legal but suspicious; advisory, so healthy scenes and positive fixtures may carry them and nothing fails. (`info` is retired.)
_Avoid_: advisory conditions as errors (breaks fixtureLint); severity as presentation (surfaces map it, never redefine it).

**Live lint, settled render**:
The cross-host contract: every lint surface describes the text **as currently typed** (the web gutter reads the raw buffer; VS Code's Problems panel re-lints keystroke-debounced), while the rendered scene follows **committed** text (**Hold-last-valid** in the web, **Save-driven refresh** in VS Code). Diagnostics may be transiently red mid-edit; the viewport never is.
_Avoid_: gating lint on a clean parse (lint must see the broken text); rendering the raw mid-edit buffer.

**Instance-opaque linting**:
Existence checks (node names, NodePath targets) never assume visibility into an instanced sub-scene's internals: a reference that crosses an `instance=` boundary stays silent rather than false-positive. The linter reads the static text of one file — never the composed **Live scene tree**.
_Avoid_: "fixing" the silence by resolving instance internals (the linter must stay file-local and React-free).

### Code organization

**Vertical slice**:
All code for one Node type co-located in one folder — parser, linter, formatter, render component, and tests — the organizing principle the codebase is being unified toward.
_Avoid_: "module" (reserve for the architecture sense), "feature folder".

**Resource slice**:
All code for one resource type co-located in `resources/<category>/<type>/` — a registration object declaring the TSCN type names and file extensions it claims plus its bus tag, `types.ts`, and co-located tests; the resource-side sibling of the **Vertical slice**. Two kinds under one contract: a *Godot-text slice* adds pure `decode.ts` (a **ParsedResource** section → typed Data) and `build.ts` (Data plus resolved dependencies → THREE object or plain data); a *foreign-format slice* (GLB, images, the **Import sidecar**, **Project settings**) declares its real parser openly instead of faking that split. One decoder per type: hosts may keep two appliers over it, the decode never forks (ADR-0031).
_Avoid_: "processor" for the slice (the processor is the loading-side adapter that feeds it); a hollow `decode.ts` on a foreign format; value-shape sniffing a property bag (the pattern this replaced).

**Split slice** (historical — removed 2026-06):
The former transitional state where a Node type's parser/linter/formatter lived in `nodes/<category>/<type>/` while its render component lived in a parallel `r3f/nodes/<type>/`. Every slice is now unified; the term survives only so old documents stay readable.
_Avoid_: using it for current code.

**React-free linter boundary**:
The hard invariant that the linter bundle never transitively imports React or THREE — preserved because `linter/index.ts` imports only each slice's `index.linter.ts` entry point (which imports `linterParser.ts` + `linter.ts`), never its `Component.tsx`.
_Avoid_: "linter isolation" used loosely; this is a specific import-graph constraint guarded by a test.

**Slice entry points**:
The three thin registration files per unified slice — `index.ts` (registers the parser/formatter, never re-exports the component), `index.linter.ts` (registers validators + lint rules, imports only `.ts`), `index.r3f.ts` (registers the render component, the only file allowed to import `./Component`).
_Avoid_: "barrel" for these (reserve "barrel" for the three aggregating files that collect them: `parser/TscnParser.ts`, `r3f/nodes/index.ts`, `linter/index.ts`).

**NodeRegistry**:
The parser-domain singleton mapping `typeName → {typeGuard, parser, propertyFormatter}`, populated by side-effect imports in `TscnParser.ts`.
_Avoid_: "parser registry" loosely.

**NodeComponentRegistry**:
The render-domain singleton mapping `typeName → React component`, populated by side-effect imports in the R3F barrel and consulted by `NodeDispatcher`, with `GenericNodeFallback` when a type is absent.
_Avoid_: "renderer registry".

**ControlComponentRegistry**:
The 2D-UI analogue of NodeComponentRegistry, mapping a Control `typeName → native (WebGL canvas) painter component`; kept separate so the 3D registry stays THREE-typed. A type with no registration draws as `ControlFallback` — an outline at its solved rect — rather than nothing.
_Avoid_: "UI registry"; "DOM component" (there is no DOM path left to register into).

### Rendering

**NodeDispatcher**:
The recursive walker that turns SceneGraph root Nodes into a React-three-fiber tree, wrapping each Node in a pickable `<group>` and injecting instanced-scene children.
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
What displays a **sub-viewport**'s render target: a `SubViewportContainer`, or a `ViewportTexture` consumer. The one place a sub-viewport's canvas subtree is dispatched — the parent's own walkers stop at the boundary. A surface is also the single exception to "the 3D workspace drops CanvasItem subtrees", since a contained sub-viewport's 3D content still shares the parent world.
_Avoid_: "viewport container" for the concept (that is one implementation of it); "render target" for the surface (the target is what it displays).

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
A material prop three bakes into the compiled program SOURCE instead of reading per draw — texture-slot presence, `defines` (keys *and* values), `side`, the `opaque` composite, `vertexColors`, the physical `> 0` thresholds, an injected shader patch's cache-key contribution. `WebGLPrograms.getParameters()` derives them once, at that material's first compile, and `WebGLRenderer.setProgram()` re-derives only on a `material.version` move or for the short list it re-checks itself. So assigning one to an already-MOUNTED material — which is what a re-parse does, the dispatcher keying a node on its name — changes the material and not the shader, silently and for the rest of the session. `materialProgramInputs()` is the single owner: it merges a material's own bag with the shared blend/facing/lighting recipes and derives the React remount key from the RESULT, so the key and the material cannot describe different programs, and a shader patch cannot travel without the cache-key contribution that identifies it. The contrast is a **uniform** — a colour, an opacity, a texture swapped for another texture — which a mounted material may change freely and which must therefore stay OUT of the key, since remounting for one throws a program away for nothing (ADR-0038).
_Avoid_: bare "key" for either half of this (see Flagged ambiguities); "recompile" for what is a React remount onto a fresh material; calling `alphaTest`, `blending` alone or `numClippingPlanes` program inputs of *ours* (each self-heals or is re-checked upstream — `materialProgramInputs.ts` states why, per field).

**Collision-shape resource**:
A `[sub_resource]` carrying collision geometry — `BoxShape3D` (`size`), `ConvexPolygonShape3D` (`points`), `ConcavePolygonShape3D` (`data`); distinct from the **CollisionShape3D** Node that references one via a `shape` property.
_Avoid_: conflating the Node with the resource; "collision mesh".

**Collision gizmo**:
A toggleable wireframe rendering of a CollisionShape3D's collision-shape resource in the 3D viewport; off by default, driven by the viewport-mode context's `showCollisions` flag.
_Avoid_: "debug shape".

**CSG root**:
The `CSGShape3D` whose direct parent is not a `CSGShape3D`; the only node in a CSG subtree that produces a drawn mesh (ADR-0027).
_Avoid_: "CSG parent"; "combiner" (`CSGCombiner3D` is one kind of root, not the definition).

**Geometry contributor**:
A CSG node inside a **CSG root**'s subtree: a **transform-only group** that draws nothing itself but supplies its own solid, and its `operation`, to the root's boolean result. The second invisible-but-not-inert role, alongside the **AnimationPlayer** as animation driver.
_Avoid_: "brush" (reserved for the `three-bvh-csg` type); "child shape".

**Contribution**:
One **geometry contributor**'s solid, baked into CSG-root-local space, carrying its `operation` and its material. Distinct from `three-bvh-csg`'s `Brush` (the library type we construct from it) and from Godot's `CSGBrush` (the engine face soup our normal algorithm is ported from): three referents that would otherwise share one word in the same files.
_Avoid_: "brush".

**CSG plan**:
The pure, React-free description of a **CSG root**'s subtree (contributions in evaluation order with matrices, operations, materials and a cache key) which `evaluateCsgPlan` consumes.
_Avoid_: "CSG tree" (collides with the scene tree).

**CSG-as-primitive**:
The named *degraded fallback* when boolean evaluation is unavailable (the CSG library fails to load, or the evaluator throws): each CSG node draws its own base geometry and `operation` is ignored.
_Avoid_: using it to describe intended behaviour. That was ADR-0004, superseded by ADR-0027.

**Transform-only group**:
A node rendered as an invisible `<group>` that positions its children but draws nothing itself — the render intent for every non-visual type: physics bodies (`StaticBody3D`, `RigidBody3D`, `CharacterBody3D`, `Area3D`), `Skeleton3D`, `Path3D`/`PathFollow3D`, `GPUParticles3D`, the `Node3D`/`Node2D` bases, and the fallback for unsupported types. No simulation, and no geometry of its own that it draws (see ADR-0005, ADR-0008). A **geometry contributor** is the one kind that *has* own geometry: it still draws nothing, because its solid is consumed by its **CSG root** instead (ADR-0027).
_Avoid_: "physics body" implying simulation; "transform container" (collides with Godot's Container Controls); "placeholder" (the visible gray-box placeholder was retired in ADR-0008).

**Render intent**:
Which of the two render outcomes a node type takes — a *visible renderer* (draws geometry/text) or a *transform-only group* (invisible, positions children). "Renders nothing" is an explicit intent, not an unregistered accident; in-viewport text and collision shapes are opt-in toggles (`showLabels`, `showCollisions`) on the viewport-mode seam (ADR-0006, ADR-0008). Three invisible roles are **not** inert: the **AnimationPlayer** draws nothing itself but *drives* sibling objects, a transform-only group that is also an **animation driver** (ADR-0011); a **geometry contributor** draws nothing itself but supplies its solid to its **CSG root** (ADR-0027); and a **sub-viewport** draws nothing itself but *hosts* — scoping its canvas subtree to a **viewport surface** while its 3D subtree stays in the parent world (ADR-0033). All three are roles layered onto the second outcome, not a third outcome.
_Avoid_: "placeholder", "not implemented" — an invisible node may be fully intended; "inert" for AnimationPlayer, a geometry contributor, or a sub-viewport.

**Editor cursor**:
Godot's `Cursor` — an orbit focus point plus the pitch, yaw and radius of the eye around it — and the thing every 3D navigation gesture actually edits. The camera transform is rebuilt from it rather than steered directly, which is why orbiting, panning, zooming and freelook compose without drift. Immutable: a gesture is `(cursor, deltas) -> cursor`.
_Avoid_: "camera state" (the camera is derived from the cursor, not the source of it); "orbit target" for the whole cursor (the target is one of its four fields).

**Preview sun**:
The stand-in directional light this previewer supplies so a scene with no light of its own is not a black void — Godot's editor preview sun, with Godot's values. It **yields**: a scene containing any `DirectionalLight3D` gets none. Not part of the scene, never rendered by the running game (ADR-0025).
_Avoid_: "default light", "fill light" (both hide that it is a faithful reproduction of a specific Godot object that disappears under a specific condition).

**Preview environment**:
The stand-in **WorldEnvironment** this previewer supplies — Godot's editor preview environment: a procedural sky that is both the background and the scene's ambient light. Yields independently of the **Preview sun**: a scene containing any `WorldEnvironment` gets none, whatever that environment actually emits (ADR-0025).
_Avoid_: "default environment", "skybox"; treating it as coupled to the **Preview sun** — the two yield separately, and a scene routinely has one and not the other.

**Yield** (of preview lighting):
What a preview element does when the scene supplies its own: it is not mounted at all. Keyed on the presence of a node **type** anywhere in the **Live scene tree** — never on whether that node is visible, enabled, or contributes any light.
_Avoid_: "override", "fallback" — nothing is layered or blended; the preview is present or absent.

**Sky ambient**:
The illumination a sky background contributes to everything in the scene — in Godot a radiance map, so it lights surfaces *and* is what they reflect, not a directionless constant. Distinct from a flat ambient colour, which is what `AMBIENT_SOURCE_COLOR` specifies.
_Avoid_: "ambient light" alone for the sky case (loses the reflection half); "IBL" in user-facing text.

**Resource event bus** / `useResource`:
The async resource pipeline — a render component calls `useResource(path, type)`, the host `ResourceLoader` fetches, and a `loaded`/`missing` event resolves the hook; backs textures, GLB meshes, and PackedScene instancing.
_Avoid_: "asset loader" (reserve `ResourceLoader` for the host implementation).

**PackedScene instancing**:
A Node with `instance = ExtResource("scene_id")` whose referenced `.tscn`/`.glb` is loaded and composed into the host tree. A single-root `.tscn` is folded in via **Instance root merge**; a `.glb` (or any multi-root scene) is instead injected as children under a nested resources provider.
_Avoid_: "include", "prefab".

**Instance root merge** (`mergeInstanceRoot`, applied via `collapseLiveNode`):
The collapse of the redundant wrapper level for a single-root `.tscn` instance: the instance Node *becomes* the sub-scene's root — adopting the root's `type` and `children`, merging the root's parsed `properties` under the instance's own overrides (instance wins per-key, so the instance `transform` **replaces** the root's, matching Godot — not composed on top), while keeping the instance ref so the row still carries the 📦 badge and ⤢ open-standalone affordance. The collapse *decision* is the shared `collapseLiveNode` (in the **Live scene tree** module, wrapping `mergeInstanceRoot` over a `singleSceneCache` of the just-loaded sub-scene): the tree (`TreeNode`), viewport (`NodeDispatcher`), inspector (`useLiveNode` → `resolveLiveEntry`), and panels all call it rather than each re-deriving the resolve-instance→merge-or-keep sequence, so node paths stay consistent across every consumer (`collapseLiveNode(node) !== node` ⟺ a merge happened). Skipped for `.glb` synthetic-root instances (`GLBSceneRoot`) and any scene with multiple top-level nodes, which fall back to the nested-injection form.
_Avoid_: "wrapper node", "prefab flattening"; "compose" for the transform (it is a replace); re-deriving the merge decision in a consumer instead of calling `collapseLiveNode`.

**Sprite-frame composition** (`r3f/spriteFrame.ts`):
The shared region_rect + hframes/vframes UV math for SpriteBase nodes — Godot computes a base_rect (region when enabled, else the full texture) and then subdivides it by the frame grid; the two compose. `composeFrameTexture` windows a texture clone's UVs to the current frame, `frameSizePx` returns the frame's pixel size. Flip handling and world sizing stay per-slice (Sprite2D mirrors via mesh scale at 1 px = 1 unit; Sprite3D mirrors via UV negation and scales by `pixel_size`), as does the **wrap mode** (`SpriteWrapMode`, a required argument): an oversized `region_rect` is never clipped by Godot — neither the region nor the quad shrinks, the UVs simply leave the texture — so only the sampler decides the overrun, and the 2D canvas clamps to the edge texel where Sprite3D's material repeats.
_Avoid_: re-inlining region/frames math in a sprite slice (the pre-extraction hand-syncing caused the B12 parity divergence); defaulting the wrap mode (a default is how the 2D and 3D samplers silently diverge again); "clip"/"crop" for an oversized region — Godot does neither.

**Synthetic render type**:
A render-only component with no parser and no linter (`GenericNodeFallback`, `GLBSceneRoot`) — not a user-authorable TSCN type; lives in `r3f/internal/`, not a Node slice.
_Avoid_: "default node".

### Shell & editing

**Source pane**:
The web previewer's editable `.tscn` text view — a left sibling of the preview shell, never inside it. Holds the single editable buffer, fed three ways (fixture-select, file upload, or direct paste/type), that is the source of truth for both the **Linter** (surfaced in the browser as gutter markers with a hover popover) and — gated on a clean **Lenient parser** result (**Hold-last-valid**) — the shell's rendered scene. Edits are ephemeral and leave the browser only via a "Download .tscn" export; nothing is written back to disk. A browser reload resets silently, but an in-app one-click scene replacement (fixture palette, ⤢ open-sub-scene, scene-replacing drop/upload) of an *edited* buffer confirms before discarding (ADR-0020 as amended).
_Avoid_: "code editor" / "Monaco" / "CodeMirror" — it is a bare `<textarea>`, no editor library; conflating it with the **SceneTreeViewer** ("scene tree" UI panel) or with the VS Code extension's own real text editor.

**Host (app)**:
An embedding application that mounts the shared preview shell over its own `ResourceLoader`/provider and source-text feed — the web previewer, or the VS Code extension. Always distinct from VS Code's own "extension host" process (qualify that one).
_Avoid_: bare "host" for VS Code's extension-host process; "frontend"/"app" bare.

**Hold-last-valid** (web):
The **Source pane**'s edit gate: the viewport keeps rendering the last cleanly-parsed buffer while mid-edit text is transiently broken — brokenness shows as gutter markers (the **Linter** reads the raw buffer, ungated), never as a blanked scene. Applies to the edit loop only; fixture loads and uploads forward ungated so a genuinely broken file surfaces its parse-error banner.
_Avoid_: "debounce" for the gate (the debounce is timing; the gate is parse cleanliness); gating the linter (it must see the broken text).

**Preview panel** (VS Code):
The per-document webview the extension opens beside the editor — one per `.tscn` document (re-invoking reveals the existing panel), pinned to its document (it does not retarget when a different `.tscn` gains editor focus — big scenes are expensive to render, ADR-0023), keeping its scene state while hidden. The VS Code **Host**'s counterpart of the web shell.
_Avoid_: "preview tab"; bare "webview" (the mechanism, not the user-facing thing); Markdown-preview-style follow mode (rejected, ADR-0023).

**Save-driven refresh** (VS Code):
The **Preview panel**'s update contract: it mirrors the file **on disk**, refreshing on save and on external disk changes (git pull, branch switch) — never on unsaved keystrokes (ADR-0021; keystroke-live preview is the web **Source pane**'s job). A refresh is in-place — re-parse and reconcile, so camera, selection, and tree expansion survive by node path; a path the refresh removed clears its selection gracefully (inspector empties, any active **Animation transport** stops) rather than erroring.
_Avoid_: expecting Source-pane-style live typing in the **Preview panel** (deliberate asymmetry); "reload" for what is an in-place refresh.

**Dependency hot-reload** (VS Code):
A disk change to a dependency (texture, `.tres` material, GLB/glTF, instanced sub-scene) refreshes just that resource in every open **Preview panel** that ever resolved it — transitively, at any dependency depth, because every resource a panel renders passes through its own provider. Relevance-gated, no full scene refresh; a resource that failed to load still counts as relevant (creating a **Missing resource**'s file heals it), and hidden panels refresh in the background rather than on re-focus. Distinct from **Save-driven refresh**, which covers the panel's own main scene.
_Avoid_: "HMR"; conflating with the main scene's **Save-driven refresh**; "direct dependencies" (the closure is transitive).

**Progressive fill-in**:
How both **Host**s' screens update after a parse: the scene renders immediately from the parsed text, then textures, materials, GLB meshes, and sub-scenes pop in per-resource as their **resource event bus** loads land; a failed load flips only its consumers to the magenta missing placeholder. The screen never blocks on, or wholesale-reloads for, resource completion.
_Avoid_: loading-screen framing; treating a missing resource as a scene error.

**Corpus root** (web):
The active fixture's `res://` namespace — each vendored demo project keeps its own, resource lookups are scoped to it, and switching corpora must never serve the other corpus's bytes for a same-named `res://` path. **Resource upload**s are scoped the same way: stored under the corpus root active when added, so an upload made in corpus A is invisible in corpus B. An **Uploaded scene** lives in its own base ('') corpus, so uploading a scene starts the user's own working corpus rather than patching the fixture's; uploads never bleed across corpus boundaries.
_Avoid_: "fixture folder" (the root scopes resolution, not just storage); sharing one resource cache across corpora; global uploads that shadow every corpus.

### Content intake (web)

**Fixture**:
A built-in scene the previewer serves from its backend — the demo/test/showcase corpus: vendored Godot demos and games, examples, edge cases, and the unit fixtures the test suites also exercise. Fixtures exist to feed the tests and to show what the previewer can do, and they are the **only** content that ever comes from the backend.
_Avoid_: "sample"/"template"; calling anything user-provided a fixture.

**Fixture catalog**:
The browsable, categorized manifest of every **Fixture** (generated; the optional vendored games corpus appends when present). All kinds stay browsable — unit and edge-case fixtures double as a node-coverage showcase. Deep links may reach unlisted sub-scenes, whose **Corpus root** derives from the path.
_Avoid_: "scene library"; curating unit fixtures out of the public catalog.

**Uploaded scene**:
A user's `.tscn` opened as the active scene (the selector shows it as "(Uploaded: …)"). User uploads live in the frontend only — never sent to or stored on the backend; they reset on scene switch and leave the browser only via the Download export.
_Avoid_: "imported scene"; treating an upload as a **Fixture** (fixtures are backend-served; uploads must never be).

**Resource upload**:
A user file fulfilling one `res://` reference — added per-path from a **Missing resource** row, or matched during **Multi-file matching**. Frontend-only like the **Uploaded scene**, and scoped to the corpus active when it was added: a fixture corpus and the user's own files are separate worlds, so an upload never bleeds into another corpus's same-named path. Removing one flips its consumers back to missing.
_Avoid_: conflating with **Uploaded scene** (one replaces the active scene, the other fulfills a reference the scene made); global uploads that shadow every corpus.

**Multi-file matching**:
The one-gesture drop/select contract: the root-most `.tscn` in the batch becomes the **Uploaded scene** (the one no other dropped scene references), and every other file fulfills a `res://` reference by case-insensitive basename — matched against the scene's ExtResources **and** the current **Missing resource** list, so a sub-scene's own dependencies arrive by repeated drops, and a batch with no `.tscn` fulfills missing rows directly. Files matching nothing are ignored.
_Avoid_: "import wizard"; per-file prompts (the gesture is match-by-name, not a dialog flow).

**Missing resource**:
A `res://` reference whose load failed: its consumers show the magenta placeholder (**Progressive fill-in**) and it gains a row (path, type, referenced-by) in the missing-resources panel; a **Resource upload** fulfills the row, and removing that upload returns it to missing. Per-reference and recoverable — never a scene error.
_Avoid_: "broken scene"/"load error" for a single missing reference.

### Animation

**GodotAnimation**:
One named Godot animation — a `[sub_resource type="Animation"]` carrying `length`, `loop_mode`, `step`, and value **Track**s; parsed render-side from the scene's SubResources and built into a `THREE.AnimationClip` for playback.
_Avoid_: "AnimationClip" for the parsed form (reserve `THREE.AnimationClip` for the three.js runtime object); "clip" bare.

**Animation library**:
The `[sub_resource type="AnimationLibrary"]` whose `_data` maps clip names → **GodotAnimation**s; referenced from an **AnimationPlayer** via `libraries/<name> = SubResource(...)`, where the empty-name default library is written `libraries/`.
_Avoid_: "library" bare; the legacy Godot-3 `anims/<name>` inline form (absent from this corpus).

**Track**:
One channel of a **GodotAnimation** targeting `NodePath("Node:property")` with ordered **Keyframe**s (time + value + transition). `value` tracks drive three ways: transform properties (`position`/`rotation`/`rotation_degrees`/`scale`) through the `THREE.AnimationMixer`; a discrete `Sprite2D:frame` (sprite-sheet flipbook), sampled *stepped*, through the **AnimatedValue push registry** (ADR-0016); and continuous non-transform properties (`Decal:modulate`, `Decal:size`), sampled by *linear interpolation*, through the same registry (ADR-0017). The mixer binds transforms only, so anything React-derived is sampled at the playhead and pushed to the target. Other track types (`bezier`/`method`/`audio`/`animation`) and unwired properties parse but do not yet drive.
_Avoid_: "channel".

**AnimatedValue push registry**:
The ref-backed registry through which the active **AnimationPlayer** pushes sampled non-transform **Track** values to their target component — the value-push lane for everything the `THREE.AnimationMixer` can't bind (it drives transforms only). Keyed by `${nodePath}:${property}` (one node animates several properties at once); the target overrides its authored value while a value is pushed and reverts on release. Discrete `frame` is sampled stepped; continuous `modulate`/`size` are linearly interpolated (ADR-0016, ADR-0017). Generalises the `frame`-only **AnimatedFrame** form: `AnimatedFrameContext` was renamed to `AnimatedValueContext` (`r3f/contexts/AnimatedValueContext.tsx`) when the Decal value-track feature landed (ADR-0017).
_Avoid_: "AnimatedFrame registry" (the generalised name is **AnimatedValue**); "mixer"/"central value context" for this path (it is a narrow per-target push, not a tree-wide per-frame recompute — ADR-0011).

**Animation transport**:
The play/pause/scrub state (`AnimationTransportContext`) and its dock-tab UI, bound to the **AnimationPlayer**, **GLB animation driver**, **AnimatedSprite2D**, or **AnimationTree driver** **currently selected in the scene tree** — selection-driven, one driver at a time, mirroring the Godot editor's Animation panel. Drives the selected node's `THREE.AnimationMixer` (or, for **AnimatedSprite2D**, advances its displayed frame via `frameAtTime` — no mixer; ADR-0015); starts STOPPED (authored pose/frame preserved), play is user-initiated. The tab is shown only while a driver is selected; deselecting (or selecting a different node) stops playback and restores the authored pose.
_Avoid_: "scene-level transport" (it follows selection, not the whole scene); "timeline" / "player controls" for the whole transport (reserve "timeline"/"scrubber" for the seek widget).

**RESET animation**:
Godot's conventional rest-pose animation, named exactly `RESET` — one keyframe per animated property at t=0 holding its default value, used by the editor for reset-on-save. Listed in the clip selector like any animation but skipped when the **Animation transport** picks its default selection — which prefers the `autoplay` clip, else the first non-`RESET` clip (`defaultClip`); `RESET` becomes the default only when it is the sole clip. 
_Avoid_: treating `RESET` as an ordinary playable clip.

**Animation root** (`root_node`):
The THREE object a clip's **Track** NodePaths resolve against and the **AnimationPlayer**'s mixer is rooted on — default `..` (the player's parent node). `THREE.PropertyBinding` resolves a Track's target by name through the dispatcher's (unnamed) pickable wrappers; the named, transform-bearing object the binding finds is the one the mixer overrides.
_Avoid_: "target root".

**GLB-embedded clip**:
An animation authored *inside* a `.glb`/`.gltf` and surfaced as a ready-made `THREE.AnimationClip` straight from the glTF loader — never a **GodotAnimation** (no `[sub_resource type="Animation"]` text form, no **Track** parsing of ours). These are the clips a Godot GLB import would carry on the model's own AnimationPlayer node.
_Avoid_: "GodotAnimation" for these (reserve that for the SubResource form); "imported animation" bare.

**GLB animation driver**:
A **GLBSceneRoot** acting as an **animation driver**. Godot's glTF importer exposes a model's clips on an AnimationPlayer node *inside* the imported hierarchy, so the tree synthesises a tree-only `GLBAnimationPlayer` row (a selectable node with no parser and no render component); when **that row** is the selected node, the GLBSceneRoot component registers the GLB's **GLB-embedded clip**s with the **Animation transport** and runs a `THREE.AnimationMixer` rooted on the loaded GLB object itself (no **Animation root**/`root_node`; the clips are already bound to the GLB's own node names). The GLB counterpart to an **AnimationPlayer**: same selection-driven transport and shared `usePlaybackLoop`, different clip source and mixer rooting (ADR-0014).
_Avoid_: "GodotAnimation" for these clips (they are ready-made glTF clips — see **GLB-embedded clip**); treating the synthesised `GLBAnimationPlayer` row as a real **AnimationPlayer** Node, or as the thing that renders (it is a tree-only selection target — the GLBSceneRoot component does both the driving and the rendering); saying the GLB *root* row activates the transport (its synthesised `GLBAnimationPlayer` child does).

**AnimationTree driver**:
An **AnimationTree** acting as a transport driver (ADR-0019). It owns no clips — it resolves its `tree_root` into an `AnimNode` graph, evaluates that graph at the *authored* `parameters/*` state into a **blend program** (`{clip, weight, timeScale}[]`), resolves its `anim_player` `NodePath` to a driver in the **AnimationDriverRegistry**, and drives that driver's object with weighted actions. Processes only when `active = true` (Godot parity — its game script flips `active` at runtime; a static previewer evaluates the saved state) AND it is the selected node. Has **no clip picker** (Godot plays it from parameter state), so it registers a single read-only transport entry (the dominant clip). The full runtime blend is approximated: per-bone Blend2 `filter`s aren't modelled and a StateMachine's current state is the authored `current_state` else the `Start`-transition target.
_Avoid_: calling it an **AnimationPlayer** (it drives one, via `anim_player`); implying it has a selectable clip list.

**AnimationDriverRegistry**:
The `nodePath → { object, clips }` lookup (`AnimationDriverContext`) that an **AnimationPlayer** or **GLB animation driver** publishes into whenever its clips are loaded — *availability*, decoupled from the selection-driven transport. The **AnimationTree driver** consumes it to find the object to root its blended mixer on and the clips to play, unifying the two clip sources behind one path lookup. Two contexts: a STABLE register function (so a publishing driver's effect doesn't re-fire) and a REACTIVE drivers map (so a consumer re-renders when an async-loaded driver appears).
_Avoid_: conflating it with the **Animation transport** (the registry is about which driver owns which clips; the transport is about play/pause for the selected one).

**Playback step** (`r3f/animation/`):
The pure per-frame transport-actuation decision shared by every **Animation transport** driver — from the previous/current play state, the transport playhead, and whether the clip changed, it decides which transition fired this frame (ensure-playing / seek / hold-paused / stop-and-restore / none), whether the driver is freshly (re)entering playback (a local clock re-seeds), and whether the pause-edge time flush must fire. Each driver's frame loop is a thin adapter that actuates the decision — single-action mixer, weighted blend program, or sprite frame sampling — so the decision is written once and tested as data, without a mount.
_Avoid_: re-deriving play/pause/seek/stop edges inside a driver's `useFrame` (the hand-synced triplication this replaced); "state machine" for the adapters (the machine is the step; adapters only actuate).

**Driver mount** (`r3f/animation/`):
The shared lifecycle by which a clip-owning transport driver (**AnimationPlayer**, **GLB animation driver**) comes online: register clips with the **Animation transport** while selected, publish `{object, clips}` availability into the **AnimationDriverRegistry**, and build the `THREE.AnimationMixer` + actions. Clip construction, mixer rooting, and pose snapshot/restore stay per-driver.
_Avoid_: mounting the **AnimationTree driver** this way (it owns no clips — it is a registry consumer, not a publisher).

## Relationships

- A **SceneGraph** holds many **Node**s; the active scene's root Nodes feed the **NodeDispatcher** — 3D content always, and the 2D world's CanvasItem content too — while a Control/CanvasLayer subtree, in 2D **viewport mode**, is solved and drawn by the **ControlCanvasWalker** inside that same canvas.
- A **Node** references **ExtResource**s and **SubResource**s by id; the **resource event bus** resolves ExtResources to files. A `.tres` the scene reached may itself reference its OWN SubResources, which the bus resolves under a **Sub-resource path** — fetching the owning file, then building the named body out of it (ADR-0032).
- A **CollisionShape3D** Node references one **collision-shape resource**; the **collision gizmo** reads the latter through the former.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) are keyed by the same `typeName` but kept separate to preserve the **React-free linter boundary**.
- A unified **vertical slice** exposes its behavior through three **slice entry points**, one per registry domain.
- **Label3D** (3D, billboarded text rasterised to a `CanvasTexture` with the browser's own font) is a different subsystem from **Label** / **RichTextLabel** (2D canvas text — the vendored Open Sans MSDF atlas and this engine's own layout, drawn as glyph-quad geometry).
- An **AnimationPlayer** references one **Animation library** via `libraries/`; the library's **GodotAnimation**s carry **Track**s that the **Animation transport** plays by building a `THREE.AnimationClip` and driving a `THREE.AnimationMixer` rooted at the **Animation root** (ADR-0011).
- An **AnimationTree driver** owns no clips: it evaluates its `tree_root` at the authored `parameters/*` into a **blend program** and drives the **AnimationPlayer** or **GLB animation driver** its `anim_player` resolves to, found via the **AnimationDriverRegistry** (ADR-0019).
- A **sub-viewport** publishes its render target into the **ViewportTextureRegistry**; a **viewport surface** or a `ViewportTexture` consumer resolves it back by node path. The parent's **NodeDispatcher** and **ControlCanvasWalker** both stop at the boundary, so the subtree is dispatched exactly once — by its surface (ADR-0033).
- Both **Host (app)**s mount the same preview shell; what differs is the resource-loading adapter and how source text arrives — **Save-driven refresh** from disk (VS Code) vs the live-typed **Source pane** buffer under **Hold-last-valid** (web). **Progressive fill-in** is shared.

## Example dialogue

> **Dev:** "When `main.tscn` loads — its root is a Node3D with a Hallway plus five CanvasLayer UI scenes — which **viewport mode** do we default to?"
> **Architect:** "3D, because the root is spatial. The five native Control subtrees don't render in 3D mode — same as Godot's own 3D editor viewport — but we surface a 'contains 2D UI' hint so the user can flip the toggle."
> **Dev:** "And a `StaticBody3D` with a `CollisionShape3D` child?"
> **Architect:** "The body is a **transform-only group**; the CollisionShape3D renders nothing unless `showCollisions` is on, in which case its **collision gizmo** draws the **collision-shape resource** as a wireframe."

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
