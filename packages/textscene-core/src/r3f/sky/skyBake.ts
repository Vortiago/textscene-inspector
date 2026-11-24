import type * as THREE from 'three';
import type { RadianceInPlace, SkyEnvironmentInput, SkyLight } from '../../resources/sky/build';
import type { buildShaderSkyEnvironment } from '../../resources/sky/shaderSky';
import type { Sky } from '../../resources/sky/types';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import { roughnessLayersOf } from '../../resources/sky/skyLayers';
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

/** A baked sky: its background and the radiance its readers sample. */
interface BakedSky {
  background: SkyBackdrop | null;
  radiance: SkyRadiance;
  /** The bake of the radiance layers in place, absent for a sky no render dirties after its build. */
  radianceInPlace?: RadianceInPlace;
  /** Shows the lights at a render's exposure to its background and its next bake in place. */
  setLights?: (lights: readonly SkyLight[]) => void;
  /** What the radiance layers drew last. */
  drawn: DrawnLayers;
  /** Frees the background and the radiance layers. */
  dispose: () => void;
}

/** What the layers of a radiance drew last, written only by `bakeSky` and `SkyBake.step`. */
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
  /** The transpiler's build, imported on demand to keep it off the first paint. */
  buildEnvironment: typeof buildShaderSkyEnvironment;
  /** `background_energy_multiplier`, which the build bakes the layers at, times the exposure. */
  energyMultiplier: number;
  rotation: THREE.Euler;
}

/** How `sky`'s radiance updates in a scene whose fog does or does not scatter the sun. */
export function skyUpdatePlan(sky: Sky, fogScattersSun: boolean): SkyUpdatePlan {
  return { mode: skyUpdateMode(sky, fogScattersSun), layers: roughnessLayersOf(sky.radianceFilter) };
}

/** The radiance update of each sky, which every Environment drawing it shares (`sky.h:251`). */
export const radianceUpdateOf = perObject((_sky: Sky) => newSkyRadianceUpdate());

/** Each renderer's bakes of each sky, by input key. Written only by `holdSkyBake`, cleared on dispose. */
const heldBakesOf = perObject((_gl: THREE.WebGLRenderer) =>
  perObject((_sky: Sky) => new Map<string, SkyBake>())
);

/** The bake of `input` on `gl`, shared as Godot shares one radiance. The caller owns the release. */
export function holdSkyBake(
  gl: THREE.WebGLRenderer,
  input: SkyBakeInput,
  contextRestores: number
): { bake: SkyBake; release: () => void } {
  const held = heldBakesOf(gl)(input.sky);
  const key = `${inputKey(input)}|${contextRestores}`;
  const bake = held.get(key) ?? new SkyBake(gl, input, () => held.delete(key));
  held.set(key, bake);
  return { bake, release: holdUntilReleased(bake) };
}

/** The input a bake reads besides the sky and the lights. */
function inputKey({ textures = {}, sampling, asBackground, rotation }: SkyBakeInput): string {
  return [
    Object.entries(textures)
      .map(([name, texture]) => `${name}=${samplerKey(texture)}`)
      .sort(),
    sampling?.anisotropicFilteringLevel ?? '',
    sampling?.useNearestMipmapFilter ?? '',
    asBackground,
    rotation.x,
    rotation.y,
    rotation.z,
  ].join('|');
}

