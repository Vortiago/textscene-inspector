/**
 * Godot's light functions as TSL nodes, each whole and in Godot's order of operations
 * (Godot 4.6.3 `servers/rendering/renderer_rd/shaders/scene_forward_lights_inc.glsl`, the desktop
 * branch without `EXPLICIT_FP16`). `light_compute` is `lightCompute`. Its optional terms are
 * build-time branches, as Godot's defines are.
 */

import { float, max, min, select, vec2, vec3 } from 'three/tsl';
import { SpecularMode } from '../godot/rendering/materials/specularMode.js';
import { GODOT_QUICK_HASH_MAGIC } from '../godot/rendering/quickHash.js';
import {
  backlightLight,
  clearcoatSpecularNL,
  dGGX,
  dGGXAnisotropic,
  diffuseBrdfNL,
  rimLight,
  schlickFresnel,
  toonSpecular,
  transmittedLight,
  vGGX,
  vGGXAnisotropic,
  type Clearcoat,
  type Transmittance,
} from './brdf.js';
import type { FloatNode, Vec2Node, Vec3Node } from './nodeTypes.js';

/** `HALF_FLT_MIN` without `EXPLICIT_FP16` (`half_inc.glsl:29`). */
const HALF_FLT_MIN = 1.175494351e-38;

/** The anisotropic frame `light_compute` reads under `LIGHT_ANISOTROPY_USED`. */
export interface Anisotropy {
  T: Vec3Node;
  B: Vec3Node;
  amount: FloatNode;
}

/** What `light_compute` reads of the surface. */
export interface LitSurfaceTerms {
  N: Vec3Node;
  V: Vec3Node;
  f0: Vec3Node;
  roughness: FloatNode;
  metallic: FloatNode;
  albedo: Vec3Node;
  energyCompensation: Vec3Node;
  diffuseMode: number;
  specularMode: number;
  backlight?: Vec3Node;
  transmittance?: Transmittance;
  rim?: { amount: FloatNode; tint: FloatNode };
  clearcoat?: Clearcoat;
  anisotropy?: Anisotropy;
}

/** What `light_compute` reads of the light. */
export interface LightTerms {
  L: Vec3Node;
  /** The light's size offset `A`. */
  A: FloatNode;
  color: Vec3Node;
  /** The shadow of a directional light, or the falloff and shadow of another. */
  attenuation: FloatNode;
  specularAmount: FloatNode;
  isDirectional: boolean;
}

/** The two sums `light_compute` adds the light to. */
export interface LightSums {
  diffuse: Vec3Node;
  specular: Vec3Node;
}

/** GGX's `specular_brdf_NL` (`:236-262`), anisotropic under `LIGHT_ANISOTROPY_USED`. */
function ggxSpecularNL(
  surface: LitSurfaceTerms,
  light: LightTerms,
  H: Vec3Node,
  cNdotL: FloatNode,
  cNdotV: FloatNode,
  cLdotH: FloatNode
): Vec3Node {
  const { N, V, f0: f0Node, roughness, metallic, energyCompensation, anisotropy } = surface;
  const { L, A } = light;
  const cNdotH = A.add(N.dot(H)).clamp(0, 1).toVar();
  const alphaGgx = roughness.mul(roughness).toVar();
  let D: FloatNode;
  let G: FloatNode;
  if (anisotropy) {
    const { T, B } = anisotropy;
    const aspect = float(1).sub(anisotropy.amount.mul(0.9)).sqrt().toVar();
    const ax = alphaGgx.div(aspect).toVar();
    const ay = alphaGgx.mul(aspect).toVar();
    D = dGGXAnisotropic(cNdotH, ax, ay, T.dot(H), B.dot(H));
    G = vGGXAnisotropic(ax, ay, {
      TdotV: T.dot(V),
      TdotL: T.dot(L),
      BdotV: B.dot(V),
      BdotL: B.dot(L),
      NdotV: cNdotV,
      NdotL: cNdotL,
    });
  } else {
    D = dGGX(cNdotH, alphaGgx);
    G = vGGX(cNdotL, cNdotV, alphaGgx);
  }
  const cLdotH5 = schlickFresnel(cLdotH);
  // Fresnel with Filament's specular occlusion term (`:256-257`).
  const f90 = f0Node.dot(vec3(50 * 0.33)).clamp(metallic, 1);
  const F = f0Node.add(vec3(f90).sub(f0Node).mul(cLdotH5));
  return energyCompensation.mul(cNdotL).mul(D).mul(F).mul(G);
}

