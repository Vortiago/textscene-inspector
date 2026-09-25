# BoneAttachment3D engine notes

Every cite is Godot 4.6.3 source. A bare `:line` is `scene/3d/bone_attachment_3d.cpp`.

## Why the `bone_idx` bound cites `_check_bind`

`linterParser.ts` cites the `bone_idx` floor on `_check_bind` (`:117-118`), not on the setter.

- `set_bone_idx` (`:190-214`) has no `ERR_FAIL`. Its guard (`:199`) and rewrite (`:201`) sit
  inside `if (sk)` (`:198`), which is dead at load.
- `get_skeleton()` reads `get_parent()` (`:139`), and PackedScene sets properties at
  `packed_scene.cpp:492`, before parenting (`packed_scene.cpp:541`).
- On ENTER_TREE (`:275`), `_check_bind` rewrites -2 to `find_bone(bone_name)`.
