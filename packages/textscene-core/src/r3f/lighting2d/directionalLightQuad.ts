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
import { accumulationState, shadowColorUniform } from './lightQuad.js';
import { FULL_SCREEN_VERTEX, multipleTargetPass } from '../fullScreenPass.js';
import { SHADOW_MAP_FAR } from './shadowPolarMap.js';
import { LIGHT_OUTPUTS } from './lightQuadShaders.js';
import { SHADOW_BINS, SHADOW_TAPS, shadowMapUniforms } from './shadowTaps.js';
import type { Rgba } from '../../godot/math/math.js';
import type { Light2DShadowFilter } from '../../godot/scene/light2d.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** The depth an empty bin compares as: past any fragment, so `step` leaves it lit. */
const EMPTY_BIN_DEPTH = '1e30';

/** Everything a directional light's quads need to evaluate its shadow per fragment. */
export interface DirectionalShadowSampling {
  /** The light's map, from `createDirectionalShadowTexture`. */
  readonly map: THREE.Texture;
  /** `Light2D.shadow_filter`. NONE takes one nearest texel, as renderer_rd does. */
  readonly filter: EnumValue<typeof Light2DShadowFilter>;
  /** `Light2D.shadow_filter_smooth`, widening the PCF taps. */
  readonly smooth: number;
  /** The quad's NDC position to the map's `(u, depth)`: the view and `shadow.directional_xform` composed. */
  readonly ndcToShadow: THREE.Matrix3;
  /** `Light2D.shadow_color`, which replaces the light where the shadow falls. */
  readonly shadowColor: Rgba;
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
 * The light's taps (`shadowTaps.ts`) over its map, one row of nearest texels read at their centres.
 * The map clamps at its ends.
 */
const SHADOW_SAMPLE = /* glsl */ `
uniform sampler2D uShadowMap;
varying vec2 vShadow;
${SHADOW_BINS}
// An empty bin never shadows. The camera can show past the viewport's far edge, where depth
// exceeds SHADOW_MAP_FAR, and a bin left at SHADOW_MAP_FAR would shadow all of it.
float shadowTexel(float texel) {
  float binDepth = texture2D(uShadowMap, vec2((clamp(texel, 0.0, shadowBins() - 1.0) + 0.5) / shadowBins(), 0.5)).r;
  return binDepth >= float(${SHADOW_MAP_FAR}) ? ${EMPTY_BIN_DEPTH} : binDepth;
}
${SHADOW_TAPS}
float shadowFraction() {
  return shadowTaps(vShadow.x, vShadow.y);
}
`;

/**
 * Writes the three outputs of `LIGHT_OUTPUTS`. With no shadow, the `shadow_color` term is the alpha
 * alone.
 */
const FRAGMENT = /* glsl */ `
${LIGHT_OUTPUTS}
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  writeLight(vec4(uColor, uAlpha), vec4(0.0, 0.0, 0.0, uAlpha));
}
`;

/**
 * `mix(light_color, shadow_color, s)` with `shadow_color.a *= light_color.a` (`canvas.glsl:543-547`),
 * split as a PointLight2D's is (`lightQuadShaders.ts`): the light term carries the albedo-scaled
 * half, the `shadow_color` term the other under the light's whole alpha, so a MIX blend scales both
 * buffers alike. One evaluation of the taps serves both.
 */
const SHADOWED_FRAGMENT = /* glsl */ `
${LIGHT_OUTPUTS}
uniform vec3 uColor;
uniform float uAlpha;
uniform vec4 uShadowColor;
${SHADOW_SAMPLE}
void main() {
  float s = shadowFraction();
  float lit = 1.0 - s;
  float alpha = uAlpha * (lit + s * uShadowColor.a);
  vec4 light = vec4(uColor * lit, alpha);
  vec4 tint = vec4(uShadowColor.rgb * s, alpha);
  writeLight(light, tint);
}
`;

interface DirectionalLightQuadOptions {
  /** `Light2D.color`, in Godot's sRGB canvas space. */
  readonly color: Rgba;
  /** `Light2D.energy`. */
  readonly energy: number;
  readonly blendMode: number;
  /** Set while the light casts a shadow. */
  readonly shadow?: DirectionalShadowSampling;
}

function shadowUniforms(shadow: DirectionalShadowSampling): Record<string, THREE.IUniform> {
  return {
    ...shadowMapUniforms(shadow.map),
    uShadowSmooth: { value: shadow.smooth },
    uNdcToShadow: { value: shadow.ndcToShadow },
    uShadowColor: { value: shadowColorUniform(shadow.shadowColor) },
  };
}

/** The light's quad: one draw fills the light, `shadow_color` and Light Only buffers of a list. */
export function createDirectionalLightMaterial({
  color,
  energy,
  blendMode,
  shadow,
}: DirectionalLightQuadOptions): THREE.ShaderMaterial {
  return multipleTargetPass(
    new THREE.ShaderMaterial({
      ...(shadow ? { defines: { SHADOW_FILTER: shadow.filter } } : {}),
      vertexShader: shadow ? SHADOW_VERTEX : FULL_SCREEN_VERTEX,
      fragmentShader: shadow ? SHADOWED_FRAGMENT : FRAGMENT,
      uniforms: {
        uAlpha: { value: color.a * energy },
        uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        ...(shadow ? shadowUniforms(shadow) : {}),
      },
      ...accumulationState(blendMode),
    })
  );
}

/**
 * One light's map as a texture: float32 and nearest, since `texture_shadow` compares texel by
 * texel and a half float rounds a depth near 1 by 1/2048 of `z_far`, 5 px at the default
 * `max_distance`. `writeDirectionalShadowMap` fills it.
 */
export function createDirectionalShadowTexture(bins: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Float32Array(bins), bins, 1, THREE.RedFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  return texture;
}

/** Uploads `bins`, as many as the texture holds, into a texture from `createDirectionalShadowTexture`. */
export function writeDirectionalShadowMap(texture: THREE.DataTexture, bins: Float32Array): void {
  const data = texture.image.data as Float32Array;
  // `set` accepts a shorter source and keeps the old bins past its end.
  if (bins.length !== data.length) {
    throw new RangeError(`expected a shadow map of ${data.length} bins, got ${bins.length}`);
  }
  data.set(bins);
  texture.needsUpdate = true;
}
