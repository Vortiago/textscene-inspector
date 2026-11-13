/**
 * Godot's light on a lit surface as a TSL lighting model: the roughness limiter
 * (`scene_forward_clustered.glsl:1657-1673`), `light_compute` for each light
 * (`scene_forward_lights_inc.glsl:62-277`), and the ambient and reflection finish (`:1764-1797`,
 * `:2119-2233`, `:2941-2949`). It reads only the surface outputs and what the light and sky nodes give.
 */

import { float, max, mix, normalView, positionViewDirection, select, texture, vec2, vec3 } from 'three/tsl';
import { LightingModel, type LightingModelDirectInput, type NodeBuilder } from 'three/webgpu';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import { ROUGHNESS_LIMITER_AMOUNT, ROUGHNESS_LIMITER_LIMIT } from '../godot/rendering/roughnessLimiter.js';
import { dfgTable } from './dfgTable.js';
import { f0, INV_PI, schlickFresnel } from './brdf.js';
import { lightCompute, type LitSurfaceTerms } from './lightFunctions.js';
import {
  lightingContextOf,
  type BoolNode,
  type FloatNode,
  type GodotDirectLightData,
  type ReflectedLight,
  type Vec2Node,
  type Vec3Node,
} from './nodeTypes.js';
import type { SurfaceOutputs } from './surfaceOutputs.js';

/** The Rec. 601 weights Godot takes the ambient's luminance with (`scene_forward_clustered.glsl:2154`). */
const AMBIENT_LUMINANCE = [0.3, 0.59, 0.11] as const;

/** What the sky node gives the clearcoat: whether a sky shows, and the coat's reflection of it. */
export interface CoatSky {
  isShown: BoolNode;
  radiance: Vec3Node;
}

/**
 * Godot's roughness limiter at its project defaults (`:1657-1671`), which reads the coarse
 * derivatives of WebGL 2 in place of Godot's fine ones.
 */
function limitedRoughness(roughness: FloatNode): FloatNode {
  const dndu = normalView.dFdx().toVar();
  const dndv = normalView.dFdy().toVar();
  const variance = float(ROUGHNESS_LIMITER_AMOUNT).mul(dndu.dot(dndu).add(dndv.dot(dndv)));
  const kernelRoughness2 = variance.mul(2).min(ROUGHNESS_LIMITER_LIMIT);
  const filtered = roughness.mul(roughness).add(kernelRoughness2).min(1).sqrt().toVar();
  // A roughness below 1e-8 collapses GGX's alpha, so Godot snaps it to 0 (`:1667-1671`).
  return select(filtered.lessThan(1e-8), float(0), filtered);
}

export class GodotLightingModel extends LightingModel {
  /** Written by `start`, before any light or the sky builds. */
  terms!: LitSurfaceTerms;
  /** Written by the sky node while it builds, for a surface with a clearcoat. */
  coatSky: CoatSky | null = null;
  private dfg!: Vec2Node;

  constructor(private readonly outputs: SurfaceOutputs) {
    super();
  }

  override start(builder: NodeBuilder): void {
    const { albedo, metallic, specular, clearcoat } = this.outputs;
    const N = normalView;
    const V = positionViewDirection;
    const roughness = limitedRoughness(this.outputs.roughness).toVar();
    const surfaceF0 = f0(metallic, specular, albedo).toVar();
    const NdotV = N.dot(V).clamp(0.0001, 1);
    this.dfg = texture(dfgTable(), vec2(NdotV, roughness)).rg.toVar();
    this.terms = {
      ...this.outputs,
      N,
      V,
      f0: surfaceF0,
      roughness,
      // `get_energy_compensation` (`scene_forward_clustered_inc.glsl:486-488`).
      energyCompensation: vec3(1)
        .add(surfaceF0.mul(float(1).div(this.dfg.y).sub(1)))
        .toVar(),
      // The coat reads the vertex normal, which is the normal while a covered surface maps none.
      clearcoat: clearcoat && { ...clearcoat, vertexNormal: N },
    };
    super.start(builder);
  }

