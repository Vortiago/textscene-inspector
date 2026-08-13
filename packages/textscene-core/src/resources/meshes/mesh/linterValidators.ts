/**
 * What Godot declares on `Mesh`, the abstract base under ArrayMesh and the
 * PrimitiveMesh family.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Mesh', {
  // mesh.cpp:820's ADD_PROPERTY, a Variant::VECTOR2I with no hint;
  // `set_lightmap_size_hint` (mesh.cpp:799-801) is a bare assignment, so a
  // negative extent is as legal as any other and only the format is checkable.
  lightmap_size_hint: v.vector2i('lightmap_size_hint'),
});
