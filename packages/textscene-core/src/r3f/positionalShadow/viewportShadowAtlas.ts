/**
 * One viewport's positional shadow atlas: the slots Godot's atlas gives its lights, laid out in the
 * shared atlas texture (`shadowAtlasTarget.ts`), and the cube each omni light renders for that
 * viewport. A light two viewports render holds a cube for each, as Godot holds a slot in each atlas.
 * One cube per light would reallocate whenever the two slots differ.
 */

import type * as THREE from 'three';
import {
  PositionalShadowAtlas,
  type PositionalShadowAtlasSettings,
  type PositionalShadowRequest,
  type PositionalShadowSlot,
} from '../../godot/positionalShadowAtlas.js';
import { holdPositionalShadowAtlas, releasePositionalShadowAtlas } from './shadowAtlasTarget.js';

/** An omni or spot light. */
export type PositionalLight = THREE.PointLight | THREE.SpotLight;

/** The cube three renders an omni light's shadow into. */
type ShadowMap = NonNullable<THREE.LightShadow['map']>;

/** Written only by `ViewportShadowAtlas.bind`. Cleared for a shadow when its atlas is disposed. */
const boundAtlas = new WeakMap<THREE.LightShadow, ViewportShadowAtlas>();

export class ViewportShadowAtlas {
  private readonly slots: PositionalShadowAtlas<PositionalLight>;
  /** The cubes this viewport's lights rendered last, kept while another viewport renders them. */
  private readonly parkedMaps = new Map<THREE.LightShadow, ShadowMap>();
  /** The shadows whose cube is this viewport's now. */
  private readonly boundShadows = new Set<THREE.LightShadow>();

  constructor(settings: PositionalShadowAtlasSettings) {
    this.slots = new PositionalShadowAtlas(settings);
    holdPositionalShadowAtlas(this, this.slots.size);
  }

  /** One render's allocation, in Godot's order (`PositionalShadowAtlas.allocate`). */
  allocate(requests: readonly PositionalShadowRequest<PositionalLight>[], tickMsec: number): void {
    this.slots.allocate(requests, tickMsec);
  }

  /** The slot the light holds, or null when it holds none. */
  slot(light: PositionalLight): PositionalShadowSlot | null {
    return this.slots.slot(light);
  }

  /**
   * Gives an omni light's shadow the cube it rendered last for this viewport, and parks the cube it
   * holds for the viewport that rendered it before. A cube made before any viewport bound it stays.
   */
  bind(shadow: THREE.LightShadow): void {
    const current = boundAtlas.get(shadow);
    if (current === this) return;
    if (current) {
      current.park(shadow);
      shadow.map = this.parkedMaps.get(shadow) ?? null;
      this.parkedMaps.delete(shadow);
    }
    boundAtlas.set(shadow, this);
    this.boundShadows.add(shadow);
  }

  /**
   * Frees the slot and the parked cube of every light that left the scene. A bound cube stays with its
   * light, which disposes it when it unmounts.
   */
  retain(lights: ReadonlySet<PositionalLight>): void {
    for (const owner of this.slots.ownersHoldingSlots()) {
      if (!lights.has(owner)) this.slots.release(owner);
    }
    const shadows = new Set<THREE.LightShadow>([...lights].map((light) => light.shadow));
    for (const [shadow, map] of this.parkedMaps) {
      if (shadows.has(shadow)) continue;
      map.dispose();
      this.parkedMaps.delete(shadow);
    }
    for (const shadow of this.boundShadows) {
      if (!shadows.has(shadow)) this.unbind(shadow);
    }
  }

  /**
   * Disposes every parked cube and lets go of the atlas texture. A bound cube stays with its light, and
   * the next viewport adopts it.
   */
  dispose(): void {
    for (const map of this.parkedMaps.values()) map.dispose();
    this.parkedMaps.clear();
    for (const shadow of this.boundShadows) this.unbind(shadow);
    releasePositionalShadowAtlas(this);
  }

  private park(shadow: THREE.LightShadow): void {
    if (shadow.map) this.parkedMaps.set(shadow, shadow.map);
    this.unbind(shadow);
  }

  private unbind(shadow: THREE.LightShadow): void {
    this.boundShadows.delete(shadow);
    if (boundAtlas.get(shadow) === this) boundAtlas.delete(shadow);
  }
}

/** Pushed only by `renderWithShadowAtlas` around one render, and popped when that render returns. */
const activeAtlases: ViewportShadowAtlas[] = [];

/** Runs `render` with `atlas` as the atlas of every scene it renders: a SubViewport's pass. */
export function renderWithShadowAtlas(atlas: ViewportShadowAtlas, render: () => void): void {
  activeAtlases.push(atlas);
  try {
    render();
  } finally {
    activeAtlases.pop();
  }
}

/** The atlas of the SubViewport rendering now, or null for a render of the main view. */
export function activeShadowAtlas(): ViewportShadowAtlas | null {
  return activeAtlases[activeAtlases.length - 1] ?? null;
}
