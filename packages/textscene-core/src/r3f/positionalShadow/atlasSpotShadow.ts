/**
 * A spot light's shadow that three draws straight into the light's slot of the positional shadow
 * atlas, as Godot does (`render_forward_clustered.cpp:2712-2718`). The light shines down its own -Z,
 * where SpotLight3D puts its target. `positionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import type { SpotLightShadow } from 'three/src/lights/SpotLightShadow.js';
import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas.js';
import { confineShadowScissor, type LightShadowInternals } from '../sharedAtlasShadow.js';
import { readLightPose } from './lightPose.js';
import { positionalShadowAtlas } from './shadowAtlasTarget.js';

/** three exports no `SpotLightShadow` class, so it comes from a spot light's own shadow. */
const ThreeSpotLightShadow = new THREE.SpotLight().shadow.constructor as new () => SpotLightShadow &
  LightShadowInternals;

export class AtlasSpotShadow extends ThreeSpotLightShadow {
  /** The slot's rectangle in units of the slot, as three gives a viewport (`WebGLShadowMap.js:345-350`). */
  private readonly slotRect = new THREE.Vector4(0, 0, 1, 1);

  constructor() {
    super();
    this.map = positionalShadowAtlas();
  }

  /**
   * Draws into `slot` of the atlas. `mapSize` is the slot, and the frame extents are the atlas over
   * the slot. So three asks for the atlas's own size, and never resizes it
   * (`WebGLShadowMap.js:172-176`, `:281-285`). A null slot leaves the shadow as it is.
   */
  place(slot: PositionalShadowSlot | null): void {
    if (slot === null) return;
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
    readLightPose(light, this.camera.position, this.camera.quaternion);
    this.camera.updateMatrixWorld();
    this._updateMatrix(this.camera, this.matrix, this._frustum, this.slotRect);
    confineShadowScissor(this, this.slotRect);
  }

  /** Lets go of the atlas, which other shadows share. */
  override dispose(): void {
    this.map = null;
  }
}
