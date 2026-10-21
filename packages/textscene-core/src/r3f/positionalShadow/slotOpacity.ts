/**
 * A positional shadow's `intensity`, which three's lit programs read as the shadow's opacity: the
 * light's `shadow_opacity` while the shadow holds a slot of the atlas, and none without one. Godot
 * sends an opacity of zero for a light the atlas holds no slot for (`light_storage.cpp:948-952`,
 * `:1027`). The light's component and its distance fade write the opacity through `intensity`.
 */

import type * as THREE from 'three';
import type { PositionalShadowSlot } from '../../godot/rendering/lights/positionalShadowAtlas.js';

/** A shadow that holds a slot of the atlas, or none. */
export interface SlottedShadow extends THREE.LightShadow {
  slot: PositionalShadowSlot | null;
  /** The opacity the light last wrote through `intensity`. */
  opacity: number;
  /**
   * Writes the matrix from the space of `view` into the space the shadow looks up in, and returns
   * `target`: the light's own space for an omni or area light, the atlas for a spot light. The
   * surface and the volumetric fog both read it. A spot shadow's matrix holds its light's pose, so
   * it ignores `light`.
   */
  viewToLookup(view: THREE.Camera, target: THREE.Matrix4, light: THREE.Object3D): THREE.Matrix4;
}

/** A slotted shadow that looks up through paraboloids: an omni or an area light's. */
export interface ParaboloidShadow extends SlottedShadow {
  /**
   * Writes the slot's rect into `target` in units of the atlas, as the lookup reads it, and
   * returns it, or null without a slot. An omni light's `zw` step to its second paraboloid. An area
   * light's are the slot's side. The surface and the volumetric fog both read it.
   */
  slotRect(target: THREE.Vector4): THREE.Vector4 | null;
}

/**
 * Gives every instance of `shadowClass` the slotted `intensity`. three types `intensity` as a field,
 * so the accessor goes on the prototype. `LightShadow`'s constructor and `copy` assign it, and an
 * assignment reaches an inherited setter.
 */
export function readIntensityThroughSlot(shadowClass: { prototype: SlottedShadow }): void {
  Object.defineProperty(shadowClass.prototype, 'intensity', {
    get(this: SlottedShadow) {
      return this.slot === null ? 0 : this.opacity;
    },
    set(this: SlottedShadow, opacity: number) {
      this.opacity = opacity;
    },
    configurable: true,
  });
}
