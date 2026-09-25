/**
 * What Godot declares on `PrimitiveMesh`, the abstract base every procedural
 * mesh carries and none of them declares.
 */

// Registers Mesh and, through it, Resource, so the inherited keys resolve when
// this module loads alone.
import '../mesh/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PrimitiveMesh', {
  // primitive_meshes.cpp:256, a Material slot: an ExtResource or an inline
  // SubResource, both of which `resourceReference` accepts.
  material: v.resourceReference('material'),
  // primitive_meshes.cpp:257. `set_custom_aabb` (:286) bare-assigns, and a
  // zero-size AABB is the documented "use the generated one" default, so only
  // the literal's shape is checkable.
  custom_aabb: v.aabb('custom_aabb'),
  // primitive_meshes.cpp:258
  flip_faces: v.boolean('flip_faces'),
  // primitive_meshes.cpp:259
  add_uv2: v.boolean('add_uv2'),
  // primitive_meshes.cpp:260 ("0,10,0.01,or_greater"). `set_uv2_padding` (:320)
  // bare-assigns, so the floor is the hint's and `or_greater` opens the ceiling.
  uv2_padding: v.nonNegativeFloat('uv2_padding', { hinted: 'primitive_meshes.cpp:260' }),
});
