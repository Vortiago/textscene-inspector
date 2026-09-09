/** CSGCylinder3D strict validators for linting. */

import '../csgprimitive3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CSGCylinder3D', {
  // set_radius/set_height (csg_shape.cpp:1855-1869) are bare assignments; the
  // hints (:1847-1848) are advisory only.
  radius: v.float('radius', { min: 0.001, hinted: 'csg_shape.cpp:1847' }),
  height: v.float('height', { min: 0.001, hinted: 'csg_shape.cpp:1848' }),
  // set_sides:1876 ERR_FAIL_COND(p_sides < 3): the floor is enforced. The
  // hint's (:1849) ceiling of 64 is closed (no or_greater) but never checked
  // by the setter, so it is a warning, not an error.
  sides: v.int('sides', {
    min: 3,
    max: 64,
    enforced: { min: 'csg_shape.cpp:1876' },
    hinted: { max: 'csg_shape.cpp:1849' },
  }),
  cone: v.boolean('cone'),
  smooth_faces: v.boolean('smooth_faces'),
  material: v.resourceReference('material'),
});
