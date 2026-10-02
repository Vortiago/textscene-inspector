/**
 * Gives a declared omni or spot light the shadow that draws into the positional shadow atlas, in
 * place of the one three built with the light.
 */

import * as THREE from 'three';
import { AtlasOmniShadow } from './atlasOmniShadow.js';
import { AtlasSpotShadow } from './atlasSpotShadow.js';

/** An omni or spot light whose shadow draws into the atlas. */
export type AtlasLight =
  (THREE.PointLight & { shadow: AtlasOmniShadow }) | (THREE.SpotLight & { shadow: AtlasSpotShadow });

/**
 * The light, its shadow replaced once. The new shadow copies what the light's component set on the
 * old one (`LightShadow.copy`), and react-three-fiber sets each later change on the light's current
 * shadow. The old shadow frees the map three built for it.
 */
export function adoptAtlasShadow(light: THREE.PointLight | THREE.SpotLight): AtlasLight {
  if (light instanceof THREE.SpotLight) {
    if (!(light.shadow instanceof AtlasSpotShadow))
      light.shadow = replaced(light.shadow, new AtlasSpotShadow());
    return light as AtlasLight;
  }
  if (!(light.shadow instanceof AtlasOmniShadow))
    light.shadow = replaced(light.shadow, new AtlasOmniShadow());
  return light as AtlasLight;
}

function replaced<T extends THREE.LightShadow>(old: THREE.LightShadow, next: T): T {
  const map = next.map;
  next.copy(old);
  next.map = map;
  old.dispose();
  return next;
}
