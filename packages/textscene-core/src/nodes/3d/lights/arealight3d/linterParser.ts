/**
 * AreaLight3D strict validators. The base-walk AreaLight3D → Light3D → Node3D
 * delivers the light_* and shadow_* validators.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('AreaLight3D', {
  // Unbounded: AreaLight3D postdates the pinned 4.6.3 reference, so there is no
  // hint or setter to read. ADR-0032 puts an unread bound at the "nothing" tier,
  // so this stays a format check until the pin moves.
  area_range: v.float('area_range'),
  area_size: v.vector2('area_size'),
  area_normalize_energy: v.boolean('area_normalize_energy'),
});
