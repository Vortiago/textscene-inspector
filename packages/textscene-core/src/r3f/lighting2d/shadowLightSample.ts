/**
 * Where a 2D light casts from, and how far, read off its cookie quad. Godot
 * culls occluders against `rect_cache`, the cookie's `texture_size * texture_scale`
 * placed by `offset` (`RendererCanvasCull::_light_find_shadow`), and radiates the
 * shadow from the light node's origin, which `offset` does not move.
 */

import * as THREE from 'three';
import type { LightRect, ShadowLight } from './shadowVolumes';
import type { ShadowPolarLight } from './shadowPolarMap';

/** Reused across the sample so a per-frame read allocates nothing. */
const corner = new THREE.Vector3();
const origin = new THREE.Vector3();
const inverse = new THREE.Matrix4();

/** Grow `rect` to cover one geometry corner placed by `matrix`. */
function expandToCorner(rect: LightRect, x: number, y: number, matrix: THREE.Matrix4): void {
  corner.set(x, y, 0).applyMatrix4(matrix);
  if (corner.x < rect.minX) rect.minX = corner.x;
  if (corner.x > rect.maxX) rect.maxX = corner.x;
  if (corner.y < rect.minY) rect.minY = corner.y;
  if (corner.y > rect.maxY) rect.maxY = corner.y;
}

/**
 * The pose both shadow mechanisms read. The polar map's fields come from
 * `renderer_viewport.cpp:556`: `light_update_shadow(…, light->xform_cache.affine_inverse(),
 * …, radius_cache / 1000, radius_cache * 1.1, …)`. `radius_cache` (line 485) is the
 * cookie rect's full light-local diagonal, whatever the light's position or scale.
 */
export interface ShadowLightPose extends ShadowLight, ShadowPolarLight {
  /** Narrows `ShadowPolarLight`'s `ArrayLike<number>` to the 2×3 it always is. */
  readonly worldToLocal: readonly [number, number, number, number, number, number];
}

/**
 * The pose of the light whose cookie `quad` draws, in the previewer's 2D world
 * space, or null while the quad is not in the tree. The quad's bounds give the
 * rect, and its parent, the CanvasItem, gives the origin and the local frame.
 */
export function sampleShadowLight(quad: THREE.Mesh | null, matricesFresh: boolean): ShadowLightPose | null {
  if (!quad || !quad.parent) return null;
  const geometry = quad.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return null;

  // `useFrame` runs before the renderer's `updateMatrixWorld`, so the matrices
  // are refreshed unless the caller has just done it: a second ancestor walk on
  // a deep light costs more than the allocations the hook's guard saves.
  if (!matricesFresh) quad.updateWorldMatrix(true, false);
  origin.setFromMatrixPosition(quad.parent.matrixWorld);

  const rect: LightRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  expandToCorner(rect, box.min.x, box.min.y, quad.matrixWorld);
  expandToCorner(rect, box.min.x, box.max.y, quad.matrixWorld);
  expandToCorner(rect, box.max.x, box.min.y, quad.matrixWorld);
  expandToCorner(rect, box.max.x, box.max.y, quad.matrixWorld);
  if (!Number.isFinite(rect.minX) || !Number.isFinite(rect.minY)) return null;

  // The light node's frame, not the quad's: `offset` moves the cookie without
  // moving the space Godot states its shadow map in.
  const e = inverse.copy(quad.parent.matrixWorld).invert().elements;
  const worldToLocal: [number, number, number, number, number, number] = [
    e[0]!,
    e[4]!,
    e[12]!,
    e[1]!,
    e[5]!,
    e[13]!,
  ];
  for (const value of worldToLocal) {
    if (!Number.isFinite(value)) return null;
  }

  const radius = Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y);

  return { x: origin.x, y: origin.y, rect, worldToLocal, radius };
}

/** Do two poses shadow identically? */
export function sameShadowLight(a: ShadowLightPose | null, b: ShadowLightPose | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.x !== b.x ||
    a.y !== b.y ||
    a.rect.minX !== b.rect.minX ||
    a.rect.minY !== b.rect.minY ||
    a.rect.maxX !== b.rect.maxX ||
    a.rect.maxY !== b.rect.maxY ||
    a.radius !== b.radius
  ) {
    return false;
  }
  for (let i = 0; i < a.worldToLocal.length; i += 1) {
    if (a.worldToLocal[i] !== b.worldToLocal[i]) return false;
  }
  return true;
}
