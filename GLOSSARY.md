# TextScene Inspector

This glossary names the project's own concepts for parsing Godot text-scene (`.tscn`) files and rendering them with react-three-fiber. It holds no general programming terms.

## Language

### Format & parsing

**TSCN**:
Godot's text scene file format: a sequence of `[heading key=value]` sections of the kinds `node`, `ext_resource` and `sub_resource`.
_Avoid_: "scene file", "godot file".

**Node**:
One entry in a scene tree, with a `type`, `name`, parent path, `properties`, optional `instance` reference and `children`, which the parser emits as `TscnNode`.
_Avoid_: "element", "entity".

**SceneGraph** (`core/SceneGraph.ts`):
The parsed tree of Nodes for one authored root scene, built at parse time and read from `HierarchyContext`.
_Avoid_: "scene tree" for the data structure (it names the UI panel, `SceneTreeViewer`).

**Live scene tree** (`r3f/liveSceneTree.ts`):
The runtime tree the user navigates: the **SceneGraph** roots with **PackedScene instancing** folded in and **GLBSceneRoot** internals descended, in one node-path space.
Every consumer that renders a subtree descends this tree, because a **SceneGraph** child list shows an instance as a childless node.
_Avoid_: **SceneGraph** or "scene tree" for this tree.

**ExtResource**:
An external file reference, written `ExtResource("id")` and declared by an `[ext_resource]` heading with a `uid=` and a `path="res://…"`.
_Avoid_: "asset", "import".

**Import sidecar**:
The `.import` file Godot writes beside a source asset to record its importer and parameters.
No scene references it, so a missing one is an ordinary outcome and not a **Missing resource**.
_Avoid_: "import file" for the asset itself.

**Project settings**:
`project.godot` at a project's `res://` root, read under the names `ProjectSettings.get_setting()` uses.
Only settings the previewer honours get a typed reader, and a scene without the file renders at Godot's defaults.
_Avoid_: "config file" for a `.tscn`. A general settings store.

**Asset re-import**:
What the previewer does in place of Godot's import pipeline: it loads the source asset (`.gltf`, `.glb`, `.obj`) and re-derives the scene from it.
ADR-0028 holds the decision and the allowlist of **Import sidecar** parameters it honours.
_Avoid_: "Godot's importer" for this.

**SubResource**:
An embedded resource, written `SubResource("id")` and declared by a `[sub_resource]` heading in the scene's internal-resources list.
_Avoid_: "asset", "inline resource".

**Sub-resource path** (`resources/subResourcePath.ts`):
`res://file.tres::SubId`: Godot's notation for a **SubResource** of a `.tres` other than the previewed scene (ADR-0046).
The whole address is the resource identity, and only its `filePath` half reaches the byte layer, because only real files can be fetched.
_Avoid_: "composite path", "synthetic path". A `fetch` of the whole address.

**ParsedResource** (`parser/parsedResource.ts`):
The one parsed form every Godot resource serialisation normalises to: the header type, the resource tables and the `[resource]` body as raw value strings.
The slice's `decode.ts` owns what the values mean.
_Avoid_: decoding values at parse time.

**UID reference**:
Godot 4's stable `uid://…` identifier, which the previewer ignores because every ExtResource here pairs it with an authoritative `res://` path.
_Avoid_: "id".

**Lenient parser** (`TscnParser`):
The recovering parser for rendering, which logs issues, emits what it can and keeps unknown Node types.
_Avoid_: "the parser".

**Strict parser** (`StrictTscnParser`):
The validating parser for linting, which reports every syntax and format error as a `ParseError` with line and column through a **ParseObserver**.
_Avoid_: "validator".

**ParseObserver** (`parser/TscnParserCore.ts`):
The optional hook **seam** (`onError`, `onSectionStart`, `onProperty`, `onSectionBuilt`) on the one shared scanning loop.
The lenient parser passes none, and the strict parser passes one that collects errors and runs validators.
_Avoid_: "callback API", "strict mode flag".

**Value decoder** (`parser/valueParsers.ts`):
The lenient parser's shared primitives (`intOr`, `floatOr`, `parseOptionalFloat` and the others) that read a raw property string into a typed scalar or vector.
The grammar is shared, but the absent/error contract may **fork** per slice.
_Avoid_: per-node `intOr` or `floatOr` copies. "validator". `FLOAT_PATTERN_SOURCE` in a validator (it refuses `inf` and `nan`, which Godot writes).

