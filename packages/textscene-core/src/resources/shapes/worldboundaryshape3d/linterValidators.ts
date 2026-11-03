/**
 * Strict parser validation for WorldBoundaryShape3D's OWN property.
 */

// Registers the Shape3D tier this class inherits from, and through it the
// Resource tier the chain terminates at, so an inherited key still resolves
// when this module is loaded on its own.
import '../shape3d/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('WorldBoundaryShape3D', {
  // world_boundary_shape_3d.cpp:118 stores any plane, so the format is the whole contract.
  plane: v.plane('plane'),
});
