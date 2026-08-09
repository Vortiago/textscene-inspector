/**
 * Resolve a Godot class name to its documentation URL and its engine source file.
 *
 * The docs URL is pure derivation. The source path is NOT derivable: OmniLight3D
 * lives in `scene/3d/light_3d.h`, CSGBox3D in `modules/csg/csg_shape.h`. So the
 * candidate is found three ways — snake_case filename, then the class's ancestor
 * chain, then a curated override — and every candidate is then VERIFIED by
 * fetching the file and looking for its `GDCLASS(<Name>,` macro.
 *
 * Verification is the load-bearing part. Existence alone is not enough: an
 * ancestor walk lands on a real-but-wrong header (CSGBox3D would resolve to
 * `visual_instance_3d.h`), and every chain terminates at `node.h`, which always
 * exists — so an existence check can never fail and would emit silent lies. A
 * `class <Name>` substring is not enough either: `scene/resources/material.h:138`
 * is a bare forward declaration `class StandardMaterial3D;`, 774 lines above the
 * definition. Only `GDCLASS(<Name>,` marks the real thing.
 *
 * An unresolved class gets NO `source` field and a loud console.error. A missing
 * link is honest; a wrong one is not.
 *
 * The parts live in `godotLinks/`: `sourceIndex` (what headers exist), `headers`
 * (fetching one and checking its GDCLASS), `resolve` (the candidate strategies)
 * and `pool` (bounded fan-out).
 */

export const docsUrl = (name) =>
  `https://docs.godotengine.org/en/stable/classes/class_${name.toLowerCase()}.html`;
