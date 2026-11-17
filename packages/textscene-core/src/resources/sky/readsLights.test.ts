import { describe, expect, it } from 'vitest';
import { materialReadsLights } from './readsLights';
import type { ShaderSkyProperties } from './types';

const shaderSky = (light: boolean): ShaderSkyProperties => ({
  kind: 'shader',
  code: '',
  file: 'res://sky.gdshader',
  parameters: {},
  textures: {},
  usage: { light, samplers: {} },
});

describe('materialReadsLights', () => {
  it('reads the lights of a sky shader that reads a LIGHTn built-in', () => {
    expect(materialReadsLights(shaderSky(true))).toBe(true);
  });

  it('reads no light of a sky shader that reads no LIGHTn built-in', () => {
    expect(materialReadsLights(shaderSky(false))).toBe(false);
  });
});
