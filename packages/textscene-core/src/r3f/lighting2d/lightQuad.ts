/**
 * The quad a PointLight2D contributes to the canvas light accumulator.
 *
 * It emits Godot's `light_color` and nothing else:
 *
 *   rgb = cookie.rgb * light.color * energy      (sRGB, unclamped)
 *   a   = cookie.a
 *
 * `energy` is applied HERE, in sRGB, which is the space Godot's canvas works in
 * — scaling a linear colour instead raises it by only `energy^(1/2.2)` once
 * re-encoded, which is why lights read dim when the multiply is folded into a
 * linear material colour.
 *
 * The alpha is emitted RAW rather than pre-multiplied into rgb, because the
 * accumulator needs it twice over: as the blend factor that reproduces
 * `light_blend_compute` (below) and, summed across lights, as the coverage mask
 * a `light_mode = Light Only` item is drawn through.
 *
 * `light_blend_compute` in `canvas.glsl` is
 *
 *   ADD: S += light_color.rgb * light_color.a
 *   SUB: S -= light_color.rgb * light_color.a
 *   MIX: S  = mix(S, light_color.rgb, light_color.a)
 *
 * SHADOWS replace the whole term rather than dimming it. `canvas.glsl` does
 *
 *   shadow_color.a *= light_color.a;                  // .a is the cookie's
 *   light_color = mix(light_color, shadow_color, shadow);
 *
 * so a fully shadowed pixel takes `vec4(shadow_color.rgb, shadow_color.a *
 * cookie.a)`. At `Light2D`'s default `shadow_color = Color(0, 0, 0, 0)` the
 * whole term vanishes, which is why withholding the quad — a stencil test — IS
 * the shadow for almost every scene.
 *
 * An authored `shadow_color` is the same `mix` from its other side, so it is the
 * same quad drawn through the complementary stencil test: `createLightQuadMaterial`
 * covers where the volumes did NOT stamp, `createShadowColorQuadMaterial` covers
 * where they did. Together they partition the light's rect exactly once. The
 * second quad is skipped unless `shadowColorContributes`, so the default costs
 * nothing.
 *
 * and each of the three is exactly one fixed-function blend against the
 * accumulator, which is why all three are reproduced rather than approximated:
 * SrcAlpha/One with add, SrcAlpha/One with reverse-subtract, and
 * SrcAlpha/OneMinusSrcAlpha with add. Alpha always accumulates One/One, since
 * `light_only_alpha` is a plain sum (measured against Godot 4.6.3: one, two and
 * three overlapping cookies of alpha 0.3 mask to 0.3, 0.6 and 0.9, not to the
 * 0.51/0.657 a screen combination would give).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Color } from '../../nodes/base/node2d/types.js';

/** Godot `Light2D.BlendMode`. */
export enum Light2DBlendMode {
  ADD = 0,
  SUB = 1,
  MIX = 2,
}

const VERTEX = /* glsl */ `
varying vec2 vLightUv;
void main() {
  vLightUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The cookie arrives decoded to linear (three tags loaded textures
 * `SRGBColorSpace`), so it is re-encoded to recover Godot's texel before the
 * light maths. Nothing is clamped: the accumulator is half-float, and Godot
 * clamps only after the light has been multiplied into an item's albedo.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec3 uColor;
uniform float uEnergy;
varying vec2 vLightUv;

vec3 lightToSrgb(vec3 c) {
  return mix(c * 12.92, pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}

void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  gl_FragColor = vec4(lightToSrgb(cookie.rgb) * uColor * uEnergy, cookie.a);
}
`;

/**
 * One fixed-function blend per `Light2D.BlendMode`, against an accumulator whose
 * rgb holds `S` and whose alpha holds the summed cookie coverage.
 *
 * `transparent` is load-bearing rather than cosmetic: it is what puts the quads
 * in three's transparent list, which sorts farthest-first and so replays them in
 * canvas draw order. In the opaque list they would sort nearest-first, and MIX —
 * the one mode whose result depends on the order lights are applied — would come
 * out reversed.
 */
function accumulationBlend(blendMode: number): Partial<THREE.ShaderMaterialParameters> {
  return {
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation:
      blendMode === Light2DBlendMode.SUB ? THREE.ReverseSubtractEquation : THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst:
      blendMode === Light2DBlendMode.MIX ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
  };
}

/**
 * Stencil state for a light quad, spread verbatim onto the material.
 * `litQuadStencilProps` for a shadowed light, empty for one that casts nothing.
 */
export type LightQuadStencil = Partial<THREE.ShaderMaterialParameters>;

/**
 * The shadowed half of `light_shadow_compute`. The cookie is sampled for its
 * ALPHA alone — `mix` overwrites rgb outright, so the light's colour, its energy
 * and the cookie's own rgb all drop out, and the albedo multiply that the lit
 * branch applies never reaches this term either.
 */
const SHADOW_FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec4 uShadowColor;
varying vec2 vLightUv;

void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  gl_FragColor = vec4(uShadowColor.rgb, uShadowColor.a * cookie.a);
}
`;

/**
 * Whether a `shadow_color` puts anything into the accumulator. Alpha is the
 * whole test: it multiplies the term twice over (once as the blend factor, once
 * as `shadow_color.a`), so a transparent colour contributes nothing whatever its
 * rgb, and Godot's default is exactly that.
 */
export function shadowColorContributes(shadowColor: Color): boolean {
  return shadowColor.a > 0;
}

export function createShadowColorQuadMaterial(
  cookie: THREE.Texture,
  shadowColor: Color,
  blendMode: number,
  stencil: LightQuadStencil = {}
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uShadowColor: {
        value: new THREE.Vector4(shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a),
      },
    },
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}

export function createLightQuadMaterial(
  cookie: THREE.Texture,
  color: Color,
  energy: number,
  blendMode: number,
  stencil: LightQuadStencil = {}
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      uEnergy: { value: energy },
    },
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}
