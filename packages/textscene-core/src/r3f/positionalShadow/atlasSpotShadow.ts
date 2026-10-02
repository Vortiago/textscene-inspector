/**
 * A spot light's shadow that three draws straight into the light's slot of the positional shadow
 * atlas, as Godot does (`render_forward_clustered.cpp:2712-2718`). The light shines down its own -Z,
 * where SpotLight3D puts its target. `positionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import type { SpotLightShadow } from 'three/src/lights/SpotLightShadow.js';
import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { positionalShadowAtlas } from './shadowAtlasTarget.js';

/** three exports no `SpotLightShadow` class, so it comes from a spot light's own shadow. */
const ThreeSpotLightShadow = new THREE.SpotLight().shadow.constructor as new () => SpotLightShadow;

export class AtlasSpotShadow extends ThreeSpotLightShadow {
  // three r186's own `LightShadow` members, which its types leave out (`LightShadow.js:161-169`,
  // `:235`). `declare` types them without a class field, which would reset the base's values.
  declare _frameExtents: THREE.Vector2;
  declare _frustum: THREE.Frustum;
  declare _viewports: THREE.Vector4[];
  declare _updateMatrix: (
    shadowCamera: THREE.Camera,
    shadowMatrix: THREE.Matrix4,
    frustum: THREE.Frustum,
    viewport: THREE.Vector4
  ) => void;

  /** The slot's rectangle in units of the slot, as three gives a viewport (`WebGLShadowMap.js:345-350`). */
  private readonly slotRect = new THREE.Vector4(0, 0, 1, 1);

  constructor() {
    super();
    this.map = positionalShadowAtlas();
  }

  /**
   * Draws into `slot` of the atlas. `mapSize` is the slot, and the frame extents are the atlas over
   * the slot. So three asks for the atlas's own size, and never resizes it
   * (`WebGLShadowMap.js:172-176`, `:281-285`).
   */
  place(slot: PositionalShadowSlot): void {
    this.map = positionalShadowAtlas();
    const atlasSize = this.map.width;
    this.mapSize.set(slot.size, slot.size);
    this._frameExtents.set(atlasSize / slot.size, atlasSize / slot.size);
    this.slotRect.set(slot.x / slot.size, slot.y / slot.size, 1, 1);
    this._viewports[0]!.copy(this.slotRect);
  }

  /**
   * three calls this before it binds and clears the atlas (`WebGLShadowMap.js:291`). three's update
   * sets the projection. The camera then takes the light's axes, as Godot's does
   * (`renderer_scene_cull.cpp:2582`), and the matrix maps into the slot.
   */
  override updateMatrices(light: THREE.SpotLight): void {
    super.updateMatrices(light);
    this.alignToLight(light);
    this._updateMatrix(this.camera, this.matrix, this._frustum, this.slotRect);
    this.confineToSlot();
  }

  /** The light's position and rotation, without its scale (`renderer_scene_cull.cpp:2358-2359`). */
  private alignToLight(light: THREE.SpotLight): void {
    light.matrixWorld.decompose(this.camera.position, this.camera.quaternion, new THREE.Vector3());
    this.camera.updateMatrixWorld();
  }

  /**
   * three binds a target with its own scissor (`WebGLRenderer.js:3040-3043`). It scales by `mapSize`,
   * which three shrinks on a GPU whose textures are smaller than the atlas (`WebGLShadowMap.js:180-198`).
   */
  private confineToSlot(): void {
    if (!this.map) return;
    const { x, y } = this.mapSize;
    this.map.scissor.set(this.slotRect.x * x, this.slotRect.y * y, x, y);
    this.map.scissorTest = true;
  }

  /** Lets go of the atlas, which other shadows share. */
  override dispose(): void {
    this.map = null;
  }
}
