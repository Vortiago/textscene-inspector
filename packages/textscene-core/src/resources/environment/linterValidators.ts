/**
 * Environment property validation through the shared `v` combinators, one module per
 * Godot property group, as a reader checking a citation looks at the group. Each entry
 * emits its own `INVALID_<PROPERTY>_*` code, and an enum entry names Godot's constants.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { backgroundKeys } from './backgroundValidators.js';
import { fogKeys } from './fogValidators.js';
import { postProcessKeys } from './postProcessValidators.js';
import { screenSpaceKeys } from './screenSpaceValidators.js';

validatorRegistry.registerAll('Environment', {
  ...backgroundKeys,
  ...postProcessKeys,
  ...screenSpaceKeys,
  ...fogKeys,
});