### Linting

**Diagnostic**:
One linter finding: a **Severity**, a message, the node, the name of the check and usually a line and column.
A finding with no line is about the whole file.
_Avoid_: "error" for a diagnostic of unknown severity, "issue".

**Validator** (format check):
A per-property format or range check that judges one property's value alone during strict parsing and inherits down the node base-type chain.
Its **Severity** comes from what the engine does (`linter/validators/v/grounding.ts`).
_Avoid_: "validator" for a **Value decoder**.

**Format-only validator**:
A **Validator** marked `formatOnly`, which cites nothing because it refuses only unreadable text or a whole value of a type the slot does not convert.
The `formatOnlyCorpus` ledger checks that it never errors on a literal Godot stores.
_Avoid_: `formatOnly` on a refusal of a value the setter receives.

**Lint rule** (semantic check):
A per-node-type check on the parsed scene for a condition no single property settles, matched to its exact node type with no base-type inheritance.
_Avoid_: bare "rule" for a **Validator**.

**Rule arm** (`linter/ruleArms.ts`):
One diagnostic a **Lint rule** can report, declared with its rule name, its **Severity** and the `EmitGrounding` that fixes that severity.
A rule reports only through its arms (`reportArm`, `armDiagnostic`), and `armEmits` derives its `emits` from them.
_Avoid_: a hand-written diagnostic object in a rule.

**Range advisory** (`linter/rangeAdvisory.ts`):
A warning **Lint rule** that the shared `rangeAdvisories` combinator emits when one numeric property falls outside a table of cited thresholds.
_Avoid_: a range advisory that errors. A cross-field check as a range advisory.

**Severity**:
One of three levels, fixed by what the engine does with the value (ADR-0032, `severityFixedBy`), never chosen per rule.
An **error** means Godot refuses or alters the value or cannot load the file, or a rule threw. Only an error fails the CLI and CI.
A **warning** means the value is legal but suspect: Godot's editor warns about it, it sits outside the property's editor hint, or the claim is about the file.
An **info** means the engine reads the value and leaves it inert (`engine-inert`), or the finding is about this previewer rather than the scene.
_Avoid_: advisory conditions as errors. Severity as presentation.

**Live lint, settled render**:
The cross-host contract that every lint surface describes the text as typed, while the rendered scene follows committed text.
_Avoid_: gating lint on a clean parse. Rendering the raw mid-edit buffer.

**Instance-opaque linting**:
The rule that existence checks never look inside an instanced sub-scene, so a reference across an `instance=` boundary stays silent.
_Avoid_: resolving instance internals in the linter.

**Viewport scope**:
The nearest Viewport ancestor of a node, or null for the scene's own viewport, which bounds per-viewport state such as the current-camera slot.
An ancestor of unknown type puts the node in no scope.
_Avoid_: a per-viewport rule scoped to the whole scene.

### Language features

**Language-feature engine** (`languageFeatures/`):
The React- and THREE-free core area that answers editor requests for one `.tscn`: hover, completion, quick fixes, folding and document highlights.
It reads the text through a **ParseObserver** on the scanning loop, and reads the `godot/` captures.
Every result is host-neutral with zero-based ranges, so the VS Code extension and the `tscn-lsp` server share it (ADR-0049).
_Avoid_: "LSP" for the engine. LSP names the protocol, which the `tscn-lsp` server speaks. "Language service".

**Agent tool**:
A tool the VS Code extension registers through `vscode.lm` for a coding agent in chat.
The agent tools lint a scene, read its node tree, open or capture its preview, and list its missing resources.
_Avoid_: "action" for an agent tool.

### Code organisation

**Vertical slice**:
All code for one Node type in one folder: parser, linter, formatter, render component and tests.
_Avoid_: "module", "feature folder".

**Resource slice**:
All code for one resource type in `resources/<category>/<type>/`, the resource-side sibling of the **Vertical slice** (ADR-0031).
A Godot-text slice splits a pure `decode.ts` from `build.ts`, and a foreign-format slice declares its real parser instead.
_Avoid_: "processor" for the slice. A hollow `decode.ts` on a foreign format.

**React-free linter boundary**:
The invariant that the linter bundle never imports React or THREE, even transitively, which a **conformance guard** checks on the import graph.
_Avoid_: "linter isolation".

