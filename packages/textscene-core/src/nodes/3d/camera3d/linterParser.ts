// Loads the base chain, so a slice test resolves inherited keys.
import '../../base/node3d/linterParser.js';
import { registerPropertyFacts } from '../../../godot/classdb/propertyDescriptor.js';
import { CMP_EPSILON } from '../../../godot/math/math.js';
import { DOPPLER_TRACKING_NAMES } from '../../../godot/scene/audio.js';
import { CAMERA_3D_KEEP_ASPECT_NAMES, CAMERA_3D_PROJECTION_NAMES } from '../../../godot/scene/camera3d.js';

registerPropertyFacts('Camera3D', {
  projection: { setter: { cite: 'camera_3d.cpp:341' }, labels: CAMERA_3D_PROJECTION_NAMES },
  fov: {
    setter: { cite: 'camera_3d.cpp:725' },
    message: "Property 'fov' must be between 1 and 179 degrees",
  },
  size: { setter: { cite: 'camera_3d.cpp:731', min: { at: CMP_EPSILON, exclusive: true } } },
  keep_aspect: { labels: CAMERA_3D_KEEP_ASPECT_NAMES },
  doppler_tracking: { labels: DOPPLER_TRACKING_NAMES },
});
