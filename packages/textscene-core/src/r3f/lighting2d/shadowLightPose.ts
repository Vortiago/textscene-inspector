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
import { SHADOW_SNAPSHOT_PRIORITY } from './ShadowCasterStage';

/** Reused across the sample so a per-frame read allocates nothing. */
const corner = new THREE.Vector3();
const origin = new THREE.Vector3();

/**
 * The pose of the light whose cookie `quad` draws, in the previewer's 2D world
 * space, or null while the quad is not yet in the tree.
 *
 * `quad` must be the cookie mesh itself: its geometry's bounds give the rect
 * and its parent gives the shadow origin.
 */
export function sampleShadowLight(quad: THREE.Mesh | null): ShadowLight | null {
  if (!quad || !quad.parent) return null;
  const geometry = quad.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return null;

  // A pass running in `useFrame` executes BEFORE the renderer's own
  // `updateMatrixWorld`, so the matrices are refreshed rather than trusted.
  quad.updateWorldMatrix(true, false);
  origin.setFromMatrixPosition(quad.parent.matrixWorld);

  const rect: LightRect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      corner.set(x, y, 0).applyMatrix4(quad.matrixWorld);
      if (corner.x < rect.minX) rect.minX = corner.x;
      if (corner.x > rect.maxX) rect.maxX = corner.x;
      if (corner.y < rect.minY) rect.minY = corner.y;
      if (corner.y > rect.maxY) rect.maxY = corner.y;
    }
  }
  if (!Number.isFinite(rect.minX) || !Number.isFinite(rect.minY)) return null;

  return { x: origin.x, y: origin.y, rect };
}

/** Do two poses shadow identically? */
export function sameShadowLight(a: ShadowLight | null, b: ShadowLight | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.rect.minX === b.rect.minX &&
    a.rect.minY === b.rect.minY &&
    a.rect.maxX === b.rect.maxX &&
    a.rect.maxY === b.rect.maxY
  );
}

/**
 * `sampleShadowLight(quad)` refreshed on mount and on every frame, republished
 * only on a move. Returns null while `enabled` is false, so a light with
 * shadows off costs nothing but the frame callback.
 *
 * The layout pass is what lets a still frame be correct without a render loop
 * having run; the frame callback is what keeps an animated light correct. See
 * ShadowCasterStage for the same split on the occluder side.
 */
export function useShadowLightPose(quad: THREE.Mesh | null, enabled: boolean): ShadowLight | null {
  const [pose, setPose] = useState<ShadowLight | null>(null);
  const published = useRef(pose);

  const sample = useCallback(() => {
    const next = enabled ? sampleShadowLight(quad) : null;
    if (sameShadowLight(published.current, next)) return;
    published.current = next;
    setPose(next);
  }, [quad, enabled]);

  useLayoutEffect(sample, [sample]);
  useFrame(sample, SHADOW_SNAPSHOT_PRIORITY);

  return pose;
}