**Slice entry points**:
The three thin registration files per slice: `index.ts` (parser and formatter), `index.linter.ts` (validators and lint rules, `.ts` only) and `index.r3f.ts` (the only importer of `./Component`).
_Avoid_: "barrel" (it names `parser/TscnParser.ts`, `r3f/nodes/index.ts`, `linter/index.ts` and `resources/sliceRegistrations.ts`).

**NodeRegistry**:
The parser-domain singleton that maps `typeName` to `{parser, propertyFormatter}`, filled by side-effect imports in `TscnParser.ts`.
_Avoid_: "parser registry".

**NodeComponentRegistry**:
The render-domain singleton that maps `typeName` to a React component, which `NodeDispatcher` consults before it falls back to `GenericNodeFallback`.
_Avoid_: "renderer registry".

**ControlComponentRegistry**:
The 2D-UI analogue of NodeComponentRegistry, which maps a Control `typeName` to a native canvas painter and falls back to the outline `ControlFallback`.
_Avoid_: "UI registry", "DOM component".

**Seam**:
The place where a module's interface lives, so behaviour can change behind it without an edit to the callers.
Two adapters make a seam real, and one makes it hypothetical.
_Avoid_: "boundary". A seam nothing varies across.

**Depth**:
How much behaviour a caller or test can exercise per unit of interface it must learn.
_Avoid_: bare "depth" for a dependency-chain distance or a test suite's size.

**Conformance guard**:
A test that walks a registry or scrapes source to prove every registered thing has its promised shape (`barrelCompleteness`, `parserBarrelCompleteness`, `resourceSliceConformance`, `baseChainCompleteness`, `reactFree`, `noDependencies`).
Its failure list is the work list, and a green guard proves only what it scraped.
_Avoid_: a per-slice test as a substitute. "coverage" for a guard.

### Rendering

**NodeDispatcher**:
The recursive walker that turns SceneGraph root Nodes into a react-three-fiber tree, with each Node in a pickable `<group>`.
_Avoid_: "renderer".

**ControlCanvasWalker** (`r3f/controls/native/ControlCanvasWalker.tsx`):
The native analogue of NodeDispatcher for Controls: it runs the **Control rect solve** and emits one named `<group>` per Control at its solved rect (ADR-0037).
A painter draws only its node's own chrome, and children render as solved siblings, never as its React children.
_Avoid_: "UI renderer", "ControlDispatcher".

**Control rect solve** (`r3f/controls/native/controlRectSolver.ts`):
The two-phase pass that computes every Control's `Rect2` before anything paints: minimum sizes bottom-up, then placement top-down.
It is a line-by-line port of Godot 4.6.3's `scene/gui/control.cpp` (ADR-0037).
_Avoid_: "layout solve".

