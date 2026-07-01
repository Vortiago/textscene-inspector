/** AudioStreamPlayer strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const busValidator: PropertyValidator = (key, value, line) => {
  if (!value.startsWith('"') && !value.startsWith('&"')) {
    return propertyError(key, line, `Property 'bus' must be a string, got: "${value}"`, 'INVALID_BUS_FORMAT');
  }
  return null;
};

validatorRegistry.registerAll('AudioStreamPlayer', {
  stream: v.resourceReference('stream'),
  volume_db: v.float('volume_db'),
  pitch_scale: v.positiveFloat('pitch_scale'),
  playing: v.boolean('playing'),
  autoplay: v.boolean('autoplay'),
  stream_paused: v.boolean('stream_paused'),
  bus: busValidator,
  max_polyphony: v.int('max_polyphony', { min: 1 }),
});
