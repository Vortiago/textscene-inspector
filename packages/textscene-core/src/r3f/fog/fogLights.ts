/**
 * The lights the volumetric fog scatters, packed as Godot's light buffers hold them for the fog
 * pass (`storage_rd/light_storage.cpp:636-670,840-910`, 4.7.2 `:1054-1094` for the area light):
 * view-space positions and directions, and a colour already times the light's energy and its fog
 * energy. One row of texels per light.
 */

import * as THREE from 'three';
import {
  LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT,
  SPOT_ANGLE_ATTENUATION_DEFAULT,
  VOLUMETRIC_FOG_LIGHT_ENERGY_MIN,
} from '../../godot/volumetricFog.js';
import { visibleInTree } from '../visibleInTree.js';
import { readFogLightDeclaration } from './fogLightDeclaration.js';
import { readAreaLightFalloff } from '../areaLight/areaLightFalloff.js';

/**
 * Each row's RGBA texels: position and inverse range, colour and distance decay, direction and
 * cone cosine, cone exponent and kind, then an area light's width and height. An area light's
 * direction texel carries its inverse centre range in place of the cone cosine.
 */
export const FOG_LIGHT_TEXELS = 6;

const ROW_LENGTH = FOG_LIGHT_TEXELS * 4;

/** The kind in a row's last texel, which the fog shader branches on. */
export const FogLightKind = {
  DIRECTIONAL: 0,
  OMNI: 1,
  SPOT: 2,
  AREA: 3,
} as const;

type Kind = (typeof FogLightKind)[keyof typeof FogLightKind];

/** Godot's floor on a positional light's range (`light_storage.cpp:895`). */
const RANGE_MIN = 0.001;

/** Scratch for one row, overwritten by each light. */
const position = new THREE.Vector3();
const towards = new THREE.Vector3();
const axis = new THREE.Vector3();
const row = new Float32Array(ROW_LENGTH);

/**
 * The rows of every visible light the fog scatters, rewritten in place by each `pack`. three's
 * `intensity` is already Godot's `light_energy * PI` with its sign and distance fade
 * (`lightConstants.ts`), and its colour is linear, as in Godot's buffer.
 */
export class FogLightRows {
  /** The rows, `count` of them, then unused space. */
  data = new Float32Array(ROW_LENGTH);
  count = 0;

  /** Packs `lights` as `camera` sees them, and answers whether any row changed. */
  pack(lights: readonly THREE.Light[], camera: THREE.Camera): boolean {
    let count = 0;
    let hasChanged = false;
    for (const light of lights) {
      if (!visibleInTree(light) || !writeRow(light, camera)) continue;
      this.reserve(count + 1);
      const start = count * ROW_LENGTH;
      for (let i = 0; i < ROW_LENGTH; i++) {
        if (this.data[start + i] !== row[i]) hasChanged = true;
        this.data[start + i] = row[i]!;
      }
      count++;
    }
    hasChanged ||= count !== this.count;
    this.count = count;
    return hasChanged;
  }

  private reserve(rows: number): void {
    if (this.data.length >= rows * ROW_LENGTH) return;
    const grown = new Float32Array(rows * 2 * ROW_LENGTH);
    grown.set(this.data);
    this.data = grown;
  }
}

