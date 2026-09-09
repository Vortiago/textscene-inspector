/**
 * Validators shared by every CSGPrimitive3D-derived node: the six primitives,
 * not the combiner.
 *
 * Registered under the abstract key 'CSGPrimitive3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice; it reaches its
 * subclasses through the NODE_BASE_TYPES base-walk. Each primitive's
 * linterParser imports this module, which imports the CSGShape3D tier above it.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CSGPrimitive3D', {
  // csg_shape.cpp:1102; set_flip_faces:1105-1112 assigns and rebuilds.
  flip_faces: v.boolean('flip_faces'),
});
