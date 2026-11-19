import type * as THREE from 'three';
import type { SkyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { VECTOR3_ZERO, type Vector3 } from '../../godot/math/vector';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import {
  createSkyLayers,
  disposeSkyLayers,
  SkyLayerBaker,
  swapSkyLayerTargets,
  type SkyLayers,
} from './skyLayers';
import type { RadianceInPlace, SkyEnvironment, SkyLight } from './build';
import type { SkyBackdrop } from '../../r3f/sky/skyBackground';
import type { SkyBake } from './types';

/** A sky drawn into Godot's octmap for each bake of its radiance (`sky.cpp:1322`). */
export interface OctmapSky {
  /** Draws the sky over `octmap`, laid out as `layout`, with `POSITION` at `position`, read at `energy`. */
  draw(
    gl: THREE.WebGLRenderer,
    octmap: THREE.WebGLRenderTarget,
    layout: SkyOctmapLayout,
    position: Readonly<Vector3>,
    energy: number
  ): void;
  /** Keeps what the next draw reads of the radiance just baked into `layers`, absent when it reads none. */
  keepRadiance?(gl: THREE.WebGLRenderer, layers: SkyLayers): void;
  dispose(): void;
}

/** A sky's radiance layers from its octmap pass, kept for a dirty render to bake again in place. */
export class OctmapRadiance implements RadianceInPlace {
  readonly layers: SkyLayers;
  private readonly baker: SkyLayerBaker;
  /** The key of the full bake `layers` hold, null for layers drawn in steps or under no key. */
  private heldKey: string | null = null;
  private readonly bake: SkyBake;
  /** The full bake before, by key: a software WebGL bake takes 0.9 s. Freed with the radiance. */
  private kept: { layers: SkyLayers; key: string | null } | null = null;

  /** Bakes the first radiance at `energy`, `POSITION` at the origin. Disposes `octmapSky` if that fails. */
  constructor(
    private readonly gl: THREE.WebGLRenderer,
    bake: SkyBake,
    private readonly octmapSky: OctmapSky,
    energy: number,
    private readonly sampling?: ProjectSampling
  ) {
    this.bake = bake;
    let layers: SkyLayers | undefined;
    try {
      layers = createSkyLayers(bake, sampling);
      this.baker = new SkyLayerBaker(gl, layers, bake.radianceFilter);
    } catch (error) {
      if (layers) disposeSkyLayers(layers);
      octmapSky.dispose();
      throw error;
    }
    this.layers = layers;
    try {
      this.bakeAgain(VECTOR3_ZERO, energy);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  bakeAgain(position: Readonly<Vector3>, energy: number, key?: string): void {
    if (key !== undefined && this.kept?.key === key) {
      this.takeKept(key);
      return;
    }
    if (key === undefined) this.freeKept();
    else if (this.heldKey !== null) this.keepHeld();
    this.baker.bakeEveryLayer(this.drawnAt(position, energy));
    this.heldKey = key ?? null;
    this.octmapSky.keepRadiance?.(this.gl, this.layers);
  }

  bakeFirstLayerAgain(position: Readonly<Vector3>, energy: number): void {
    this.baker.bakeFirstLayer(this.drawnAt(position, energy));
    this.heldKey = null;
    this.octmapSky.keepRadiance?.(this.gl, this.layers);
  }

  filterLayer(layer: number): void {
    this.baker.filterLayer(layer);
  }

  /** Frees what bakes the layers, and hands the layers to the caller, who frees them. */
  releaseLayers(): SkyLayers {
    this.freeKept();
    this.baker.dispose();
    this.octmapSky.dispose();
    return this.layers;
  }

  dispose(): void {
    disposeSkyLayers(this.releaseLayers());
  }

  /** Holds the kept layers of `key` again, and keeps the layers held until now. */
  private takeKept(key: string): void {
    const kept = this.kept!;
    swapSkyLayerTargets(this.layers, kept.layers);
    kept.key = this.heldKey;
    this.heldKey = key;
    this.octmapSky.keepRadiance?.(this.gl, this.layers);
  }

  /** Keeps the held layers under their key, and leaves the kept array, or a new one, to bake into. */
  private keepHeld(): void {
    this.kept ??= { layers: createSkyLayers(this.bake, this.sampling), key: null };
    swapSkyLayerTargets(this.layers, this.kept.layers);
    this.kept.key = this.heldKey;
  }

  private freeKept(): void {
    if (this.kept) disposeSkyLayers(this.kept.layers);
    this.kept = null;
  }

  private drawnAt(position: Readonly<Vector3>, energy: number) {
    return (octmap: THREE.WebGLRenderTarget, layout: SkyOctmapLayout) =>
      this.octmapSky.draw(this.gl, octmap, layout, position, energy);
  }
}

/** What a sky's environment holds beside its radiance. */
interface SkyEnvironmentParts {
  background: SkyBackdrop | null;
  disposeBackground: () => void;
  redrawBackground?: () => void;
  setLights: (lights: readonly SkyLight[]) => void;
}

/** The environment of `radiance`. A sky no render dirties after its build keeps only its layers. */
export function octmapSkyEnvironment(
  radiance: OctmapRadiance,
  isDirtiable: boolean,
  { background, disposeBackground, redrawBackground, setLights }: SkyEnvironmentParts
): SkyEnvironment {
  if (!isDirtiable) {
    const layers = radiance.releaseLayers();
    const dispose = () => {
      disposeBackground();
      disposeSkyLayers(layers);
    };
    return { background, layers, redrawBackground, dispose };
  }
  const dispose = () => {
    disposeBackground();
    radiance.dispose();
  };
  return {
    background,
    layers: radiance.layers,
    redrawBackground,
    radianceInPlace: radiance,
    setLights,
    dispose,
  };
}
