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
 * UNDER `shadow_filter = PCF5/PCF13` the `mix` factor is a FRACTION and there is
 * no in/out to stencil, so both quads instead sample the light's polar shadow map
 * (`shadowPolarMap.ts`), cover the whole rect, and each emit their own share.
 * Expanding `canvas.glsl:502` with the albedo already folded into `C` (line 814
 * runs first) and `S = shadow_color`:
 *
 *   out += (C·(1−s) + S.rgb·s) · cookie.a·((1−s) + S.a·s)
 *        = C·(1−s)·cookie.a·((1−s) + S.a·s)      ← albedo-MULTIPLIED, the cookie quad
 *        + S.rgb·s·cookie.a·((1−s) + S.a·s)      ← albedo-FREE, the tint quad
 *
 * — no cross term, so the split across the two accumulators is exact rather than
 * approximate. At `s = 1` the tint term is `cookie.a · S.a`, byte-identical to
 * what the stencil path emits, and at Godot's transparent default the cookie term
 * collapses to the (1−s)² falloff MEASURED on Godot 4.6.3 (a PCF5 light over a
 * 0.25 surface steps 167/129/100/80/67/63 of 255, against the 167/146/…/64 a
 * plain (1−s) would give).
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
import { SHADOW_MAP_BINS } from './shadowPolarMap.js';
import { GODOT_TO_SRGB_GLSL } from './srgbTransfer.js';

/** Godot `Light2D.BlendMode`. */
export enum Light2DBlendMode {
  ADD = 0,
  SUB = 1,
  MIX = 2,
}

/** Godot `Light2D.ShadowFilter`. NONE keeps the stencil path; the rest sample the map. */
export const SHADOW_FILTER_NONE = 0;
export const SHADOW_FILTER_PCF5 = 1;
export const SHADOW_FILTER_PCF13 = 2;

const VERTEX = /* glsl */ `
varying vec2 vLightUv;
void main() {
  vLightUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The same quad, plus the fragment's world position — the shadow lookup needs
 * where the pixel IS, which the cookie's uv cannot say once `offset` has moved
 * the quad off the light's origin.
 */
const SHADOW_VERTEX = /* glsl */ `
varying vec2 vLightUv;
varying vec2 vWorld;
void main() {
  vLightUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xy;
  gl_Position = projectionMatrix * viewMatrix * world;
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
${GODOT_TO_SRGB_GLSL}
void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  gl_FragColor = vec4(godotToSrgb(cookie.rgb) * uColor * uEnergy, cookie.a);
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
 * `light_shadow_compute`'s tap loops and the quadrant block that feeds them,
 * ported from `canvas.glsl:458-503` and `canvas.glsl:819-848`. `SHADOW_FILTER`
 * selects the kernel exactly as Godot's `LIGHT_FLAGS_FILTER_MASK` branch does,
 * and the taps step along the map's ANGULAR axis — which is why the penumbra
 * widens with distance from the light instead of being a fixed screen-space band.
 */
const SHADOW_SAMPLE = /* glsl */ `
uniform sampler2D uShadowMap;
uniform mat3 uWorldToLight;
uniform float uShadowZFarInv;
uniform float uShadowPixelSize;
varying vec2 vWorld;

#define SHADOW_TEST(m_u) shadow += step(texture2D(uShadowMap, vec2(m_u, 0.5)).r, dist);

float shadowFraction() {
  // Godot states the quadrant rule in its own Y-DOWN canvas space; the previewer
  // renders the 2D subtree conjugated by diag(1, -1), so the light-local point
  // is flipped back before the mapping rather than the mapping being re-derived.
  vec2 local = (uWorldToLight * vec3(vWorld, 1.0)).xy;
  vec2 shadow_pos = vec2(local.x, -local.y);

  vec2 pos_norm = normalize(shadow_pos);
  vec2 pos_abs = abs(pos_norm);
  vec2 pos_box = pos_norm / max(pos_abs.x, pos_abs.y);
  vec2 pos_rot = pos_norm * mat2(vec2(0.7071067811865476, -0.7071067811865476), vec2(0.7071067811865476, 0.7071067811865476));

  float tex_ofs;
  float dist;
  if (pos_rot.y > 0.0) {
    if (pos_rot.x > 0.0) {
      tex_ofs = pos_box.y * 0.125 + 0.125;
      dist = shadow_pos.x;
    } else {
      tex_ofs = pos_box.x * -0.125 + (0.25 + 0.125);
      dist = shadow_pos.y;
    }
  } else {
    if (pos_rot.x < 0.0) {
      tex_ofs = pos_box.y * -0.125 + (0.5 + 0.125);
      dist = -shadow_pos.x;
    } else {
      tex_ofs = pos_box.x * 0.125 + (0.75 + 0.125);
      dist = -shadow_pos.y;
    }
  }
  dist *= uShadowZFarInv;

  float shadow = 0.0;
#if SHADOW_FILTER == 2
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 6.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 5.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 4.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 3.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 2.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize);
  SHADOW_TEST(tex_ofs);
  SHADOW_TEST(tex_ofs + uShadowPixelSize);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 2.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 3.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 4.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 5.0);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 6.0);
  shadow /= 13.0;
#else
  SHADOW_TEST(tex_ofs - uShadowPixelSize * 2.0);
  SHADOW_TEST(tex_ofs - uShadowPixelSize);
  SHADOW_TEST(tex_ofs);
  SHADOW_TEST(tex_ofs + uShadowPixelSize);
  SHADOW_TEST(tex_ofs + uShadowPixelSize * 2.0);
  shadow /= 5.0;
#endif
  return shadow;
}
`;

/** The cookie quad's `light_color` after `mix`, split out of the sum above. */
const SHADOWED_FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec3 uColor;
uniform float uEnergy;
uniform vec4 uShadowColor;
varying vec2 vLightUv;
${GODOT_TO_SRGB_GLSL}
void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  float s = shadowFraction();
  float lit = 1.0 - s;
  gl_FragColor = vec4(
    godotToSrgb(cookie.rgb) * uColor * uEnergy * lit,
    cookie.a * (lit + s * uShadowColor.a)
  );
}
`;

/** The `shadow_color` quad's share of the same sum — neat, never albedo-scaled. */
const SHADOWED_TINT_FRAGMENT = /* glsl */ `
uniform sampler2D uCookie;
uniform vec4 uShadowColor;
varying vec2 vLightUv;

