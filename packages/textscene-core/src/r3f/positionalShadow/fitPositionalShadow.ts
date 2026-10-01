/**
 * Sizes an omni or spot light's shadow map and PCF kernel to the slot Godot's positional shadow atlas
 * gives the light for the camera about to render. Godot keeps one atlas per viewport. Here a light
 * keeps one map, so two cameras that give it different slots reallocate the map between them.
 */

import * as THREE from 'three';
import {
  omniShadowCubeSize,
  omniShadowKernelAngle,
  positionalShadowSlotSize,
} from '../../godot/positionalShadowAtlas.js';
import { isViewingCamera, type ViewingCamera } from '../directionalShadow/fitDirectionalShadowBox.js';
import { omniShadowCoverage, spotShadowCoverage } from './shadowCoverage.js';

/**
 * `softShadowScale` is the light's own. A light that casts no shadow, or a camera without a depth
 * range, keeps the map as it is.
 */
export function fitPositionalShadow(
  light: THREE.PointLight | THREE.SpotLight,
  camera: THREE.Camera,
  softShadowScale: number
): void {
  if (!light.castShadow || !isViewingCamera(camera)) return;
  if ('isSpotLight' in light) fitSpotShadow(light, camera, softShadowScale);
  else fitOmniShadow(light, camera, softShadowScale);
}

/**
 * three offsets the unit lookup direction by `radius / mapSize` (r186
 * `shadowmap_pars_fragment.glsl.js:381`), an angle in radians, so the radius is Godot's angle in
 * texels of a cube face.
 */
function fitOmniShadow(light: THREE.PointLight, camera: ViewingCamera, softShadowScale: number): void {
  const position = light.getWorldPosition(new THREE.Vector3());
  const slotSize = positionalShadowSlotSize(omniShadowCoverage(position, light.distance, camera));
  const faceSize = omniShadowCubeSize(slotSize);
  resizeShadowMap(light.shadow, faceSize);
  light.shadow.radius = omniShadowKernelAngle(softShadowScale, slotSize) * faceSize;
}

/**
 * Godot's spot kernel spans `soft_shadow_scale` atlas texels
 * (`servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl:847`), and the slot holds
 * the map at the atlas's own resolution, so the radius is that many texels of the map.
 */
function fitSpotShadow(light: THREE.SpotLight, camera: ViewingCamera, softShadowScale: number): void {
  const position = light.getWorldPosition(new THREE.Vector3());
  const direction = light.target.getWorldPosition(new THREE.Vector3()).sub(position).normalize();
  const coverage = spotShadowCoverage(position, direction, light.distance, light.angle, camera);
  resizeShadowMap(light.shadow, positionalShadowSlotSize(coverage));
  light.shadow.radius = softShadowScale;
}

/**
 * three resizes a 2D map at its next render but never a cube one (r186 `WebGLShadowMap.js:281`), so a
 * new size drops the map, and three allocates one at that size. An unchanged size keeps the map.
 */
export function resizeShadowMap(shadow: THREE.LightShadow, size: number): void {
  if (shadow.mapSize.x === size && shadow.mapSize.y === size) return;
  shadow.mapSize.set(size, size);
  shadow.map?.dispose();
  shadow.map = null;
}
