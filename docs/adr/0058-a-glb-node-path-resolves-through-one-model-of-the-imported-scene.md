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
- A Skeleton3D and a BoneAttachment3D are frame groups: a `THREE.Group` that holds the root bones of
  the skeleton, or the nodes that hang on one bone. `groupFrames` makes them after the importer's
  tags, and `flattenGlbObjects` looks through them, so a relative path does not change. A write of
  `transform` or `visible` to a Skeleton3D lands on its group. A BoneAttachment3D takes the pose of
  its bone (`bone_attachment_3d.cpp:311`), so a `transform` there is ignored with a warning.
- A skinned mesh sits in skeleton space with its transform reset (`gltf_document.cpp:5919`). Its
  node transform in Godot is the frame matrix times its own, and `godotMatrixWorld` gives it.
- The drive properties of the two frames (`bone_name`, `override_pose` and the others) are issue
  #980. A write to one warns once and names the issue.
- Rejected: a fuzzy match that falls back when the exact path fails. It gives the wrong answer
  silently, and it needs a second model to explain a miss.

## Consequences

A property of a node that Godot makes a bone (a node under a joint, before 4.5 or with
`import_as_skeleton_bones`) is relative to the bone's rest pose in Godot. `writeNodeTransform` and
`composeTracksOntoRestPose` compose a write or a track onto that rest pose, which
`godotBoneRest` holds.
