# BoneAttachment3D engine notes

Every cite is Godot 4.6.3 source. A bare `:line` is `scene/3d/bone_attachment_3d.cpp`.

## Why the `bone_idx` bound cites `_check_bind`

`linterParser.ts` cites the `bone_idx` floor on `_check_bind` (`:117-118`), not on the setter.

- `set_bone_idx` (`:190-214`) has no `ERR_FAIL`. Its guard (`:199`) and rewrite (`:201`) sit
  inside `if (sk)` (`:198`), which needs a skeleton.
- `get_skeleton()` reads `get_parent()` (`:139`), and PackedScene sets properties at
  `packed_scene.cpp:492`, before parenting a new node (`packed_scene.cpp:541`). A typeless override acts on the existing node with its parent in place.
- On ENTER_TREE (`:275`), `_check_bind` rewrites -2 to `find_bone(bone_name)`.

## Bone poses before tree entry

A parented index setter reads the global bone pose before tree entry (`:207-211,311`).
A later reset changes the local position, rotation and scale (`skeleton_3d.cpp:908-914`).
Outside the tree these setters leave cached global poses intact (`skeleton_3d.cpp:856-888`).
The next global read starts at the first cached ancestor (`skeleton_3d.cpp:532-563`).
