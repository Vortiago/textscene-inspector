/**
 * What Godot declares on `Shape3D` itself, so every 3D collision shape in a
 * `.tscn` validates it.
 *
 * Both are hint-tier only: `set_custom_solver_bias` (shape_3d.cpp:50) and
 * `set_margin` (:63) are bare assignments that hand the value straight to the
 * physics server, so nothing is refused or altered and only the inspector's
 * own range has anything to say.
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Shape3D', {
  // shape_3d.cpp:155 hints "0,1,0.001" — BOTH ends closed, no `or_greater`, so
  // each is a real hint bound rather than an open end.
  custom_solver_bias: v.float('custom_solver_bias', {
    min: 0,
    max: 1,
    hinted: { min: 'shape_3d.cpp:155', max: 'shape_3d.cpp:155' },
  }),
  // shape_3d.cpp:156 hints "0,10,0.001,or_greater": the ceiling is OPEN and
  // never warns, so only the floor is declared.
  margin: v.float('margin', { min: 0, hinted: { min: 'shape_3d.cpp:156' } }),
});
