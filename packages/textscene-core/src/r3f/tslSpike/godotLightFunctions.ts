/**
 * Godot's light functions as TSL nodes: Burley diffuse and Schlick GGX specular, as
 * `../godotLightFunction.ts` holds them in GLSL (Godot 4.6.3 `scene_forward_lights_inc.glsl:16-62`,
 * `:194-264`). Each keeps Godot's order of operations, so one graph rounds as the GLSL does.
 */

import { float, mix, select, vec3 } from 'three/tsl';
import type { FloatNode, Vec3Node } from './nodeTypes.js';

const RECIPROCAL_PI = 1 / Math.PI;

/** `SchlickFresnel` (`scene_forward_lights_inc.glsl:55-58`). */
export function schlickFresnel(u: FloatNode): FloatNode {
  const m = u.oneMinus().toVar();
  const m2 = m.mul(m).toVar();
  return m2.mul(m2).mul(m);
}

/** The diffuse modes the spike ports. Lambert wrap and toon stay in the GLSL patch only. */
export type DiffuseMode = 'burley' | 'lambert';

/** Lambert's `diffuse_brdf_NL` times pi (`:194-196`). */
export function lambertDiffuseNL(dotNLRaw: FloatNode): FloatNode {
  return dotNLRaw.min(1).max(0);
}

/**
 * Burley's `diffuse_brdf_NL` times pi (`:203-212`). It takes the raw N.L, as the GLSL does, and the
 * caller adds the light's size offset.
 */
export function burleyDiffuseNL(
  dotNLRaw: FloatNode,
  dotNVRaw: FloatNode,
  dotLH: FloatNode,
  roughness: FloatNode
): FloatNode {
  const cNdotL = dotNLRaw.min(1).max(0).toVar();
  const cNdotV = dotNVRaw.max(1e-4);
  const fd90Minus1 = float(2).mul(dotLH).mul(dotLH).mul(roughness).sub(0.5).toVar();
  const fdV = fd90Minus1.mul(schlickFresnel(cNdotV)).add(1);
  const fdL = fd90Minus1.mul(schlickFresnel(cNdotL)).add(1);
  return fdV.mul(fdL).mul(cNdotL);
}

/** `D_GGX` (`:16-26`), operation for operation. */
function ggxDistribution(cNdotH: FloatNode, alpha: FloatNode): FloatNode {
  const a = cNdotH.mul(alpha).toVar();
  const k = alpha.div(cNdotH.mul(cNdotH).oneMinus().add(a.mul(a))).toVar();
  return k.mul(k).mul(RECIPROCAL_PI);
}

/** `V_GGX` (`:28-30`). */
function ggxVisibility(cNdotL: FloatNode, cNdotV: FloatNode, alpha: FloatNode): FloatNode {
  return float(0.5).div(mix(float(2).mul(cNdotL).mul(cNdotV), cNdotL.add(cNdotV), alpha));
}

/** What the specular reads of the surface. */
export interface SpecularSurface {
  /** F0, blended towards the albedo by the metallic. */
  f0: Vec3Node;
  metalness: FloatNode;
  /** Godot's limited roughness. */
  roughness: FloatNode;
}

/**
 * Godot's GGX specular divided by N.L (`:239-262`). `sizeOffset` is the light's `A`, which widens
 * N.L, N.H and L.H. Zero at and behind the terminator, where the GLSL returns early.
 */
export function ggxSpecular(
  L: Vec3Node,
  V: Vec3Node,
  N: Vec3Node,
  surface: SpecularSurface,
  sizeOffset: FloatNode
): Vec3Node {
  const cNdotL = sizeOffset.add(N.dot(L)).clamp().toVar();
  const halfDir = L.add(V).normalize().toVar();
  const cNdotV = N.dot(V).max(1e-4);
  const cNdotH = sizeOffset.add(N.dot(halfDir)).clamp();
  const cLdotH = sizeOffset.add(L.dot(halfDir)).clamp();
  const { f0 } = surface;
  const f90 = f0.dot(vec3(50 * 0.33)).clamp(surface.metalness, 1);
  const F = f0.add(vec3(f90).sub(f0).mul(schlickFresnel(cLdotH)));
  const alpha = surface.roughness.mul(surface.roughness).toVar();
  const D = ggxDistribution(cNdotH, alpha);
  const visibility = ggxVisibility(cNdotL, cNdotV, alpha);
  return select(cNdotL.lessThanEqual(0), vec3(0), F.mul(D).mul(visibility));
}
