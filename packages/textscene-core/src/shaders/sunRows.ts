/**
 * The rows each directional light writes into the pooled rows of its kind (`lightRows.ts`): what
 * `light_compute` reads of it, and its shadow's split layout. A split layout is the fitter's
 * (`r3f/directionalShadow/fitDirectionalShadowSplits.ts`), which the shader module reads through
 * `SplitShadowLayout`, so the module imports no owner of it.
 */

import * as THREE from 'three';
import { DIRECTIONAL_SHADOW_MAX_SPLITS } from '../godot/rendering/lights/directionalShadow.js';
import { declaredLightOf } from './lights/declaredLight.js';
import { lightSizeDeclaration, lightSpecularDeclaration } from './lights/lightDeclarations.js';
import type { RowWrite } from './lightRows.js';

/** Godot draws at most 8 directional lights (`scene_forward_clustered.glsl:2286`). */
export const MAX_SUNS = 8;

/**
 * Every shadow on the sun path holds this many slots, so a light's slots sit at fixed rows. A light
 * with fewer splits leaves the slots past its last split undrawn.
 */
export const SPLIT_SLOTS = DIRECTIONAL_SHADOW_MAX_SPLITS;

/** The rows of one slot matrix the lookup reads. Its fourth row is always (0, 0, 0, 1). */
export const SLOT_MATRIX_ROWS = 3;

/** The row after the split matrices. */
const MATRICES_END = 2 + SPLIT_SLOTS + SPLIT_SLOTS * SLOT_MATRIX_ROWS;

/** Each field's first row in a light's slot. */
export const SUN_ROW = {
  /** The view-space direction towards the light, and its size offset `A`. */
  direction: 0,
  /** The colour times the energy, and the specular amount. */
  colour: 1,
  /** One row per split slot: its far end, depth bias, normal bias and blend start. */
  splits: 2,
  /** Three rows per split slot: the slot's world-to-atlas matrix. */
  matrices: 2 + SPLIT_SLOTS,
  /** The fade's two depths, the shadow's opacity and its filter radius. */
  shadow: MATRICES_END,
  /** The atlas size in texels, and the soft shadow angle. */
  atlas: MATRICES_END + 1,
  /** Each split slot's range start, for the blocker search. */
  rangeBegins: MATRICES_END + 2,
  /** The world-space direction towards the light. */
  worldDirection: MATRICES_END + 3,
} as const;

export const SUN_ROWS = SUN_ROW.worldDirection + 1;

/** How far a blocker sits towards the light at least, in both the patch and the node lookup. */
export const SUN_PANCAKE = 1e-4;

/**
 * The blend start of a slot that does not blend into the next split. A real blend start is negative
 * for a negative split offset, which Godot's setter keeps, so the marker sits far below any depth.
 */
export const NO_BLEND = -1e30;

/**
 * A slot blends while its blend start lies above this. Half of `NO_BLEND`, so the float32 rounding
 * of the row cannot carry the marker across it, and a negative blend start still blends.
 */
export const BLENDS_ABOVE = NO_BLEND / 2;

/**
 * What the shadow lookup reads of a light's split shadow. `DirectionalSplitShadow`
 * (`r3f/directionalShadow/splitShadow.ts`) has this shape. The fitter writes it before each render.
 */
export interface SplitShadowLayout {
  /** One vec4 per slot, in the layout `fitDirectionalShadowSplits.ts` documents. */
  readonly _cascadeData: readonly THREE.Vector4[];
  /** Each slot's range start, which the blocker search measures from. */
  readonly rangeBegins: THREE.Vector4;
  /** The camera depths the shadow fades out between. Ends that do not ascend fade nothing. */
  readonly fade: { readonly from: number; readonly to: number };
  /** The light's soft shadow angle while the render draws directional soft shadows, else 0. */
  readonly softShadowAngle: number;
  /** World space to the slot's atlas position and depth. */
  getMatrix(slot: number): THREE.Matrix4;
  /** One split's rectangle in texels. */
  readonly mapSize: THREE.Vector2;
  /** The atlas size in split rectangles. */
  getFrameExtents(): THREE.Vector2;
  readonly intensity: number;
  readonly radius: number;
}

