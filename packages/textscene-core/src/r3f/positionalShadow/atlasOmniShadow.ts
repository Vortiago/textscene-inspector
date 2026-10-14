/**
 * An omni light's shadow as Godot keeps it in its default Cube mode: three renders a cube, and the
 * shadow pass copies the cube into two paraboloids in neighbouring slots of the positional shadow
 * atlas (`render_forward_clustered.cpp:2676-2695`, `:2722-2738`). `positionalShadow.md` beside this
 * file has the design.
 */

import * as THREE from 'three';
import type { PointLightShadow } from 'three/src/lights/PointLightShadow.js';
import { omniShadowCubeSize, type PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { lightPoseMatrix } from './lightPose.js';
import { positionalShadowAtlas } from './shadowAtlasTarget.js';
import { readIntensityThroughSlot, type SlottedShadow } from './slotOpacity.js';

/** three exports no `PointLightShadow` class, so it comes from a point light's own shadow. */
const ThreePointLightShadow = new THREE.PointLight().shadow.constructor as new () => PointLightShadow;

/** Written only by `writeLookupMatrix`, and valid only inside that call. */
const scratchRect = new THREE.Vector4();

export class AtlasOmniShadow extends ThreePointLightShadow implements SlottedShadow {
  /** The light's slot in the atlas of the viewport that renders now, or null for none. */
  slot: PositionalShadowSlot | null = null;
  opacity = 1;

  /**
   * Takes `slot`, which the shadow pass copies the cube into, and renders the cube at the side the
   * slot asks for. A null slot keeps the cube, and three renders none.
   */
  place(slot: PositionalShadowSlot | null): void {
    this.slot = slot;
    this.autoUpdate = slot !== null;
    if (slot !== null) this.fitCube(omniShadowCubeSize(slot.size));
  }

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
   * and in the bottom row, which a light-space position never needs, the paraboloids' rect. three
   * overwrites it in its pass (`WebGLShadowMap.js:320`), so the shadow pass writes it after.
   */
  writeLookupMatrix(light: THREE.Object3D): void {
    lightPoseMatrix(light, this.matrix).invert();
    const rect = this.paraboloidRect(scratchRect);
    if (!rect) return;
    const e = this.matrix.elements;
    e[3] = rect.x;
    e[7] = rect.y;
    e[11] = rect.z;
    e[15] = rect.w;
  }

  /**
   * The first paraboloid's corner and the step to the second, in units of the atlas texture
   * (`light_storage.cpp:981-984`, `:1002-1003`), written into `target`. Null without a slot.
   */
  paraboloidRect(target: THREE.Vector4): THREE.Vector4 | null {
    const slot = this.slot;
    if (!slot?.paraboloidStep) return null;
    const atlasSize = positionalShadowAtlas().width;
    const [stepX, stepY] = slot.paraboloidStep;
    return target.set(
      slot.x / atlasSize,
      slot.y / atlasSize,
      (stepX * slot.size) / atlasSize,
      (stepY * slot.size) / atlasSize
    );
  }

  /** Frees the cube. */
  override dispose(): void {
    this.map?.dispose();
    this.map = null;
  }
}

readIntensityThroughSlot(AtlasOmniShadow);

function isReadable(cube: THREE.WebGLCubeRenderTarget): boolean {
  return cube.depthTexture?.compareFunction === null;
}
