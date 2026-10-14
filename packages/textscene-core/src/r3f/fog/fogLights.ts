/**
 * The lights the volumetric fog scatters, packed as Godot's light buffers hold them for the fog
 * pass (`storage_rd/light_storage.cpp:636-760,840-1029`, 4.7.2 `:1054-1094` for the area light):
 * view-space positions and directions, a colour already times the light's energy and its fog
 * energy, each shadow's lookup from view space, and an area light's rectangle. One row of texels
 * per light.
 */

import * as THREE from 'three';
import {
  LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT,
  SPOT_ANGLE_ATTENUATION_DEFAULT,
  VOLUMETRIC_FOG_LIGHT_ENERGY_MIN,
  VOLUMETRIC_FOG_SHADOW_OPACITY_MIN,
} from '../../godot/volumetricFog.js';
import { DIRECTIONAL_SHADOW_MAX_SPLITS } from '../../godot/directionalShadow.js';
import { splitSunOf } from '../directionalShadow/splitSun.js';
import { isAreaShadowLight } from '../positionalShadow/atlasAreaShadow.js';
import { AtlasOmniShadow } from '../positionalShadow/atlasOmniShadow.js';
import { AtlasSpotShadow } from '../positionalShadow/atlasSpotShadow.js';
import { lightPoseMatrix } from '../positionalShadow/lightPose.js';
import { visibleInTree } from '../visibleInTree.js';
import { readFogLightDeclaration } from './fogLightDeclaration.js';
import { AREA_LIGHT_AXES, areaLightViewAxis, readAreaLightFalloff } from '../areaLight/areaLightFalloff.js';
import { RowBuffer } from './packedRows.js';
import { writeVec4 } from './writeVec4.js';

/**
 * Where each value sits in a light's row, in texels of four floats. `CONE` holds the cone exponent,
 * the kind, the shadow opacity and a positional light's depth bias. `SHADOW_MATRICES` starts four
 * matrices of four columns: a directional light's splits, or one positional light's lookup.
 * `SHADOW_SPLITS` holds a directional light's split ends, or an omni or area light's paraboloid
 * slot. An area light's direction carries its inverse centre range where a spot holds its cone
 * cosine.
 */
export const FogLightTexel = {
  POSITION: 0,
  COLOR: 1,
  DIRECTION: 2,
  CONE: 3,
  SHADOW_MATRICES: 4,
  SHADOW_SPLITS: 20,
  SHADOW_RANGES: 21,
  SHADOW_FADE: 22,
  AREA_WIDTH: 23,
  AREA_HEIGHT: 24,
} as const;

/** Where each value sits in the cone texel, as an index into the row. */
const Cone = {
  EXPONENT: FogLightTexel.CONE * 4,
  KIND: FogLightTexel.CONE * 4 + 1,
  SHADOW_OPACITY: FogLightTexel.CONE * 4 + 2,
  SHADOW_BIAS: FogLightTexel.CONE * 4 + 3,
} as const;

/** The texels in each row. */
export const FOG_LIGHT_TEXELS = FogLightTexel.AREA_HEIGHT + 1;

const ROW_LENGTH = FOG_LIGHT_TEXELS * 4;

/** The kind in a row's cone texel, which the fog shader branches on. */
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
const worldToLight = new THREE.Matrix4();
const viewToShadow = new THREE.Matrix4();
const paraboloidRect = new THREE.Vector4();
const row = new Float32Array(ROW_LENGTH);

/**
 * The rows of every visible light the fog scatters, rewritten in place by each `pack`. three's
 * `intensity` is already Godot's `light_energy * PI` with its sign and distance fade
 * (`lightConstants.ts`), and its colour is linear, as in Godot's buffer.
 */
export class FogLightRows extends RowBuffer {
  /** Whether a row's shadow reads the directional atlas, and whether one reads the positional atlas. */
  readsDirectionalAtlas = false;
  readsPositionalAtlas = false;

  constructor() {
    super(ROW_LENGTH);
  }

  /** Whether any row's shadow reads an atlas. */
  get readsShadowAtlas(): boolean {
    return this.readsDirectionalAtlas || this.readsPositionalAtlas;
  }

