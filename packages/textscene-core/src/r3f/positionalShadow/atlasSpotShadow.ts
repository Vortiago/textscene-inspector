/**
 * A spot light's shadow that three draws straight into the light's slot of the positional shadow
 * atlas, as Godot does (`render_forward_clustered.cpp:2712-2718`). three never draws it by itself:
 * the shadow pass's atlas step does (`atlasDepthPass.ts`). The light shines down its own -Z, where
 * SpotLight3D puts its target. `positionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import type { SpotLightShadow } from 'three/src/lights/SpotLightShadow.js';
import type { PositionalShadowSlot } from '../../godot/rendering/lights/positionalShadowAtlas.js';
import { confineShadowScissor, type LightShadowInternals } from '../sharedAtlasShadow.js';
import { readLightPose } from './lightPose.js';
import { drawIntoAtlasSlot, positionalShadowAtlas } from './shadowAtlasTarget.js';
import { readIntensityThroughSlot, type SlottedShadow } from './slotOpacity.js';

/** three exports no `SpotLightShadow` class, so it comes from a spot light's own shadow. */
const ThreeSpotLightShadow = new THREE.SpotLight().shadow.constructor as new () => SpotLightShadow &
  LightShadowInternals;

export class AtlasSpotShadow extends ThreeSpotLightShadow implements SlottedShadow {
  /** The light's slot in the atlas of the viewport that renders now, or null for none. */
  slot: PositionalShadowSlot | null = null;
  opacity = 1;
  /** The slot's rectangle in units of the slot, as three gives a viewport (`WebGLShadowMap.js:345-350`). */
  private readonly slotRect = new THREE.Vector4(0, 0, 1, 1);

  constructor() {
    super();
    this.autoUpdate = false;
    this.map = positionalShadowAtlas();
  }

  /** Draws into `slot` of the atlas. A null slot draws nothing, and leaves the rest of the shadow as it is. */
  place(slot: PositionalShadowSlot | null): void {
    this.slot = slot;
    if (slot === null) return;
    drawIntoAtlasSlot(this, slot, this.slotRect);
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

  /**
   * Writes the matrix from the space of `view` into the atlas, through the slot. `_light` is unused:
   * `matrix` already holds the light's pose.
   */
  viewToLight(_light: THREE.Object3D, view: THREE.Camera, target: THREE.Matrix4): THREE.Matrix4 {
    return target.multiplyMatrices(this.matrix, view.matrixWorld);
  }

  /** Copies `source`, and stays undrawn by three's own pass. */
  override copy(source: SpotLightShadow): this {
    super.copy(source);
    this.autoUpdate = false;
    return this;
  }

  /** Lets go of the atlas, which other shadows share. */
  override dispose(): void {
    this.map = null;
  }
}

readIntensityThroughSlot(AtlasSpotShadow);
