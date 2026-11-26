import { describe, expect, it } from 'vitest';
import { transform2DXform, TRANSFORM2D_IDENTITY } from '../../godot/math/transform2d';
import { Light2DBlendMode, Light2DShadowFilter } from '../../godot/scene/light2d';
import {
  directionalLightRow,
  itemLightBits,
  LIGHT_ROW_WORDS,
  lightArrayWords,
  pointLightRow,
  type PointLightPlacement,
} from './canvasLights';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

const translated = (tx: number, ty: number) => ({ ...TRANSFORM2D_IDENTITY, tx, ty });

const LIGHT: PointLightPlacement = {
  color: { r: 1, g: 0.5, b: 0.25, a: 0.5 },
  energy: 3,
  blendMode: Light2DBlendMode.MIX,
  shadowFilter: Light2DShadowFilter.PCF5,
  height: 10,
  global: translated(100, 50),
  onScreen: translated(100, 50),
  canvasTransform: TRANSFORM2D_IDENTITY,
  textureSize: { width: 64, height: 32 },
  textureScale: 2,
  textureOffset: { x: 10, y: 0 },
  atlasRect: { x: 0.25, y: 0.5, w: 0.125, h: 0.0625 },
};

describe('pointLightRow', () => {
  it("maps the light texture's scaled, offset rect to 0 to 1", () => {
    const { textureMatrix } = pointLightRow(LIGHT);
    // 128 by 64 texels centred on (110, 50): the rect runs from (46, 18) to (174, 82).
    expect(transform2DXform(textureMatrix, { x: 46, y: 18 })).toEqual({ x: 0, y: 0 });
    expect(transform2DXform(textureMatrix, { x: 174, y: 82 })).toEqual({ x: 1, y: 1 });
    expect(transform2DXform(textureMatrix, { x: 110, y: 50 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('places the light at its origin through the canvas transform of the canvas it lights', () => {
    const scaled = { a: 2, b: 0, c: 0, d: 2, tx: 5, ty: 7 };
    expect(pointLightRow({ ...LIGHT, canvasTransform: scaled }).position).toEqual({ x: 205, y: 107 });
  });

  it("scales the height by the mean of the canvas transform's axis lengths", () => {
    const stretched = { a: 2, b: 0, c: 0, d: 4, tx: 0, ty: 0 };
    expect(pointLightRow({ ...LIGHT, canvasTransform: stretched }).height).toBe(30);
  });

  it('carries the energy in the colour alpha and the base colour apart', () => {
    expect(pointLightRow(LIGHT).color).toEqual({ r: 1, g: 0.5, b: 0.25, a: 1.5 });
  });

  it('packs the blend mode at bit 16 and the shadow filter at bit 22, with no shadow bit', () => {
    expect(pointLightRow(LIGHT).flags).toBe((2 << 16) | (1 << 22));
  });
});

describe('directionalLightRow', () => {
  const light = { color: WHITE, energy: 1, blendMode: 0, shadowFilter: 0, height: 0.5 };

  it('points toward the light: minus the normalised y axis on screen', () => {
    const turned = { a: 0, b: 2, c: -2, d: 0, tx: 30, ty: 40 };
    expect(directionalLightRow({ ...light, onScreen: turned }).position).toEqual({ x: 1, y: -0 });
  });

  it('keeps its height in 0 to 1, unscaled', () => {
    const scaled = { a: 3, b: 0, c: 0, d: 3, tx: 0, ty: 0 };
    expect(directionalLightRow({ ...light, onScreen: scaled }).height).toBe(0.5);
  });
});

describe('lightArrayWords', () => {
  it("writes each row at Godot's std430 offsets, 32 words apart", () => {
    const words = lightArrayWords([pointLightRow(LIGHT), pointLightRow(LIGHT)]);
    const floats = new Float32Array(words.buffer);
    const second = LIGHT_ROW_WORDS;
    expect(words.length).toBe(64);
    expect([...floats.subarray(second + 16, second + 20)]).toEqual([1, 0.5, 0.25, 1.5]);
    expect(words[second + 21]).toBe((2 << 16) | (1 << 22));
    expect([floats[second + 22], floats[second + 23]]).toEqual([1, 10]);
    expect([...floats.subarray(second + 24, second + 28)]).toEqual([100, 50, 1, 0]);
    expect([...floats.subarray(second + 28, second + 32)]).toEqual([0.25, 0.5, 0.125, 0.0625]);
  });

  it('writes the texture matrix as two rows, each with its origin last', () => {
    const floats = new Float32Array(lightArrayWords([pointLightRow(LIGHT)]).buffer);
    expect([...floats.subarray(0, 8)]).toEqual([1 / 128, -0, 0, -46 / 128, -0, 1 / 64, 0, -18 / 64]);
  });

  it('refuses more lights than a render holds', () => {
    expect(() => lightArrayWords(Array(257).fill(pointLightRow(LIGHT)))).toThrow(/at most 256/);
  });
});

describe('itemLightBits', () => {
  it('packs four 8-bit indices a word, the first in the low byte, and counts them', () => {
    expect(itemLightBits([3, 7, 1, 2, 9])).toEqual({
      flags: 5,
      lights: [3 | (7 << 8) | (1 << 16) | (2 << 24), 9, 0, 0],
    });
  });

  it('packs index 255 in the top byte unsigned', () => {
    expect(itemLightBits([0, 0, 0, 255]).lights[0]).toBe(0xff000000);
  });

  it('refuses a sixteenth positional light', () => {
    expect(() => itemLightBits(Array(16).fill(0))).toThrow(/at most 15/);
  });
});
