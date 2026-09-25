/** RemoteTransform2D strict validators for linting. */

// Registration happens on import, so a test that loads only this slice
// resolves an inherited key only when this line imports the ancestor.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('RemoteTransform2D', {
  remote_path: v.nodePath('remote_path'),
  update_position: v.boolean('update_position'),
  update_rotation: v.boolean('update_rotation'),
  update_scale: v.boolean('update_scale'),
  use_global_coordinates: v.boolean('use_global_coordinates'),
});