/** Whether `shadow` holds a split layout, as a light on the sun path does. */
export function isSplitShadow(shadow: unknown): shadow is SplitShadowLayout {
  const candidate = shadow as Partial<SplitShadowLayout> | null;
  return Array.isArray(candidate?._cascadeData) && typeof candidate?.getMatrix === 'function';
}

/** Scratch for one write. Written only by `writeSunRows`, which reads it back within the call. */
const lightPosition = new THREE.Vector3();
const toLight = new THREE.Vector3();
const viewToLight = new THREE.Vector3();
const atlasSize = new THREE.Vector2();

/**
 * The direction towards `light` in world space. three points a directional light from its target
 * towards its position, and a light with no target from the origin (r187 `WebGLLights.js:566-582`).
 */
function worldDirectionTowards(light: THREE.Light): THREE.Vector3 {
  lightPosition.setFromMatrixPosition(light.matrixWorld);
  const target = (light as Partial<THREE.DirectionalLight>).target;
  if (target) toLight.setFromMatrixPosition(target.matrixWorld);
  else toLight.set(0, 0, 0);
  return toLight.subVectors(lightPosition, toLight).normalize();
}

/**
 * Writes the rows of `light` for a render through `camera`. A light takes its size only while the
 * render draws directional soft shadows (`scene_forward_clustered.glsl:2615-2617`). A light without
 * declarations, such as a GLB light, has no size and three's full specular.
 */
export function writeSunRows(
  write: RowWrite,
  light: THREE.Light,
  camera: THREE.Camera | null,
  drawsDirectionalSoftShadows: boolean
): void {
  const declared = declaredLightOf(light);
  const size = (drawsDirectionalSoftShadows && declared && lightSizeDeclaration.read(declared)?.size) || 0;
  const specularAmount = (declared && lightSpecularDeclaration.read(declared)?.amount) ?? 1;
  const world = worldDirectionTowards(light);
  viewToLight.copy(world);
  if (camera) viewToLight.transformDirection(camera.matrixWorldInverse);
  write(SUN_ROW.direction, viewToLight.x, viewToLight.y, viewToLight.z, size);
  const { r, g, b } = light.color;
  write(SUN_ROW.colour, r * light.intensity, g * light.intensity, b * light.intensity, specularAmount);
  write(SUN_ROW.worldDirection, world.x, world.y, world.z, 0);
  const { shadow } = light as { shadow?: unknown };
  if (isSplitShadow(shadow)) writeSplitRows(write, shadow);
}

/** `Matrix4.elements` is column-major, so row `r` is elements `r`, `r + 4`, `r + 8` and `r + 12`. */
function writeSplitRows(write: RowWrite, shadow: SplitShadowLayout): void {
  for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
    const { x, y, z, w } = shadow._cascadeData[slot]!;
    write(SUN_ROW.splits + slot, x, y, z, w);
    const e = shadow.getMatrix(slot).elements;
    for (let row = 0; row < SLOT_MATRIX_ROWS; row++) {
      write(
        SUN_ROW.matrices + slot * SLOT_MATRIX_ROWS + row,
        e[row]!,
        e[row + 4]!,
        e[row + 8]!,
        e[row + 12]!
      );
    }
  }
  write(SUN_ROW.shadow, shadow.fade.from, shadow.fade.to, shadow.intensity, shadow.radius);
  atlasSize.copy(shadow.mapSize).multiply(shadow.getFrameExtents());
  write(SUN_ROW.atlas, atlasSize.x, atlasSize.y, shadow.softShadowAngle, 0);
  const { x, y, z, w } = shadow.rangeBegins;
  write(SUN_ROW.rangeBegins, x, y, z, w);
}
