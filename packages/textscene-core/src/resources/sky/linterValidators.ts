/**
 * Sky property validation (`scene/resources/sky.cpp:84-86`). `set_radiance_size` refuses an index
 * past its table (`:34`), an error. `set_process_mode` stores any value (`:47-50`), so only the
 * enum hint bounds it, a warning.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';
import { SKY_PROCESS_MODE_NAMES, SKY_RADIANCE_SIZE_NAMES } from '../../godot/scene/sky.js';

validatorRegistry.registerAll('Sky', {
  process_mode: v.enumInt('process_mode', SKY_PROCESS_MODE_NAMES, { hinted: 'sky.cpp:84' }),
  radiance_size: v.enumInt('radiance_size', SKY_RADIANCE_SIZE_NAMES, { enforced: 'sky.cpp:34' }),
  sky_material: v.resourceReference('sky_material'),
});
