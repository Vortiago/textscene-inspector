/**
 * The producer side of the 2D light pass: the material one PointLight2D
 * contributes to the accumulator.
 *
 * Each `Light2D.BlendMode` is one fixed-function blend of `light_blend_compute`,
 * so the blend state IS the port — an approximation would show up here as two
 * modes sharing one set of factors.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createLightQuadMaterial,
  createShadowColorQuadMaterial,
  createShadowPolarTexture,
  shadowPixelSize,
  Light2DBlendMode,
  SHADOW_FILTER_PCF5,
  SHADOW_FILTER_PCF13,
  type ShadowSampling,
} from './lightQuad';
import { SHADOW_MAP_BINS, SHADOW_MAP_FAR } from './shadowPolarMap';

const WARM = { r: 1, g: 0.75, b: 0.35, a: 1 };

function material(blendMode: number, energy = 1) {
  return createLightQuadMaterial({ cookie: new THREE.Texture(), color: WARM, energy, blendMode });
}

function sampling(overrides: Partial<ShadowSampling> = {}): ShadowSampling {
  return {
    map: new THREE.Texture(),
    filter: SHADOW_FILTER_PCF5,
    smooth: 0,
    worldToLocal: new THREE.Matrix3(),
    zFarInv: 1 / 1100,
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    ...overrides,
  };
}

/** A filtered cookie quad with everything but the sampling left at its default. */
function filteredMaterial(shadow: ShadowSampling = sampling()) {
  return createLightQuadMaterial({
    cookie: new THREE.Texture(),
    color: WARM,
    energy: 1,
    blendMode: 0,
    shadow,
  });
}

describe('createLightQuadMaterial', () => {
  it('emits the light term unclamped, in sRGB, with the cookie alpha kept separate', () => {
    const mat = material(Light2DBlendMode.ADD);
    // rgb is the light term; alpha stays raw because the accumulator needs it
    // both as the blend factor and, summed, as the Light Only mask.
    expect(mat.fragmentShader).toContain('vec4(godotToSrgb(cookie.rgb) * uColor * uEnergy, cookie.a)');
    expect(mat.fragmentShader).not.toContain('clamp(');
  });

  it('carries colour and energy as separate sRGB uniforms', () => {
    const mat = material(Light2DBlendMode.ADD, 2);
    const color = mat.uniforms.uColor!.value as THREE.Vector3;
    expect([color.x, color.y, color.z]).toEqual([1, 0.75, 0.35]);
    expect(mat.uniforms.uEnergy!.value).toBe(2);
  });

  it('accumulates ADD as src×srcAlpha + dst', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.blending).toBe(THREE.CustomBlending);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('accumulates SUB by reverse-subtracting that same term', () => {
    const mat = material(Light2DBlendMode.SUB);
    expect(mat.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('accumulates MIX by interpolating toward the light', () => {
    const mat = material(Light2DBlendMode.MIX);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });

  it('sums the coverage mask whatever the colour mode does', () => {
    // light_only_alpha is a plain sum, measured: three overlapping cookies of
    // alpha 0.3 mask to 0.9, not to the 0.657 a screen combination would give.
    for (const mode of [Light2DBlendMode.ADD, Light2DBlendMode.SUB, Light2DBlendMode.MIX]) {
      const mat = material(mode);
      expect(mat.blendEquationAlpha, `mode ${mode}`).toBe(THREE.AddEquation);
      expect(mat.blendSrcAlpha, `mode ${mode}`).toBe(THREE.OneFactor);
      expect(mat.blendDstAlpha, `mode ${mode}`).toBe(THREE.OneFactor);
    }
  });

  it('gives the three modes three distinct blends', () => {
    const signature = (mode: number) => {
      const m = material(mode);
      return `${m.blendEquation}/${m.blendSrc}/${m.blendDst}`;
    };
    const all = [
      signature(Light2DBlendMode.ADD),
      signature(Light2DBlendMode.SUB),
      signature(Light2DBlendMode.MIX),
    ];
    expect(new Set(all).size).toBe(3);
  });

  it('sorts with the transparent list, so lights replay in canvas order', () => {
    // The opaque list sorts nearest-first, reversing canvas order — and MIX is
    // the one mode whose result depends on the order lights are applied.
    expect(material(Light2DBlendMode.MIX).transparent).toBe(true);
  });

  it('never occludes or is occluded: a light has no depth of its own', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(false);
  });

  it('falls back to ADD for an out-of-range blend mode', () => {
    const mat = material(99);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });
});

/**
 * The filtered branch. Expected values are Godot's:
 *  - `rasterizer_canvas_gles3.cpp:182` for the tap step,
 *  - `canvas.glsl:469-493` for the two kernel widths,
 *  - `canvas.glsl:500-502` for the `mix`, whose expansion over the accumulator's
 *    own `src×srcAlpha` blend is the (1−s)² MEASURED on Godot 4.6.3
 *    (167/129/100/80/67/63 of 255 over a 0.25 surface, PCF5 at smooth 8).
 */
describe('shadowPixelSize', () => {
  it('is one atlas texel widened by shadow_filter_smooth', () => {
    expect(shadowPixelSize(0)).toBe(1 / 2048);
    expect(shadowPixelSize(8)).toBe(9 / 2048);
    expect(shadowPixelSize(5)).toBe(6 / 2048);
    // The dungeon's 23 lights all author smooth 5, so this row is its penumbra.
    expect(shadowPixelSize(5) * SHADOW_MAP_BINS).toBe(6);
  });
});

describe('createShadowPolarTexture', () => {
  it('carries the atlas state Godot samples the map with', () => {
    const texture = createShadowPolarTexture(new Float32Array(SHADOW_MAP_BINS));
    // LINEAR is what rounds each PCF step's corner; REPEAT is what lets a tap
    // cross the seam between the last bin and the first.
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.image.width).toBe(SHADOW_MAP_BINS);
    expect(texture.image.height).toBe(1);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.generateMipmaps).toBe(false);
  });

  it('round-trips the far sentinel and an occluder distance through half-float', () => {
    const bins = new Float32Array(SHADOW_MAP_BINS).fill(SHADOW_MAP_FAR);
    bins[7] = 176 / 1593;
    const texture = createShadowPolarTexture(bins);
    const data = texture.image.data as Uint16Array;
    expect(THREE.DataUtils.fromHalfFloat(data[0]!)).toBe(1);
    // Half-float relative precision is 2^-11, which at z_far 1593 is under a
    // tenth of a pixel of occluder distance.
    expect(THREE.DataUtils.fromHalfFloat(data[7]!)).toBeCloseTo(176 / 1593, 4);
  });
});

