/**
 * Clone a loaded `THREE.Texture` and apply the StandardMaterial3D
 * `uv1_scale` / `uv1_offset` transform to it.
 *
 * Cloning is the load-bearing detail. `useResource` returns the same
 * cached `THREE.Texture` reference for every consumer of a given path
 * (identity-equality contract — see `R3F-contracts.md` §1). If two
 * MeshInstance3D nodes share a texture but configure different UV
 * transforms (a typical scene-tiling pattern), mutating in place would
 * make the second consumer clobber the first. `texture.clone()` is
 * cheap: it copies texture parameters but shares the underlying
 * `image` data, so memory is constant.
 *
 * Skips the clone if scale is identity and offset is zero — at that
 * point there's nothing to set, so we hand the original back.
 */

import type * as THREE from 'three';
import { RepeatWrapping } from 'three';

const IDENTITY_EPSILON = 1e-6;

export interface UVTransform {
  scale: { x: number; y: number };
  offset: { x: number; y: number };
}

export function applyUVTransform(
  texture: THREE.Texture,
  transform: UVTransform
): THREE.Texture {
  const isIdentity =
    near(transform.scale.x, 1) &&
    near(transform.scale.y, 1) &&
    near(transform.offset.x, 0) &&
    near(transform.offset.y, 0);
  if (isIdentity) {
    return texture;
  }

  const cloned = texture.clone();
  cloned.repeat.set(transform.scale.x, transform.scale.y);
  cloned.offset.set(transform.offset.x, transform.offset.y);
  cloned.wrapS = RepeatWrapping;
  cloned.wrapT = RepeatWrapping;
  cloned.needsUpdate = true;
  return cloned;
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < IDENTITY_EPSILON;
}
