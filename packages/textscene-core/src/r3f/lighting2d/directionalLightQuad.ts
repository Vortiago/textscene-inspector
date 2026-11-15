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
import { accumulationState } from './lightQuad.js';
import { FULL_SCREEN_VERTEX, multipleTargetPass } from '../fullScreenPass.js';
import { LIGHT_OUTPUTS } from './lightQuadShaders.js';
import { shadowMapUniforms } from './shadowMap/shadowMapTexture.js';
import {
  DIRECTIONAL_LOOKUP,
  DIRECTIONAL_SHADOW_VERTEX,
  SHADOWED_LIGHT_GLSL,
  shadowSampleGlsl,
  shadowedLightUniforms,
} from './shadowMap/shadowShader.js';
import type { Rgba } from '../../godot/math/math.js';
import type { Light2DShadowFilter } from '../../godot/scene/light2d.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** Everything a directional light's quads need to evaluate its shadow per fragment. */
export interface DirectionalShadowSampling {
  /** The light's map, from `useDirectionalShadow`. */
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
 * The light, shadowed by its map (`shadowShader.ts`): the light term's `rgb` is `color` and its
 * alpha `color.a × energy`.
 */
const SHADOWED_FRAGMENT = /* glsl */ `
${LIGHT_OUTPUTS}
${SHADOWED_LIGHT_GLSL}
uniform vec3 uColor;
uniform float uAlpha;
${shadowSampleGlsl(DIRECTIONAL_LOOKUP)}
void main() {
  writeShadowedLight(uColor, uAlpha, shadowFraction());
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
    ...shadowedLightUniforms(shadow.shadowColor),
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
      vertexShader: shadow ? DIRECTIONAL_SHADOW_VERTEX : FULL_SCREEN_VERTEX,
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
