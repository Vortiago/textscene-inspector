/**
 * Godot's BRDF terms as TSL nodes, each whole and in Godot's order of operations
 * (Godot 4.6.3 `servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl`, the desktop
 * branch without `EXPLICIT_FP16`). `lightFunctions.ts` composes them into `light_compute`.
 */

import { exp, float, max, mix, pow, smoothstep, vec3 } from 'three/tsl';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import type { FloatNode, Vec3Node, Vec4Node } from './nodeTypes.js';

export const INV_PI = 1 / Math.PI;

/** `SchlickFresnel` (`:49-53`). */
export function schlickFresnel(u: FloatNode): FloatNode {
  const m = u.oneMinus().toVar();
  const m2 = m.mul(m).toVar();
  return m2.mul(m2).mul(m);
}

/** `F0` (`:55-60`): the dielectric reflectance of `specular`, blended to the albedo by the metallic. */
export function f0(metallic: FloatNode, specular: FloatNode, albedo: Vec3Node): Vec3Node {
  const dielectric = float(0.16).mul(specular).mul(specular);
  return mix(vec3(dielectric), albedo, vec3(metallic));
}

/** `D_GGX` (`:16-27`), the branch without `EXPLICIT_FP16`. `roughness` is the GGX alpha. */
export function dGGX(NoH: FloatNode, roughness: FloatNode): FloatNode {
  const a = NoH.mul(roughness).toVar();
  const k = roughness.div(float(1).sub(NoH.mul(NoH)).add(a.mul(a))).toVar();
  return k.mul(k).mul(INV_PI);
}

/** `V_GGX` (`:29-32`). */
export function vGGX(NdotL: FloatNode, NdotV: FloatNode, alpha: FloatNode): FloatNode {
  return float(0.5).div(mix(float(2).mul(NdotL).mul(NdotV), NdotL.add(NdotV), alpha));
}

/** `D_GGX_anisotropic` (`:34-40`). */
export function dGGXAnisotropic(
  cosThetaM: FloatNode,
  alphaX: FloatNode,
  alphaY: FloatNode,
  cosPhi: FloatNode,
  sinPhi: FloatNode
): FloatNode {
  const alpha2 = alphaX.mul(alphaY).toVar();
  const v = vec3(alphaY.mul(cosPhi), alphaX.mul(sinPhi), alpha2.mul(cosThetaM)).toVar();
  const v2 = v.dot(v);
  const w2 = alpha2.div(v2).toVar();
  return alpha2.mul(w2).mul(w2).mul(INV_PI);
}

/** The dot products `V_GGX_anisotropic` reads, named as Godot's parameters are. */
export interface AnisotropicDots {
  TdotV: FloatNode;
  TdotL: FloatNode;
  BdotV: FloatNode;
  BdotL: FloatNode;
  NdotV: FloatNode;
  NdotL: FloatNode;
}

/** `V_GGX_anisotropic` (`:42-47`). */
export function vGGXAnisotropic(alphaX: FloatNode, alphaY: FloatNode, dots: AnisotropicDots): FloatNode {
  const { TdotV, TdotL, BdotV, BdotL, NdotV, NdotL } = dots;
  const lambdaV = NdotL.mul(vec3(alphaX.mul(TdotV), alphaY.mul(BdotV), NdotV).length());
  const lambdaL = NdotV.mul(vec3(alphaX.mul(TdotL), alphaY.mul(BdotL), NdotL).length());
  return float(0.5).div(lambdaV.add(lambdaL));
}

/** The terms of `light_compute` that every diffuse mode reads. */
export interface DiffuseTerms {
  /** `min(A + dot(N, L), 1)`, which wrap and toon read past the terminator. */
  NdotL: FloatNode;
  cNdotL: FloatNode;
  cNdotV: FloatNode;
  cLdotH: FloatNode;
  roughness: FloatNode;
}

/**
 * `diffuse_brdf_NL` in the surface's `diffuse_mode` (`:190-210`). A mode past the enum draws
 * Lambert, as a surface with no diffuse render mode does (`material.cpp:828-855`).
 */
export function diffuseBrdfNL(mode: number, terms: DiffuseTerms): FloatNode {
  const { NdotL, cNdotL, cNdotV, cLdotH, roughness } = terms;
  switch (mode) {
    case DiffuseMode.DIFFUSE_LAMBERT_WRAP: {
      const opRoughness = float(1).add(roughness).toVar();
      return max(0, NdotL.add(roughness).div(opRoughness.mul(opRoughness))).mul(INV_PI);
    }
    case DiffuseMode.DIFFUSE_TOON:
      return smoothstep(roughness.negate(), max(roughness, 0.01), NdotL).mul(INV_PI);
    case DiffuseMode.DIFFUSE_BURLEY: {
      const fd90Minus1 = float(2).mul(cLdotH).mul(cLdotH).mul(roughness).sub(0.5).toVar();
      const fdV = float(1).add(fd90Minus1.mul(schlickFresnel(cNdotV)));
      const fdL = float(1).add(fd90Minus1.mul(schlickFresnel(cNdotL)));
      return float(INV_PI).mul(fdV).mul(fdL).mul(cNdotL);
    }
    default:
      return cNdotL.mul(INV_PI);
  }
}

