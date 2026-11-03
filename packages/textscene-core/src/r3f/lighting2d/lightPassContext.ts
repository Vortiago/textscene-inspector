/**
 * What the 2D light pass publishes to the canvas beneath it: the accumulation each item placement
 * reads, and the declarations a light or an item makes to shape them. `CanvasLightPass.tsx` says
 * why each light list has its own buffer.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';
import type { CanvasLightDeclaration, ItemPlacement, LitItemRead, PassMeshRole } from './itemLightList.js';
import type { CappedItem } from './itemLightCap.js';
import type { CanvasClip } from './lightPassHost.js';

/** The accumulations of one item light list. */
export interface CanvasLightList {
  /**
   * `S` seeded from the canvas modulate in rgb, and the list's summed cookie coverage in alpha, in
   * Godot's sRGB space and unclamped. Null while only Light Only and normal-mapped items read the list.
   */
  readonly buffer: THREE.Texture | null;
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
 * The lights of a list, each accumulated alone from a black seed into a layer of its own, in the
 * order Godot applies them. A layer holds what the ordinary buffer would add for that light, so a
 * normal-mapped item can scale each light by its own normal term before it blends. The pass owns
 * the vectors and rewrites `places` ahead of every frame's draws, so an item binds them once.
 */
export interface ApartLightBuffers {
  /** `light_color` with the shadow applied, premultiplied by its alpha, and the alpha. */
  readonly buffer: THREE.Texture;
  /** The albedo-free `shadow_color` terms of the lights that tint, or null while none does. */
  readonly shadowTintBuffer: THREE.Texture | null;
  /**
   * Each layer's light in the canvas's world frame, y up: a positional light's position, or a
   * directional light's direction toward the light, in xy, and its height in z.
   */
  readonly places: readonly THREE.Vector3[];
  /**
   * Each layer's x: 1 for a directional light. y: 1 for a MIX light. z: the light's layer in
   * `shadowTintBuffer`, or -1 while it adds no tint.
   */
  readonly modes: readonly THREE.Vector3[];
}

/** Writes where a light kept apart sits into `place` (`ApartLightBuffers.places`). */
export type ApartPlacer = (place: THREE.Vector3) => void;

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
  /** Declares a lit item at `placement`, and the accumulation it reads. */
  registerItem(placement: ItemPlacement, read: LitItemRead): () => void;
  /** Hands an item to the per-item cap, which measures it while its placement is crowded. */
  registerCappedItem(item: CappedItem): () => void;
  /**
   * Hands the pass the placer of light `ordinal`, which it runs ahead of the draws of every frame
   * while a normal-mapped item reads the light.
   */
  registerApartPlacer(ordinal: number, placer: ApartPlacer): () => void;
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
  registerItem: (_placement: ItemPlacement, _read: LitItemRead) => () => {},
  registerCappedItem: (_item: CappedItem) => () => {},
  registerApartPlacer: (_ordinal: number, _placer: ApartPlacer) => () => {},
  registerPassMesh: (_mesh: THREE.Object3D, _ordinal: number, _role: PassMeshRole) => () => {},
  registerPassStep: (_step: LightPassStep) => () => {},
};

export const CanvasLighting2DContext = createContext<CanvasLighting2D>(INERT_CANVAS_LIGHTING);

/** The lighting in force, or an inert value outside a 2D stage (3D, unit tests). */
export function useCanvasLighting2D(): CanvasLighting2D {
  return useContext(CanvasLighting2DContext);
}
