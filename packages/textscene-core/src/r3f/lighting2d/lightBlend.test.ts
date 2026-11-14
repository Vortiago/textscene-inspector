/**
 * The two shader forms of a light's blend against Godot's `light_blend_compute`: a quad's
 * fixed-function state, evaluated here from its equation and factors, and the GLSL a normal-mapped
 * item blends a layer with. The goldens hold the shaders to these twins.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { accumulationState } from './lightQuad';
import { blendLayer, BLEND_LAYER_GLSL, lightBlendCompute, shadowedLightTerms, type Rgb } from './lightBlend';
import { Light2DBlendMode } from '../../godot/scene/light2d';
import type { Rgba } from '../../godot/math/math';

const MODES = [Light2DBlendMode.ADD, Light2DBlendMode.SUB, Light2DBlendMode.MIX];
const BASES: Rgb[] = [
  { r: 0, g: 0, b: 0 },
  { r: 0.2, g: 0.4, b: 0.6 },
  { r: 1, g: 1, b: 1 },
];
const LIGHTS: Rgba[] = [0, 0.3, 1].map((a) => ({ r: 1, g: 0.5, b: 0.25, a }));
const SHADOW_FRACTIONS = [0, 0.25, 1];
const SHADOW_COLORS: Rgba[] = [
  { r: 0, g: 0, b: 0, a: 0 },
  { r: 0.2, g: 0, b: 0.4, a: 0.5 },
  { r: 1, g: 1, b: 1, a: 1 },
];

const UNSHADOWED_ROWS = MODES.flatMap((mode) =>
  BASES.flatMap((base) => LIGHTS.map((light) => ({ mode, base, light })))
);
const SHADOWED_ROWS = UNSHADOWED_ROWS.flatMap((row) =>
  SHADOW_FRACTIONS.flatMap((s) => SHADOW_COLORS.map((shadowColor) => ({ ...row, s, shadowColor })))
);

const PRECISION = 6;

/** One channel of a blend factor, for a source and a destination of four channels. */
function factor(name: THREE.BlendingDstFactor | undefined, src: Rgba): number {
  switch (name) {
    case THREE.OneFactor:
      return 1;
    case THREE.ZeroFactor:
      return 0;
    case THREE.SrcAlphaFactor:
      return src.a;
    case THREE.OneMinusSrcAlphaFactor:
      return 1 - src.a;
    default:
      throw new Error(`expected a factor the light quad uses, got ${String(name)}`);
  }
}

function equation(name: THREE.BlendingEquation | undefined, srcTerm: number, dstTerm: number): number {
  switch (name) {
    case THREE.AddEquation:
      return srcTerm + dstTerm;
    case THREE.ReverseSubtractEquation:
      return dstTerm - srcTerm;
    case THREE.SubtractEquation:
      return srcTerm - dstTerm;
    default:
      throw new Error(`expected an equation the light quad uses, got ${String(name)}`);
  }
}

/** What the GPU writes when a quad of colour `src` lands on `dst` under `accumulationState(mode)`. */
function fixedFunction(mode: number, dst: Rgba, src: Rgba): Rgba {
  const state = accumulationState(mode);
  const rgb = (channel: 'r' | 'g' | 'b') =>
    equation(
      state.blendEquation,
      src[channel] * factor(state.blendSrc as THREE.BlendingDstFactor, src),
      dst[channel] * factor(state.blendDst, src)
    );
  return {
    r: rgb('r'),
    g: rgb('g'),
    b: rgb('b'),
    a: equation(
      state.blendEquationAlpha ?? undefined,
      src.a * factor(state.blendSrcAlpha as THREE.BlendingDstFactor, src),
      dst.a * factor(state.blendDstAlpha ?? undefined, src)
    ),
  };
}

/** A layer holds the light premultiplied by its alpha, negated by a SUB light. */
function premultipliedTerm(mode: number, { r, g, b, a }: Rgba): Rgb {
  const sign = mode === Light2DBlendMode.SUB ? -1 : 1;
  return { r: sign * r * a, g: sign * g * a, b: sign * b * a };
}

function add(x: Rgb, y: Rgb): Rgb {
  return { r: x.r + y.r, g: x.g + y.g, b: x.b + y.b };
}

function expectRgbClose(actual: Rgb, expected: Rgb): void {
  expect(actual.r).toBeCloseTo(expected.r, PRECISION);
  expect(actual.g).toBeCloseTo(expected.g, PRECISION);
  expect(actual.b).toBeCloseTo(expected.b, PRECISION);
}

