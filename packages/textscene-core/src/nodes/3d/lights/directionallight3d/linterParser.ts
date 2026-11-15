import '../shared/linterParser.js';
import { registerPropertyFacts } from '../../../../godot/classdb/propertyDescriptor.js';
import { DIRECTIONAL_SHADOW_MODE_NAMES } from '../../../../godot/rendering/lights/directionalShadow.js';
import { DIRECTIONAL_LIGHT_SKY_MODE_NAMES } from '../../../../godot/rendering/lights/directionalLightSkyMode.js';

registerPropertyFacts('DirectionalLight3D', {
  directional_shadow_mode: { labels: DIRECTIONAL_SHADOW_MODE_NAMES },
  sky_mode: { labels: DIRECTIONAL_LIGHT_SKY_MODE_NAMES },
});
