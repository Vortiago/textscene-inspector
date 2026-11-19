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
import { isDebanded } from '../../resources/sky/debanding';
import {
  newSkyRadianceUpdate,
  type SkyRadianceStep,
  type SkyRender,
  type SkyUpdatePlan,
} from '../../godot/rendering/environment/skyRadianceUpdate';
import type { Vector3 } from '../../godot/math/vector';
import { skyUpdateMode } from '../../resources/sky/decode';
import { perObject } from '../../utils/perObject';
import { holdUntilReleased } from '../useDisposeOnRelease';
import { SkyRadiance } from './skyRadiance';
import type { SkyBackdrop } from './skyBackground';
import { isLiveTarget, liveTargetDrawCount } from '../liveTargets';

/** A baked sky: its background and the radiance its readers sample. */
interface BakedSky {
  background: SkyBackdrop | null;
  radiance: SkyRadiance;
  /** Draws the background again from a live panorama, absent for any other. */
  redrawBackground?: () => void;
  /** The bake of the radiance layers in place, absent for a sky no render dirties after its build. */
  radianceInPlace?: RadianceInPlace;
  /** Shows the lights at a render's exposure to its background and its next bake in place. */
  setLights?: (lights: readonly SkyLight[]) => void;
  /** Sets the energy the next bake in place is read at. */
  setBakeEnergy?: (energy: number) => void;
  /** What the radiance layers drew last. */
  drawn: DrawnLayers;
  /** Frees the background and the radiance layers. */
  dispose: () => void;
}

/** What the layers of a radiance drew last, written only by `bakeSky` and `stepLayers`. */
interface DrawnLayers {
  /** The light data layer 0 drew with, at the exposure of the render that drew it. */
  lightData: string;
  /** Whether a render has stepped the radiance since its build. */
  isStepped: boolean;
  /** Whether the other layers filter from a layer 0 that changed. */
  isFiltering: boolean;
  /** The energy each layer was baked or filtered at, which Godot bakes into the layer. */
  energies: number[];
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

/** The one bake of an input, which every render steps, as Godot keeps one radiance (`sky.h:271`). */
export class SkyBakes {
  /** The bake, null for one the renderer could not make, absent before `bakeNow`. */
  private baked: BakedSky | null | undefined;
  /** The lights each render shows, written only by `followLights`. */
  private lights: SkyLightsRead;
  /** The exposure the bake's lights show now, null once `followLights` takes new lights. */
  private shownExposure: number | null;
  /** The live panorama draw the background shows, written only by `followPanorama`, null for none. */
  private backgroundDraws: number | null;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly input: SkyBakeInput,
    private readonly onDispose: () => void
  ) {
    const { lights, panorama } = input;
    this.lights = lights;
    this.shownExposure = null;
    this.backgroundDraws = panorama && isLiveTarget(panorama) ? liveTargetDrawCount(panorama) : null;
  }

  /** Bakes the sky at `exposure` now, outside any render, unless it holds its bake. */
  bakeNow(exposure: number, lightData: string): BakedSky | null {
    if (this.baked === undefined) {
      this.baked = bakeSky(this.gl, { ...this.input, lights: this.lights }, exposure, lightData);
      this.shownExposure = exposure;
    }
    return this.baked;
  }

  /** Draws the background again for each new draw of a live panorama, as Godot does (`sky.cpp:1463`). */
  followPanorama(): void {
    const { panorama } = this.input;
    if (this.backgroundDraws === null || !panorama) return;
    const draws = liveTargetDrawCount(panorama);
    if (draws === this.backgroundDraws) return;
    this.backgroundDraws = draws;
    this.baked?.redrawBackground?.();
  }

  /** Takes `lights` for the renders to come. A repeat changes nothing. */
  followLights(lights: SkyLightsRead): void {
    if (lights.key === this.lights.key) return;
    this.lights = lights;
    this.shownExposure = null;
  }

  /** Shows the lights at `exposure` to the background and the next bake in place. */
  showLightsAt(exposure: number): void {
    if (exposure === this.shownExposure) return;
    this.shownExposure = exposure;
    this.baked?.setLights?.(exposed(this.lights.lights, exposure));
  }

  /** Runs `step` of `render`, whose sky reads `lightData`, and answers whether it drew. */
  step(render: SkyRender, step: SkyRadianceStep, lightData: string, draw: InPlaceRender): boolean {
    const baked = this.baked;
    if (!baked) return false;
    if (baked.radianceInPlace) this.showLightsAt(render.exposure);
    if (step.kind === 'bake') baked.setBakeEnergy?.(render.brightness);
    const layersDraw = { ...draw, lightData, energy: render.brightness };
    return stepLayers(baked.radianceInPlace, baked.drawn, step, layersDraw);
  }

  dispose(): void {
    if (this.baked) free(this.baked);
    this.onDispose();
  }
}

function free(baked: BakedSky | null): void {
  baked?.radiance.hide();
  baked?.dispose();
}

/** The sky baked at `exposure`, which scales the energy of each light and the debanding noise. */
function bakeSky(
  gl: THREE.WebGLRenderer,
  input: SkyBakeInput,
  exposure: number,
  lightData: string
): BakedSky | null {
  const { energyMultiplier, rotation, lights, ...sky } = input;
  const energy = energyMultiplier * exposure;
  const built = buildSkyEnvironment(gl, { ...sky, lights: exposed(lights.lights, exposure), energy });
  if (!built) return null;
  const { layers, ...baked } = built;
  const energies = new Array<number>(roughnessLayersOf(sky.sky.radianceFilter)).fill(energy);
  const drawn = { lightData, isStepped: false, isFiltering: false, energies };
  return { ...baked, radiance: new SkyRadiance(gl, layers, rotation), drawn };
}

/** What a render asks of a radiance in place. */
export interface InPlaceRender {
  /** `POSITION` of the draw. */
  position: Vector3;
  /** Whether each bake draws again, as for a sky that reads `TIME` or `POSITION`. */
  isDrawnEachBake: boolean;
}

/** What a render asks of a radiance in place, with the light data its sky reads and its energy. */
interface InPlaceDraw extends InPlaceRender {
  lightData: string;
  energy: number;
}

/** Runs `step` on the layers' energies and, where their content changes, on the bake in place. */
function stepLayers(
  inPlace: RadianceInPlace | undefined,
  drawn: DrawnLayers,
  step: SkyRadianceStep,
  draw: InPlaceDraw
): boolean {
  if (!drawn.isStepped) {
    // A radiance no render has stepped holds the lights, the `TIME` and the origin of its build.
    drawn.isStepped = true;
    drawn.energies.fill(draw.energy);
    if (!inPlace || (!draw.isDrawnEachBake && drawn.lightData === draw.lightData)) return false;
    drawn.lightData = draw.lightData;
    inPlace.bakeAgain(draw.position);
    return true;
  }
  if (step.kind === 'filter') {
    drawn.energies[step.layer] = drawn.energies[0]!;
    if (!inPlace || !drawn.isFiltering) return false;
    inPlace.filterLayer(step.layer);
    return true;
  }
  if (step.kind !== 'bake') return false;
  if (step.isFirstLayerOnly) drawn.energies[0] = draw.energy;
  else drawn.energies.fill(draw.energy);
  // The light data holds the exposure, so a render at another exposure redraws layer 0.
  const isChanged = draw.isDrawnEachBake || drawn.lightData !== draw.lightData;
  drawn.isFiltering = isChanged && step.isFirstLayerOnly;
  if (!inPlace || !isChanged) return false;
  drawn.lightData = draw.lightData;
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
