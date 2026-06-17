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
The lenient parser's shared primitives for reading a raw property string into a typed scalar/vector — `intOr`/`floatOr`/`boolOr`/`enumOr`/`vec2Or` (take a fallback, always return) and `parseOptionalInt` (returns `undefined` when unset). One contract: fall back **silently when absent**, **warn-then-fall-back when present but unparseable**. Wraps the canonical leaf scanners (`parseVector2`/`parseVector3` in `parser/vectors.ts`, `parseColor` in `utils/colorParser.ts`), which share `FLOAT_PATTERN_SOURCE` — the one float regex accepting scientific notation (`1e-05`, which Godot emits) and rejecting malformed components outright; one-off structured literals (`Vector2i`, `Rect2`, `frame_coords`) and divergent leaf parsers (the throwing `parseColor` in `standardmaterial3d`, the `undefined`-returning `parseVector2` in `control`) stay in their slice.
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
_Avoid_: "barrel" for these (reserve "barrel" for the three aggregating files below).

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
The Control property deciding how a node is positioned — `0` free position, `1` anchors, `2` container-managed (parent lays out the child; anchors ignored); in this corpus `2` is the majority and takes precedence.
_Avoid_: treating anchors as the primary path.

**Anchor / offset**:
Godot Control layout properties (`anchors_preset`, `anchor_*`, `offset_*`, `grow_*`) decoded via the full LayoutPreset 0..15 table to CSS absolute positioning; used only when `layout_mode` is not `2`.
_Avoid_: "margin" (reserve for `MarginContainer` → CSS padding).

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
A Node with `instance = ExtResource("scene_id")` whose referenced `.tscn`/`.glb` is loaded and injected as children under a nested resources provider.
_Avoid_: "include", "prefab".

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
One channel of a **GodotAnimation** targeting `NodePath("Node:property")` with ordered **Keyframe**s (time + value + transition); slice-1 supports `value` tracks for `position`/`rotation`/`rotation_degrees`/`scale`. Other track types (`bezier`/`method`/`audio`/`animation`) and other properties parse but do not yet drive.
_Avoid_: "channel".

**Animation transport**:
The play/pause/scrub state (`AnimationTransportContext`) and its dock-tab UI, bound to the **AnimationPlayer currently selected in the scene tree** — selection-driven, one player at a time, mirroring the Godot editor's Animation panel. Drives that player's `THREE.AnimationMixer`; starts STOPPED (authored pose preserved), play is user-initiated. The tab is shown only while an AnimationPlayer is selected; deselecting (or selecting a different node) stops playback and restores the authored pose.
_Avoid_: "scene-level transport" (it follows selection, not the whole scene); "timeline" / "player controls" for the whole transport (reserve "timeline"/"scrubber" for the seek widget).

**RESET animation**:
Godot's conventional rest-pose animation, named exactly `RESET` — one keyframe per animated property at t=0 holding its default value, used by the editor for reset-on-save. Listed in the clip selector like any animation but never the **Animation transport**'s default selection (the `autoplay` clip is). 
_Avoid_: treating `RESET` as an ordinary playable clip.

**Animation root** (`root_node`):
The THREE object a clip's **Track** NodePaths resolve against and the **AnimationPlayer**'s mixer is rooted on — default `..` (the player's parent node). `THREE.PropertyBinding` resolves a Track's target by name through the dispatcher's (unnamed) pickable wrappers; the named, transform-bearing object the binding finds is the one the mixer overrides.
_Avoid_: "target root".

## Relationships

- A **SceneGraph** holds many **Node**s; the active scene's root Nodes feed the **NodeDispatcher** (3D) or, in 2D **viewport mode**, the **ControlDispatcher**.
- A **Node** references **ExtResource**s and **SubResource**s by id; the **resource event bus** resolves ExtResources to files.
- A **CollisionShape3D** Node references one **collision-shape resource**; the **collision gizmo** reads the latter through the former.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) are keyed by the same `typeName` but kept separate to preserve the **React-free linter boundary**.
- A unified **vertical slice** exposes its behavior through three **slice entry points**, one per registry domain.
- **Label3D** (3D, billboarded text in-canvas) is a different subsystem from **Label** / **RichTextLabel** (2D DOM text in the **Control overlay**).
- An **AnimationPlayer** references one **Animation library** via `libraries/`; the library's **GodotAnimation**s carry **Track**s that the **Animation transport** plays by building a `THREE.AnimationClip` and driving a `THREE.AnimationMixer` rooted at the **Animation root** (ADR-0011).

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
