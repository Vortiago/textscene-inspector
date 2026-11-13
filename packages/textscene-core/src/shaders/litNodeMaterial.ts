/**
 * Godot's lit surface as one TSL node material: `BaseMaterial3D`'s shaded modes with the light of
 * `lightingModel.ts`, the sky of `skyLightingNode.ts` and the emission times the exposure
 * (`scene_forward_clustered.glsl:1679-1683`). Its fields are three's material fields, so a caller
 * sets them as it sets a `MeshStandardMaterial`'s, plus Godot's `specular`.
 */

import * as THREE from 'three';
import {
  diffuseColor,
  float,
  materialClearcoat,
  materialClearcoatRoughness,
  materialEmissive,
  materialMetalness,
  materialReference,
  materialRoughness,
} from 'three/tsl';
import { NodeMaterial, type Node } from 'three/webgpu';
import { GodotLightingModel } from './lightingModel.js';
import type { LitPipeline } from './litPipeline.js';
import type { FloatNode } from './nodeTypes.js';
import type { GodotSkyLightingNode } from './skyLightingNode.js';
import type { SurfaceOutputs } from './surfaceOutputs.js';

/** What picks a lit program's branches, as Godot's defines do. */
export interface LitProgram {
  /** `diffuse_mode`, a `DiffuseMode`, or past the enum, which draws Lambert. */
  diffuseMode: number;
  /** `specular_mode`, a `SpecularMode`, or past the enum, which draws GGX. */
  specularMode: number;
  /** `LIGHT_CLEARCOAT_USED`. */
  hasClearcoat: boolean;
}

/** The key of `program`: two materials compile one program exactly when their keys match. */
export function litProgramKey({ diffuseMode, specularMode, hasClearcoat }: LitProgram): string {
  return `${diffuseMode}:${specularMode}:${hasClearcoat}`;
}

export class GodotLitNodeMaterial extends NodeMaterial {
  static override get type(): string {
    return 'GodotLitNodeMaterial';
  }

  color = new THREE.Color(1, 1, 1);
  roughness = 1;
  metalness = 0;
  /** Godot's `specular`, whose dielectric reflectance is `0.16 * specular * specular`. */
  specular = 0.5;
  emissive = new THREE.Color(0, 0, 0);
  emissiveIntensity = 1;
  clearcoat = 0;
  clearcoatRoughness = 0;
  /** The emission three's `setupLighting` adds (r187 `NodeMaterial.js:1131-1136`), which its types leave out. */
  declare emissiveNode: Node | null;

  constructor(
    readonly litPipeline: LitPipeline,
    readonly program: LitProgram
  ) {
    super();
    this.lights = true;
    // Godot's fog is a node of a later slice of the port, and three's fog is not Godot's.
    this.fog = false;
    this.emissiveNode = materialEmissive.mul(litPipeline.emissionExposure);
  }

  override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}:${litProgramKey(this.program)}`;
  }

  override setupLightingModel(): GodotLightingModel {
    return new GodotLightingModel(this.surfaceOutputs());
  }

  override setupEnvironment(): GodotSkyLightingNode {
    return this.litPipeline.skyLighting();
  }

  /** What Godot's `fragment()` writes for a `BaseMaterial3D` with no texture. */
  private surfaceOutputs(): SurfaceOutputs {
    const { diffuseMode, specularMode, hasClearcoat } = this.program;
    return {
      albedo: diffuseColor.rgb,
      metallic: materialMetalness,
      roughness: materialRoughness,
      specular: materialReference('specular', 'float') as unknown as FloatNode,
      ao: float(1),
      aoLightAffect: float(0),
      diffuseMode,
      specularMode,
      clearcoat: hasClearcoat
        ? { amount: materialClearcoat, roughness: materialClearcoatRoughness }
        : undefined,
    };
  }
}
