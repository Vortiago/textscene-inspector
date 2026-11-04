/**
 * Strict parser validation for SeparationRayShape3D's OWN properties.
 */

// Registers the Shape3D tier this class inherits from, and through it the
// Resource tier the chain terminates at, so an inherited key still resolves
// when this module is loaded on its own.
import '../shape3d/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('SeparationRayShape3D', {
  // separation_ray_shape_3d.cpp:88 hints "0.001,100,…,or_greater", so the ceiling is open and
  // never warns. `set_length` (:61) assigns straight through, so the floor only warns.
  length: v.float('length', { min: 0.001, hinted: { min: 'separation_ray_shape_3d.cpp:88' } }),
  slide_on_slope: v.boolean('slide_on_slope'),
});
