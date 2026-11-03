/**
 * What the 2D light pass publishes to the canvas beneath it: the accumulation each item placement
 * reads, and the declarations a light or an item makes to shape them. `CanvasLightPass.tsx` says
 * why each light list has its own buffer.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';
import type { CanvasLightDeclaration, ItemPlacement, LitItemNeeds, PassMeshRole } from './itemLightList.js';
import type { CappedItem } from './itemLightCap.js';
import type { CanvasClip } from './lightPassHost.js';

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
   * unless a light on the list tints its shadow, as Godot's transparent default
   * (`light_2d.h:58`) does not.
   */
  readonly shadowTintBuffer: THREE.Texture | null;
  /** The lights kept apart for a normal-mapped item, or null while none reads the list. */
  readonly apart: ApartLightBuffers | null;
}

/**
 * Where a light kept apart sits and how it blends, which a normal-mapped item reads to shade it. The
 * pass owns one per ordinal, and the light writes it ahead of every frame's draws, so an item
 * binds these objects once and reads the light where it is.
 */
export interface ApartLight {
  /**
   * In the canvas's world frame, y up: a positional light's position, or a directional light's
   * direction toward the light, in xy, and `Light2D.height` in z.
   */
  readonly place: THREE.Vector3;
  /** x: 1 for a directional light, else 0. y: 1 for a MIX light, else 0. */
  readonly mode: THREE.Vector2;
}

/**
 * The lights of a list, each accumulated alone from a black seed into a layer of its own, in the
 * order Godot applies them. A layer holds what the ordinary buffer would add for that light, so a
 * normal-mapped item can scale each light by its own normal term before it blends.
 */
export interface ApartLightBuffers {
  /** `light_color` with the shadow applied, premultiplied by its alpha, and the alpha. */
  readonly buffer: THREE.Texture;
  /** The albedo-free `shadow_color` term of each light, or null while no light tints. */
  readonly shadowTintBuffer: THREE.Texture | null;
  /** Each layer's light. */
  readonly lights: readonly ApartLight[];
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

/** Runs ahead of a pass's draws, with the camera it is about to draw through and its clip. */
export type LightPassStep = (camera: THREE.Camera, clip: CanvasClip) => void;

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
  /** Declares a lit item at `placement`, and the buffers it reads besides the ordinary one. */
  registerItem(placement: ItemPlacement, needs: LitItemNeeds): () => void;
  /** Hands an item to the per-item cap, which measures it while its placement is crowded. */
  registerCappedItem(item: CappedItem): () => void;
  /** The place light `ordinal` writes for a normal-mapped item, the same object for the ordinal's life. */
  apartLight(ordinal: number): ApartLight;
  /** Hands the pass one of light `ordinal`'s meshes, which it shows only in the passes `role` draws in. */
  registerPassMesh(mesh: THREE.Object3D, ordinal: number, role: PassMeshRole): () => void;
  /**
   * Hands the pass a step to run now and ahead of the draws of every frame, once the host has framed
   * the camera. What depends on the camera's frame belongs here, not in a frame subscriber, which
   * may run before the host frames it.
   */
  registerPassStep(step: LightPassStep): () => void;
}

/** The lighting outside a 2D light pass: no lists, and every declaration a no-op. */
export const INERT_CANVAS_LIGHTING: CanvasLighting2D = {
  lists: new Map(),
  resolution: new THREE.Vector2(1, 1),
  registerLight: (_declaration: CanvasLightDeclaration) => ({ ordinal: 0, release: () => {} }),
  registerItem: (_placement: ItemPlacement, _needs: LitItemNeeds) => () => {},
  registerCappedItem: (_item: CappedItem) => () => {},
  apartLight: (_ordinal: number) => ({ place: new THREE.Vector3(), mode: new THREE.Vector2() }),
  registerPassMesh: (_mesh: THREE.Object3D, _ordinal: number, _role: PassMeshRole) => () => {},
  registerPassStep: (_step: LightPassStep) => () => {},
};

export const CanvasLighting2DContext = createContext<CanvasLighting2D>(INERT_CANVAS_LIGHTING);

/** The lighting in force, or an inert value outside a 2D stage (3D, unit tests). */
export function useCanvasLighting2D(): CanvasLighting2D {
  return useContext(CanvasLighting2DContext);
}
