/**
 * What Godot declares on `Shape3D`, so every 3D collision shape validates it.
 * Both are hint-tier only: `set_custom_solver_bias` (shape_3d.cpp:50) and
 * `set_margin` (:63) hand the value straight to the physics server.
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Shape3D', {
  // shape_3d.cpp:155 hints "0,1,0.001": both ends closed, no `or_greater`, so
  // each is a real hint bound rather than an open end.
  custom_solver_bias: v.float('custom_solver_bias', {
    min: 0,
    max: 1,
    hinted: { min: 'shape_3d.cpp:155', max: 'shape_3d.cpp:155' },
  }),
  // shape_3d.cpp:156 hints "0,10,0.001,or_greater": the ceiling is open and
  // never warns, so only the floor is declared.
  margin: v.float('margin', { min: 0, hinted: { min: 'shape_3d.cpp:156' } }),
});
