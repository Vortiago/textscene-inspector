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
The composed, *runtime* tree the user navigates: the **SceneGraph**'s root Nodes with **PackedScene instancing** folded in (**Instance root merge** plus lazily-loaded sub-scenes) and **GLBSceneRoot** internals descended, in one consistent node-path space with per-sub-scene **ExtResource** scope. Unlike **SceneGraph** (static, parse-time, root-scene only) it depends on the **resource event bus** caches, so it is derived on demand from a cache snapshot. `liveSceneTree.ts` defines the single traversal; the viewport (**NodeDispatcher**), the scene tree panel, the inspector resolver (`useLiveNode` → `resolveLiveEntry`), and the cameras/stats panels are its consumers.
_Avoid_: conflating with **SceneGraph** (the parsed structure) or "scene tree" (the UI panel).

**ExtResource**:
An external file reference written `ExtResource("id")` and declared by an `[ext_resource]` heading carrying both a `uid=` and a `path="res://…"`.
_Avoid_: "asset", "import".

**SubResource**:
An embedded resource written `SubResource("id")` and declared by a `[sub_resource]` heading stored in the scene's flat internal-resources list (meshes, materials, StyleBoxes, collision-shape resources).
_Avoid_: "asset", "inline resource".

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
The lenient parser's shared primitives for reading a raw property string into a typed scalar/vector — `intOr`/`floatOr`/`boolOr`/`enumOr`/`vec2Or` (take a fallback, always return) and `parseOptionalInt` (returns `undefined` when unset). One contract: fall back **silently when absent**, **warn-then-fall-back when present but unparseable**. Wraps only the canonical `parseVector2` leaf scanner (via `vec2Or`); `parseVector2`/`parseVector3` (`parser/vectors.ts`) and the canonical `parseColor` (`utils/colorParser.ts`), which the slices call directly, share `FLOAT_PATTERN_SOURCE` — the one float regex accepting scientific notation (`1e-05`, which Godot emits) and rejecting malformed components outright; one-off structured literals (`Vector2i`, `Rect2`, `frame_coords`) and divergent leaf parsers (the throwing `parseColor` in `standardmaterial3d`, the `undefined`-returning `parseVector2` in `control`) stay in their slice.
_Avoid_: re-declaring per-node `intOr`/`floatOr` copies (the pattern this replaced); "validator" (that is the strict-linter path).

### Code organization

**Vertical slice**:
All code for one Node type co-located in one folder — parser, linter, formatter, render component, and tests — the organizing principle the codebase is being unified toward.
_Avoid_: "module" (reserve for the architecture sense), "feature folder".

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
The 2D-overlay analogue of NodeComponentRegistry, mapping a Control `typeName → DOM component`; kept separate so the 3D registry stays THREE-typed.
_Avoid_: "UI registry".

### Rendering

**NodeDispatcher**:
The recursive walker that turns SceneGraph root Nodes into a React-three-fiber tree, wrapping each Node in a pickable `<group>` and injecting instanced-scene children.
_Avoid_: "renderer".

**ControlDispatcher**:
The DOM analogue of NodeDispatcher — recursively walks a Control subtree and emits nested `<div>`s mapping anchor/offset and container layout to CSS.
_Avoid_: "UI renderer".

**Viewport mode**:
The single `'2D' | '3D'` display state of the center viewport — `3D` mounts the R3F canvas, `2D` mounts the Control overlay; chosen by an auto-default heuristic on the scene root type, overridable by the toolbar toggle.
_Avoid_: "2D mode" alone (it is one of two values of one state).

**Control overlay**:
The HTML/CSS DOM rendering of a Godot Control/CanvasLayer subtree, layered as a sibling of (never inside) the R3F `<Canvas>`.
_Avoid_: "HUD", "UI canvas".

**layout_mode**:
The Godot Control property recording how a node is positioned — `0` free position, `1` anchors, `2` container-managed (the parent lays out the child; anchors ignored); in this corpus `2` is the majority. The renderer does **not** branch on this field, though: it is parsed into `ControlProperties.layoutMode` but left unread, and the free-vs-container decision is made structurally from the **parent container's** imposed `ParentLayoutKind` (`controlLayout.ts`) — a Control is container-managed iff its parent is a layout container.
_Avoid_: treating anchors as the primary path; saying the renderer branches on `layout_mode` (it branches on the parent's `ParentLayoutKind`).

**Anchor / offset**:
Godot Control layout properties (`anchors_preset`, `anchor_*`, `offset_*`, `grow_*`) decoded via the full LayoutPreset 0..15 table (`PRESET_ANCHORS`) to CSS absolute positioning; applied when the **parent imposes the `'free'` layout kind** (a top-level overlay, or a child of a plain Control/Panel/CanvasLayer rather than a layout container).
_Avoid_: "margin" (reserve for `MarginContainer` → CSS padding); gating this on the child's `layout_mode` value (the gate is the parent's `ParentLayoutKind`).

**StyleBox**:
A Godot Control theme resource (`StyleBoxFlat` / `StyleBoxEmpty`) defining background/border/corner-radius, mapped to CSS `background`/`border`/`border-radius` on the Control overlay.
_Avoid_: "style".

