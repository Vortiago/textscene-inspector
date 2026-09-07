/** CSGPolygon3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { csgShapeValidators } from '../sharedLinter.js';

const MODE = { 0: 'DEPTH', 1: 'SPIN', 2: 'PATH' };
const INTERVAL_TYPE = { 0: 'DISTANCE', 1: 'SUBDIVIDE' };
const PATH_ROTATION = { 0: 'POLYGON', 1: 'PATH', 2: 'PATH_FOLLOW' };

// Ranges are Godot's own editor hints (csg_shape.cpp:2601-2612). `transform` comes from
// the Node3D base walk and is deliberately not shadowed here.
validatorRegistry.registerAll('CSGPolygon3D', {
  polygon: v.packedVector2Array('polygon'),
  mode: v.enumInt('mode', 0, 2, MODE),
  depth: v.positiveFloat('depth'),
  spin_degrees: v.float('spin_degrees', { min: 1, max: 360 }),
  spin_sides: v.int('spin_sides', { min: 3, max: 64 }),
  path_node: v.nodePath('path_node'),
  path_interval_type: v.enumInt('path_interval_type', 0, 1, INTERVAL_TYPE),
  path_interval: v.positiveFloat('path_interval'),
  path_simplify_angle: v.float('path_simplify_angle', { min: 0, max: 180 }),
  path_rotation: v.enumInt('path_rotation', 0, 2, PATH_ROTATION),
  path_rotation_accurate: v.boolean('path_rotation_accurate'),
  path_local: v.boolean('path_local'),
  path_continuous_u: v.boolean('path_continuous_u'),
  // Godot's hint is `0,10,or_greater`, so zero is legal and means "no U scaling".
  path_u_distance: v.nonNegativeFloat('path_u_distance'),
  path_joined: v.boolean('path_joined'),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  ...csgShapeValidators,
});
