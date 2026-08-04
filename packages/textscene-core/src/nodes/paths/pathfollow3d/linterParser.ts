/**
 * PathFollow3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const ROTATION_MODE = { 0: 'NONE', 1: 'Y', 2: 'XY', 3: 'XYZ', 4: 'ORIENTED' };

validatorRegistry.registerAll('PathFollow3D', {
  progress: v.float('progress'),
  progress_ratio: v.float('progress_ratio'),
  h_offset: v.float('h_offset'),
  v_offset: v.float('v_offset'),
  // path_3d.cpp:517-524 is a bare assignment (only an equal-check early return);
  // no engine-side range check on the raw int.
  rotation_mode: v.enumInt('rotation_mode', 0, 4, ROTATION_MODE, { hinted: 'path_3d.cpp:436' }),
  cubic_interp: v.boolean('cubic_interp'),
  loop: v.boolean('loop'),
  tilt_enabled: v.boolean('tilt_enabled'),
  use_model_front: v.boolean('use_model_front'),
});
