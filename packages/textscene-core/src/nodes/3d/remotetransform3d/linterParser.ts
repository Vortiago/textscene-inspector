/** RemoteTransform3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('RemoteTransform3D', {
  transform: v.transform3d('transform'),
  remote_path: v.nodePath('remote_path'),
  update_position: v.boolean('update_position'),
  update_rotation: v.boolean('update_rotation'),
  update_scale: v.boolean('update_scale'),
  use_global_coordinates: v.boolean('use_global_coordinates'),
});
