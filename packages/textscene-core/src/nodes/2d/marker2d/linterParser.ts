/**
 * Marker2D strict validators for linting — the cross-gizmo `gizmo_extents` size.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Marker2D', {
  // marker_2d.cpp:105 hints "0,1000,0.1,or_greater,suffix:px" — `or_greater`
  // opens the top. set_gizmo_extents (:93) is a bare assignment, so the floor warns.
  gizmo_extents: v.float('gizmo_extents', { min: 0, hinted: { min: 'marker_2d.cpp:105' } }),
});
