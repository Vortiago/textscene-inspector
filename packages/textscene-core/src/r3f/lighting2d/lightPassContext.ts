/**
 * What the 2D light pass publishes to the canvas beneath it: the accumulations
 * in force, and the declarations a light or an item makes to shape them.
 *
 * The pass itself — why there are classes at all, and what each buffer holds —
 * is documented in `CanvasLighting2D.tsx`.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';
import type { LightCullKey } from './lightCullKey.js';

/** One cull tuple's accumulation. */
export interface CanvasLightClass {
  /** The cull tuple every light in this class shares — see `lightCullKey`. */
  readonly key: LightCullKey;
  /**
   * `S` seeded from the canvas modulate in rgb, and this class's summed cookie
   * coverage in alpha, in Godot's sRGB space and unclamped.
   */
  readonly buffer: THREE.Texture;
  /** The same accumulation seeded from an unmodulated white, for Light Only items. */
  readonly lightOnlyBuffer: THREE.Texture | null;
  /**
   * The albedo-free `shadow_color` accumulation, added AFTER an item multiplies
   * by its albedo. Null unless some light in this class tints its shadow, which
   * is Godot's default and so the usual case.
   */
  readonly shadowTintBuffer: THREE.Texture | null;
  /** The camera layer this class's light quads draw on. */
  readonly layer: number;
  /**
   * The camera layer this class's `shadow_color` quads draw on — set only while
   * `shadowTintBuffer` is, so a light is never told to draw a tint quad into a
   * pass that does not run. The two are allocated together and withdrawn
   * together; splitting them would put an untinted frame on screen for the
   * commit between a light declaring its tint and its class getting a target.
   */
  readonly shadowTintLayer: number | undefined;
}

/** One light's place in its class's pass, handed out by `register`. */
export interface CanvasLightSlot {
  /**
   * This light's index among the lights of its class — dense, reused on
   * withdrawal, and distinct only WITHIN the class, which is all the stencil
   * needs since a class pass renders no other class's layer.
   */
  readonly ordinal: number;
  /** Withdraws the light and frees the ordinal. Idempotent. */
  release(): void;
}

export interface CanvasLighting2D {
  /**
   * The light classes in force, ordered by their cull tuple (cull mask first).
   * Empty when the canvas holds no light, in which case items fall back to the
   * canvas modulate they already know.
   */
  readonly classes: readonly CanvasLightClass[];
  /**
   * The accumulators' size in DEVICE pixels, which is what `gl_FragCoord` is
   * measured in. MUTATED in place each frame, so an item that binds it as a
   * uniform value stays in step without re-rendering.
   */
  readonly resolution: THREE.Vector2;
  /**
   * Declares a light of this cull tuple on the canvas and takes a slot in that
   * class's pass.
   */
  register(key: LightCullKey): CanvasLightSlot;
  /** Declares an item that needs the unmodulated accumulation. */
  registerLightOnly(): () => void;
  /**
   * Declares a light that tints its shadow, so ITS class allocates the extra
   * pass. Keyed, unlike `registerLightOnly`: an item can read any class, but a
   * light belongs to exactly one.
   */
  registerShadowTint(key: LightCullKey): () => void;
}

const INERT: CanvasLighting2D = {
  classes: [],
  resolution: new THREE.Vector2(1, 1),
  register: (_key: LightCullKey) => ({ ordinal: 0, release: () => {} }),
  registerLightOnly: () => () => {},
  registerShadowTint: (_key: LightCullKey) => () => {},
};

export const CanvasLighting2DContext = createContext<CanvasLighting2D>(INERT);

/** The lighting in force, or an inert value outside a 2D stage (3D, unit tests). */
export function useCanvasLighting2D(): CanvasLighting2D {
  return useContext(CanvasLighting2DContext);
}