describe('createLightQuadMaterial with a shadow filter', () => {
  it('leaves the unfiltered material untouched', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.defines?.SHADOW_FILTER).toBeUndefined();
    expect(mat.uniforms.uShadowMap).toBeUndefined();
    expect(mat.fragmentShader).not.toContain('shadowFraction');
  });

  it('selects the five-tap kernel for PCF5 and the thirteen-tap for PCF13', () => {
    const pcf5 = filteredMaterial();
    const pcf13 = filteredMaterial(sampling({ filter: SHADOW_FILTER_PCF13 }));
    expect(pcf5.defines?.SHADOW_FILTER).toBe(1);
    expect(pcf13.defines?.SHADOW_FILTER).toBe(2);
    // Both kernels are compiled into the one shader and chosen by the define, so
    // the divisors are what say the two branches exist and differ.
    expect(pcf5.fragmentShader).toContain('shadow /= 5.0;');
    expect(pcf5.fragmentShader).toContain('shadow /= 13.0;');
    expect(pcf5.fragmentShader).toContain('#if SHADOW_FILTER == 2');
  });

  it('generates Godot\'s exact tap offsets, not a plausible kernel', () => {
    // canvas.glsl:471-475 and :479-491. A typo'd multiplier reads perfectly
    // sensibly and shifts the whole penumbra, so the literals are asserted.
    const shader = filteredMaterial()
      .fragmentShader;
    const taps = [...shader.matchAll(/SHADOW_TEST\(tex_ofs([^)]*)\);/g)].map(([, arg]) =>
      arg!.trim()
    );
    expect(taps).toEqual([
      // PCF13 first — the `#if` branch is written in Godot's own order.
      '- uShadowPixelSize * 6.0',
      '- uShadowPixelSize * 5.0',
      '- uShadowPixelSize * 4.0',
      '- uShadowPixelSize * 3.0',
      '- uShadowPixelSize * 2.0',
      '- uShadowPixelSize',
      '',
      '+ uShadowPixelSize',
      '+ uShadowPixelSize * 2.0',
      '+ uShadowPixelSize * 3.0',
      '+ uShadowPixelSize * 4.0',
      '+ uShadowPixelSize * 5.0',
      '+ uShadowPixelSize * 6.0',
      // then PCF5.
      '- uShadowPixelSize * 2.0',
      '- uShadowPixelSize',
      '',
      '+ uShadowPixelSize',
      '+ uShadowPixelSize * 2.0',
    ]);
  });

  it('takes the SHADOW_TEST comparison from canvas.glsl:454, in that order', () => {
    // `step(sd, dist)` — 1 where the stored occluder depth is at or in FRONT of
    // the fragment. Swapping the arguments inverts every shadow.
    const shader = filteredMaterial()
      .fragmentShader;
    expect(shader).toContain('shadow += step(texture2D(uShadowMap, vec2(m_u, 0.5)).r, dist);');
  });

  it('offsets the taps along the map axis by (1 + smooth) / 2048', () => {
    const mat = filteredMaterial(sampling({ smooth: 8 }));
    expect(mat.uniforms.uShadowPixelSize!.value).toBe(9 / 2048);
    // The tap coordinate moves in u only — the map's second axis is the atlas
    // row, and a tap that wandered off it would sample another light's shadow.
    expect(mat.fragmentShader).toContain('vec2(m_u, 0.5)');
  });

  it('carries the light-local transform and the z_far the map was built with', () => {
    const worldToLocal = new THREE.Matrix3().set(0, 1, -300, -1, 0, 400, 0, 0, 1);
    const mat = filteredMaterial(sampling({ worldToLocal, zFarInv: 1 / 1593 }));
    expect(mat.uniforms.uWorldToLight!.value).toBe(worldToLocal);
    expect(mat.uniforms.uShadowZFarInv!.value).toBe(1 / 1593);
    // The fragment's world position is what the transform is applied to, so the
    // vertex stage has to publish it.
    expect(mat.vertexShader).toContain('vWorld = world.xy');
  });

  it('scales BOTH rgb and alpha by the lit fraction, which is the (1-s)^2 falloff', () => {
    const mat = filteredMaterial();
    expect(mat.fragmentShader).toContain('godotToSrgb(cookie.rgb) * uColor * uEnergy * lit');
    expect(mat.fragmentShader).toContain('cookie.a * (lit + s * uShadowColor.a)');
  });

  it('keeps the accumulator blends the unfiltered quad uses', () => {
    for (const mode of [Light2DBlendMode.ADD, Light2DBlendMode.SUB, Light2DBlendMode.MIX]) {
      const plain = material(mode);
      const filtered = createLightQuadMaterial({
        cookie: new THREE.Texture(),
        color: WARM,
        energy: 1,
        blendMode: mode,
        shadow: sampling(),
      });
      expect(filtered.blendEquation, `mode ${mode}`).toBe(plain.blendEquation);
      expect(filtered.blendSrc, `mode ${mode}`).toBe(plain.blendSrc);
      expect(filtered.blendDst, `mode ${mode}`).toBe(plain.blendDst);
    }
  });
});