void main() {
  vec4 cookie = texture2D(uCookie, vLightUv);
  float s = shadowFraction();
  gl_FragColor = vec4(uShadowColor.rgb, cookie.a * s * ((1.0 - s) + s * uShadowColor.a));
}
`;

/**
 * `rasterizer_canvas_gles3.cpp:182`:
 * `shadow_pixel_size = (1.0 / state.shadow_texture_size) * (1.0 + l->shadow_smooth)`
 * — one tap's step along the atlas's u axis, i.e. an ANGULAR step around the light.
 */
export function shadowPixelSize(smooth: number): number {
  return (1 + smooth) / SHADOW_MAP_BINS;
}

/** Everything a quad needs to evaluate one light's filtered shadow per fragment. */
export interface ShadowSampling {
  /** The light's polar map, from `createShadowPolarTexture`. */
  readonly map: THREE.Texture;
  /** `Light2D.shadow_filter`. `SHADOW_FILTER_NONE` never reaches here. */
  readonly filter: typeof SHADOW_FILTER_PCF5 | typeof SHADOW_FILTER_PCF13;
  /** `Light2D.shadow_filter_smooth`, widening the kernel. */
  readonly smooth: number;
  /** Previewer world → light-local, Godot's `xform_cache.affine_inverse()`. */
  readonly worldToLocal: THREE.Matrix3;
  /** `1 / (radius_cache * 1.1)`, the divisor the map was normalised by. */
  readonly zFarInv: number;
  /**
   * `Light2D.shadow_color`. It belongs to the sampling because only a FILTERED
   * cookie quad reads one: the stencil mechanism partitions the two terms
   * between two quads, so its cookie fragment has no `shadow_color` term at all.
   * The tint quad carries the colour in its own right, filtered or not.
   */
  readonly shadowColor: Color;
}

/**
 * One light's polar map as a texture the quad can tap.
 *
 * `LinearFilter` and `RepeatWrapping` are Godot's own atlas state
 * (`rasterizer_canvas_gles3.cpp:1885-1888`), not a choice: the linear read is
 * what rounds each PCF step's corner, and the wrap is what lets a tap cross the
 * seam between the last bin and the first. Half-float because linear filtering
 * of half-float textures is core WebGL2 while the float32 equivalent is an
 * extension; the values are normalised to [0, 1] where the relative precision
 * costs well under a tenth of a pixel of occluder distance.
 */
export function createShadowPolarTexture(bins: Float32Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    new Uint16Array(bins.length),
    bins.length,
    1,
    THREE.RedFormat,
    THREE.HalfFloatType
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  fillShadowPolarTexture(texture, bins);
  return texture;
}

function fillShadowPolarTexture(texture: THREE.DataTexture, bins: Float32Array): void {
  const data = texture.image.data as Uint16Array;
  for (let i = 0; i < bins.length; i += 1) data[i] = THREE.DataUtils.toHalfFloat(bins[i]!);
  texture.needsUpdate = true;
}

/**
 * `existing` refilled from `bins` where it can be, a fresh texture otherwise.
 *
 * A light rebuilds its map whenever an occluder settles or moves, which during
 * load is several times per light. The texture is the only thing downstream of
 * the map that costs a GPU allocation, and its IDENTITY is what the quad's
 * material holds in `uShadowMap` — so replacing it would rebuild the material
 * (and the shadow-tint material) to change nothing the shader can observe.
 * Keeping it means a rebuild re-uploads 4 KB and stops there.
 */
export function updateShadowPolarTexture(
  existing: THREE.DataTexture | null,
  bins: Float32Array
): THREE.DataTexture {
  const data = existing?.image.data as ArrayLike<number> | undefined;
  if (!existing || data?.length !== bins.length) return createShadowPolarTexture(bins);
  fillShadowPolarTexture(existing, bins);
  return existing;
}

function shadowSamplingParameters(
  shadow: ShadowSampling
): Pick<THREE.ShaderMaterialParameters, 'defines'> & {
  uniforms: Record<string, THREE.IUniform>;
} {
  return {
    defines: { SHADOW_FILTER: shadow.filter },
    uniforms: {
      uShadowMap: { value: shadow.map },
      uWorldToLight: { value: shadow.worldToLocal },
      uShadowZFarInv: { value: shadow.zFarInv },
      uShadowPixelSize: { value: shadowPixelSize(shadow.smooth) },
    },
  };
}

/**
 * Whether a `shadow_color` puts anything into the accumulator. Alpha is the
 * whole test: it multiplies the term twice over (once as the blend factor, once
 * as `shadow_color.a`), so a transparent colour contributes nothing whatever its
 * rgb, and Godot's default is exactly that.
 */
export function shadowColorContributes(shadowColor: Color): boolean {
  return shadowColor.a > 0;
}

/**
 * The `shadow_color` quad: one light's albedo-free term.
 *
 * The two mechanisms name the colour in different places, and the union is what
 * stops a light's two quads being built from two different colours. A FILTERED
 * light's colour rides its `ShadowSampling`, which the cookie quad reads for the
 * same light — one carrier, so the tint quad's rgb and the cookie quad's alpha
 * term are provably the same value rather than two that happen to agree. An
 * unfiltered light has no sampling, so it names the colour directly.
 */
export type ShadowColorQuadOptions = {
  readonly cookie: THREE.Texture;
  readonly blendMode: number;
} & (
  | {
      readonly shadow: ShadowSampling;
      readonly shadowColor?: never;
      readonly stencil?: never;
    }
  | {
      readonly shadow?: undefined;
      /** `Light2D.shadow_color` — the whole colour, this quad's entire output. */
      readonly shadowColor: Color;
      /** The stencil test that confines it to where the volumes stamped. */
      readonly stencil?: LightQuadStencil;
    }
);

export function createShadowColorQuadMaterial(
  options: ShadowColorQuadOptions
): THREE.ShaderMaterial {
  const { cookie, blendMode, shadow } = options;
  const shadowColor = shadow ? shadow.shadowColor : options.shadowColor;
  const stencil = shadow ? undefined : options.stencil;
  const sampling = shadow ? shadowSamplingParameters(shadow) : null;
  return new THREE.ShaderMaterial({
    ...(sampling ? { defines: sampling.defines } : {}),
    vertexShader: sampling ? SHADOW_VERTEX : VERTEX,
    fragmentShader: sampling ? SHADOW_SAMPLE + SHADOWED_TINT_FRAGMENT : SHADOW_FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uShadowColor: {
        value: new THREE.Vector4(shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a),
      },
      ...sampling?.uniforms,
    },
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}

/** The cookie quad: one light's albedo-multiplied term. */
export interface LightQuadOptions {
  readonly cookie: THREE.Texture;
  /** `Light2D.color`. */
  readonly color: Color;
  /** `Light2D.energy`. */
  readonly energy: number;
  readonly blendMode: number;
  /** The stencil test that withholds it where the volumes stamped. */
  readonly stencil?: LightQuadStencil;
  /** Set for a filtered light, whose fraction replaces the stencil. */
  readonly shadow?: ShadowSampling;
}

export function createLightQuadMaterial({
  cookie,
  color,
  energy,
  blendMode,
  stencil,
  shadow,
}: LightQuadOptions): THREE.ShaderMaterial {
  const sampling = shadow ? shadowSamplingParameters(shadow) : null;
  return new THREE.ShaderMaterial({
    ...(sampling ? { defines: sampling.defines } : {}),
    vertexShader: sampling ? SHADOW_VERTEX : VERTEX,
    fragmentShader: sampling ? SHADOW_SAMPLE + SHADOWED_FRAGMENT : FRAGMENT,
    uniforms: {
      uCookie: { value: cookie },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      uEnergy: { value: energy },
      // Only `.a` is read on this side — it is what carries the shadowed half of
      // the alpha the accumulator sums for `light_only_alpha`.
      ...(shadow
        ? {
            uShadowColor: {
              value: new THREE.Vector4(
                shadow.shadowColor.r,
                shadow.shadowColor.g,
                shadow.shadowColor.b,
                shadow.shadowColor.a
              ),
            },
          }
        : {}),
      ...sampling?.uniforms,
    },
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    ...accumulationBlend(blendMode),
    ...stencil,
  });
}