  /** Packs `lights` as `camera` sees them, and answers whether any row changed. */
  pack(lights: readonly THREE.Light[], camera: THREE.Camera): boolean {
    this.begin();
    this.readsDirectionalAtlas = false;
    this.readsPositionalAtlas = false;
    for (const light of lights) {
      if (!visibleInTree(light) || !writeRow(light, camera)) continue;
      if (row[Cone.SHADOW_OPACITY]! > VOLUMETRIC_FOG_SHADOW_OPACITY_MIN) {
        if (row[Cone.KIND] === FogLightKind.DIRECTIONAL) this.readsDirectionalAtlas = true;
        else this.readsPositionalAtlas = true;
      }
      this.append(row);
    }
    return this.finish();
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
  writeTexel(FogLightTexel.COLOR, light.color.r * energy, light.color.g * energy, light.color.b * energy);
  row[Cone.KIND] = kind;
  if (kind === FogLightKind.DIRECTIONAL) {
    // Godot's directional row points towards the light, its basis +Z (`light_storage.cpp:640`).
    const { x, y, z } = targetDirection(light as THREE.DirectionalLight, camera).negate();
    writeTexel(FogLightTexel.DIRECTION, x, y, z);
    writeDirectionalShadow(light as THREE.DirectionalLight, camera);
    return true;
  }
  if (kind === FogLightKind.AREA) return writeArea(light as THREE.RectAreaLight, camera);
  const { x, y, z } = viewPosition(light, camera);
  const positional = light as THREE.PointLight | THREE.SpotLight;
  writeTexel(FogLightTexel.POSITION, x, y, z, 1 / Math.max(RANGE_MIN, positional.distance));
  row[FogLightTexel.COLOR * 4 + 3] = positional.decay;
  if (kind === FogLightKind.OMNI) {
    writeOmniShadow(light as THREE.PointLight, camera);
    return true;
  }
  const spot = light as THREE.SpotLight;
  const travel = targetDirection(spot, camera);
  writeTexel(FogLightTexel.DIRECTION, travel.x, travel.y, travel.z, Math.cos(spot.angle));
  // The cone exponent is the inverse of `spot_angle_attenuation` (`light_storage.cpp:914`).
  row[Cone.EXPONENT] = 1 / (declaration?.spotAngleAttenuation ?? SPOT_ANGLE_ATTENUATION_DEFAULT);
  writeSpotShadow(spot, camera);
  return true;
}

/**
 * An area light's range, attenuation, facing, rectangle and shadow, as 4.7.2 packs them
 * (`light_storage.cpp:1059-1094`, `:1150-1210`). Its rectangle ignores the node's scale, as Godot's does. A
 * light without a falloff, such as a GLB light, is left out.
 */
function writeArea(light: THREE.RectAreaLight, camera: THREE.Camera): boolean {
  const falloff = readAreaLightFalloff(light);
  if (!falloff) return false;
  const range = Math.max(RANGE_MIN, falloff.range);
  const { x, y, z } = viewPosition(light, camera);
  writeTexel(FogLightTexel.POSITION, x, y, z, 1 / range);
  // The fog's falloff takes the attenuation less one (4.7.2 `volumetric_fog_process.glsl:653`).
  row[FogLightTexel.COLOR * 4 + 3] = falloff.attenuation - 1;
  const inverseCentreRange = 1 / (range + Math.hypot(light.width, light.height) / 2);
  writeViewAxis(FogLightTexel.DIRECTION, light, AREA_LIGHT_AXES.facing, 1, camera, inverseCentreRange);
  writeViewAxis(FogLightTexel.AREA_WIDTH, light, AREA_LIGHT_AXES.width, light.width, camera);
  writeViewAxis(FogLightTexel.AREA_HEIGHT, light, AREA_LIGHT_AXES.height, light.height, camera);
  writeAreaShadow(light, camera);
  return true;
}

/** The light's `local` axis in view space, `length` long, in `texel` of the row. */
function writeViewAxis(
  texel: number,
  light: THREE.RectAreaLight,
  local: THREE.Vector3,
  length: number,
  camera: THREE.Camera,
  w = 0
): void {
  areaLightViewAxis(axis, local, light, camera);
  writeTexel(texel, axis.x * length, axis.y * length, axis.z * length, w);
}

/**
 * A light in Godot's shadow list casts through its split sun (`../directionalShadow/splitSun.ts`).
 * Each slot maps view space into the atlas, and a slot past the last split repeats it, as its
 * matrix does. A depth range is its split's box, near to far (`light_storage.cpp:726`).
 */
function writeDirectionalShadow(light: THREE.DirectionalLight, camera: THREE.Camera): void {
  const sun = splitSunOf(light);
  if (!sun) return;
  const { shadow } = sun;
  row[Cone.SHADOW_OPACITY] = shadow.intensity;
  for (let slot = 0; slot < DIRECTIONAL_SHADOW_MAX_SPLITS; slot++) {
    writeLookup(slot, shadow.getMatrix(slot), camera);
    const split = shadow.getCamera(Math.min(slot, shadow.splitCount - 1));
    row[FogLightTexel.SHADOW_SPLITS * 4 + slot] = shadow._cascadeData[slot]!.x;
    row[FogLightTexel.SHADOW_RANGES * 4 + slot] = split.far - split.near;
  }
  writeTexel(FogLightTexel.SHADOW_FADE, shadow.fade.from, shadow.fade.to, 0);
}

/**
 * An omni light with a slot looks up through Godot's world-to-light transform, and keeps its
 * paraboloids' rect beside it (`../positionalShadow/atlasOmniShadow.ts`).
 */
function writeOmniShadow(light: THREE.PointLight, camera: THREE.Camera): void {
  const { shadow } = light;
  if (!light.castShadow || !(shadow instanceof AtlasOmniShadow)) return;
  const rect = shadow.paraboloidRect(paraboloidRect);
  if (!rect) return;
  writeTexel(FogLightTexel.SHADOW_SPLITS, rect.x, rect.y, rect.z, rect.w);
  writePositionalShadow(shadow, lightPoseMatrix(light, worldToLight).invert(), camera);
}

/**
 * An area light with a slot looks up from its own space into its one paraboloid's slot
 * (`../positionalShadow/atlasAreaShadow.ts`).
 */
function writeAreaShadow(light: THREE.RectAreaLight, camera: THREE.Camera): void {
  if (!light.castShadow || !isAreaShadowLight(light)) return;
  const { shadow } = light;
  if (shadow.slot === null) return;
  const rect = shadow.slotUvRect(paraboloidRect);
  writeTexel(FogLightTexel.SHADOW_SPLITS, rect.x, rect.y, rect.z, rect.w);
  writePositionalShadow(shadow, lightPoseMatrix(light, worldToLight).invert(), camera);
}

/** A spot light with a slot looks up through its matrix into the slot (`../positionalShadow/atlasSpotShadow.ts`). */
function writeSpotShadow(light: THREE.SpotLight, camera: THREE.Camera): void {
  const { shadow } = light;
  if (!light.castShadow || !(shadow instanceof AtlasSpotShadow)) return;
  writePositionalShadow(shadow, shadow.matrix, camera);
}

function writePositionalShadow(
  shadow: THREE.LightShadow,
  worldToShadow: THREE.Matrix4,
  camera: THREE.Camera
): void {
  row[Cone.SHADOW_OPACITY] = shadow.intensity;
  row[Cone.SHADOW_BIAS] = shadow.bias;
  writeLookup(0, worldToShadow, camera);
}

/** Writes `worldToShadow` after the view's own world matrix, so it maps a view-space cell. */
function writeLookup(slot: number, worldToShadow: THREE.Matrix4, camera: THREE.Camera): void {
  viewToShadow.multiplyMatrices(worldToShadow, camera.matrixWorld);
  row.set(viewToShadow.elements, (FogLightTexel.SHADOW_MATRICES + slot * 4) * 4);
}

function writeTexel(texel: number, x: number, y: number, z: number, w = 0): void {
  writeVec4(row, texel, x, y, z, w);
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
