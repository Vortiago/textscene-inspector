/**
 * Environment property validation, entirely through the shared `v` combinators.
 *
 * One module per Godot property group, because the declaration is long and the
 * group is what a reader checking a citation is already looking at.
 *
 * Each entry names its own property, so it emits an `INVALID_<PROPERTY>_*` code
 * rather than one shared across unrelated properties, and the enum entries name
 * Godot's own constants instead of printing a bare numeric range.
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
