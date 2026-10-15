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
