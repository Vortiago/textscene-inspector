/**
 * Sky property validation (`scene/resources/sky.cpp:84-86`). `set_radiance_size` refuses an index
 * past its table (`:34`), an error. `set_process_mode` stores any value (`:47-50`), so only the
 * enum hint bounds it, a warning.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

validatorRegistry.registerAll('Sky', {
  process_mode: v.enumInt(
    'process_mode',
    0,
    3,
    {
      0: 'PROCESS_MODE_AUTOMATIC',
      1: 'PROCESS_MODE_QUALITY',
      2: 'PROCESS_MODE_INCREMENTAL',
      3: 'PROCESS_MODE_REALTIME',
    },
    { hinted: 'sky.cpp:84' }
  ),
  radiance_size: v.enumInt(
    'radiance_size',
    0,
    6,
    {
      0: 'RADIANCE_SIZE_32',
      1: 'RADIANCE_SIZE_64',
      2: 'RADIANCE_SIZE_128',
      3: 'RADIANCE_SIZE_256',
      4: 'RADIANCE_SIZE_512',
      5: 'RADIANCE_SIZE_1024',
      6: 'RADIANCE_SIZE_2048',
    },
    { enforced: 'sky.cpp:34' }
  ),
  sky_material: v.resourceReference('sky_material'),
});
