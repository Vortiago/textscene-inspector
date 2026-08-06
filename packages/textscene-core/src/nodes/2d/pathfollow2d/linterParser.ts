/**
 * PathFollow2D strict validators for linting. 2D uses `rotates` (bool), not the
 * 3D `rotation_mode` enum.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PathFollow2D', {
  // set_progress (path_2d.cpp:425) opens with ERR_FAIL_COND(!isfinite), so
  // `inf`/`nan` are refused here even though they are legal float literals
  // elsewhere. The path offset itself is unbounded.
  progress: v.float('progress', { finite: 'path_2d.cpp:425' }),
  progress_ratio: v.float('progress_ratio'),
  h_offset: v.float('h_offset'),
  v_offset: v.float('v_offset'),
  rotates: v.boolean('rotates'),
  cubic_interp: v.boolean('cubic_interp'),
  loop: v.boolean('loop'),
});
