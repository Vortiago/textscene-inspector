/**
 * Godot's lit surface as one TSL node material: the default `BaseMaterial3D` shading mode, with
 * Burley diffuse, Schlick GGX specular, the sky's ambient and reflection, and the split sun's
 * shadow. It draws on `WebGLRenderer` through three's `WebGLNodesHandler` and on `WebGPURenderer`.
 * A spike of the lit-surface port ADR-0055 names: it ports no map, no decal, no reflection probe and
 * no screen-space read.
 */

import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import type { DiffuseMode } from './godotLightFunctions.js';
import { GodotLightingModel } from './godotLightingModel.js';
import { GodotSkyLightingNode, type ShownSkyInputs } from './skyLightingNode.js';
import { GodotSunLightNode, type SplitSun, type SunShadowInputs } from './sunLightNode.js';

/** What the lit surface reads that a renderer's pipeline owns. */
export interface LitSurfaceInputs {
  /** Godot's DFG table (`godot/rendering/materials/dfg.ts`). */
  dfgTable: THREE.Texture;
  sky: ShownSkyInputs;
  sunShadow: SunShadowInputs;
}

export class GodotLitNodeMaterial extends NodeMaterial {
  static override get type(): string {
    return 'GodotLitNodeMaterial';
  }

  readonly isGodotLitNodeMaterial = true;

  color = new THREE.Color(0xffffff);
  roughness = 1;
  metalness = 0;
  emissive = new THREE.Color(0x000000);
  emissiveIntensity = 1;

  private readonly lightingModel: GodotLightingModel;
  private readonly skyLighting: GodotSkyLightingNode;

  /** `diffuseMode` picks the program's diffuse branch, as a define does in the GLSL patch. */
  constructor(
    inputs: LitSurfaceInputs,
    readonly diffuseMode: DiffuseMode
  ) {
    super();
    this.lights = true;
    this.lightingModel = new GodotLightingModel(inputs.dfgTable, diffuseMode);
    this.skyLighting = new GodotSkyLightingNode(inputs.sky);
  }

  override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}:${this.diffuseMode}`;
  }

  override setupLightingModel(): GodotLightingModel {
    return this.lightingModel;
  }

  /** The sky as a material lighting, which builds after the lighting model starts. */
  override setupEnvironment(): GodotSkyLightingNode {
    return this.skyLighting;
  }
}

/** A light class whose instances carry splits, with three's static node registry. */
type SplitSunClass = (new () => SplitSun) & Pick<typeof THREE.Light, 'registerNode'>;

/**
 * Makes every light of `lightClass` shade through `GodotSunLightNode` with `sunShadow`, for every
 * node material built after the call.
 */
export function registerSunLightNode(lightClass: SplitSunClass, sunShadow: SunShadowInputs): void {
  lightClass.registerNode(
    class extends GodotSunLightNode {
      constructor(light: SplitSun) {
        super(light, sunShadow);
      }
    }
  );
}
