/** RemoteTransform3D strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only this slice resolves
// an inherited key only when this line imports the ancestor.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// Node3D's spatial validators arrive through the nodeBaseTypes chain, so only the type's own keys
// register here.
validatorRegistry.registerAll('RemoteTransform3D', {
  remote_path: v.nodePath('remote_path'),
  update_position: v.boolean('update_position'),
  update_rotation: v.boolean('update_rotation'),
  update_scale: v.boolean('update_scale'),
  use_global_coordinates: v.boolean('use_global_coordinates'),
});
