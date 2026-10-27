# A GLB node path resolves through one model of the imported scene

- Status: Accepted
- Related: ADR-0014 (the GLB animation driver), ADR-0008 (typed nodes inside a GLB).

## Context

A scene names a node inside an instanced `.glb` by the path Godot's glTF importer gives it. The
importer builds nodes that three's graph does not hold (a `Skeleton3D`, a `BoneAttachment3D` for
each bone with a child, and a skinned mesh moved under its `Skeleton3D`), and it names every node
by a rule that depends on `gltf/naming_version` and `nodes/import_as_skeleton_bones`. Overrides,
typed nodes, sidecar layers and animation tracks each matched a path to three's graph in their own
way, and the matchers guessed: an ordered subsequence of the names, or the nearest ancestor. A
guess binds the wrong node when two nodes share a name, and it hides a path that is wrong.

## Decision

One function, `gltfImportScene` in `godot/import/`, gives each glTF node its full Godot path from
the importer's source (`gltf_document.cpp`). A loaded GLB carries those paths on its objects, and
every consumer finds an object by the whole path. A path that names no node logs one warning and
binds nothing.

- `gltfImportScene.godot.json` holds the paths of a headless Godot import, and a test compares the
  model with it for every file, naming version and bone mode. `measure.mjs` writes it again.
- A Skeleton3D and a BoneAttachment3D are frame groups (`frameGroups.ts`), so a write to either node
  has an object to land on. Lookups see through the groups, so a relative path does not change.
- A skinned mesh sits in skeleton space as in Godot (`skinnedMeshSpace.ts`). Ask `godotMatrixWorld`
  for the matrix of its node, never `matrixWorld`.
- The drive properties of the two frames are not read. A write warns once and names issue #980.
- Rejected: a fuzzy match that falls back when the exact path fails. It gives the wrong answer
  silently, and it needs a second model to explain a miss.

## Consequences

A write to a node that Godot makes a bone (an override or a track) composes onto the rest pose the
object holds. `boneRest.ts` is the one place that does it.
