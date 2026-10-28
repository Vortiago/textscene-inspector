# A scene pass that crosses an instance runs on the live tree

- Status: Accepted
- Related: ADR-0013 (the instance root merge), ADR-0045 (a scene pass is an implemented drive).

## Context

A scene pass hands a component what it cannot reach itself: the node a NodePath on it names. Godot
resolves that path with `get_node_or_null` on the live tree (`mesh_instance_3d.cpp:175-199`), so the
node may sit inside an instance, or the path may leave one. A parse stage pass reads only the nodes
of the root file, before any sub-scene loads, so it binds nothing across an instance border. A
sub-scene's nodes are shared by every instance of it, so a pass cannot write its result into a node.

## Decision

A type that drives through such a pass declares the `live` stage in
`NodeComponentRegistration.scenePass`. The pass is a `LiveScenePass`: a function of one `LiveTree`
that returns a result per live node path.

- `liveScenePassResults` runs a pass once for each live tree, so every reader shares one run. A
  load builds a new tree, so a sub-scene that arrives after the root binds then.
- A component reads its result by the pass and its own node path (`useLiveScenePass`). It
  re-renders only where its result changes identity, so a pass hands back the same result for an
  input that a load leaves as it is. A component that cannot be bound asks with no path, so the
  pass never runs for a scene where nothing binds.
- A NodePath resolves from the live path of the node that writes it. A `%Name` reads the table of
  that node where it is an instance root, then its owner's (`nodePathUniquePaths`, `node.cpp:1930-1938`).
- The parse stages (`transforms`, `paths`) stay for a pass that has not moved. A pass runs on one
  stage only.

The Skeleton3D pass (`bindMeshesToSkeletons`) runs on the live stage. It keeps one automatic skin
for each Skeleton3D node object. That holds while the pose is a function of the node's own
properties. A pose that differs between two instances of one sub-scene, such as one an animation or
a modifier writes, keys the skin by the live path of the skeleton instead.

## Considered Options

- **Compose the sub-scenes into the parse, then run the passes.** Rejected. Sub-scenes load lazily
  (ADR-0013), so the parse would wait on every load, and the live tree would be built twice.
- **Run every live pass on each tree, in the registry.** Rejected. The reader names the pass, so a
  pass runs only when a reader asks for it. The registration declares only the drive, which the
  sheet guards of ADR-0045 read.
