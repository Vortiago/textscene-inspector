/**
 * The bakes of one sky, one for each exposure that bakes it. Godot bakes a sky's radiance at the
 * exposure of the render that finds it dirty (`sky.cpp:1275`, `:1295`), and a sky that reads lights
 * is dirty in each render whose light energies, which the exposure scales, differ from the last
 * (`sky.cpp:1085-1087`, `:1105-1143`). So viewports that draw one sky at two exposures can read two
 * bakes. A bake holds the exposure only in its light energies and its debanding noise.
 */

import type * as THREE from 'three';
import {
  buildSkyEnvironment,
  type RadianceInPlace,
  type SkyEnvironmentInput,
  type SkyLight,
} from '../../resources/sky/build';
import type { Sky } from '../../resources/sky/types';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import { roughnessLayersOf } from '../../resources/sky/skyLayers';
import { materialReadsLights } from '../../resources/sky/readsLights';
import { isDebanded } from '../../resources/sky/debanding';
import {
  newSkyRadianceUpdate,
  type SkyRadianceStep,
  type SkyUpdatePlan,
} from '../../godot/rendering/environment/skyRadianceUpdate';
import type { Vector3 } from '../../godot/math/vector';
import { skyUpdateMode } from '../../resources/sky/decode';
import { perObject } from '../../utils/perObject';
import { holdUntilReleased } from '../useDisposeOnRelease';
import { SkyRadiance } from './skyRadiance';
import type { SkyBackdrop } from './skyBackground';
import { isLiveTarget, liveTargetDrawCount } from '../liveTargets';

/** A sky baked at one exposure: its background and the radiance its readers sample. */
interface BakedSky {
  background: SkyBackdrop | null;
  radiance: SkyRadiance;
  /** Draws the background again from a live panorama, absent for any other. */
  redrawBackground?: () => void;
  /** The bake of the radiance layers in place, absent for a sky no render dirties after its build. */
  radianceInPlace?: RadianceInPlace;
  /** Shows the lights at the bake's exposure to its background and its next bake in place. */
  setLights?: (lights: readonly SkyLight[]) => void;
  /** What layer 0 of the radiance in place drew last. */
  drawn: DrawnLayers;
  /** Frees the background and the radiance layers. */
  dispose: () => void;
}

/** What layer 0 of a radiance in place drew last, written only by `stepInPlace`. */
interface DrawnLayers {
  lightsKey: string;
  /** Whether a render has stepped the radiance since its build. */
  isStepped: boolean;
  /** Whether the other layers filter from a layer 0 that changed. */
  isFiltering: boolean;
}

/** The lights a render reads for its sky, and the key that tells one reading from the next. */
export interface SkyLightsRead {
  readonly lights: readonly SkyLight[];
  readonly key: string;
}

/** What a bake of the sky takes beside the exposure. */
interface SkyBakeInput extends Omit<SkyEnvironmentInput, 'energy' | 'lights'> {
  lights: SkyLightsRead;
  /** `background_energy_multiplier`, which the exposure scales into the debanding noise. */
  energyMultiplier: number;
  rotation: THREE.Euler;
}

