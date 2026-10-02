/**
 * An omni light's shadow as Godot keeps it in its default Cube mode: three renders a cube, and the
 * shadow pass copies the cube into two paraboloids in neighbouring slots of the positional shadow
 * atlas (`render_forward_clustered.cpp:2676-2695`, `:2722-2738`). `positionalShadow.md` beside this
 * file has the design.
 */

import * as THREE from 'three';
import type { PointLightShadow } from 'three/src/lights/PointLightShadow.js';
import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { positionalShadowAtlas } from './shadowAtlasTarget.js';

/** A light's scale counts for nothing in Godot's shadow (`renderer_scene_cull.cpp:2358-2359`). */
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

/** three exports no `PointLightShadow` class, so it comes from a point light's own shadow. */
const ThreePointLightShadow = new THREE.PointLight().shadow.constructor as new () => PointLightShadow;

export class AtlasOmniShadow extends ThreePointLightShadow {
  /** The light's slot in the atlas of the viewport that renders now, or null for none. */
  slot: PositionalShadowSlot | null = null;

  /**
   * Gives the shadow a cube of `faceSize` texels a side. The copy reads its depth at each texel,
   * which a depth texture allows only unfiltered and uncompared (OpenGL ES 3.0 §3.8.13), so three's
   * own cube, which compares, does not serve. three builds a map only for a shadow that has none
   * (`WebGLShadowMap.js:203`), and never resizes a cube (`:281`).
   */
  fitCube(faceSize: number): void {
    this.mapSize.set(faceSize, faceSize);
    if (
      this.map instanceof THREE.WebGLCubeRenderTarget &&
      this.map.width === faceSize &&
      isReadable(this.map)
    ) {
      return;
    }
    this.map?.dispose();
    const cube = new THREE.WebGLCubeRenderTarget(faceSize);
    const depth = new THREE.CubeDepthTexture(faceSize, THREE.UnsignedIntType);
    depth.format = THREE.DepthFormat;
    depth.compareFunction = null;
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    // three's types give a cube target a 2D depth texture, where its renderer takes a cube one
    // (`WebGLShadowMap.js:249`).
    cube.depthTexture = depth as unknown as THREE.DepthTexture;
    this.map = cube;
  }

  /**
   * Writes `pointShadowMatrix`: Godot's world-to-light transform (`light_storage.cpp:989-991`) above,
   * and in the bottom row, which a light-space position never needs, the first paraboloid's corner and
   * the step to the second, in units of the atlas texture (`:981-984`, `:1002-1003`). three overwrites
   * it in its pass (`WebGLShadowMap.js:320`), so the shadow pass writes it after.
   */
  writeLookupMatrix(light: THREE.Object3D): void {
    const atlasSize = positionalShadowAtlas().width;
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    light.matrixWorld.decompose(position, rotation, new THREE.Vector3());
    this.matrix.compose(position, rotation, UNIT_SCALE).invert();
    const slot = this.slot;
    if (!slot?.paraboloidStep) return;
    const e = this.matrix.elements;
    e[3] = slot.x / atlasSize;
    e[7] = slot.y / atlasSize;
    e[11] = (slot.paraboloidStep[0] * slot.size) / atlasSize;
    e[15] = (slot.paraboloidStep[1] * slot.size) / atlasSize;
  }

  /** Frees the cube. */
  override dispose(): void {
    this.map?.dispose();
    this.map = null;
  }
}

function isReadable(cube: THREE.WebGLCubeRenderTarget): boolean {
  return cube.depthTexture?.compareFunction === null;
}
