/**
 * Marker3D strict validators for linting — the cross-gizmo `gizmo_extents` size.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Marker3D', {
  // marker_3d.cpp:49 hints "0,10,0.01,or_greater,suffix:m" — `or_greater` opens
  // the top. set_gizmo_extents (:37) only compares before assigning, so the
  // floor warns.
  gizmo_extents: v.float('gizmo_extents', { min: 0, hinted: { min: 'marker_3d.cpp:49' } }),
});