/** How `sky`'s radiance updates in a scene whose fog does or does not scatter the sun. */
export function skyUpdatePlan(sky: Sky, fogScattersSun: boolean): SkyUpdatePlan {
  return { mode: skyUpdateMode(sky, fogScattersSun), layers: roughnessLayersOf(sky.radianceFilter) };
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

/** The bakes of `input` on `gl`, shared as Godot shares one radiance. The caller owns the release. */
export function holdSkyBakes(
  gl: THREE.WebGLRenderer,
  input: SkyBakeInput,
  contextRestores: number
): { bakes: SkyBakes; release: () => void } {
  const held = heldBakesOf(gl)(input.sky);
  const key = `${inputKey(input)}|${contextRestores}`;
  const bakes = held.get(key) ?? new SkyBakes(gl, input, () => held.delete(key));
  held.set(key, bakes);
  return { bakes, release: holdUntilReleased(bakes) };
}

/** The input a bake reads besides the sky and the lights. Only a debanded sky reads the energy multiplier. */
function inputKey({
  sky,
  panorama,
  textures = {},
  sampling,
  asBackground,
  energyMultiplier,
  rotation,
}: SkyBakeInput): string {
  const debandedEnergy = isDebanded(sky.material) ? energyMultiplier : '';
  return [
    panorama?.uuid ?? '',
    Object.entries(textures)
      .map(([name, texture]) => `${name}=${samplerKey(texture)}`)
      .sort(),
    sampling?.anisotropicFilteringLevel ?? '',
    sampling?.useNearestMipmapFilter ?? '',
    asBackground,
    debandedEnergy,
    rotation.x,
    rotation.y,
    rotation.z,
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
  /** Whether the exposure changes a bake: through the light energies, or the debanding noise. */
  private readonly holdsExposure: boolean;
  /** The lights each bake draws, written only by `followLights`. */
  private lights: SkyLightsRead;
  /** Grows by one with each bake made, so a reader tells a new one. */
  bakeCount = 0;
  /**
   * The draw of a live panorama the backgrounds show, written only by `followPanorama`. Null for a
   * panorama no pass draws.
   */
  private backgroundDraws: number | null;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly input: SkyBakeInput,
    private readonly onDispose: () => void
  ) {
    const { sky, lights, panorama } = input;
    this.lights = lights;
    // Whatever the energies: a change of the lights moves into each bake, which keeps its exposure.
    this.holdsExposure = materialReadsLights(sky.material) || isDebanded(sky.material);
    this.backgroundDraws = panorama && isLiveTarget(panorama) ? liveTargetDrawCount(panorama) : null;
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

  /**
   * Draws the background of each bake again once per new draw of a live panorama, as Godot draws
   * the background from the sky shader each frame (`sky.cpp:1463`). The radiance keeps its bake, as
   * a draw of the target leaves Godot's sky clean. Every layer that shares these bakes may call it.
   */
  followPanorama(): void {
    const { panorama } = this.input;
    if (this.backgroundDraws === null || !panorama) return;
    const draws = liveTargetDrawCount(panorama);
    if (draws === this.backgroundDraws) return;
    this.backgroundDraws = draws;
    for (const baked of this.bakes.values()) baked?.redrawBackground?.();
  }

  /** Shows `lights` to each bake at its own exposure, and to the bakes to come. A repeat changes nothing. */
  followLights(lights: SkyLightsRead): void {
    if (lights.key === this.lights.key) return;
    this.lights = lights;
    for (const [exposure, baked] of this.bakes) baked?.setLights?.(exposed(lights.lights, exposure));
  }

  /** Runs `step` on the radiance at `exposure` and answers whether it drew, as `stepInPlace` does. */
  stepInPlaceAt(
    exposure: number,
    step: SkyRadianceStep,
    position: Vector3,
    isDrawnEachBake: boolean
  ): boolean {
    const baked = this.bakes.get(this.keyOf(exposure));
    if (!baked?.radianceInPlace) return false;
    const draw = { position, lightsKey: this.lights.key, isDrawnEachBake };
    return stepInPlace(baked.radianceInPlace, baked.drawn, step, draw);
  }

  dispose(): void {
    for (const baked of this.bakes.values()) free(baked);
    this.onDispose();
  }

  private bake(exposure: number): void {
    const baked = bakeSky(this.gl, { ...this.input, lights: this.lights }, exposure);
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
  const { energyMultiplier, rotation, lights, ...sky } = input;
  const energy = energyMultiplier * exposure;
  const built = buildSkyEnvironment(gl, { ...sky, lights: exposed(lights.lights, exposure), energy });
  if (!built) return null;
  const { layers, ...baked } = built;
  const drawn = { lightsKey: lights.key, isStepped: false, isFiltering: false };
  return { ...baked, radiance: new SkyRadiance(gl, layers, rotation), drawn };
}

/** What a render asks of a radiance in place. */
interface InPlaceDraw {
  /** `POSITION` of the draw. */
  position: Vector3;
  lightsKey: string;
  /** Whether each bake draws again, as for a sky that reads `TIME` or `POSITION`. */
  isDrawnEachBake: boolean;
}

/** Runs `step` in place and answers whether it drew. A cycle of lights layer 0 holds draws nothing. */
function stepInPlace(
  inPlace: RadianceInPlace,
  drawn: DrawnLayers,
  step: SkyRadianceStep,
  draw: InPlaceDraw
): boolean {
  if (!drawn.isStepped) {
    // A radiance no render has stepped holds the lights, the `TIME` and the origin of its build.
    drawn.isStepped = true;
    if (!draw.isDrawnEachBake && drawn.lightsKey === draw.lightsKey) return false;
    drawn.lightsKey = draw.lightsKey;
    inPlace.bakeAgain(draw.position);
    return true;
  }
  if (step.kind === 'filter') {
    if (drawn.isFiltering) inPlace.filterLayer(step.layer);
    return drawn.isFiltering;
  }
  if (step.kind !== 'bake') return false;
  // Each bake holds one exposure, so a dirt from the exposure alone redraws what layer 0 holds.
  const isChanged = draw.isDrawnEachBake || drawn.lightsKey !== draw.lightsKey;
  drawn.isFiltering = isChanged && step.isFirstLayerOnly;
  if (!isChanged) return false;
  drawn.lightsKey = draw.lightsKey;
  if (step.isFirstLayerOnly) inPlace.bakeFirstLayerAgain(draw.position);
  else inPlace.bakeAgain(draw.position);
  return true;
}

function exposed(lights: readonly SkyLight[], exposure: number): SkyLight[] {
  return lights.map((light) => ({ ...light, energy: light.energy * exposure }));
}

function samplerKey(value: SamplerValue): string {
  return Array.isArray(value)
    ? value.map((texture) => texture?.uuid ?? '').join(',')
    : (value as THREE.Texture).uuid;
}
