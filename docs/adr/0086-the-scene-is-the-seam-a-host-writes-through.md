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
  lays a second overlay.
- **Layers**, lowest first: the file with its instance overrides, the host writes, the animated
  values (empty today), the Live scene passes. A pass result lies over a host write.
- **Setters.** A stored property takes the value cast as `Object::set` casts it, and answers whether
  the cast is strict (`class_db.cpp:1647-1690`). A property with no storage is ported per class
  family, with the cache Godot keeps. A class takes every family of its bases. A family answers first
  for a stored property too, where Godot's setter writes more than the property, as a Control's anchor
  does. A setter that reads up the tree, such as `global_position`, reads the parent through the
  parent's own getter, so one port serves each level.
- **Loading.** The class table and the defaults load on the first `get` or `set`, outside the first
  chunk of the webview (ADR-0055).
- **Redraw.** The writes of one task make one notice, so every view draws one frame for them.

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
