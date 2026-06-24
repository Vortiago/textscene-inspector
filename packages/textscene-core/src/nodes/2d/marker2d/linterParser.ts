/**
 * Marker2D strict validators for linting — the cross-gizmo `gizmo_extents` size.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Marker2D', {
  gizmo_extents: v.float('gizmo_extents'),
});