describe('lightBlendCompute', () => {
  it('adds, subtracts and mixes the light by its alpha, as canvas.glsl:549-563 does', () => {
    const color = { r: 0.2, g: 0.4, b: 0.6 };
    const light = { r: 1, g: 0.5, b: 0.25, a: 0.5 };
    expectRgbClose(lightBlendCompute(Light2DBlendMode.ADD, color, light), { r: 0.7, g: 0.65, b: 0.725 });
    expectRgbClose(lightBlendCompute(Light2DBlendMode.SUB, color, light), { r: -0.3, g: 0.15, b: 0.475 });
    expectRgbClose(lightBlendCompute(Light2DBlendMode.MIX, color, light), { r: 0.6, g: 0.45, b: 0.425 });
  });
});

describe("a light quad's fixed-function blend", () => {
  it.each(UNSHADOWED_ROWS)(
    'equals the Godot rule: mode $mode over $base, light $light',
    ({ mode, base, light }) => {
      expectRgbClose(fixedFunction(mode, { ...base, a: 0 }, light), lightBlendCompute(mode, base, light));
    }
  );

  it.each(SHADOWED_ROWS)(
    'equals the Godot rule over both buffers: mode $mode, s $s, shadow colour $shadowColor',
    ({ mode, base, light, s, shadowColor }) => {
      const terms = shadowedLightTerms(light, shadowColor, s);
      const lightBuffer = fixedFunction(mode, { ...base, a: 0 }, terms.light);
      const tintBuffer = fixedFunction(mode, { r: 0, g: 0, b: 0, a: 0 }, terms.tint);
      const shadowed = godotShadowedLight(light, shadowColor, s);
      expectRgbClose(add(lightBuffer, tintBuffer), lightBlendCompute(mode, base, shadowed));
    }
  );

  it('sums the alpha of three lights into the Light Only alpha, as canvas.glsl:760-763 does', () => {
    const light = { r: 1, g: 0.5, b: 0.25, a: 0.3 };
    let buffer: Rgba = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = 0; i < 3; i++) buffer = fixedFunction(Light2DBlendMode.ADD, buffer, light);
    expect(buffer.a).toBeCloseTo(0.9, PRECISION);
  });
});

describe("a normal-mapped item's layer blend", () => {
  it.each(UNSHADOWED_ROWS)(
    'equals the Godot rule: mode $mode over $base, light $light',
    ({ mode, base, light }) => {
      const mixes = mode === Light2DBlendMode.MIX;
      expectRgbClose(
        blendLayer(base, premultipliedTerm(mode, light), light.a, mixes),
        lightBlendCompute(mode, base, light)
      );
    }
  );

  it.each(SHADOWED_ROWS)(
    'equals the Godot rule with the shadow layer: mode $mode, s $s, shadow colour $shadowColor',
    ({ mode, base, light, s, shadowColor }) => {
      const terms = shadowedLightTerms(light, shadowColor, s);
      const term = add(premultipliedTerm(mode, terms.light), premultipliedTerm(mode, terms.tint));
      const mixes = mode === Light2DBlendMode.MIX;
      expectRgbClose(
        blendLayer(base, term, terms.light.a, mixes),
        lightBlendCompute(mode, base, godotShadowedLight(light, shadowColor, s))
      );
    }
  );

  it('is the GLSL line its twin evaluates', () => {
    expect(BLEND_LAYER_GLSL).toContain('return color * (1.0 - mixes * alpha) + term;');
  });
});

describe('shadowedLightTerms', () => {
  it('puts the shadow_color under the light alpha, as SHADOWED_LIGHT_GLSL does', () => {
    const terms = shadowedLightTerms(
      { r: 1, g: 0.5, b: 0.25, a: 0.8 },
      { r: 0.2, g: 0, b: 0.4, a: 0.5 },
      0.25
    );
    const alpha = 0.8 * (0.75 + 0.25 * 0.5);
    expect(terms.light).toEqual({ r: 0.75, g: 0.375, b: 0.1875, a: alpha });
    expect(terms.tint).toEqual({ r: 0.05, g: 0, b: 0.1, a: alpha });
  });
});

/**
 * `canvas.glsl:543-547` as written: `shadow_color.a *= light_color.a`, then
 * `light_color = mix(light_color, shadow_color, shadow)`.
 */
function godotShadowedLight(light: Rgba, shadowColor: Rgba, s: number): Rgba {
  const tinted = { ...shadowColor, a: shadowColor.a * light.a };
  const mix = (from: number, to: number) => from + (to - from) * s;
  return {
    r: mix(light.r, tinted.r),
    g: mix(light.g, tinted.g),
    b: mix(light.b, tinted.b),
    a: mix(light.a, tinted.a),
  };
}
