/**
 * Resolves a Godot class name to its docs URL and its engine source file. The
 * path is not derivable (`scene/3d/light_3d.h`, `modules/csg/csg_shape.h`), so
 * each candidate is verified by its `GDCLASS(<Name>,` macro. An unresolved class
 * gets no `source` and a loud console.error: a missing link is honest.
 */

export { fetchSourceIndex } from './godotLinks/sourceIndex.mjs';
// Existence proves nothing: an ancestor walk lands on a real but wrong header
// (CSGBox3D on `visual_instance_3d.h`) and every chain ends at `node.h`. Nor does
// `class <Name>`: `scene/resources/material.h:138` only forward-declares
// `class StandardMaterial3D;`.
export { makeResolver } from './godotLinks/resolve.mjs';
export { mapPool } from './godotLinks/pool.mjs';

export const docsUrl = (name) =>
  `https://docs.godotengine.org/en/stable/classes/class_${name.toLowerCase()}.html`;