/** The toon specular's intensity (`:225-230`). */
export function toonSpecular(L: Vec3Node, N: Vec3Node, V: Vec3Node, roughness: FloatNode): FloatNode {
  const R = L.reflect(N).negate().normalize();
  const RdotV = R.dot(V);
  const mid = roughness.oneMinus().toVar();
  mid.mulAssign(mid);
  return smoothstep(mid.sub(roughness.mul(0.5)), mid.add(roughness.mul(0.5)), RdotV).mul(mid);
}

/** The rim light's factor on the light colour (`:158-162`). */
export function rimLight(
  cNdotV: FloatNode,
  roughness: FloatNode,
  rim: FloatNode,
  rimTint: FloatNode,
  albedo: Vec3Node
): Vec3Node {
  // The floor prevents `pow(0, 0)`, which GLSL leaves undefined.
  const rimFactor = pow(max(1e-4, cNdotV.oneMinus()), max(0, roughness.oneMinus().mul(16)));
  return vec3(rimFactor.mul(rim)).mul(mix(vec3(1), albedo, rimTint));
}

/** The backlight's factor on the light colour (`:214-216`), from the diffuse's `diffuse_brdf_NL`. */
export function backlightLight(diffuseNL: FloatNode, backlight: Vec3Node): Vec3Node {
  return vec3(float(INV_PI).sub(diffuseNL)).mul(backlight);
}

/** What the transmittance reads (`:136-156`). */
export interface Transmittance {
  /** `transmittance_color`, its alpha the amount. */
  color: Vec4Node;
  depth: FloatNode;
  boost: FloatNode;
  /** The distance through the surface the light's shadow measures. */
  z: FloatNode;
  /** `SSS_MODE_SKIN`. */
  isSkin: boolean;
}

/** Godot's six-term skin profile (`:142-147`). */
const SKIN_PROFILE: readonly (readonly [readonly [number, number, number], number])[] = [
  [[0.233, 0.455, 0.649], 0.0064],
  [[0.1, 0.336, 0.344], 0.0484],
  [[0.118, 0.198, 0.0], 0.187],
  [[0.113, 0.007, 0.007], 0.567],
  [[0.358, 0.004, 0.0], 1.99],
  [[0.078, 0.0, 0.0], 7.41],
];

/** The transmittance's factor on the light colour (`:136-156`). */
export function transmittedLight(transmittance: Transmittance, NdotL: FloatNode): Vec3Node {
  const { color, depth, boost, z, isSkin } = transmittance;
  const scale = float(8.25).div(depth);
  const d = scale.mul(z.abs()).toVar();
  const dd = d.negate().mul(d).toVar();
  const throughBoost = boost.sub(NdotL).clamp(0, 1).mul(INV_PI);
  if (!isSkin) return exp(dd).mul(color.rgb).mul(color.a).mul(throughBoost);
  const profile = SKIN_PROFILE.map(([weights, variance]) =>
    vec3(...weights).mul(exp(dd.div(variance)))
  ).reduce((sum, term) => sum.add(term));
  return profile.mul(color.a).mul(throughBoost);
}

/** The clearcoat's lobe (`:171-185`) before the light colour, which reads the coat's vertex normal. */
export interface Clearcoat {
  amount: FloatNode;
  roughness: FloatNode;
  vertexNormal: Vec3Node;
}

/** `clearcoat_specular_brdf_NL` (`:173-182`). */
export function clearcoatSpecularNL(
  clearcoat: Clearcoat,
  A: FloatNode,
  H: Vec3Node,
  cLdotH: FloatNode,
  cNdotL: FloatNode
): FloatNode {
  const ccNdotH = A.add(clearcoat.vertexNormal.dot(H)).clamp(0, 1);
  const cLdotH5 = schlickFresnel(cLdotH);
  const Dr = dGGX(ccNdotH, mix(float(0.001), float(0.1), clearcoat.roughness));
  const Gr = float(0.25).div(cLdotH.mul(cLdotH).add(1e-4));
  const Fr = mix(float(0.04), float(1), cLdotH5);
  return clearcoat.amount.mul(Gr).mul(Fr).mul(Dr).mul(cNdotL);
}
