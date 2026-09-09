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
  // Unbounded: AreaLight3D postdates the pinned 4.6.3 reference and has no
  // `AreaLight` hit in it at all, so there is no ADD_PROPERTY hint and no setter
  // to read. ADR-0032 puts a bound nobody has read at the "nothing" tier — a
  // hint could only warn, and only a setter can error — so this stays a format
  // check until the pin moves and a real bound can be cited.
  area_range: v.float('area_range'),
  area_size: v.vector2('area_size'),
  area_normalize_energy: v.boolean('area_normalize_energy'),
});