describe('createShadowColorQuadMaterial with a shadow filter', () => {
  const TINT = { r: 0.15, g: 0.35, b: 1, a: 0.5 };

  it('emits the fractional tint, reducing to the stencil path at s = 1', () => {
    // The colour rides the sampling, so this quad and the cookie quad of the
    // same light provably read one value — the options type forbids naming a
    // second one here.
    const mat = createShadowColorQuadMaterial({
      cookie: new THREE.Texture(),
      blendMode: 0,
      shadow: sampling({ shadowColor: TINT }),
    });
    // s * ((1 - s) + s * a): at s = 1 this is `uShadowColor.a * cookie.a`, which
    // is byte-for-byte what the unfiltered tint quad emits inside its umbra.
    expect(mat.fragmentShader).toContain(
      'vec4(uShadowColor.rgb, cookie.a * s * ((1.0 - s) + s * uShadowColor.a))'
    );
    expect(mat.defines?.SHADOW_FILTER).toBe(1);
    expect(mat.uniforms.uShadowMap).toBeDefined();
  });

  it('leaves the unfiltered tint quad on the stencil-partitioned shader', () => {
    const mat = createShadowColorQuadMaterial({ cookie: new THREE.Texture(), shadowColor: TINT, blendMode: 0 });
    expect(mat.fragmentShader).toContain('vec4(uShadowColor.rgb, uShadowColor.a * cookie.a)');
    expect(mat.fragmentShader).not.toContain('shadowFraction');
  });
});
