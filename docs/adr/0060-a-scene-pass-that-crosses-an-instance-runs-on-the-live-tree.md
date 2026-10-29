# A scene pass that crosses an instance runs on the live tree

- Status: Accepted
- Related: ADR-0013 (the instance root merge), ADR-0045 (a scene pass is an implemented drive).

## Context

A scene pass hands a component what it cannot reach itself: the node a NodePath on it names. Godot
resolves that path with `get_node_or_null` on the live tree (`mesh_instance_3d.cpp:175-199`), so the
node may sit inside an instance, or the path may leave one. A pass that reads only the nodes of the
root file runs before any sub-scene loads, so it binds nothing across an instance border. A
sub-scene's nodes are shared by every instance of it, so a pass cannot write its result into a node.

## Decision

A type that drives through such a pass declares `NodeComponentRegistration.scenePass: true`. The
pass is a `LiveScenePass`: a function of one `LiveTree` that returns a result per live node path.

- `liveScenePassResults` runs a pass once for each live tree, so every reader shares one run. A
  load builds a new tree, so a sub-scene that arrives after the root binds then.
- A component reads its result by the pass and its own node path (`useLiveScenePass`). It
  re-renders only where its result changes identity, so a pass hands back the same result for an
  input that a load leaves as it is. A component that cannot be bound asks with no path, so it
  watches no load, and the pass never runs for a scene where nothing binds.
- A NodePath resolves from the live path of the node that writes it. A `%Name` reads the table of
  that node where it is an instance root, then its owner's (`nodePathUniquePaths`, `node.cpp:1930-1938`).
- A pass that drives properties returns a `NodePatch` per live node path: the property values laid
  over the node. `liveNodePatches` runs the RemoteTransform pass, then the CSGPolygon3D path pass over
  its placements, and `useLivePatchedNode` hands a node its patch. A pass never writes into a node. `scripts/livePatchReaders.test.mjs` fails for a reader of a live node
  that neither lays the patches over it nor states why its reads need no overlay.

The Skeleton3D pass (`bindMeshesToSkeletons`) is a live pass. A Skeleton3D with no
SkeletonModifier3D child keeps one automatic skin for each node object, since its pose is a function
of the node's own properties. A Skeleton3D with a modifier child keys its skin by its live path, since
a modifier reads the scene around the skeleton and two instances of one sub-scene pose differently.
A type registers its edit as a `poseModifier` beside a scene pass, and a load that leaves the
skin as it was hands back the same array.

## Considered Options

- **Compose the sub-scenes into the parse, then run the passes.** Rejected. Sub-scenes load lazily
  (ADR-0013), so the parse would wait on every load, and the live tree would be built twice.
- **Run every live pass on each tree, in the registry.** Rejected. The reader names the pass, so a
  pass runs only when a reader asks for it. The registration declares only the drive, which the
  sheet guards of ADR-0045 read.
