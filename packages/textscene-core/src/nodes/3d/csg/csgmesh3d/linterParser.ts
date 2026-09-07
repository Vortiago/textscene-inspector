/** CSGMesh3D strict validators for linting. */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { csgShapeValidators } from '../sharedLinter.js';

// `transform` comes from the Node3D base walk and is deliberately not shadowed here.
validatorRegistry.registerAll('CSGMesh3D', {
  mesh: v.resourceReference('mesh'),
  material: v.resourceReference('material'),
  flip_faces: v.boolean('flip_faces'),
  ...csgShapeValidators,
});
