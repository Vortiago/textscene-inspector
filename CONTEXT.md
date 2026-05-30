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
The validating parser used only for linting — reports every syntax/format error as a `ParseError` with line/column.
_Avoid_: "validator" (reserve for property validators).

### Code organization

**Vertical slice**:
All code for one Node type co-located in one folder — parser, linter, formatter, render component, and tests — the organizing principle the codebase is being unified toward.
_Avoid_: "module" (reserve for the architecture sense), "feature folder".

**Split slice** (current, being removed):
The transitional state where a Node type's parser/linter/formatter live in `nodes/<category>/<type>/` while its render component lives in a parallel `r3f/nodes/<type>/`.
_Avoid_: "the layout".

**React-free linter boundary**:
The hard invariant that the linter bundle never transitively imports React or THREE — preserved because `linter/index.ts` imports only each slice's `linterParser.ts` + `linter.ts`, never its `Component.tsx`.
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
The decision to render physics bodies (`StaticBody3D`, `Area3D`, and kin) as transform-only `<group>`s that position their children, with no simulation and no own geometry.
_Avoid_: "physics body" implying simulation; "transform container" (collides with Godot's Container Controls).

**Resource event bus** / `useResource`:
The async resource pipeline — a render component calls `useResource(path, type)`, the host `ResourceLoader` fetches, and a `loaded`/`missing` event resolves the hook; backs textures, GLB meshes, and PackedScene instancing.
_Avoid_: "asset loader" (reserve `ResourceLoader` for the host implementation).

**PackedScene instancing**:
A Node with `instance = ExtResource("scene_id")` whose referenced `.tscn`/`.glb` is loaded and injected as children under a nested resources provider.
_Avoid_: "include", "prefab".

**Synthetic render type**:
A render-only component with no parser and no linter (`GenericNodeFallback`, `GLBSceneRoot`) — not a user-authorable TSCN type; lives in `r3f/internal/`, not a Node slice.
_Avoid_: "default node".

## Relationships

- A **SceneGraph** holds many **Node**s; the active scene's root Nodes feed the **NodeDispatcher** (3D) or, in 2D **viewport mode**, the **ControlDispatcher**.
- A **Node** references **ExtResource**s and **SubResource**s by id; the **resource event bus** resolves ExtResources to files.
- A **CollisionShape3D** Node references one **collision-shape resource**; the **collision gizmo** reads the latter through the former.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) are keyed by the same `typeName` but kept separate to preserve the **React-free linter boundary**.
- A unified **vertical slice** exposes its behavior through three **slice entry points**, one per registry domain.
- **Label3D** (3D, billboarded text in-canvas) is a different subsystem from **Label** / **RichTextLabel** (2D DOM text in the **Control overlay**).

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
