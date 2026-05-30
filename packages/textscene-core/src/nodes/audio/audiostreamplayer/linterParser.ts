/** AudioStreamPlayer strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('AudioStreamPlayer', {
  stream: v.resourceReference('stream'),
  volume_db: v.float('volume_db'),
  pitch_scale: v.positiveFloat('pitch_scale'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  max_polyphony: v.int('max_polyphony', { min: 1 }),
});
