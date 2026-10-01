/**
 * Sizes an omni or spot light's shadow map, PCF kernel and normal bias to the slot Godot's
 * positional shadow atlas gives the light.
 */

import type * as THREE from 'three';
import { omniShadowCubeSize, omniShadowKernelAngle } from '../../godot/positionalShadowAtlas.js';
import { positionalShadowNormalBias } from '../../godot/positionalShadow.js';
import type { PositionalShadowDeclaration } from './declaration.js';

/** three's own shadow intensity, which a light with a slot keeps. */
const FULL_SHADOW = 1;

/**
 * A null slot draws no shadow: Godot sends an opacity of zero for a light the atlas holds no slot
 * for (`light_storage.cpp:947-1029`). The light's map stays as it is.
 */
export function fitPositionalShadow(
  light: THREE.PointLight | THREE.SpotLight,
  slotSize: number | null,
  declaration: PositionalShadowDeclaration
): void {
  light.shadow.intensity = slotSize === null ? 0 : FULL_SHADOW;
  if (slotSize === null) return;
  light.shadow.normalBias = positionalShadowNormalBias(declaration.normalBias, slotSize);
  if ('isSpotLight' in light) fitSpotShadow(light.shadow, slotSize, declaration.softShadowScale);
  else fitOmniShadow(light.shadow, slotSize, declaration.softShadowScale);
}

/**
 * three offsets the unit lookup direction by `radius / mapSize` (r186
 * `shadowmap_pars_fragment.glsl.js:381`), an angle in radians, so the radius is Godot's angle in
 * texels of a cube face.
 */
function fitOmniShadow(shadow: THREE.LightShadow, slotSize: number, softShadowScale: number): void {
  const faceSize = omniShadowCubeSize(slotSize);
  resizeShadowMap(shadow, faceSize);
  shadow.radius = omniShadowKernelAngle(softShadowScale, slotSize) * faceSize;
}

/**
 * Godot's spot kernel spans `soft_shadow_scale` atlas texels
 * (`servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl:847`), and the slot holds
 * the map at the atlas's own resolution, so the radius is that many texels of the map.
 */
function fitSpotShadow(shadow: THREE.LightShadow, slotSize: number, softShadowScale: number): void {
  resizeShadowMap(shadow, slotSize);
  shadow.radius = softShadowScale;
}

/**
 * three resizes a 2D map at its next render but never a cube one (r186 `WebGLShadowMap.js:281`), so a
 * map of another size is dropped, and three allocates one at the new size. The map's own width
 * decides, since a map another viewport rendered can arrive with this light's `mapSize` unchanged.
 */
export function resizeShadowMap(shadow: THREE.LightShadow, size: number): void {
  shadow.mapSize.set(size, size);
  if (!shadow.map || shadow.map.width === size) return;
  shadow.map.dispose();
  shadow.map = null;
}
