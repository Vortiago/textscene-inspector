/** CSGPolygon3D strict validators for linting. */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };
const MODE = { 0: 'DEPTH', 1: 'SPIN', 2: 'PATH' };
const INTERVAL_TYPE = { 0: 'DISTANCE', 1: 'SUBDIVIDE' };
const PATH_ROTATION = { 0: 'POLYGON', 1: 'PATH', 2: 'PATH_FOLLOW' };

// Ranges are Godot's own editor hints (csg_shape.cpp:2601-2612). `transform` comes from
// the Node3D base walk and is deliberately not shadowed here.
validatorRegistry.registerAll('CSGPolygon3D', {
  polygon: v.packedVector2Array('polygon'),
  // set_mode:2639-2645 is a bare assignment; the hint (:2600) is advisory.
  mode: v.enumInt('mode', 0, 2, MODE, { hinted: 'csg_shape.cpp:2600' }),
  // set_depth:2651 ERR_FAIL_COND(p_depth < 0.001): the real floor is 0.001,
  // not the ~0 `positiveFloat` used to carry — a value like 0.0005 loaded
  // here but was refused by Godot.
  depth: v.float('depth', { min: 0.001, enforced: 'csg_shape.cpp:2651' }),
  // set_spin_degrees:2681 ERR_FAIL_COND(p_spin_degrees < 0.01 ||
  // p_spin_degrees > 360): the real floor is 0.01, not the hint's (:2602)
  // displayed minimum of 1 — a value like 0.5 loaded here but was refused.
  spin_degrees: v.float('spin_degrees', {
    min: 0.01,
    max: 360,
    enforced: 'csg_shape.cpp:2681',
  }),
  // set_spin_sides:2692 ERR_FAIL_COND(p_spin_sides < 3): the floor is
  // enforced. The hint's (:2603) ceiling of 64 is closed (no or_greater) but
  // never checked by the setter, so it is a warning, not an error.
  spin_sides: v.int('spin_sides', {
    min: 3,
    max: 64,
    enforced: { min: 'csg_shape.cpp:2692' },
    hinted: { max: 'csg_shape.cpp:2603' },
  }),
  path_node: v.nodePath('path_node'),
  // set_path_interval_type:2711-2714 is a bare assignment; the hint (:2605)
  // is advisory.
  path_interval_type: v.enumInt('path_interval_type', 0, 1, INTERVAL_TYPE, {
    hinted: 'csg_shape.cpp:2605',
  }),
  // set_path_interval:2716-2719 is a bare assignment; the hint (:2606) is
  // advisory only.
  path_interval: v.float('path_interval', { min: 0.01, hinted: 'csg_shape.cpp:2606' }),
  // set_path_simplify_angle:2728-2732 is a bare assignment; the hint (:2607)
  // is advisory only.
  path_simplify_angle: v.float('path_simplify_angle', {
    min: 0,
    max: 180,
    hinted: 'csg_shape.cpp:2607',
  }),
  // set_path_rotation:2743-2748 is a bare assignment; the hint (:2608) is
  // advisory.
  path_rotation: v.enumInt('path_rotation', 0, 2, PATH_ROTATION, {
    hinted: 'csg_shape.cpp:2608',
  }),
  path_rotation_accurate: v.boolean('path_rotation_accurate'),
  path_local: v.boolean('path_local'),
  path_continuous_u: v.boolean('path_continuous_u'),
  // Godot's hint is `0,10,or_greater` (csg_shape.cpp:2612), so zero is legal
  // and means "no U scaling"; set_path_u_distance:2670-2674 is a bare
  // assignment.
  path_u_distance: v.nonNegativeFloat('path_u_distance', { hinted: 'csg_shape.cpp:2612' }),
  path_joined: v.boolean('path_joined'),
  smooth_faces: v.boolean('smooth_faces'),
  flip_faces: v.boolean('flip_faces'),
  material: v.resourceReference('material'),
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // CSGShape3D::set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
});
