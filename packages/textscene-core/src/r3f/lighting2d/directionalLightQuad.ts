/**
 * The quad materials a DirectionalLight2D adds to the canvas light accumulator. It has no cookie:
 * renderer_rd's `canvas_render_items` (`renderer_canvas_render_rd.cpp:540-575`) hands the shader
 * `color` with `color.a × energy` as alpha, and `canvas.glsl:727-760` applies it to every lit
 * pixel, so the quad covers the whole target. Its shadow samples `directionalShadowMap.ts`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import * as THREE from 'three';
import type { Color } from '../../nodes/base/node2d/types.js';
import type { Light2DShadowFilter } from '../../nodes/2d/lights/shared/types.js';
import { accumulationState } from './lightQuad.js';
import { FULL_SCREEN_VERTEX } from './fullScreenQuad.js';
import { SHADOW_MAP_BINS } from './shadowPolarMap.js';
import { shadowPixelSize } from './shadowSampling.js';

/** Everything a directional light's quads need to evaluate its shadow per fragment. */
export interface DirectionalShadowSampling {
  /** The light's map, from `createDirectionalShadowTexture`. */
  readonly map: THREE.Texture;
  /** `Light2D.shadow_filter`. NONE takes one nearest texel, as renderer_rd does. */
  readonly filter: Light2DShadowFilter;
  /** `Light2D.shadow_filter_smooth`, widening the PCF taps. */
  readonly smooth: number;
  /** The quad's NDC position to the map's `(u, depth)`: the view and `shadow.directional_xform` composed. */
  readonly ndcToShadow: THREE.Matrix3;
  /** `Light2D.shadow_color`, which replaces the light where the shadow falls. */
  readonly shadowColor: Color;
}

const SHADOW_VERTEX = /* glsl */ `
uniform mat3 uNdcToShadow;
varying vec2 vShadow;
void main() {
  vec2 ndc = position.xy * 2.0;
  vShadow = (uNdcToShadow * vec3(ndc, 1.0)).xy;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

/**
 * `light_shadow_compute`'s kernels (`canvas.glsl:498-540`) over `texture_shadow` (`:392-399`). The
 * map is one row of nearest texels, so a texel is read at its centre. `SHADOW_FILTER` 0 is
 * NEAREST's single texel, 1 and 2 the PCF5 and PCF13 taps.
 */
const SHADOW_SAMPLE = /* glsl */ `
uniform sampler2D uShadowMap;
uniform float uShadowPixelSize;
varying vec2 vShadow;

float shadowTexel(float texel) {
  return texture2D(uShadowMap, vec2((clamp(texel, 0.0, ${SHADOW_MAP_BINS - 1}.0) + 0.5) / ${SHADOW_MAP_BINS}.0, 0.5)).r;
}

float textureShadow(float u, float depth) {
  float scaled = u * ${SHADOW_MAP_BINS}.0;
  float texel = floor(scaled);
  return mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth), scaled - texel);
}

float shadowFraction() {
  float u = vShadow.x;
  float depth = vShadow.y;
#if SHADOW_FILTER == 0
  return step(shadowTexel(floor(u * ${SHADOW_MAP_BINS}.0)), depth);
#elif SHADOW_FILTER == 2
  float shadow = 0.0;
  for (int tap = -6; tap <= 6; tap++) shadow += textureShadow(u + uShadowPixelSize * float(tap), depth);
  return shadow / 13.0;
#else
  float shadow = 0.0;
  for (int tap = -2; tap <= 2; tap++) shadow += textureShadow(u + uShadowPixelSize * float(tap), depth);
  return shadow / 5.0;
#endif
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}
`;

/**
 * `mix(light_color, shadow_color, s)` with `shadow_color.a *= light_color.a` (`canvas.glsl:543-547`),
 * split as a PointLight2D's is (`lightQuadShaders.ts`): this quad carries the albedo-scaled half.
 */
const SHADOWED_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform vec4 uShadowColor;
${SHADOW_SAMPLE}
void main() {
  float s = shadowFraction();
  float lit = 1.0 - s;
  gl_FragColor = vec4(uColor * lit, uAlpha * (lit + s * uShadowColor.a));
}
`;

/** The other half: `shadow_color`, never albedo-scaled, so it draws in the tint pass. */
const SHADOWED_TINT_FRAGMENT = /* glsl */ `
uniform float uAlpha;
uniform vec4 uShadowColor;
${SHADOW_SAMPLE}
void main() {
  float s = shadowFraction();
  gl_FragColor = vec4(uShadowColor.rgb, uAlpha * s * ((1.0 - s) + s * uShadowColor.a));
}
`;

interface DirectionalLightQuadOptions {
  /** `Light2D.color`, in Godot's sRGB canvas space. */
  readonly color: Color;
  /** `Light2D.energy`. */
  readonly energy: number;
  readonly blendMode: number;
  /** Set while the light casts a shadow. */
  readonly shadow?: DirectionalShadowSampling;
}

function shadowUniforms(shadow: DirectionalShadowSampling): Record<string, THREE.IUniform> {
  const { r, g, b, a } = shadow.shadowColor;
  return {
    uShadowMap: { value: shadow.map },
    uShadowPixelSize: { value: shadowPixelSize(shadow.smooth) },
    uNdcToShadow: { value: shadow.ndcToShadow },
    uShadowColor: { value: new THREE.Vector4(r, g, b, a) },
  };
}

function accumulationQuad(
  options: DirectionalLightQuadOptions,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  const { color, energy, blendMode, shadow } = options;
  return new THREE.ShaderMaterial({
    ...(shadow ? { defines: { SHADOW_FILTER: shadow.filter } } : {}),
    vertexShader: shadow ? SHADOW_VERTEX : FULL_SCREEN_VERTEX,
    fragmentShader,
    uniforms: {
      uAlpha: { value: color.a * energy },
      ...(shadow ? shadowUniforms(shadow) : {}),
      ...uniforms,
    },
    ...accumulationState(blendMode),
  });
}

/** The albedo-multiplied term: the light's colour, withheld where its shadow falls. */
export function createDirectionalLightMaterial(options: DirectionalLightQuadOptions): THREE.ShaderMaterial {
  const { r, g, b } = options.color;
  return accumulationQuad(options, options.shadow ? SHADOWED_FRAGMENT : FRAGMENT, {
    uColor: { value: new THREE.Vector3(r, g, b) },
  });
}

/** The albedo-free `shadow_color` term, drawn only for a light whose `shadow_color` contributes. */
export function createDirectionalShadowColorMaterial(
  options: DirectionalLightQuadOptions & { readonly shadow: DirectionalShadowSampling }
): THREE.ShaderMaterial {
  return accumulationQuad(options, SHADOWED_TINT_FRAGMENT, {});
}

/**
 * One light's map as a texture: float32 and nearest, since `texture_shadow` compares texel by
 * texel and a half float rounds a depth near 1 by 1/2048 of `z_far`, 5 px at the default
 * `max_distance`. `writeDirectionalShadowMap` fills it.
 */
export function createDirectionalShadowTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    new Float32Array(SHADOW_MAP_BINS),
    SHADOW_MAP_BINS,
    1,
    THREE.RedFormat,
    THREE.FloatType
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  return texture;
}

/** Uploads `bins`, `SHADOW_MAP_BINS` long, into a texture from `createDirectionalShadowTexture`. */
export function writeDirectionalShadowMap(texture: THREE.DataTexture, bins: Float32Array): void {
  (texture.image.data as Float32Array).set(bins);
  texture.needsUpdate = true;
}
