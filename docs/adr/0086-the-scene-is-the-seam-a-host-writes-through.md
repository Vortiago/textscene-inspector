# The scene is the seam a host writes through

- Status: Accepted
- Related: ADR-0013 (the instance root merge), ADR-0060 (a scene pass runs on the live tree), ADR-0055
  (the webview bundle ceiling).

## Context

A script reaches Godot with an object, a property name from ClassDB and a Variant value
(`object.cpp:357`, `:440`). A scene file's own values reach a node through the same `set` when the
scene is instanced (`packed_scene.cpp:492`). No script runs in this project, so a host's own code
must be able to do what a script does: find a node, change a property, and see the change drawn.

## Decision

The scene that `openScene` gives is the one seam between a host and the renderer. It holds the text,
the resource loader, and the host's writes. It imports no React and no three.js.

- **Finding.** `getNode` walks a NodePath as `Node::get_node_or_null` does (`node.cpp:1892-1952`):
  relative, `..`, `%Name` and `/root`. The walk reads the Live scene tree through a port the renderer
  binds (`bindSceneRuntime`), so a node inside a sub-scene is found once its scene loads.
- **Values.** A boolean, a number and a string pass as they are. Any other type is `variant(text)`,
  the port of `str_to_var`. `scene.load(path)` is the port of `load`.
- **One write path.** `set` keeps the value as Variant text by live path. The written graph lays it
  over the file as an instance override: on the node's own heading, or as an override heading below
  the nearest instance. Every reader of the Live scene tree reads it as a file value, so no reader
  lays a second overlay. The property store and write replay load with the accessor tables on first use.
  Until then a view reads the parse directly. Each written graph also records the latest setter revision for each property
  at its live path. A SubViewport reads its own revisions because setting either ONCE mode again
  arms that mode, even when its value stays the same (`renderer_viewport.cpp:373-377,920-922,1113-1118,1170-1175`).
- **Layers**, lowest first: the file with its instance overrides, the host writes, the animated
  values, the Live scene passes. A pass result lies over a host write. The animated layer stays empty
  until #1500 writes its animated patch there.
- **Setters.** A stored property takes the value cast as `Object::set` casts it, and answers whether
  the cast is strict (`class_db.cpp:1647-1690`). A property with no storage is ported per class
  family, with the cache Godot keeps. A class takes every family of its bases. A family answers first
  for a stored property too, where Godot's setter writes more than the property, as a Control's anchor
  does. A setter that reads up the tree, such as `global_position`, reads the parent through the
  parent's own getter, so one port serves each level.
- **Calls.** `call(method, ...args)` runs a method this release ports, else a setter or a getter by
  the name ClassDB gives it (`get_property_setter`, `get_property_getter`), which reaches `set` or
  `get`. An indexed setter, such as `set_anchor`, takes the index first. Any other method throws with
  the class and the method. `set` and `get` of a property whose setter or getter is a ported method
  run that method, so `set('current', true)` is `set_current(true)`.
- **Current cameras.** The scene keeps the current Camera3D and Camera2D of each viewport, as
  `Viewport` keeps them: the root window and each SubViewport apart. Until a call moves it, the state
  is the enter rule over the loaded tree (`camera_3d.cpp:189-191`, `camera_2d.cpp:353-355`), so a
  sub-scene that loads late enters where the game enters it. After a call, a camera that enters or
  exits moves the state as `_camera_3d_add` and `_camera_3d_remove` do (`viewport.cpp:4565-4607`). A
  new text fills the state again. The In-game mode draws through it, and the editor's 3D view keeps
  its orbit. A current Camera3D that leaves hands the viewport over, and Godot keeps its `current`
  flag so it claims the viewport again when it re-enters (`camera_3d.cpp:215-219`). No node leaves
  and comes back in this release, so the scene keeps no such flag. A release that lets a host add or
  remove nodes must keep it.
- **Camera list.** `scene.cameras()` reads that state as one `CameraState` per camera inside the
  tree: its viewport, `isCurrent` for Godot's `is_current`, and `canBeCurrent`, false for a Camera2D
  that `make_current` refuses (`camera_2d.cpp:585`). The Cameras tab of the In-game view reads it.
- **Call errors.** A wrong count of arguments and an argument the binding cannot convert throw the
  text of Godot's error (`object.cpp:888`). `set` of a ported setter casts the value as `Object::set`
  does and answers whether the cast is strict (`class_db.cpp:1683`).
- **Loading.** The class table and the defaults load on the first `get` or `set`, outside the first
  chunk of the webview (ADR-0055).
- **Redraw.** The writes of one task give each view one notice. A reader renders when its selection
  changes. The walk reads the written node and its ancestors, whose children contain that node.

## What it changes in ADR-0060

ADR-0060's **node patch** stays the result of a Live scene pass. A host write is not a node patch: it
lies under the passes, in the graph the tree is built from, so `scripts/livePatchReaders.test.mjs`
needs no new reader.

## Considered Options

- **Typed values laid over the node, as a node patch.** Rejected. Only Node3D and Node2D read a patch,
  and the Control layout reads the node without it. The text form reaches every parser.
- **A second route through `useLiveDrawnNode`.** Rejected: it serves only Node3D and Node2D.
- **Rebuild the parse with the writes in the text.** Rejected. A write would parse the whole file
  again, and an override of a node inside an instance has no heading in the file to edit.

## Amendment: the apps use the package entry

The VS Code webview and the web previewer open their scene with `openScene` and import every name
of the renderer from `@textscene/renderer`, as an npm user does. They resolve it to its source in the
workspace (`scripts/workspaceRenderer.mjs`), so the view and the shell share one copy of core's
modules. A `no-restricted-imports` guard in `eslint.config.js` refuses a renderer name from core in
those apps. The shell takes the host's scene and leaves it open. Its panels still read the renderer's
private contexts, and #2054 owns that move.
