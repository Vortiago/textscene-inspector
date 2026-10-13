/**
 * The lights the volumetric fog scatters, packed as Godot's light buffers hold them for the fog
 * pass (`storage_rd/light_storage.cpp:636-670,840-910`): view-space positions and directions, and a
 * colour already times the light's energy and its fog energy. One row of texels per light.
 */

import * as THREE from 'three';
import {
  LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT,
  SPOT_ANGLE_ATTENUATION_DEFAULT,
  VOLUMETRIC_FOG_LIGHT_ENERGY_MIN,
} from '../../godot/volumetricFog.js';
import { visibleInTree } from '../visibleInTree.js';
import { readFogLightDeclaration } from './fogLightDeclaration.js';

/**
 * Each row's RGBA texels: position and inverse range, colour and distance decay, direction and
 * cone cosine, then cone exponent and kind.
 */
export const FOG_LIGHT_TEXELS = 4;

/** The kind in a row's last texel, which the fog shader branches on. */
export const FogLightKind = {
  DIRECTIONAL: 0,
  OMNI: 1,
  SPOT: 2,
} as const;

/** Godot's floor on a positional light's range (`light_storage.cpp:895`). */
const RANGE_MIN = 0.001;

/**
 * Every visible light the fog scatters, in the camera's view space. three's `intensity` is already
 * Godot's `light_energy * PI` (`lightConstants.ts`), and its colour is linear, as in Godot's buffer.
 */
export function packFogLights(scene: THREE.Object3D, camera: THREE.Camera): Float32Array {
  const rows: number[] = [];
  scene.traverse((object) => {
    const light = object as THREE.Light;
    if (!light.isLight || !visibleInTree(light)) return;
    const kind = fogLightKind(light);
    if (kind === null) return;
    const declaration = readFogLightDeclaration(light);
    const fogEnergy = declaration?.energy ?? LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT;
    if (fogEnergy <= VOLUMETRIC_FOG_LIGHT_ENERGY_MIN) return;
    rows.push(...fogLightRow(light, kind, fogEnergy, declaration?.spotAngleAttenuation, camera));
  });
  return Float32Array.from(rows);
}

type Kind = (typeof FogLightKind)[keyof typeof FogLightKind];

function fogLightKind(light: THREE.Light): Kind | null {
  if ((light as THREE.DirectionalLight).isDirectionalLight) return FogLightKind.DIRECTIONAL;
  if ((light as THREE.SpotLight).isSpotLight) return FogLightKind.SPOT;
  if ((light as THREE.PointLight).isPointLight) return FogLightKind.OMNI;
  return null;
}

function fogLightRow(
  light: THREE.Light,
  kind: Kind,
  fogEnergy: number,
  spotAngleAttenuation: number | undefined,
  camera: THREE.Camera
): number[] {
  const position = light.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse);
  const color = light.color.clone().multiplyScalar(light.intensity * fogEnergy);
  if (kind === FogLightKind.DIRECTIONAL) {
    // Godot's directional row points towards the light, its basis +Z (`light_storage.cpp:640`).
    const towardsLight = targetDirection(light as THREE.DirectionalLight, camera).negate();
    return [0, 0, 0, 0, color.r, color.g, color.b, 0, ...towardsLight.toArray(), 0, 0, kind, 0, 0];
  }
  const positional = light as THREE.PointLight | THREE.SpotLight;
  const inverseRange = 1 / Math.max(RANGE_MIN, positional.distance);
  const head = [...position.toArray(), inverseRange, color.r, color.g, color.b, positional.decay];
  if (kind === FogLightKind.OMNI) return [...head, 0, 0, 0, 0, 0, kind, 0, 0];
  // The cone exponent is the inverse of `spot_angle_attenuation` (`light_storage.cpp:914`).
  const spot = light as THREE.SpotLight;
  const travel = targetDirection(spot, camera);
  const coneExponent = 1 / (spotAngleAttenuation ?? SPOT_ANGLE_ATTENUATION_DEFAULT);
  return [...head, ...travel.toArray(), Math.cos(spot.angle), coneExponent, kind, 0, 0];
}

/** The unit view-space direction a light shines along, from itself to its target. */
function targetDirection(
  light: THREE.DirectionalLight | THREE.SpotLight,
  camera: THREE.Camera
): THREE.Vector3 {
  const from = light.getWorldPosition(new THREE.Vector3());
  const to = light.target.getWorldPosition(new THREE.Vector3());
  return to.sub(from).transformDirection(camera.matrixWorldInverse);
}