/** Writes `light`'s row into the scratch row, or answers false for a light the fog skips. */
function writeRow(light: THREE.Light, camera: THREE.Camera): boolean {
  const kind = fogLightKind(light);
  if (kind === null) return false;
  const declaration = readFogLightDeclaration(light);
  const fogEnergy = declaration?.energy ?? LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT;
  if (fogEnergy <= VOLUMETRIC_FOG_LIGHT_ENERGY_MIN) return false;
  row.fill(0);
  const energy = light.intensity * fogEnergy;
  writeTriple(4, light.color.r * energy, light.color.g * energy, light.color.b * energy);
  row[13] = kind;
  if (kind === FogLightKind.DIRECTIONAL) {
    // Godot's directional row points towards the light, its basis +Z (`light_storage.cpp:640`).
    const { x, y, z } = targetDirection(light as THREE.DirectionalLight, camera).negate();
    writeTriple(8, x, y, z);
    return true;
  }
  const { x, y, z } = viewPosition(light, camera);
  writeTriple(0, x, y, z);
  if (kind === FogLightKind.AREA) return writeArea(light as THREE.RectAreaLight, camera);
  const positional = light as THREE.PointLight | THREE.SpotLight;
  row[3] = 1 / Math.max(RANGE_MIN, positional.distance);
  row[7] = positional.decay;
  if (kind === FogLightKind.OMNI) return true;
  const spot = light as THREE.SpotLight;
  const travel = targetDirection(spot, camera);
  writeTriple(8, travel.x, travel.y, travel.z);
  row[11] = Math.cos(spot.angle);
  // The cone exponent is the inverse of `spot_angle_attenuation` (`light_storage.cpp:914`).
  row[12] = 1 / (declaration?.spotAngleAttenuation ?? SPOT_ANGLE_ATTENUATION_DEFAULT);
  return true;
}

/**
 * An area light's range, attenuation, facing and rectangle, as 4.7.2 packs them
 * (`light_storage.cpp:1059-1094`). Its rectangle ignores the node's scale, as Godot's does. A
 * light without a falloff, such as a GLB light, is left out.
 */
function writeArea(light: THREE.RectAreaLight, camera: THREE.Camera): boolean {
  const falloff = readAreaLightFalloff(light);
  if (!falloff) return false;
  const range = Math.max(RANGE_MIN, falloff.range);
  row[3] = 1 / range;
  // The fog's falloff takes the attenuation less one (4.7.2 `volumetric_fog_process.glsl:647`).
  row[7] = falloff.attenuation - 1;
  writeViewAxis(8, light, 0, 0, -1, 1, camera);
  row[11] = 1 / (range + Math.hypot(light.width, light.height) / 2);
  writeViewAxis(16, light, 1, 0, 0, light.width, camera);
  writeViewAxis(20, light, 0, 1, 0, light.height, camera);
  return true;
}

/** The light's local axis (`x`, `y`, `z`) in view space, `length` long, at `offset` of the row. */
function writeViewAxis(
  offset: number,
  light: THREE.Light,
  x: number,
  y: number,
  z: number,
  length: number,
  camera: THREE.Camera
): void {
  axis.set(x, y, z).transformDirection(light.matrixWorld).transformDirection(camera.matrixWorldInverse);
  writeTriple(offset, axis.x * length, axis.y * length, axis.z * length);
}

function writeTriple(offset: number, x: number, y: number, z: number): void {
  row[offset] = x;
  row[offset + 1] = y;
  row[offset + 2] = z;
}

function fogLightKind(light: THREE.Light): Kind | null {
  if ((light as THREE.DirectionalLight).isDirectionalLight) return FogLightKind.DIRECTIONAL;
  if ((light as THREE.SpotLight).isSpotLight) return FogLightKind.SPOT;
  if ((light as THREE.PointLight).isPointLight) return FogLightKind.OMNI;
  if ((light as THREE.RectAreaLight).isRectAreaLight) return FogLightKind.AREA;
  return null;
}

function viewPosition(light: THREE.Light, camera: THREE.Camera): THREE.Vector3 {
  return position.setFromMatrixPosition(light.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
}

/** The world direction `light` shines along, from itself to its target, unnormalised, into `out`. */
export function shineDirection(
  light: THREE.DirectionalLight | THREE.SpotLight,
  out: THREE.Vector3
): THREE.Vector3 {
  position.setFromMatrixPosition(light.matrixWorld);
  return out.setFromMatrixPosition(light.target.matrixWorld).sub(position);
}

/** The unit view-space direction a light shines along, from itself to its target. */
function targetDirection(
  light: THREE.DirectionalLight | THREE.SpotLight,
  camera: THREE.Camera
): THREE.Vector3 {
  return shineDirection(light, towards).transformDirection(camera.matrixWorldInverse);
}
