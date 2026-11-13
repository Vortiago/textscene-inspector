/**
 * Godot's shading on a `WebGLRenderer`: the nodes handler, the light nodes, and the renderer's lit
 * pipeline, whose inputs the caller fills and whose lit materials it mounts.
 */

import * as THREE from 'three';
import { GodotLitNodeMaterial, type LitProgram } from './litNodeMaterial.js';
import { LitPipeline } from './litPipeline.js';
import { installNodesHandler, type NodeOutput } from './nodesHandler.js';
import type { PipelineInputs } from './pipelineInputs.js';
import { GodotSunLightNode } from './sunLightNode.js';

/** A light class as the sun node registers on it. three types `registerNode` for one known light class. */
interface SunLightClass {
  registerNode(lightNodeClass: typeof GodotSunLightNode): void;
}

export interface GodotShadingOptions {
  output?: NodeOutput;
  /**
   * Light classes beside `THREE.DirectionalLight` that shade as Godot's directional light, such as
   * a renderer's own stand-in for one (`lights/declaredLight.ts`).
   */
  sunLights?: readonly (typeof THREE.Light)[];
  /**
   * The pipeline inputs to read. Renderers given one inputs object share one shading, so a lit
   * material of one draws on all of them. Without it, the renderer gets inputs of its own.
   */
  inputs?: PipelineInputs;
}

export interface GodotShading {
  /** The renderer's pipeline inputs, which the caller fills (`pipelineInputs.ts`). */
  readonly inputs: PipelineInputs;
  /** A lit material of the renderer, for a surface whose program is `program`. */
  surfaceMaterial(program: LitProgram): GodotLitNodeMaterial;
}

/** Each renderer's shading. Written only by `installGodotShading`, once for each renderer. */
// eslint-disable-next-line no-restricted-syntax -- the shader module imports nothing outside shaders/ and godot/ (ADR-0072), so utils/perObject.ts is out of reach
const shadings = new WeakMap<THREE.WebGLRenderer, GodotShading>();

/** The shading of each inputs object a caller passed. Written only by `shadingReading`. */
// eslint-disable-next-line no-restricted-syntax -- as above: utils/perObject.ts is outside the shader module
const shadingsByInputs = new WeakMap<PipelineInputs, GodotShading>();

/** The shading that reads `inputs`, made on the first ask. */
function shadingReading(inputs: PipelineInputs): GodotShading {
  const shared = shadingsByInputs.get(inputs);
  if (shared) return shared;
  const pipeline = new LitPipeline(inputs);
  const shading: GodotShading = {
    inputs,
    surfaceMaterial: (program) => new GodotLitNodeMaterial(pipeline, program),
  };
  shadingsByInputs.set(inputs, shading);
  return shading;
}

/**
 * Installs Godot's shading on `renderer` before its first frame, and answers it. The light nodes
 * shade every renderer of the page, as three keeps them on the light class (r187 `Light.js:18-22`).
 * A second call for the same renderer answers the first call's shading, whatever its options.
 */
export function installGodotShading(
  renderer: THREE.WebGLRenderer,
  options: GodotShadingOptions = {}
): GodotShading {
  for (const lightClass of [THREE.DirectionalLight, ...(options.sunLights ?? [])]) {
    (lightClass as unknown as SunLightClass).registerNode(GodotSunLightNode);
  }
  const installed = shadings.get(renderer);
  if (installed) return installed;
  installNodesHandler(renderer, options.output);
  const shading = shadingReading(options.inputs ?? {});
  shadings.set(renderer, shading);
  return shading;
}
