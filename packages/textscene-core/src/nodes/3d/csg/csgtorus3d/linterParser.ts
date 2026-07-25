/** CSGTorus3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

// Ranges are Godot's own editor hints (csg_shape.cpp:2072-2075). `transform` is
// deliberately NOT re-declared: the Node3D base walk supplies it, and a shadow copy
// here would drift from the base without anything noticing.
validatorRegistry.registerAll('CSGTorus3D', {
  inner_radius: v.positiveFloat('inner_radius'),
  outer_radius: v.positiveFloat('outer_radius'),
  sides: v.int('sides', { min: 3, max: 64 }),
  ring_sides: v.int('ring_sides', { min: 3, max: 64 }),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  operation: v.enumInt('operation', 0, 2, OPERATION),
});
