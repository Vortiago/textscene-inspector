/**
 * PathFollow3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const ROTATION_MODE = { 0: 'NONE', 1: 'Y', 2: 'XY', 3: 'XYZ', 4: 'ORIENTED' };

validatorRegistry.registerAll('PathFollow3D', {
  // set_progress (path_3d.cpp:450) opens with ERR_FAIL_COND(!isfinite), so
  // `inf`/`nan` are refused here even though they are legal float literals
  // elsewhere. The path offset itself is unbounded.
  progress: v.float('progress', { finite: 'path_3d.cpp:450' }),
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
