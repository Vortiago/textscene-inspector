/**
 * Camera3D hand rows: only what the engine source says and ClassDB cannot report. Every other
 * key takes the check its ClassDB capture row implies (`godot/classdb/propertyDescriptor.ts`).
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves
// an inherited key only if the ancestor is pulled in too.
import '../../base/node3d/linterParser.js';
import { registerPropertyFacts } from '../../../godot/classdb/propertyDescriptor.js';
import { CMP_EPSILON } from '../../../godot/math/math.js';
import { DOPPLER_TRACKING_NAMES } from '../../../godot/scene/audio.js';
import { CAMERA_3D_KEEP_ASPECT_NAMES, CAMERA_3D_PROJECTION_NAMES } from '../../../godot/scene/camera3d.js';

// `labels` gives the enum constant names the messages print, which the capture lacks: it
// holds only the hint labels.
registerPropertyFacts('Camera3D', {
  // `set_projection` assigns only inside `if (p_mode==PERSPECTIVE||ORTHOGONAL||FRUSTUM)`, so an
  // out-of-enum value is dropped, which ADR-0032 counts as enforced.
  projection: { setter: { cite: 'camera_3d.cpp:341' }, labels: CAMERA_3D_PROJECTION_NAMES },
  // ERR_FAIL_COND(p_fov < 1 || p_fov > 179) refuses at the hint's ends. The message keeps the
  // unit the hint's `degrees` flag shows.
  fov: {
    setter: { cite: 'camera_3d.cpp:725' },
    message: "Property 'fov' must be between 1 and 179 degrees",
  },
  // ERR_FAIL_COND(p_size <= CMP_EPSILON) refuses the endpoint too. The hint's 0.001 floor sits
  // above it, so the band between them loads and only warns.
  size: { setter: { cite: 'camera_3d.cpp:731', min: { at: CMP_EPSILON, exclusive: true } } },
  cull_mask: { width: 'uint32' /* camera_3d.h:177 */ },
  keep_aspect: { labels: CAMERA_3D_KEEP_ASPECT_NAMES },
  doppler_tracking: { labels: DOPPLER_TRACKING_NAMES },
});
