/**
 * What the 2D light pass publishes to the canvas beneath it: the accumulation each item placement
 * reads, and the declarations a light or an item makes to shape them. `CanvasLighting2D.tsx` says
 * why each light list has its own buffer.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';
import type { CanvasLightDeclaration, ItemPlacement, PassMeshRole } from './itemLightList.js';
import type { CappedItem } from './itemLightCap.js';

/** The accumulations of one item light list. */
export interface CanvasLightList {
  /**
   * `S` seeded from the canvas modulate in rgb, and the list's summed cookie coverage in alpha, in
   * Godot's sRGB space and unclamped.
   */
  readonly buffer: THREE.Texture;
  /** The same accumulation seeded from an unmodulated white, for Light Only items. */
  readonly lightOnlyBuffer: THREE.Texture | null;
  /**
   * The albedo-free `shadow_color` accumulation, added after an item multiplies by its albedo. Null
   * unless a light on the list tints its shadow, as Godot's transparent default does not.
   */
  readonly shadowTintBuffer: THREE.Texture | null;
}

/** One light's place on the canvas, handed out by `registerLight`. */
export interface CanvasLightSlot {
  /**
   * The light's index on the canvas: dense and reused on withdrawal. It names the light in every
   * list, and its stencil ref keeps its shadow stamps apart from every other light's.
   */
  readonly ordinal: number;
  /** Withdraws the light and frees the ordinal. Idempotent. */
  release(): void;
}

export interface CanvasLighting2D {
  /**
   * The accumulation each placement reads, by `placementId`. A placement no light reaches is
   * absent, and its items fall back to the canvas modulate they already know.
   */
  readonly lists: ReadonlyMap<string, CanvasLightList>;
  /**
   * The accumulators' size in device pixels, the unit of `gl_FragCoord`. Mutated in place each
   * frame, so an item that binds it as a uniform value stays in step without re-rendering.
   */
  readonly resolution: THREE.Vector2;
  /** Declares a light on the canvas and gives it an ordinal. */
  registerLight(declaration: CanvasLightDeclaration): CanvasLightSlot;
  /** Declares a lit item at `placement`. A Light Only item also needs the unmodulated buffer. */
  registerItem(placement: ItemPlacement, lightOnly: boolean): () => void;
  /** Hands an item to the per-item cap, which measures it while its placement is crowded. */
  registerCappedItem(item: CappedItem): () => void;
  /** Hands the pass one of light `ordinal`'s meshes, which it shows only in the passes `role` draws in. */
  registerPassMesh(mesh: THREE.Object3D, ordinal: number, role: PassMeshRole): () => void;
}

/** The lighting outside a 2D light pass: no lists, and every declaration a no-op. */
export const INERT_CANVAS_LIGHTING: CanvasLighting2D = {
  lists: new Map(),
  resolution: new THREE.Vector2(1, 1),
  registerLight: (_declaration: CanvasLightDeclaration) => ({ ordinal: 0, release: () => {} }),
  registerItem: (_placement: ItemPlacement, _lightOnly: boolean) => () => {},
  registerCappedItem: (_item: CappedItem) => () => {},
  registerPassMesh: (_mesh: THREE.Object3D, _ordinal: number, _role: PassMeshRole) => () => {},
};

export const CanvasLighting2DContext = createContext<CanvasLighting2D>(INERT_CANVAS_LIGHTING);

/** The lighting in force, or an inert value outside a 2D stage (3D, unit tests). */
export function useCanvasLighting2D(): CanvasLighting2D {
  return useContext(CanvasLighting2DContext);
}
