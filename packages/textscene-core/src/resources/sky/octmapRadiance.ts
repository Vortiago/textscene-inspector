import type * as THREE from 'three';
import type { SkyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { VECTOR3_ZERO, type Vector3 } from '../../godot/math/vector';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import { createSkyLayers, disposeSkyLayers, SkyLayerBaker, type SkyLayers } from './skyLayers';
import type { RadianceInPlace } from './build';
import type { SkyBake } from './types';

/** A sky drawn into Godot's octmap for each bake of its radiance (`sky.cpp:1322`). */
export interface OctmapSky {
  /** Draws the sky over `octmap`, laid out as `layout`, with `POSITION` at `position`. */
  draw(
    gl: THREE.WebGLRenderer,
    octmap: THREE.WebGLRenderTarget,
    layout: SkyOctmapLayout,
    position: Readonly<Vector3>
  ): void;
  /** Keeps what the next draw reads of the radiance just baked into `layers`. */
  keepRadiance(gl: THREE.WebGLRenderer, layers: SkyLayers): void;
  dispose(): void;
}

/** A sky's radiance layers from its octmap pass, kept for a dirty render to bake again in place. */
export class OctmapRadiance implements RadianceInPlace {
  readonly layers: SkyLayers;
  private readonly baker: SkyLayerBaker;

  /** Bakes the first radiance with `POSITION` at the origin. Disposes `octmapSky` if that fails. */
  constructor(
    private readonly gl: THREE.WebGLRenderer,
    bake: SkyBake,
    private readonly octmapSky: OctmapSky,
    sampling?: ProjectSampling
  ) {
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
      this.bakeAgain(VECTOR3_ZERO);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  bakeAgain(position: Readonly<Vector3>): void {
    this.baker.bakeEveryLayer(this.drawnAt(position));
    this.octmapSky.keepRadiance(this.gl, this.layers);
  }

  bakeFirstLayerAgain(position: Readonly<Vector3>): void {
    this.baker.bakeFirstLayer(this.drawnAt(position));
    this.octmapSky.keepRadiance(this.gl, this.layers);
  }

  filterLayer(layer: number): void {
    this.baker.filterLayer(layer);
  }

  /** Frees what bakes the layers, and hands the layers to the caller, who frees them. */
  releaseLayers(): SkyLayers {
    this.baker.dispose();
    this.octmapSky.dispose();
    return this.layers;
  }

  dispose(): void {
    disposeSkyLayers(this.releaseLayers());
  }

  private drawnAt(position: Readonly<Vector3>) {
    return (octmap: THREE.WebGLRenderTarget, layout: SkyOctmapLayout) =>
      this.octmapSky.draw(this.gl, octmap, layout, position);
  }
}