/** The specular of `light_compute` in the surface's `specular_mode` (`:219-264`), and toon's diffuse. */
function specularSums(
  surface: LitSurfaceTerms,
  light: LightTerms,
  H: Vec3Node,
  cNdotL: FloatNode,
  cNdotV: FloatNode,
  cLdotH: FloatNode
): LightSums {
  const none = vec3(0);
  // Godot draws no specular at roughness 0 (`:219`), where GGX divides by a collapsed alpha.
  const isRough = surface.roughness.greaterThan(0);
  switch (surface.specularMode) {
    case SpecularMode.SPECULAR_TOON: {
      const intensity = toonSpecular(light.L, surface.N, surface.V, surface.roughness);
      // Toon writes to the diffuse, as toon shading wants no reflection (`:231`).
      return {
        diffuse: select(
          isRough,
          light.color.mul(intensity).mul(light.attenuation).mul(light.specularAmount),
          none
        ),
        specular: none,
      };
    }
    case SpecularMode.SPECULAR_DISABLED:
      return { diffuse: none, specular: none };
    default: {
      const specularNL = ggxSpecularNL(surface, light, H, cNdotL, cNdotV, cLdotH);
      return {
        diffuse: none,
        specular: select(
          isRough,
          specularNL.mul(light.color).mul(light.attenuation).mul(light.specularAmount),
          none
        ),
      };
    }
  }
}

/** The lit terms under `is_directional || attenuation > HALF_FLT_MIN` (`:165-269`). */
function litSums(
  surface: LitSurfaceTerms,
  light: LightTerms,
  NdotL: FloatNode,
  cNdotV: FloatNode
): LightSums {
  const { V, roughness, metallic, clearcoat, backlight } = surface;
  const { L, A, color, attenuation, specularAmount } = light;
  const cNdotL = max(NdotL, 0).toVar();
  const H = V.add(L).normalize().toVar();
  const cLdotH = A.add(L.dot(H)).clamp(0, 1).toVar();
  let specular: Vec3Node = vec3(0);
  if (clearcoat) {
    const coatNL = clearcoatSpecularNL(clearcoat, A, H, cLdotH, cNdotL);
    specular = specular.add(color.mul(coatNL).mul(attenuation).mul(specularAmount));
  }
  const diffuseNL = diffuseBrdfNL(surface.diffuseMode, { NdotL, cNdotL, cNdotV, cLdotH, roughness }).toVar();
  let diffuse: Vec3Node = color.mul(diffuseNL).mul(attenuation);
  if (backlight) diffuse = diffuse.add(color.mul(backlightLight(diffuseNL, backlight)).mul(attenuation));
  // Godot shades no diffuse on a full metal (`:188`).
  diffuse = select(metallic.lessThan(1), diffuse, vec3(0));
  const specularTerms = specularSums(surface, light, H, cNdotL, cNdotV, cLdotH);
  return { diffuse: diffuse.add(specularTerms.diffuse), specular: specular.add(specularTerms.specular) };
}

/**
 * `light_compute` (`:62-277`), the branch without `LIGHT_CODE_USED`: what one light adds to the
 * diffuse and the specular. `USE_SHADOW_TO_OPACITY` is not ported, since no surface sets it yet.
 */
export function lightCompute(surface: LitSurfaceTerms, light: LightTerms): LightSums {
  const { N, V } = surface;
  const NdotL = min(light.A.add(N.dot(light.L)), 1).toVar();
  const cNdotV = max(N.dot(V), 1e-4).toVar();
  let unlit: Vec3Node = vec3(0);
  if (surface.transmittance)
    unlit = unlit.add(transmittedLight(surface.transmittance, NdotL).mul(light.color));
  if (surface.rim) {
    const { amount, tint } = surface.rim;
    unlit = unlit.add(rimLight(cNdotV, surface.roughness, amount, tint, surface.albedo).mul(light.color));
  }
  const lit = litSums(surface, light, NdotL, cNdotV);
  if (light.isDirectional) return { diffuse: unlit.add(lit.diffuse), specular: lit.specular };
  const isLit = light.attenuation.greaterThan(HALF_FLT_MIN);
  return {
    diffuse: unlit.add(select(isLit, lit.diffuse, vec3(0))),
    specular: select(isLit, lit.specular, vec3(0)),
  };
}

/** `quick_hash` (`:278-281`), interleaved gradient noise. */
export function quickHash(pos: Vec2Node): FloatNode {
  const [x, y, scale] = GODOT_QUICK_HASH_MAGIC;
  return pos.dot(vec2(x, y)).fract().mul(scale).fract();
}
