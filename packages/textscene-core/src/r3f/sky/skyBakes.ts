/**
 * The bakes of one sky, one for each exposure that bakes it. Godot bakes a sky's radiance at the
 * exposure of the render that finds it dirty (`sky.cpp:1275`, `:1295`), and a sky that reads lights
 * is dirty in each render whose light energies, which the exposure scales, differ from the last
 * (`sky.cpp:1085-1087`, `:1105-1143`). So viewports that draw one sky at two exposures can read two
 * bakes. A bake holds the exposure only in its light energies and its debanding noise.
 */

import type * as THREE from 'three';
import { buildSkyEnvironment, type SkyEnvironmentInput, type SkyLight } from '../../resources/sky/build';
import type { Sky } from '../../resources/sky/types';
import { roughnessLayersOf } from '../../resources/sky/skyLayers';
import { materialReadsLights } from '../../resources/sky/readsLights';
import { isDebanded } from '../../resources/sky/debanding';
import {
  newSkyRadianceUpdate,
  skyUpdateMode,
  type SkyUpdatePlan,
} from '../../godot/rendering/environment/skyRadianceUpdate';
import { perObject } from '../../utils/perObject';
import { SkyRadiance } from './skyRadiance';

/** A sky baked at one exposure: its background and the radiance its readers sample. */
interface BakedSky {
  background: THREE.Texture | null;
  radiance: SkyRadiance;
  /** Frees the background and the radiance layers. */
  dispose: () => void;
}

/** What a bake of the sky takes beside the exposure. */
interface SkyBakeInput extends Omit<SkyEnvironmentInput, 'energy'> {
  /** `background_energy_multiplier`, which the exposure scales into the debanding noise. */
  intensity: number;
  rotation: THREE.Euler;
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

/** Bakes that layers hold, and how many hold them. */
interface HeldBakes {
  bakes: SkyBakes;
  holders: number;
}

/**
 * The bakes each renderer holds of each sky, by the rest of the input. Written only by
 * `holdSkyBakes` and its release. An entry leaves with its last holder.
 */
const heldBakesOf = perObject((_gl: THREE.WebGLRenderer) =>
  perObject((_sky: Sky) => new Map<string, HeldBakes>())
);

/**
 * The bakes of `input` on `gl`, which every layer that draws the same sky with the same input
 * shares, as Godot shares one radiance. `lightsKey` names the lights. The caller owns the release.
 */
export function holdSkyBakes(
  gl: THREE.WebGLRenderer,
  input: SkyBakeInput,
  lightsKey: string
): { bakes: SkyBakes; release: () => void } {
  const held = heldBakesOf(gl)(input.sky);
  const key = inputKey(input, lightsKey);
  const entry = held.get(key) ?? { bakes: new SkyBakes(gl, input), holders: 0 };
  held.set(key, entry);
  entry.holders++;
  let isReleased = false;
  return {
    bakes: entry.bakes,
    release: () => {
      if (isReleased) return;
      isReleased = true;
      entry.holders--;
      if (entry.holders > 0) return;
      entry.bakes.dispose();
      held.delete(key);
    },
  };
}

function inputKey({ panorama, asBackground, intensity, rotation }: SkyBakeInput, lightsKey: string): string {
  return [panorama?.uuid ?? '', asBackground, intensity, rotation.x, rotation.y, rotation.z, lightsKey].join(
    '|'
  );
}

/** The one exposure a bake that holds none bakes at, as every exposure would bake it alike. */
const ANY_EXPOSURE = 1;

export class SkyBakes {
  /** Each bake by its exposure, null for one the renderer could not make. */
  private readonly bakes = new Map<number, BakedSky | null>();
  /** The exposures a render asked for while it drew, which `bakeWanted` bakes. */
  private readonly wanted = new Set<number>();
  /** Whether the exposure changes a bake: through a light energy, or the debanding noise. */
  private readonly holdsExposure: boolean;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly input: SkyBakeInput
  ) {
    const { sky, lights } = input;
    const lightsScale = materialReadsLights(sky.material) && lights.some((light) => light.energy !== 0);
    this.holdsExposure = lightsScale || isDebanded(sky.material);
  }

  /** Bakes the sky at `exposure` now, outside any render, or answers the bake it holds. */
  bakeNow(exposure: number): BakedSky | null {
    const key = this.keyOf(exposure);
    if (!this.bakes.has(key)) this.bakes.set(key, bakeSky(this.gl, this.input, key));
    return this.bakes.get(key)!;
  }

  /**
   * The bake at `exposure`, or null while it waits for `bakeWanted`. A render that asks draws with
   * another bake for one frame, since a bake renders cubes of its own.
   */
  at(exposure: number): BakedSky | null {
    const key = this.keyOf(exposure);
    if (!this.bakes.has(key)) this.wanted.add(key);
    return this.bakes.get(key) ?? null;
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
  }

  private keyOf(exposure: number): number {
    return this.holdsExposure ? exposure : ANY_EXPOSURE;
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
