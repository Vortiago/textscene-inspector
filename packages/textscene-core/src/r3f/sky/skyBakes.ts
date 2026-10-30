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
import { holdUntilReleased } from '../useDisposeOnRelease';
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

/**
 * The bakes each renderer holds of each sky, by the rest of the input. Written only by
 * `holdSkyBakes`, and an entry leaves when its bakes are disposed.
 */
const heldBakesOf = perObject((_gl: THREE.WebGLRenderer) =>
  perObject((_sky: Sky) => new Map<string, SkyBakes>())
);

/**
 * The bakes of `input` on `gl`, which every layer that draws the same sky with the same input
 * shares, as Godot shares one radiance. `lightsKey` names the lights, and `contextRestores` the
 * context the bakes live in. The caller owns the release.
 */
export function holdSkyBakes(
  gl: THREE.WebGLRenderer,
  input: SkyBakeInput,
  lightsKey: string,
  contextRestores: number
): { bakes: SkyBakes; release: () => void } {
  const held = heldBakesOf(gl)(input.sky);
  const key = `${inputKey(input, lightsKey)}|${contextRestores}`;
  const bakes = held.get(key) ?? new SkyBakes(gl, input, () => held.delete(key));
  held.set(key, bakes);
  return { bakes, release: holdUntilReleased(bakes) };
}

/** The input a bake reads besides the sky. Only a debanded sky reads the intensity. */
function inputKey(
  { sky, panorama, asBackground, intensity, rotation }: SkyBakeInput,
  lightsKey: string
): string {
  const debandedIntensity = isDebanded(sky.material) ? intensity : '';
  return [
    panorama?.uuid ?? '',
    asBackground,
    debandedIntensity,
    rotation.x,
    rotation.y,
    rotation.z,
    lightsKey,
  ].join('|');
}

/** The one exposure a bake that holds none bakes at, as every exposure would bake it alike. */
const ANY_EXPOSURE = 1;

/**
 * The bakes of one input by exposure. Godot keeps one radiance for a sky, so a bake that no render
 * read since the last sweep is freed, and a render whose bake waits draws with the latest one.
 */
export class SkyBakes {
  /** Each bake by its exposure, null for one the renderer could not make. */
  private readonly bakes = new Map<number, BakedSky | null>();
  /** The exposures a render asked for while it drew, which `bakeWanted` bakes. */
  private readonly wanted = new Set<number>();
  /** The exposures read since the last sweep, written by `at` and `bakeNow`, cleared by each sweep. */
  private readonly read = new Set<number>();
  /** The bake read last, which a render whose bake waits draws with, and which no sweep frees. */
  private latest: { exposure: number; baked: BakedSky } | null = null;
  /** Whether the exposure changes a bake: through a light energy, or the debanding noise. */
  private readonly holdsExposure: boolean;
  /** Grows by one with each bake made, so a reader tells a new one. */
  bakeCount = 0;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly input: SkyBakeInput,
    private readonly onDispose: () => void
  ) {
    const { sky, lights } = input;
    const exposureScalesLights =
      materialReadsLights(sky.material) && lights.some((light) => light.energy !== 0);
    this.holdsExposure = exposureScalesLights || isDebanded(sky.material);
  }

  /** Bakes the sky at `exposure` now, outside any render, or answers the bake it holds. */
  bakeNow(exposure: number): BakedSky | null {
    const key = this.keyOf(exposure);
    if (!this.bakes.has(key)) this.bake(key);
    return this.readOf(key);
  }

  /**
   * The bake at `exposure`, else the latest while it waits for `bakeWanted`, since a bake renders
   * cubes of its own. Null only before any bake.
   */
  at(exposure: number): BakedSky | null {
    const key = this.keyOf(exposure);
    if (!this.bakes.has(key)) this.wanted.add(key);
    return this.readOf(key) ?? (this.latest && this.readOf(this.latest.exposure));
  }

  /**
   * Frees each bake no render read since the last sweep, then bakes each exposure a render asked
   * for. Answers whether it baked any. A sweep with no read between runs nothing, so several
   * holders can call this in one frame.
   */
  bakeWanted(): boolean {
    if (this.read.size > 0) this.sweep();
    if (this.wanted.size === 0) return false;
    for (const exposure of this.wanted) this.bake(exposure);
    this.wanted.clear();
    return true;
  }

  dispose(): void {
    for (const baked of this.bakes.values()) free(baked);
    this.onDispose();
  }

  private bake(exposure: number): void {
    const baked = bakeSky(this.gl, this.input, exposure);
    this.bakes.set(exposure, baked);
    this.read.add(exposure);
    if (baked) this.bakeCount++;
  }

  private readOf(exposure: number): BakedSky | null {
    const baked = this.bakes.get(exposure) ?? null;
    if (!baked) return null;
    this.read.add(exposure);
    this.latest = { exposure, baked };
    return baked;
  }

  private sweep(): void {
    for (const [exposure, baked] of this.bakes) {
      if (this.read.has(exposure) || exposure === this.latest?.exposure) continue;
      free(baked);
      this.bakes.delete(exposure);
    }
    this.read.clear();
  }

  private keyOf(exposure: number): number {
    return this.holdsExposure ? exposure : ANY_EXPOSURE;
  }
}

function free(baked: BakedSky | null): void {
  baked?.radiance.hide();
  baked?.dispose();
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
