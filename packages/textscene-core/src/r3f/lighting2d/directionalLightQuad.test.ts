/**
 * The materials one DirectionalLight2D adds to the accumulator, against renderer_rd's
 * `canvas_render_items` (`renderer_canvas_render_rd.cpp:540-575`) and `canvas.glsl:727-760`.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createDirectionalLightMaterial,
  createDirectionalShadowColorMaterial,
  createDirectionalShadowTexture,
  writeDirectionalShadowMap,
  type DirectionalShadowSampling,
} from './directionalLightQuad';
import { Light2DBlendMode, SHADOW_FILTER_NONE, SHADOW_FILTER_PCF13 } from './lightQuad';
import { SHADOW_MAP_BINS } from './shadowPolarMap';

const WARM = { r: 1, g: 0.75, b: 0.35, a: 0.5 };

function sampling(overrides: Partial<DirectionalShadowSampling> = {}): DirectionalShadowSampling {
  return {
    map: createDirectionalShadowTexture(),
    filter: SHADOW_FILTER_NONE,
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
    const shadow = sampling({ filter: SHADOW_FILTER_PCF13 });
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0, shadow });
    expect(mat.defines?.SHADOW_FILTER).toBe(SHADOW_FILTER_PCF13);
    expect(mat.uniforms.uShadowMap!.value).toBe(shadow.map);
    expect(mat.uniforms.uNdcToShadow!.value).toBe(shadow.ndcToShadow);
  });

  it('spaces the taps by `(1 + shadow_filter_smooth) / shadow_texture_size` (`:557`)', () => {
    const mat = createDirectionalLightMaterial({
      color: WARM,
      energy: 1,
      blendMode: 0,
      shadow: sampling({ smooth: 1.2 }),
    });
    expect(mat.uniforms.uShadowPixelSize!.value).toBeCloseTo(2.2 / SHADOW_MAP_BINS, 12);
  });

  it("emulates renderer_rd's `texture_shadow`: two texels compared, then mixed", () => {
    // `canvas.glsl:392-399`, since the atlas is a depth texture behind a nearest sampler.
    const mat = createDirectionalLightMaterial({ color: WARM, energy: 1, blendMode: 0, shadow: sampling() });
    expect(mat.fragmentShader).toContain(
      'mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth)'
    );
  });
});

describe('createDirectionalShadowColorMaterial', () => {
  it("draws Godot's `shadow_color` where the shadow falls, scaled by the light's alpha", () => {
    const shadow = sampling();
    const mat = createDirectionalShadowColorMaterial({ color: WARM, energy: 2, blendMode: 0, shadow });
    const tint = mat.uniforms.uShadowColor!.value as THREE.Vector4;
    expect([tint.x, tint.y, tint.z, tint.w]).toEqual([0, 0, 1, 0.5]);
    expect(mat.uniforms.uAlpha!.value).toBe(1);
    expect(mat.uniforms.uShadowMap!.value).toBe(shadow.map);
  });
});

describe('createDirectionalShadowTexture', () => {
  it('holds one full-precision depth per bin, sampled texel by texel', () => {
    // A half float rounds a depth near 1 by 1/2048 of z_far, 5 px at the default max_distance.
    const texture = createDirectionalShadowTexture();
    expect(texture.type).toBe(THREE.FloatType);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
    expect(texture.magFilter).toBe(THREE.NearestFilter);
    expect(texture.image.width).toBe(SHADOW_MAP_BINS);
  });
});

describe('writeDirectionalShadowMap', () => {
  it('fills the texture in place and flags the upload', () => {
    const texture = createDirectionalShadowTexture();
    const bins = new Float32Array(SHADOW_MAP_BINS).fill(1);
    bins[3] = 0.123456;
    const versionBefore = texture.version;
    writeDirectionalShadowMap(texture, bins);
    expect((texture.image.data as Float32Array)[3]).toBeCloseTo(0.123456, 6);
    expect(texture.version).toBeGreaterThan(versionBefore);
  });

  it('refuses a map of the wrong length rather than leaving stale bins behind', () => {
    expect(() =>
      writeDirectionalShadowMap(createDirectionalShadowTexture(), new Float32Array(SHADOW_MAP_BINS + 1))
    ).toThrow(RangeError);
  });
});