**Painter view** (`r3f/controls/native/solveTree.ts`'s `painterView`/`PainterView`):
The node properties a native Control painter may see: all except `modulate` and `selfModulate`, which **ControlCanvasWalker** has already applied.
`painterViewConformance.test.ts` forbids a painter to read them from `solveNode.node.properties`.
_Avoid_: "the painter's props" for this.

**Solve handoff** (`r3f/controls/native/solveHandoff.ts`):
What a Control's solver computes and hands to its painter, so neither computes it twice.
A **share** reads only the node and `theme` and is memoised per `(SolveNode, theme)`, and a **channel** is solve output sealed by a `ContainerLayoutFn`.
_Avoid_: "meta" for either form. "cache" for a share.

**Canvas paint order** (`r3f/canvasPaintOrder.ts`):
Where a canvas item draws in the 2D canvas, as Godot decides it: `(canvas layer, z_final, draw sequence)` in that precedence, whatever the node type (ADR-0036).
_Avoid_: "z order", "z offset".

**Draw sequence**:
An item's position in Godot's single pre-order walk of the canvas, the third and weakest term of **canvas paint order**.
_Avoid_: "paint index".

**Viewport mode**:
The single `'2D' | '3D'` display state of the centre viewport: `3D` mounts the R3F canvas, and `2D` mounts the pannable 2D stage.
A heuristic on the scene root type picks the default, and the toolbar toggle overrides it.
_Avoid_: "2D mode" alone.

**Sub-viewport**:
Godot's `SubViewport` Node, a canvas boundary but not a world boundary: it owns its World2D and shares the parent's World3D unless `own_world_3d` is set (ADR-0033).
_Avoid_: bare "viewport" or the unhyphenated "subviewport" for the Godot node. "offscreen subtree".

**Viewport surface**:
What displays a **sub-viewport**'s render target (a `SubViewportContainer` or a `ViewportTexture` consumer), and the one place its canvas subtree is dispatched.
_Avoid_: "viewport container" for the concept. "render target" for the surface.

**ViewportTextureRegistry**:
The `nodePath → { texture, size }` lookup that a **sub-viewport** publishes its render target into and every **viewport surface** resolves against.

**ViewportPassRegistry**:
The pass-ordering half of the same seam (`ViewportPassRegistryContext.tsx`): one `<ViewportPassOrchestrator>` per canvas runs every registered sub-viewport pass in dependency order each frame.
A pass in a dependency cycle never runs, and `useViewportPassCycle` lets a consumer fall back.
_Avoid_: treating it as a resource cache.

**layout_mode**:
The Godot Control property that records how a node is positioned: `0` free, `1` anchors, `2` container-managed.
The **Control rect solve** leaves it unread and treats a Control as container-managed when its parent has a registered `ContainerLayoutFn`.
_Avoid_: saying the solve branches on `layout_mode`.

**Anchor / offset**:
The Godot Control layout properties (`anchors_preset`, `anchor_*`, `offset_*`, `grow_*`) that place a Control whose parent has no registered `ContainerLayoutFn`.
_Avoid_: "margin". CSS `calc()` or absolute-positioning language.

**StyleBox**:
A Godot Control theme resource (`StyleBoxFlat` or `StyleBoxEmpty`) for background, border and corner radius, drawn as a vertex-coloured mesh ported from `StyleBoxFlat::draw`.
_Avoid_: "style". CSS `background`, `border` or `border-radius` language.

**Program input** (`r3f/materialProgramInputs.ts`):
A material prop that decides which shader program a material draws with, so a change to it remounts the material (ADR-0038, ADR-0039).
A **uniform**, such as a colour, changes freely and stays out of the remount key.
_Avoid_: bare "key". "recompile" for a React remount.

**Collision-shape resource**:
A `[sub_resource]` that carries collision geometry (`BoxShape3D`, `ConvexPolygonShape3D`, `ConcavePolygonShape3D`), referenced by a **CollisionShape3D** Node through `shape`.
_Avoid_: "collision mesh".

**Collision gizmo**:
An optional wireframe of a CollisionShape3D's collision-shape resource in the 3D viewport, off by default and driven by `showCollisions`.
_Avoid_: "debug shape".

**CSG root**:
The `CSGShape3D` whose direct parent is not a `CSGShape3D`, and the only node in a CSG subtree that draws a mesh (ADR-0027).
_Avoid_: "CSG parent", "combiner".

**Geometry contributor**:
A CSG node inside a **CSG root**'s subtree that draws nothing itself but supplies its solid and its `operation` to the root's boolean result.
_Avoid_: "brush", "child shape".

**Contribution**:
One **geometry contributor**'s solid in CSG-root-local space, with its `operation` and its material.
It is distinct from `three-bvh-csg`'s `Brush` and from Godot's `CSGBrush`.
_Avoid_: "brush".

**CSG plan**:
The pure, React-free description of a **CSG root**'s subtree that `evaluateCsgPlan` consumes: contributions in evaluation order with matrices, operations, materials and a cache key.
_Avoid_: "CSG tree".

**CSG-as-primitive**:
The degraded fallback when boolean evaluation fails: each CSG node draws its own base geometry and ignores `operation` (ADR-0027).
_Avoid_: this term for intended behaviour.

**Transform-only group**:
A node rendered as an invisible `<group>` that positions its children and draws nothing, the render intent for a non-visual type whose Godot effect is nil or already implemented (ADR-0005, ADR-0008).
_Avoid_: "physics body" implying simulation. "transform container". "placeholder".

**Render intent**:
Which render outcome a node type declares, a visible renderer or a **transform-only group**, so "renders nothing" is a choice and not an accident (ADR-0006, ADR-0008).
The **AnimationPlayer**, a **geometry contributor** and a **sub-viewport** are transform-only groups that are not inert.
_Avoid_: "placeholder", "not implemented". "inert" for those three roles.

**Pending** (render intent):
A node type whose Godot effect, an own visual or the drive of a **Driver**, is not implemented yet, registered under its base with `renderIntent: 'pending'` and the sheet status `unimplemented` (ADR-0045).
_Avoid_: bare "pending" for a resource load (say "load pending").

**Driver**:
A node with no geometry of its own that moves, deforms or animates other nodes, such as AnimationPlayer, RemoteTransform3D and a SkeletonModifier3D.
A drive the previewer does not run registers **Pending** and is `unimplemented`, never `linter-only` (ADR-0045).
_Avoid_: "controller" (collides with `XRController3D`). "inert".

**Editor cursor** (`r3f/godotEditorCursor.ts`):
Godot's `Cursor`, an orbit focus point plus the pitch, yaw and radius of the eye, from which every 3D gesture rebuilds the camera.
_Avoid_: "camera state". "orbit target" for the whole cursor.

**Preview sun**:
The stand-in directional light from Godot's editor that the previewer adds to a scene with no `DirectionalLight3D` (ADR-0025).
_Avoid_: "default light", "fill light".

**Preview environment**:
The stand-in **WorldEnvironment** from Godot's editor, a procedural sky for background and ambient light, added to a scene with no `WorldEnvironment` (ADR-0025).
_Avoid_: "default environment", "skybox". Coupling it to the **Preview sun**.

**Yield** (of preview lighting):
What a preview element does when the scene has a node of its type anywhere in the **Live scene tree**: it does not mount.
_Avoid_: "override", "fallback".

**Sky ambient**:
The illumination a sky background gives the scene, which in Godot is a radiance map that both lights and reflects, unlike the flat `AMBIENT_SOURCE_COLOR`.
_Avoid_: "ambient light" alone for the sky case. "IBL" in user-facing text.

**Resource event bus** / `useResource`:
The async resource pipeline: a component calls `useResource(path, type)`, the host `ResourceLoader` fetches, and a `loaded` or `missing` event resolves the hook.
_Avoid_: "asset loader".

**PackedScene instancing**:
A Node with `instance = ExtResource("scene_id")` whose `.tscn` or `.glb` is loaded and composed into the host tree.
_Avoid_: "include", "prefab".

**Instance root merge** (`mergeInstanceRoot`, applied through `collapseLiveNode`):
The collapse of a single-root `.tscn` instance, where the instance Node becomes the sub-scene's root and its own properties win per key.
Every consumer calls `collapseLiveNode` so node paths agree, and a `.glb` or multi-root instance is not merged.
_Avoid_: "wrapper node", "prefab flattening", "compose". A merge decision derived again in a consumer.

**Cyclic instancing** (`SceneScope.instancedScenePaths`):
An instance of a PackedScene that already encloses it, directly or through other instances.
Godot's loader refuses it, so the **Live scene tree** keeps the instance as a leaf and the viewport draws the magenta placeholder of a failed load.
_Avoid_: "recursive scene". A depth limit to stop it.

**Sprite-frame composition** (`r3f/spriteFrame.ts`):
The shared region_rect plus hframes/vframes UV maths for SpriteBase nodes, which each slice calls with its own wrap mode (`SpriteWrapMode`).
_Avoid_: region or frames maths inlined in a slice. A default wrap mode. "clip" or "crop" for an oversized region.

**Stated-consumer-default wrapping**:
The rule that each consumer chooses a shared texture's wrapping at bind time, never the loader (`textureProcessing.ts`), which leaves three's clamp-to-edge default.
_Avoid_: wrapping set in the loader. A shared cache entry's wrapping changed in place.

**Synthetic render type**:
A render-only component with no parser and no linter (`GenericNodeFallback`, `GLBSceneRoot`), kept in `r3f/internal/`.
_Avoid_: "default node".

### Shell & editing

**Source pane**:
The web previewer's editable `.tscn` text view beside the preview shell, whose one buffer feeds both the linter and the rendered scene (ADR-0020).
Edits stay in the browser until a "Download .tscn" export.
_Avoid_: "code editor", "Monaco", "CodeMirror".

**Host (app)**:
An embedding application, the web previewer or the VS Code extension, that mounts the shared preview shell over its own resource loader and source-text feed.
_Avoid_: bare "host" for VS Code's extension-host process. Bare "frontend" or "app".

**Hold-last-valid** (web):
The **Source pane**'s edit gate: the viewport keeps the last cleanly parsed buffer while mid-edit text is broken.
_Avoid_: "debounce" for the gate. Gating the linter.

**Preview panel** (VS Code):
The per-document webview the extension opens beside the editor, pinned to one `.tscn` document (ADR-0023).
_Avoid_: "preview tab", bare "webview". Follow mode.

**Save-driven refresh** (VS Code):
The **Preview panel**'s update contract: it refreshes in place on save and on disk changes, never on unsaved keystrokes (ADR-0021).
_Avoid_: "reload".

**Dependency hot-reload** (VS Code):
A disk change to a dependency refreshes only that resource in every open **Preview panel** that resolved it, at any dependency depth.
_Avoid_: "HMR", "direct dependencies".

**Progressive fill-in**:
How both **Host**s update after a parse: the scene renders at once from the text, then each resource appears as its load lands.
_Avoid_: loading-screen framing. A missing resource as a scene error.

**Corpus root** (web):
The active fixture's `res://` namespace, which scopes every resource lookup and **Resource upload** so two corpora never share bytes.
_Avoid_: "fixture folder".

### Content intake (web)

**Fixture**:
A built-in scene the web previewer ships as a static file, copied from `scenes/` into `apps/textscene-web/public/fixtures`.
_Avoid_: "sample", "template".

**Fixture catalog**:
The browsable, categorised manifest of every **Fixture**, generated by `pnpm generate:fixtures`.
_Avoid_: "scene library".

**Uploaded scene**:
A user's `.tscn` opened as the active scene, kept only in the browser (ADR-0022).
_Avoid_: "imported scene".

**Resource upload**:
A user file that fulfils one `res://` reference, added from a **Missing resource** row or by **Multi-file matching**, and scoped to the active corpus.
_Avoid_: **Uploaded scene** for this.

**Multi-file matching**:
The one-gesture drop or select contract: the root-most `.tscn` becomes the **Uploaded scene**, and every other file, an **Import sidecar** or `project.godot` included, fulfils a `res://` reference by case-insensitive basename.
_Avoid_: "import wizard".

**Missing resource**:
A `res://` reference or **Sub-resource path** whose load failed. Its consumer may draw a magenta placeholder, and the missing-resources panel shows one row per address. A **Sub-resource path** into a file that loads but declares no such `[sub_resource]` is one too, since Godot's load of it fails.
_Avoid_: "broken scene", "load error".

### Animation

**GodotAnimation**:
One named Godot animation: a `[sub_resource type="Animation"]` with `length`, `loop_mode`, `step` and value **Track**s, built into a `THREE.AnimationClip` for playback.
_Avoid_: "AnimationClip" for the parsed form. Bare "clip".

**Animation library**:
The `[sub_resource type="AnimationLibrary"]` whose `_data` maps clip names to **GodotAnimation**s, referenced through `libraries/<name>`.
_Avoid_: bare "library".

**Track**:
One animated property of a **GodotAnimation**, which targets `NodePath("Node:property")` with ordered **Keyframe**s.
The `THREE.AnimationMixer` drives transform tracks, and the **AnimatedValue push registry** drives the wired non-transform ones (ADR-0016, ADR-0017).
_Avoid_: "channel".

**AnimatedValue push registry** (`r3f/contexts/AnimatedValueContext.tsx`):
The registry, keyed by `${nodePath}:${property}`, through which the active **AnimationPlayer** pushes sampled non-transform **Track** values to their target.
_Avoid_: "AnimatedFrame registry", "mixer", "central value context".

**Animation transport**:
The play, pause and scrub state (`AnimationTransportContext`) and its dock-tab UI, bound to the one driver selected in the scene tree.
It starts stopped, and a change of selection stops playback and restores the authored pose.
_Avoid_: "scene-level transport". "timeline" or "player controls" for the whole transport.

**RESET animation**:
Godot's rest-pose animation named exactly `RESET`, which the **Animation transport** picks by default only when it is the sole clip.
_Avoid_: `RESET` as an ordinary playable clip.

**Animation root** (`root_node`):
The scene node a clip's **Track** NodePaths resolve from, by default `..`, the player's parent (ADR-0011).
_Avoid_: "target root".

**GLB-embedded clip**:
An animation authored inside a `.glb` or `.gltf` that the glTF loader delivers as a ready-made `THREE.AnimationClip`, never a **GodotAnimation**.
_Avoid_: "GodotAnimation" for these. Bare "imported animation".

**GLB animation driver**:
A **GLBSceneRoot** that plays its **GLB-embedded clip**s with a mixer rooted on the GLB object, activated by a synthesised tree-only `GLBAnimationPlayer` row (ADR-0014).
_Avoid_: the `GLBAnimationPlayer` row as a real **AnimationPlayer** Node.

**AnimationTree driver**:
An **AnimationTree** that owns no clips and drives the driver its `anim_player` names with a blend program evaluated at the authored `parameters/*` state (ADR-0019).
_Avoid_: **AnimationPlayer** for this driver. A selectable clip list.

**AnimationDriverRegistry** (`AnimationDriverContext`):
The `nodePath` to `{ object, clips }` lookup that an **AnimationPlayer** or **GLB animation driver** publishes into once its clips load.
It is two contexts: a stable register function and a reactive drivers map.
_Avoid_: **Animation transport** for this registry.

**Playback step** (`r3f/animation/`):
The pure per-frame decision, shared by every **Animation transport** driver, of which transition fires: ensure-playing, seek, hold-paused, stop-and-restore or none.
_Avoid_: play, pause, seek and stop edges derived again inside a driver's `useFrame`. "state machine" for the adapters.

**Driver mount** (`r3f/animation/`):
The shared lifecycle by which a clip-owning driver (**AnimationPlayer**, **GLB animation driver**) registers clips, publishes to the **AnimationDriverRegistry** and builds its mixer.
_Avoid_: this lifecycle for the **AnimationTree driver**.

## Relationships

- A **SceneGraph** holds **Node**s, and its roots feed the **NodeDispatcher**. In 2D **viewport mode**, the **ControlCanvasWalker** draws Control subtrees in the same canvas.
- A **Node** references **ExtResource**s and **SubResource**s by id, and the **resource event bus** resolves a `.tres`'s own SubResources under a **Sub-resource path** (ADR-0046).
- A **CollisionShape3D** Node references one **collision-shape resource**, which the **collision gizmo** draws.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) share `typeName` keys but stay separate to keep the **React-free linter boundary**.
- A **vertical slice** exposes its behaviour through three **slice entry points**, one per registry domain.
- **Label3D**, **Label** and **RichTextLabel** share one shaping engine and font, but each run draws with the painter Godot's text server uses for it (ADR-0040).
- An **AnimationPlayer** references an **Animation library**, whose **GodotAnimation**s carry the **Track**s that the **Animation transport** plays (ADR-0011).
- An **AnimationTree driver** drives the **AnimationPlayer** or **GLB animation driver** that it finds through the **AnimationDriverRegistry** (ADR-0019).
- A **sub-viewport** publishes into the **ViewportTextureRegistry**, and only its **viewport surface** dispatches its canvas subtree (ADR-0033).
- Both **Host (app)**s mount the same preview shell. VS Code feeds it by **Save-driven refresh**, and the web feeds it from the **Source pane** under **Hold-last-valid**.

