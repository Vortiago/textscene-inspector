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
  // Ungrounded, and cannot be grounded against this repo's Godot reference:
  // AreaLight3D does not exist anywhere in Godot 4.6.3 (no `AreaLight` hit in
  // the engine source at all), so there is no ADD_PROPERTY hint or setter to
  // cite. See this slice's comparison.md ("the node postdates that build") —
  // the bound is left as a plain error rather than guessed at.
  area_range: v.positiveFloat('area_range'),
  area_size: v.vector2('area_size'),
  area_normalize_energy: v.boolean('area_normalize_energy'),
});