/** The one bake of an input, which every render steps, as Godot keeps one radiance (`sky.h:271`). */
class SkyBake {
  /** The bake, null for one the renderer could not make, absent before `bakeNow`. */
  private baked: BakedSky | null | undefined;
  /** The lights each render shows, written only by `followLights`. */
  private lights: SkyLightsRead;
  /** The exposure the bake's lights show now, null once `followLights` takes new lights. */
  private shownExposure: number | null;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly input: SkyBakeInput,
    private readonly onDispose: () => void
  ) {
    this.lights = input.lights;
    this.shownExposure = null;
  }

  /** Bakes the sky at `exposure` now, outside any render, unless it holds its bake. */
  bakeNow(exposure: number, lightData: string): BakedSky | null {
    if (this.baked === undefined) {
      this.baked = bakeSky(this.gl, { ...this.input, lights: this.lights }, exposure, lightData);
      this.shownExposure = exposure;
    }
    return this.baked;
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

  /** Runs `step` of `render` on the layer energies and the bake in place, and answers whether it drew. */
  step(render: SkyRender, step: SkyRadianceStep, draw: LayersDraw): boolean {
    const baked = this.baked;
    if (!baked) return false;
    const { drawn, radianceInPlace } = baked;
    const isFirstStep = !drawn.isStepped;
    drawn.isStepped = true;
    // A first step that bakes nothing keeps the build's energies, as Godot keeps the bake of a clean sky.
    if (!isFirstStep) stepEnergies(drawn.energies, step, render.brightness);
    else if (step.kind === 'bake') drawn.energies.fill(render.brightness);
    if (!radianceInPlace) return false;
    this.showLightsAt(render.exposure);
    if (!isFirstStep) return drawStep(radianceInPlace, drawn, step, draw, render.brightness);
    const isRedrawn = redrawBuild(radianceInPlace, drawn, draw, render.brightness);
    if (isRedrawn) drawn.energies.fill(render.brightness);
    return isRedrawn;
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

/** The sky baked at `exposure`, which scales the energy of each light and of the layers. */
function bakeSky(
  gl: THREE.WebGLRenderer,
  input: SkyBakeInput,
  exposure: number,
  lightData: string
): BakedSky | null {
  const { energyMultiplier, rotation, lights, buildEnvironment, ...sky } = input;
  const energy = energyMultiplier * exposure;
  const built = buildEnvironment(gl, { ...sky, lights: exposed(lights.lights, exposure), energy });
  if (!built) return null;
  const { layers, ...baked } = built;
  const energies = new Array<number>(roughnessLayersOf(sky.sky.radianceFilter)).fill(energy);
  const drawn = { lightData, isStepped: false, isFiltering: false, energies };
  return { ...baked, radiance: new SkyRadiance(gl, layers, rotation), drawn };
}

/** What a render asks of the radiance layers. */
interface LayersDraw {
  /** `POSITION` of the draw. */
  position: Vector3;
  /** Whether each bake draws again, as for a sky that reads `TIME` or `POSITION`. */
  isDrawnEachBake: boolean;
  /** The key of the light data the render's sky reads, from `lightDataKey`. */
  lightData: string;
}

/** Moves the energy of each layer `step` bakes or filters, as Godot bakes the render's energy into it. */
function stepEnergies(energies: number[], step: SkyRadianceStep, energy: number): void {
  if (step.kind === 'filter') energies[step.layer] = energies[0]!;
  else if (step.kind === 'bake' && step.isFirstLayerOnly) energies[0] = energy;
  else if (step.kind === 'bake') energies.fill(energy);
}

/** Bakes again, in the first render, a radiance whose build holds other lights, or a sky drawn each bake. */
function redrawBuild(
  inPlace: RadianceInPlace,
  drawn: DrawnLayers,
  draw: LayersDraw,
  energy: number
): boolean {
  if (!draw.isDrawnEachBake && drawn.lightData === draw.lightData) return false;
  drawn.lightData = draw.lightData;
  inPlace.bakeAgain(draw.position, energy, texelKeyOf(draw, energy));
  return true;
}

/** Runs `step` in place and answers whether it drew. A cycle of lights layer 0 holds draws nothing. */
function drawStep(
  inPlace: RadianceInPlace,
  drawn: DrawnLayers,
  step: SkyRadianceStep,
  draw: LayersDraw,
  energy: number
): boolean {
  if (step.kind === 'filter') {
    if (drawn.isFiltering) inPlace.filterLayer(step.layer);
    return drawn.isFiltering;
  }
  if (step.kind !== 'bake') return false;
  // The light data holds the exposure, so a render at another exposure redraws layer 0.
  const isChanged = draw.isDrawnEachBake || drawn.lightData !== draw.lightData;
  drawn.isFiltering = isChanged && step.isFirstLayerOnly;
  if (!isChanged) return false;
  drawn.lightData = draw.lightData;
  if (step.isFirstLayerOnly) inPlace.bakeFirstLayerAgain(draw.position, energy);
  else inPlace.bakeAgain(draw.position, energy, texelKeyOf(draw, energy));
  return true;
}

/** What a full bake's texels follow, beside the bake's input: none for a sky drawn each bake. */
function texelKeyOf(draw: LayersDraw, energy: number): string | undefined {
  return draw.isDrawnEachBake ? undefined : `${draw.lightData}|${energy}`;
}

function exposed(lights: readonly SkyLight[], exposure: number): SkyLight[] {
  return lights.map((light) => ({ ...light, energy: light.energy * exposure }));
}

function samplerKey(value: SamplerValue): string {
  return Array.isArray(value)
    ? value.map((texture) => texture?.uuid ?? '').join(',')
    : (value as THREE.Texture).uuid;
}
