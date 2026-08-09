/**
 * AreaLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * Light3D base validators (light_* / shadow_*) are inherited via the
 * base-walk: AreaLight3D → Light3D → Node3D.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('AreaLight3D', {
  // Ungrounded against this repo's Godot reference, which is pinned at 4.6.3:
  // AreaLight3D postdates that build and has no `AreaLight` hit in it at all,
  // so there is no ADD_PROPERTY hint or setter to cite. The bound is left as a
  // plain error rather than guessed at, and becomes citable when the pin moves.
  area_range: v.positiveFloat('area_range'),
  area_size: v.vector2('area_size'),
  area_normalize_energy: v.boolean('area_normalize_energy'),
});