## Flagged ambiguities

- "Shape": the CollisionShape3D Node holds a `shape` reference, and the **collision-shape resource** carries the geometry.
- "Transform container": physics bodies are **transform-only groups**, and "Container" means the 2D layout Controls.
- "Registry": say **NodeRegistry** (parse), **NodeComponentRegistry** (3D render) or **ControlComponentRegistry** (2D render).
- "id": **UID reference** is the global `uid://`, and `id=` is the per-file resource handle.
- "AnimationClip": the parsed form is **GodotAnimation**, and the runtime object is always `THREE.AnimationClip`.
- "GLB AnimationPlayer": the synthesised `GLBAnimationPlayer` row, not the GLB root, activates the **Animation transport** (ADR-0014).
- "AnimatedFrame": the term is retired. The value-push path is the **AnimatedValue push registry** (ADR-0016, ADR-0017).
- "Zoom": always qualify it. In 2D it is a CSS scale factor (0.1–4), and in 3D it is the **Editor cursor**'s orbit radius in world units. A wheel zoom anchors to the pointer in both, and a touch pinch anchors only in 2D.
- "Host": **Host (app)** is the embedding application, and VS Code's process is always "extension host".
- "Viewport": bare "viewport" is the previewer's centre panel, and the Godot node is the hyphenated **sub-viewport** (ADR-0033).
- "Offscreen": only the canvas half of a **sub-viewport** is hidden from the parent (ADR-0033).
- "Key": React's remount key and three's `customProgramCacheKey` derive from one prop bag, and **Program input** names what they depend on (ADR-0038).
- "ControlDispatcher": the term is retired. The Control walker is **ControlCanvasWalker** (ADR-0037).
