/** RemoteTransform2D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('RemoteTransform2D', {
  transform: v.transform2d('transform'),
  position: v.vector2('position'),
  remote_path: v.nodePath('remote_path'),
  update_position: v.boolean('update_position'),
  update_rotation: v.boolean('update_rotation'),
  update_scale: v.boolean('update_scale'),
  use_global_coordinates: v.boolean('use_global_coordinates'),
});
