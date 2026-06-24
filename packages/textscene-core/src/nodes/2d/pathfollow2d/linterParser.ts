/**
 * PathFollow2D strict validators for linting. 2D uses `rotates` (bool), not the
 * 3D `rotation_mode` enum.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PathFollow2D', {
  progress: v.float('progress'),
  progress_ratio: v.float('progress_ratio'),
  h_offset: v.float('h_offset'),
  v_offset: v.float('v_offset'),
  rotates: v.boolean('rotates'),
  cubic_interp: v.boolean('cubic_interp'),
  loop: v.boolean('loop'),
});