**Collision-shape resource**:
A `[sub_resource]` carrying collision geometry — `BoxShape3D` (`size`), `ConvexPolygonShape3D` (`points`), `ConcavePolygonShape3D` (`data`); distinct from the **CollisionShape3D** Node that references one via a `shape` property.
_Avoid_: conflating the Node with the resource; "collision mesh".

**Collision gizmo**:
A toggleable wireframe rendering of a CollisionShape3D's collision-shape resource in the 3D viewport; off by default, driven by the viewport-mode context's `showCollisions` flag.
_Avoid_: "debug shape".

**CSG-as-primitive**:
The decision to render `CSGBox3D`/`CSGCylinder3D` as their base three.js geometry, ignoring the boolean `operation`; never actual constructive solid geometry.
_Avoid_: "CSG support" (implies real booleans).

**Transform-only group**:
A node rendered as an invisible `<group>` that positions its children but draws nothing itself — the render intent for every non-visual type: physics bodies (`StaticBody3D`, `RigidBody3D`, `CharacterBody3D`, `Area3D`), `Skeleton3D`, `Path3D`/`PathFollow3D`, `GPUParticles3D`, the `Node3D`/`Node2D` bases, and the fallback for unsupported types. No simulation, no own geometry (see ADR-0005, ADR-0008).
_Avoid_: "physics body" implying simulation; "transform container" (collides with Godot's Container Controls); "placeholder" (the visible gray-box placeholder was retired in ADR-0008).

**Render intent**:
Which of the two render outcomes a node type takes — a *visible renderer* (draws geometry/text) or a *transform-only group* (invisible, positions children). "Renders nothing" is an explicit intent, not an unregistered accident; in-viewport text and collision shapes are opt-in toggles (`showLabels`, `showCollisions`) on the viewport-mode seam (ADR-0006, ADR-0008). One invisible type is **not** inert: the **AnimationPlayer** draws nothing itself but *drives* sibling objects — a transform-only group that is also an **animation driver** (ADR-0011).
_Avoid_: "placeholder", "not implemented" — an invisible node may be fully intended; "inert" for AnimationPlayer.

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
The shared region_rect + hframes/vframes UV math for SpriteBase nodes — Godot computes a base_rect (region when enabled, else the full texture) and then subdivides it by the frame grid; the two compose. `composeFrameTexture` windows a texture clone's UVs to the current frame, `frameSizePx` returns the frame's pixel size. Flip handling and world sizing stay per-slice (Sprite2D mirrors via mesh scale at 1 px = 1 unit; Sprite3D mirrors via UV negation and scales by `pixel_size`).
_Avoid_: re-inlining region/frames math in a sprite slice (the pre-extraction hand-syncing caused the B12 parity divergence).

**Synthetic render type**:
A render-only component with no parser and no linter (`GenericNodeFallback`, `GLBSceneRoot`) — not a user-authorable TSCN type; lives in `r3f/internal/`, not a Node slice.
_Avoid_: "default node".

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
The ref-backed registry through which the active **AnimationPlayer** pushes sampled non-transform **Track** values to their target component — the value-push lane for everything the `THREE.AnimationMixer` can't bind (it drives transforms only). Keyed by `${nodePath}:${property}` (one node animates several properties at once); the target overrides its authored value while a value is pushed and reverts on release. Discrete `frame` is sampled stepped; continuous `modulate`/`size` are linearly interpolated (ADR-0016, ADR-0017). Generalises the `frame`-only **AnimatedFrame** form (`AnimatedFrameContext` today; renamed when the Decal value-track feature lands).
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

## Relationships

- A **SceneGraph** holds many **Node**s; the active scene's root Nodes feed the **NodeDispatcher** (3D) or, in 2D **viewport mode**, the **ControlDispatcher**.
- A **Node** references **ExtResource**s and **SubResource**s by id; the **resource event bus** resolves ExtResources to files.
- A **CollisionShape3D** Node references one **collision-shape resource**; the **collision gizmo** reads the latter through the former.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) are keyed by the same `typeName` but kept separate to preserve the **React-free linter boundary**.
- A unified **vertical slice** exposes its behavior through three **slice entry points**, one per registry domain.
- **Label3D** (3D, billboarded text in-canvas) is a different subsystem from **Label** / **RichTextLabel** (2D DOM text in the **Control overlay**).
- An **AnimationPlayer** references one **Animation library** via `libraries/`; the library's **GodotAnimation**s carry **Track**s that the **Animation transport** plays by building a `THREE.AnimationClip` and driving a `THREE.AnimationMixer` rooted at the **Animation root** (ADR-0011).
- An **AnimationTree driver** owns no clips: it evaluates its `tree_root` at the authored `parameters/*` into a **blend program** and drives the **AnimationPlayer** or **GLB animation driver** its `anim_player` resolves to, found via the **AnimationDriverRegistry** (ADR-0019).

## Example dialogue

> **Dev:** "When `main.tscn` loads — its root is a Node3D with a Hallway plus five CanvasLayer UI scenes — which **viewport mode** do we default to?"
> **Architect:** "3D, because the root is spatial. The five **Control overlay** subtrees don't render in 3D mode — same as Godot's own 3D editor viewport — but we surface a 'contains 2D UI' hint so the user can flip the toggle."
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
