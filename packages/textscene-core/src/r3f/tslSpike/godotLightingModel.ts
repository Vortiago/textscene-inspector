/**
 * Godot's default `BaseMaterial3D` shading as a TSL lighting model: the direct light of
 * `scene_forward_lights_inc.glsl:133-264`, the indirect specular of
 * `scene_forward_clustered.glsl:2216-2231` and the occlusion of a reflection by the ambient
 * (`:2119-2162`). It replaces the edits `../godotLightFunction.ts` and `../godotIndirectSpecular.ts`
 * make to three's physical lighting chunks.
 */

import type * as THREE from 'three';
import {
  diffuseColor,
  float,
  materialMetalness,
  materialRoughness,
  mix,
  normalView,
  positionViewDirection,
  select,
  texture,
  vec2,
  vec3,
} from 'three/tsl';
import { LightingModel, type LightingModelDirectInput, type NodeBuilder } from 'three/webgpu';
import { ROUGHNESS_LIMITER_AMOUNT, ROUGHNESS_LIMITER_LIMIT } from '../../godot/rendering/roughnessLimiter.js';
import {
  burleyDiffuseNL,
  ggxSpecular,
  lambertDiffuseNL,
  type DiffuseMode,
  type SpecularSurface,
} from './godotLightFunctions.js';
import {
  lightingContextOf,
  type FloatNode,
  type ReflectedLight,
  type Vec2Node,
  type Vec3Node,
} from './nodeTypes.js';

const RECIPROCAL_PI = 1 / Math.PI;

/** The Rec. 601 weights Godot takes the ambient's luminance with (`scene_forward_clustered.glsl:2143`). */
const AMBIENT_LUMINANCE_WEIGHTS = [0.3, 0.59, 0.11] as const;

/** A light's direction and colour, and the Godot terms a light node of this repository adds. */
interface GodotDirectLight {
  lightDirection: Vec3Node;
  lightColor: Vec3Node;
  reflectedLight: ReflectedLight;
  lightNode: { sizeOffset?: FloatNode; specularAmount?: FloatNode };
}

/** The surface terms every light and the sky read, set by `start`. */
interface LitSurface extends SpecularSurface {
  /** The albedo that scatters: none of a metal's. */
  diffuseContribution: Vec3Node;
  /** `prefiltered_dfg` at the surface's N.V and roughness. */
  dfg: Vec2Node;
  /** The light that scatters more than once, as a factor on a specular. */
  energyCompensation: Vec3Node;
}

export class GodotLightingModel extends LightingModel {
  /** Written by `start`, before any light or the sky builds. */
  surface!: LitSurface;

  constructor(
    private readonly dfgTable: THREE.Texture,
    private readonly diffuseMode: DiffuseMode
  ) {
    super();
  }

  /**
   * Godot's roughness limiter at its project defaults (`scene_forward_clustered.glsl:1660-1671`),
   * then the DFG read and the energy compensation.
   */
  override start(builder: NodeBuilder): void {
    const roughnessFactor = materialRoughness.toVar();
    const metalness = materialMetalness.toVar();
    const dndu = normalView.dFdx().toVar();
    const dndv = normalView.dFdy().toVar();
    const variance = dndu.dot(dndu).add(dndv.dot(dndv)).mul(ROUGHNESS_LIMITER_AMOUNT);
    const kernelRoughness2 = variance.mul(2).min(ROUGHNESS_LIMITER_LIMIT);
    const limited = roughnessFactor.mul(roughnessFactor).add(kernelRoughness2).min(1).sqrt();
    const roughness = select(limited.lessThan(1e-8), 0, limited).toVar();
    const f0 = mix(vec3(0.04), diffuseColor.rgb, metalness).toVar();
    const dotNV = normalView.dot(positionViewDirection).clamp(0.0001, 1);
    const dfg = texture(this.dfgTable, vec2(dotNV, roughness)).rg.toVar();
    this.surface = {
      f0,
      metalness,
      roughness,
      diffuseContribution: diffuseColor.rgb.mul(metalness.oneMinus()).toVar(),
      dfg,
      energyCompensation: f0.mul(float(1).div(dfg.y).sub(1)).add(1).toVar(),
    };
    super.start(builder);
  }

  override direct(lightData: LightingModelDirectInput): void {
    const { lightDirection, lightColor, reflectedLight, lightNode } =
      lightData as unknown as GodotDirectLight;
    const { surface } = this;
    const sizeOffset = lightNode.sizeOffset ?? float(0);
    const specularAmount = lightNode.specularAmount ?? float(1);
    const L = lightDirection;
    const rawDotNL = sizeOffset.add(normalView.dot(L)).toVar();
    const irradiance = lightColor.mul(rawDotNL.clamp());
    const specular = ggxSpecular(L, positionViewDirection, normalView, surface, sizeOffset);
    // Godot draws a light's specular only above roughness 0 (`scene_forward_lights_inc.glsl:222`).
    const specularBRDF = select(surface.roughness.lessThanEqual(0), vec3(0), specular).mul(specularAmount);
    reflectedLight.directSpecular.addAssign(irradiance.mul(specularBRDF).mul(surface.energyCompensation));
    const halfDir = L.add(positionViewDirection).normalize();
    const dotLH = sizeOffset.add(positionViewDirection.dot(halfDir).clamp()).clamp();
    const diffuseNL =
      this.diffuseMode === 'lambert'
        ? lambertDiffuseNL(rawDotNL)
        : burleyDiffuseNL(rawDotNL, normalView.dot(positionViewDirection), dotLH, surface.roughness);
    const diffuseIrradiance = lightColor.mul(diffuseNL);
    reflectedLight.directDiffuse.addAssign(
      diffuseIrradiance.mul(surface.diffuseContribution.mul(RECIPROCAL_PI))
    );
  }

  /** `light` weighed as Godot weighs an indirect specular, each weight in turn, left to right. */
  private indirectSpecularOf(light: Vec3Node): Vec3Node {
    const { f0, metalness, dfg, energyCompensation } = this.surface;
    const f90 = f0.g.mul(50).clamp(metalness, 1);
    const weight = vec3(f90).sub(f0).mul(dfg.x).add(f0.mul(dfg.y));
    return light.mul(energyCompensation).mul(weight);
  }

  override indirect(builder: NodeBuilder): void {
    const { irradiance, iblIrradiance, radiance, reflectedLight } = lightingContextOf(builder);
    const { surface } = this;
    const diffuse = surface.diffuseContribution;
    reflectedLight.indirectDiffuse.addAssign(irradiance.mul(diffuse.mul(RECIPROCAL_PI)));
    reflectedLight.indirectSpecular.addAssign(this.indirectSpecularOf(radiance));
    reflectedLight.indirectDiffuse.addAssign(diffuse.mul(iblIrradiance.mul(RECIPROCAL_PI)));
    const ambientLight = irradiance.add(iblIrradiance).mul(RECIPROCAL_PI);
    const dimmedBy = ambientLight
      .dot(vec3(...AMBIENT_LUMINANCE_WEIGHTS))
      .mul(8)
      .min(1)
      .toVar();
    const reflective = surface.roughness.oneMinus().mul(surface.metalness);
    const specularOcclusion = reflective.mul(dimmedBy).mul(10).min(1).max(dimmedBy);
    reflectedLight.indirectSpecular.mulAssign(specularOcclusion);
  }
}
