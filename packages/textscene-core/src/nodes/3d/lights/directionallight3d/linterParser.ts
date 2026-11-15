/**
 * DirectionalLight3D hand rows: only what the engine source says and ClassDB cannot report.
 * Every other key takes the check its ClassDB capture row implies, and the base-walk
 * DirectionalLight3D → Light3D → Node3D delivers the light_* and shadow_* validators.
 */

import '../shared/linterParser.js';
import { registerPropertyFacts } from '../../../../godot/classdb/propertyDescriptor.js';
import { DIRECTIONAL_SHADOW_MODE_NAMES } from '../../../../godot/rendering/lights/directionalShadow.js';
import { DIRECTIONAL_LIGHT_SKY_MODE_NAMES } from '../../../../godot/rendering/lights/directionalLightSkyMode.js';

// The enum constant names the messages print, which the capture lacks (#261).
registerPropertyFacts('DirectionalLight3D', {
  directional_shadow_mode: { labels: DIRECTIONAL_SHADOW_MODE_NAMES },
  sky_mode: { labels: DIRECTIONAL_LIGHT_SKY_MODE_NAMES },
});
