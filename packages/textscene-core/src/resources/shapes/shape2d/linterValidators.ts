/**
 * What Godot declares on `Shape2D` itself, so every 2D collision shape in a
 * `.tscn` validates it.
 *
 * `margin` is Shape3D's alone — Shape2D declares no counterpart — so the two
 * tiers are siblings that mirror the engine rather than one hoisted base.
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Shape2D', {
  // shape_2d.cpp:109 hints "0,1,0.001" — both ends closed. `set_custom_solver_bias`
  // (:40) bare-assigns to the physics server, so there is no enforced tier.
  custom_solver_bias: v.float('custom_solver_bias', {
    min: 0,
    max: 1,
    hinted: { min: 'shape_2d.cpp:109', max: 'shape_2d.cpp:109' },
  }),
});
