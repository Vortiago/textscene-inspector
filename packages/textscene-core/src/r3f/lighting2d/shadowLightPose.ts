/**
 * Where a 2D light casts from, and how far, read off its cookie quad. Godot
 * culls occluders against `rect_cache`, the cookie's `texture_size * texture_scale`
 * placed by `offset` (`RendererCanvasCull::_light_find_shadow`), and radiates the
 * shadow from the light node's origin, which `offset` does not move.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightRect, ShadowLight } from './shadowVolumes';
import type { ShadowPolarLight } from './shadowPolarMap';
import { SHADOW_SNAPSHOT_PRIORITY } from './ShadowCasterStage';

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
export function sampleShadowLight(
  quad: THREE.Mesh | null,
  matricesFresh = false
): ShadowLightPose | null {
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
    e[0]!, e[4]!, e[12]!,
    e[1]!, e[5]!, e[13]!,
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

/**
 * Everything `sampleShadowLight` reads: the quad's and the light node's world
 * matrices and the quad's bounds. Comparing these 36 numbers before sampling
 * spares a still scene a 4×4 inverse and short-lived objects per light per frame.
 */
const SAMPLE_INPUTS = 36;

/** Scratch for the current frame's read, compared against the previous frame's. */
const inputScratch = new Float64Array(SAMPLE_INPUTS);

function readSampleInputs(quad: THREE.Mesh, out: Float64Array): boolean {
  const parent = quad.parent;
  if (!parent) return false;
  const geometry = quad.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return false;

  quad.updateWorldMatrix(true, false);
  const quadElements = quad.matrixWorld.elements;
  const lightElements = parent.matrixWorld.elements;
  for (let i = 0; i < 16; i += 1) {
    out[i] = quadElements[i]!;
    out[i + 16] = lightElements[i]!;
  }
  out[32] = box.min.x;
  out[33] = box.min.y;
  out[34] = box.max.x;
  out[35] = box.max.y;
  return true;
}

/**
 * `sampleShadowLight(quad)` refreshed on mount and every frame, republished only
 * on a move, and null while `enabled` is false. A world transform is assembled by
 * three in the render loop, so the layout pass serves a still frame and the frame
 * callback an animated light, as in ShadowCasterStage.
 */
export function useShadowLightPose(
  quad: THREE.Mesh | null,
  enabled: boolean
): ShadowLightPose | null {
  const [pose, setPose] = useState<ShadowLightPose | null>(null);
  const published = useRef(pose);
  const inputs = useRef(new Float64Array(SAMPLE_INPUTS));
  const inputsRead = useRef(false);

  const sample = useCallback(() => {
    // `readSampleInputs` is what refreshes the matrices, so the sample below
    // does not walk the ancestor chain a second time.
    let matricesFresh = false;
    if (enabled && quad && readSampleInputs(quad, inputScratch)) {
      matricesFresh = true;
      const previous = inputs.current;
      if (inputsRead.current) {
        let moved = false;
        for (let i = 0; i < SAMPLE_INPUTS; i += 1) {
          if (previous[i] !== inputScratch[i]) {
            moved = true;
            break;
          }
        }
        if (!moved) return;
      }
      previous.set(inputScratch);
      inputsRead.current = true;
    } else {
      inputsRead.current = false;
    }

    const next = enabled ? sampleShadowLight(quad, matricesFresh) : null;
    if (sameShadowLight(published.current, next)) return;
    published.current = next;
    setPose(next);
  }, [quad, enabled]);

  useLayoutEffect(() => {
    // A new quad or a change of `enabled` makes the cached inputs another
    // light's, so they are dropped rather than compared against.
    inputsRead.current = false;
    sample();
  }, [sample]);
  useFrame(sample, SHADOW_SNAPSHOT_PRIORITY);

  return pose;
}
