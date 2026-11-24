import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import type { SkyLight } from '../../shaders/sky/skyBindings';
import type { Sky } from './types';
import type { Vector3 } from '../../godot/math/vector';
import type { FastFilterQuality } from '../../godot/rendering/environment/skyReflection';
import type { SkyLayers } from './octmapArrays';
import type { SkyBackdrop } from '../../r3f/sky/skyBackground';

export type { SkyLight } from '../../shaders/sky/skyBindings';

/** The ambient, the reflections and the fogs read the sky's own radiance (`reflection_source`). */
export interface SkyEnvironment {
  /** The sky at each pixel behind the scene, or null for a sky that does not paint the background. */
  background: SkyBackdrop | null;
  /** Godot's radiance layers, which its ambient, its reflections and the fogs read. */
  layers: SkyLayers;
  /** The bake of the layers in place, absent for a sky no render dirties after its build. */
  radianceInPlace?: RadianceInPlace;
  /** Shows `lights` to the background and to the next bake, absent for a sky that reads none. */
  setLights?: (lights: readonly SkyLight[]) => void;
  /** Frees the background and the layers. */
  dispose: () => void;
}

/** Bakes the layers again into the array the readers sample, as for a dirty sky (`sky.cpp:1273`). */
export interface RadianceInPlace {
  /** Bakes every layer at `energy`. A `key` names the texels, and the bake before keeps its layers. */
  bakeAgain(position: Readonly<Vector3>, energy: number, key?: string): void;
  /** Bakes layer 0 alone to be read at `energy`, as an incremental sky does. `filterLayer` does the rest. */
  bakeFirstLayerAgain(position: Readonly<Vector3>, energy: number): void;
  /** Filters `layer` from the last bake of layer 0. */
  filterLayer(layer: number): void;
}

export interface SkyEnvironmentInput {
  sky: Sky;
  lights: readonly SkyLight[];
  /** Whether the sky paints the background. */
  asBackground: boolean;
  /** The scale a surface reads the radiance at, `scene.environmentIntensity`. */
  energy: number;
  /** The sky shader's loaded texture parameters, by uniform name. */
  textures?: Readonly<Record<string, SamplerValue>>;
  /** The sky shader's parse options: the project's rendering method, the varying slots, the decoders. */
  shaderOptions?: ProjectShaderOptions;
  /** The project's filter settings, for the sky's samplers and each surface's read of the layers. */
  sampling?: ProjectSampling;
  /** The table a real-time bake's fast filter reads, Godot's low-quality one when left out. */
  fastFilterQuality?: FastFilterQuality;
}
