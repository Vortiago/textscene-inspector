/**
 * Where a 2D light casts from, and how far — read off its cookie quad.
 *
 * Godot culls occluders against the light's `rect_cache`, which is exactly the
 * cookie's extent placed by `offset` (`RendererCanvasCull::_light_find_shadow`
 * builds it from `texture_size * texture_scale`), and radiates the shadow from
 * the light NODE's origin, which `offset` does not move. Both come off the one
 * quad: its parent group is the CanvasItem, so the group's world origin is the
 * shadow origin and the quad's own world corners are the rect.
 *
 * A light's world transform is not a React value — it is the product of every
 * ancestor Node2D transform, assembled by three during the render loop — so it
 * is SAMPLED per frame and republished only when it moves, which for a static
 * scene is once. See ShadowCasterStage for the same argument on the occluder
 * side.
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
 * The pose both shadow mechanisms read: the origin and rect the stencil volumes
 * need, plus the light-local frame and reach the polar map needs.
 *
 * The two extra fields are Godot's, from the same call site
 * (`renderer_viewport.cpp:556`): `light_update_shadow(…,
 * light->xform_cache.affine_inverse(), …, radius_cache / 1000, radius_cache * 1.1,
 * …)`. `radius_cache` is `local_rect.size.length()` (line 485) — the cookie
 * rect's FULL diagonal in light-local units, which is the quad geometry's own
 * size and so is unaffected by where the light sits or how it is scaled.
 */
export interface ShadowLightPose extends ShadowLight, ShadowPolarLight {
  /** Narrows `ShadowPolarLight`'s `ArrayLike<number>` to the 2×3 it always is. */
  readonly worldToLocal: readonly [number, number, number, number, number, number];
}

/**
 * The pose of the light whose cookie `quad` draws, in the previewer's 2D world
 * space, or null while the quad is not yet in the tree.
 *
 * `quad` must be the cookie mesh itself: its geometry's bounds give the rect
 * and its parent gives the shadow origin and the light-local frame.
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

  // A pass running in `useFrame` executes BEFORE the renderer's own
  // `updateMatrixWorld`, so the matrices are refreshed rather than trusted —
  // unless the caller has just done it. `updateWorldMatrix(true, …)` recomposes
  // the whole ancestor chain, so on a light several Node2Ds deep a second walk
  // costs more than the allocations the hook's guard saves.
  if (!matricesFresh) quad.updateWorldMatrix(true, false);
  origin.setFromMatrixPosition(quad.parent.matrixWorld);

  const rect: LightRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  expandToCorner(rect, box.min.x, box.min.y, quad.matrixWorld);
  expandToCorner(rect, box.min.x, box.max.y, quad.matrixWorld);
  expandToCorner(rect, box.max.x, box.min.y, quad.matrixWorld);
  expandToCorner(rect, box.max.x, box.max.y, quad.matrixWorld);
  if (!Number.isFinite(rect.minX) || !Number.isFinite(rect.minY)) return null;

  // The light NODE's frame, not the quad's: `offset` moves the cookie without
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
 * Everything `sampleShadowLight` reads: the cookie quad's world matrix (which
 * places the rect), the light node's world matrix (which gives the origin and
 * the local frame), and the quad's own bounds. The pose is a pure function of
 * these 36 numbers, so comparing them is the whole of "has anything moved".
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
 * `sampleShadowLight(quad)` refreshed on mount and on every frame, republished
 * only on a move. Returns null while `enabled` is false, so a light with
 * shadows off costs nothing but the frame callback.
 *
 * The layout pass is what lets a still frame be correct without a render loop
 * having run; the frame callback is what keeps an animated light correct. See
 * ShadowCasterStage for the same split on the occluder side.
 *
 * The frame callback runs whether or not anything moved, so it compares the
 * pose's INPUTS before building one. Sampling first and discarding the result
 * would spend a 4×4 inverse and half a dozen short-lived objects per shadowed
 * light per frame on a scene that has been still since load.
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
