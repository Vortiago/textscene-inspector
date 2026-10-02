/**
 * What a three shadow needs to draw into its own rectangle of an atlas that other shadows share:
 * three r186's own `LightShadow` members, and a scissor on the shared target.
 */

import type * as THREE from 'three';

/**
 * three r186's own `LightShadow` members, which its types leave out (`LightShadow.js:160-169`,
 * `:235`). A shadow class types them through its base's constructor, so no class field resets them.
 */
export interface LightShadowInternals {
  _frameExtents: THREE.Vector2;
  _frustum: THREE.Frustum;
  _viewports: THREE.Vector4[];
  _viewportCount: number;
  _updateMatrix(
    shadowCamera: THREE.Camera,
    shadowMatrix: THREE.Matrix4,
    frustum: THREE.Frustum,
    viewport: THREE.Vector4
  ): void;
}

/**
 * Confines the shadow's draws to `rect`, given in units of `mapSize` as three gives a viewport
 * (`WebGLShadowMap.js:345-350`). three binds a target with its own scissor
 * (`WebGLRenderer.js:3040-3043`), and shrinks `mapSize` on a GPU whose textures are smaller than the
 * atlas (`WebGLShadowMap.js:180-198`), so the scissor scales with it. A shadow without a map has none.
 */
export function confineShadowScissor(shadow: THREE.LightShadow, rect: THREE.Vector4): void {
  if (!shadow.map) return;
  const { x, y } = shadow.mapSize;
  shadow.map.scissor.set(rect.x * x, rect.y * y, rect.z * x, rect.w * y);
  shadow.map.scissorTest = true;
}