  override direct(input: LightingModelDirectInput): void {
    const light = input as unknown as Partial<GodotDirectLightData> & { reflectedLight: ReflectedLight };
    // A light node of three's own lacks Godot's terms. Its light kind has no port yet, so it adds nothing.
    if (!light.attenuation || !light.A || !light.specularAmount) return;
    const sums = lightCompute(this.terms, {
      L: light.lightDirection!,
      A: light.A,
      color: light.lightColor!,
      attenuation: light.attenuation,
      specularAmount: light.specularAmount,
      isDirectional: true,
    });
    light.reflectedLight.directDiffuse.addAssign(sums.diffuse);
    light.reflectedLight.directSpecular.addAssign(sums.specular);
  }

  /**
   * The ambient and the reflection, then the albedo, occlusion and metallic of the direct diffuse.
   * three sums the four terms after this, so the direct light is whole by now.
   */
  override indirect(builder: NodeBuilder): void {
    const { irradiance, iblIrradiance, radiance, reflectedLight } = lightingContextOf(builder);
    const { albedo, metallic, ao, aoLightAffect } = this.outputs;
    // three's irradiance is Godot's ambient light times PI.
    const ambient = irradiance.add(iblIrradiance).mul(INV_PI).toVar();
    const reflection = radiance.toVar();
    this.layerUnderCoat(ambient, reflection);
    ambient.mulAssign(ao);
    const occlusion = this.specularOcclusion(ambient);
    ambient.mulAssign(albedo);
    reflection.assign(this.weighedReflection(reflection).mul(occlusion));
    const directAo = mix(float(1), ao, aoLightAffect).toVar();
    const { directDiffuse, directSpecular } = reflectedLight;
    directDiffuse.assign(directDiffuse.mul(albedo).mul(directAo).mul(metallic.oneMinus()));
    directSpecular.mulAssign(directAo);
    ambient.mulAssign(metallic.oneMinus());
    reflectedLight.indirectDiffuse.addAssign(ambient);
    reflectedLight.indirectSpecular.addAssign(reflection);
  }

  /**
   * The coat dims the ambient and the reflection beneath it and adds its own reflection, only while
   * a sky gives a reflection (`:1766-1797`).
   */
  private layerUnderCoat(ambient: Vec3Node, reflection: Vec3Node): void {
    const { clearcoat } = this.terms;
    const sky = this.coatSky;
    if (!clearcoat || !sky) return;
    const NoV = max(clearcoat.vertexNormal.dot(this.terms.V), 0.0001);
    const Fc = clearcoat.amount.mul(float(0.04).add(float(0.96).mul(schlickFresnel(NoV)))).toVar();
    const attenuation = select(sky.isShown, Fc.oneMinus(), float(1)).toVar();
    ambient.mulAssign(attenuation);
    reflection.mulAssign(attenuation);
    reflection.addAssign(select(sky.isShown, sky.radiance.mul(Fc), vec3(0)));
  }

  /** The occlusion of a reflection by the luminance of the ambient (`:2154-2162`). */
  private specularOcclusion(ambient: Vec3Node): FloatNode {
    const luminance = ambient.dot(vec3(...AMBIENT_LUMINANCE));
    const dimmed = luminance.mul(8).min(1).toVar();
    const reflective = this.terms.roughness.oneMinus().mul(this.outputs.metallic);
    return reflective.mul(dimmed).mul(10).min(1).max(dimmed);
  }

  /**
   * The reflection weighed as Godot weighs an indirect specular (`:2214-2231`), each weight in turn,
   * left to right as the classic patch weighs it: another order rounds a surface at an exact half
   * step one level apart.
   */
  private weighedReflection(light: Vec3Node): Vec3Node {
    const { metallic, specular, albedo } = this.outputs;
    if (this.outputs.diffuseMode === DiffuseMode.DIFFUSE_TOON) {
      return light.mul(specular).mul(metallic).mul(albedo).mul(2);
    }
    const { f0: surfaceF0, energyCompensation } = this.terms;
    const f90 = surfaceF0.g.mul(50).clamp(metallic, 1);
    const weight = vec3(f90).sub(surfaceF0).mul(this.dfg.x).add(surfaceF0.mul(this.dfg.y));
    return light.mul(energyCompensation).mul(weight);
  }
}
