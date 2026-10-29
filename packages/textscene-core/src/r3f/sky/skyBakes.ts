/**
 * The bakes of one sky, one for each exposure that bakes it. Godot bakes a sky's radiance at the
 * exposure of the render that finds it dirty (`sky.cpp:1275`, `:1295`), and a sky that reads lights
 * is dirty in each render whose light energies, which the exposure scales, differ from the last
 * (`sky.cpp:1085-1087`, `:1105-1143`). So viewports that draw one sky at two exposures can read two
 * bakes. A bake holds the exposure only in its light energies and its debanding noise.
 */

import type * as THREE from 'three';
import { buildSkyEnvironment, type SkyEnvironmentInput, type SkyLight } from '../../resources/sky/build';
import type { Sky, SkyProperties } from '../../resources/sky/types';
import { roughnessLayersOf } from '../../resources/sky/skyLayers';
import {
  newSkyRadianceUpdate,
  skyUpdateMode,
  type SkyUpdatePlan,
} from '../../godot/rendering/environment/skyRadianceUpdate';
import { perObject } from '../../utils/perObject';
import { SkyRadiance } from './skyRadiance';

/** A sky baked at one exposure: its background and the radiance its readers sample. */
export interface BakedSky {
  background: THREE.Texture | null;
  radiance: SkyRadiance;
  /** Frees the background and the radiance layers. */
  dispose: () => void;
}

/** What a bake of the sky takes beside the exposure. */
export interface SkyBakeInput extends Omit<SkyEnvironmentInput, 'energy'> {
  /** `background_energy_multiplier`, which the exposure scales into the debanding noise. */
  intensity: number;
  rotation: THREE.Euler;
}

/**
 * Whether a sky material's shader reads the DirectionalLights. The procedural and the physical sky
 * read `LIGHT0` (`sky_material.cpp:326`, `:766`), and the panorama reads only its texture (`:502`).
 */
export function materialReadsLights(material: SkyProperties): boolean {
  return material.kind !== 'panorama';
}

/** How `sky`'s radiance updates. */
export function skyUpdatePlan(sky: Sky): SkyUpdatePlan {
  return { mode: skyUpdateMode(sky.processMode), layers: roughnessLayersOf(sky.radianceFilter) };
}

/**
 * The radiance update of each sky, which every Environment that draws the sky shares, as Godot keeps
 * one radiance for each Sky resource (`sky.h:251`). A new material is a new sky, which bakes anew.
 */
export const radianceUpdateOf = perObject((_sky: Sky) => newSkyRadianceUpdate());

export class SkyBakes {
  /** Each bake by its exposure, null for one the renderer could not make. */
  private readonly bakes = new Map<number, BakedSky | null>();
  /** The exposures a render asked for while it drew, which `bakeWanted` bakes. */
  private readonly wanted = new Set<number>();

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly input: SkyBakeInput
  ) {}

  /** Bakes the sky at `exposure` now, outside any render, or answers the bake it holds. */
  bakeNow(exposure: number): BakedSky | null {
    if (!this.bakes.has(exposure)) this.bakes.set(exposure, bakeSky(this.gl, this.input, exposure));
    return this.bakes.get(exposure)!;
  }

  /**
   * The bake at `exposure`, or null while it waits for `bakeWanted`. A render that asks draws with
   * another bake for one frame, since a bake renders cubes of its own.
   */
  at(exposure: number): BakedSky | null {
    if (!this.bakes.has(exposure)) this.wanted.add(exposure);
    return this.bakes.get(exposure) ?? null;
  }

  /** Bakes each exposure a render asked for. Answers whether it baked any. */
  bakeWanted(): boolean {
    if (this.wanted.size === 0) return false;
    for (const exposure of this.wanted) this.bakeNow(exposure);
    this.wanted.clear();
    return true;
  }

  dispose(): void {
    for (const baked of this.bakes.values()) {
      baked?.radiance.hide();
      baked?.dispose();
    }
    this.bakes.clear();
    this.wanted.clear();
  }
}

/** The sky baked at `exposure`, which scales the energy of each light and the debanding noise. */
function bakeSky(gl: THREE.WebGLRenderer, input: SkyBakeInput, exposure: number): BakedSky | null {
  const { intensity, rotation, lights, ...sky } = input;
  const energy = intensity * exposure;
  const built = buildSkyEnvironment(gl, { ...sky, lights: exposed(lights, exposure), energy });
  if (!built) return null;
  const radiance = new SkyRadiance(gl, built.layers, rotation);
  return { background: built.background, radiance, dispose: built.dispose };
}

function exposed(lights: readonly SkyLight[], exposure: number): SkyLight[] {
  return lights.map((light) => ({ ...light, energy: light.energy * exposure }));
}
