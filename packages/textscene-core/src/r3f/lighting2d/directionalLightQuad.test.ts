/**
 * The materials one DirectionalLight2D adds to the accumulator, against renderer_rd's
 * `canvas_render_items` (`renderer_canvas_render_rd.cpp:540-575`) and `canvas.glsl:727-760`.
 */

import { describe, it, expect } from 'vitest';
import { canvasShadowAtlasSize } from '../../godot/rendering/canvasShadowAtlas';
import * as THREE from 'three';
import { createDirectionalLightMaterial, type DirectionalShadowSampling } from './directionalLightQuad';
import { createShadowMapTexture } from './shadowMap/shadowMapTexture';
import { SHADOWED_LIGHT_GLSL } from './shadowMap/shadowShader';

import { Light2DBlendMode } from '../../godot/scene/light2d';
import { Light2DShadowFilter } from '../../godot/scene/light2d.js';

/** The size Godot uses when the project sets none. */
const DEFAULT_ATLAS_SIZE = canvasShadowAtlasSize(undefined);

const WARM = { r: 1, g: 0.75, b: 0.35, a: 0.5 };

function sampling(overrides: Partial<DirectionalShadowSampling> = {}): DirectionalShadowSampling {
  return {
    map: createShadowMapTexture(DEFAULT_ATLAS_SIZE, 'clamp'),
    filter: Light2DShadowFilter.NONE,
    smooth: 0,
    ndcToShadow: new THREE.Matrix3(),
    shadowColor: { r: 0, g: 0, b: 1, a: 0.5 },
    ...overrides,
  };
}

describe('createDirectionalLightMaterial', () => {
  it("carries the colour in rgb and Godot's `color.a × energy` as the term's alpha", () => {
    // `state.light_uniforms[index].color[3] *= l->energy` (`:552`): a directional light has no
    // cookie, so its whole coverage is that alpha.
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 3, blendMode: Light2DBlendMode.ADD });
    const color = mat.uniforms.uColor!.value as THREE.Vector3;
    expect([color.x, color.y, color.z]).toEqual([1, 0.75, 0.35]);
    expect(mat.uniforms.uAlpha!.value).toBe(1.5);
  });

  it('blends as a point light of the same mode does', () => {
    const add = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: Light2DBlendMode.ADD });
    const sub = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: Light2DBlendMode.SUB });
    const mix = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: Light2DBlendMode.MIX });
    expect([add.blendEquation, add.blendSrc, add.blendDst]).toEqual([
      THREE.AddEquation,
      THREE.SrcAlphaFactor,
      THREE.OneFactor,
    ]);
    expect(sub.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(mix.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });

  it('draws over the whole accumulator, ignoring every matrix', () => {
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0 });
    expect(mat.vertexShader).toContain('gl_Position = vec4(position.xy * 2.0, 0.0, 1.0)');
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(false);
  });

  it('samples no shadow map when the light casts none', () => {
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0 });
    expect(mat.uniforms.uShadowMap).toBeUndefined();
    expect(mat.defines?.SHADOW_FILTER).toBeUndefined();
  });

  it('selects the kernel by shadow_filter and binds the map and its transform', () => {
    const shadow = sampling({ filter: Light2DShadowFilter.PCF13 });
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0, shadow });
    expect(mat.defines?.SHADOW_FILTER).toBe(Light2DShadowFilter.PCF13);
    expect(mat.uniforms.uShadowMap!.value).toBe(shadow.map);
    expect(mat.uniforms.uNdcToShadow!.value).toBe(shadow.ndcToShadow);
  });

  it('hands the taps shadow_filter_smooth, which they step by over the map width (`:557`)', () => {
    const mat = createDirectionalLightMaterial({
      color: WARM,
      energy: 1,
      blendMode: 0,
      shadow: sampling({ smooth: 1.2 }),
    });
    expect(mat.uniforms.uShadowSmooth!.value).toBe(1.2);
  });

  it("emulates renderer_rd's `texture_shadow`: two texels compared, then mixed", () => {
    // `canvas.glsl:392-399`, since the atlas is a depth texture behind a nearest sampler.
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0, shadow: sampling() });
    expect(mat.fragmentShader).toContain(
      'mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth)'
    );
  });

  it('leaves an empty bin lit for a fragment past the far edge of the map', () => {
    // An editor camera wider than the viewport shows depths above SHADOW_MAP_FAR downstream.
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0, shadow: sampling() });
    expect(mat.fragmentShader).toContain('binDepth >= float(1) ? 1e30 : binDepth');
  });
});

describe('the shadow_color term of createDirectionalLightMaterial', () => {
  it("draws Godot's `shadow_color` where the shadow falls, scaled by the light's alpha", () => {
    const shadow = sampling();
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 2, blendMode: 0, shadow });
    const tint = mat.uniforms.uShadowColor!.value as THREE.Vector4;
    expect([tint.x, tint.y, tint.z, tint.w]).toEqual([0, 0, 1, 0.5]);
    expect(mat.uniforms.uAlpha!.value).toBe(1);
    expect(mat.uniforms.uShadowMap!.value).toBe(shadow.map);
  });

  it('hands the shadowed split its colour and its whole alpha', () => {
    // A MIX blend scales the buffer by the alpha, which is the light's over its whole reach.
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 2, blendMode: 2, shadow: sampling() });
    expect(mat.fragmentShader).toContain(SHADOWED_LIGHT_GLSL);
    expect(mat.fragmentShader).toContain('writeShadowedLight(uColor, uAlpha, shadowFraction());');
  });

  it('evaluates the shadow taps once per fragment, for the light and the shadow_color together', () => {
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 2, blendMode: 0, shadow: sampling() });
    expect(mat.fragmentShader.split('void main()')[1]!.match(/shadowFraction\(\)/g)).toHaveLength(1);
  });

  it('writes the light, the shadow_color and the Light Only term to attachments 0, 1 and 2', () => {
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 2, blendMode: 0 });
    expect(mat.glslVersion).toBe(THREE.GLSL3);
    for (const location of [0, 1, 2]) {
      expect(mat.fragmentShader).toContain(`layout(location = ${location}) out highp vec4`);
    }
  });

  it('carries only the alpha as the shadow_color of a light that casts no shadow', () => {
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 2, blendMode: 2 });
    expect(mat.fragmentShader).toContain('vec4(0.0, 0.0, 0.0, uAlpha)');
    expect(mat.uniforms.uAlpha!.value).toBe(1);
    expect(mat.uniforms.uShadowMap).toBeUndefined();
  });
});
