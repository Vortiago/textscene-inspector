import { describe, expect, it } from 'vitest';
import { bicubicFilterGlsl } from './bicubicFilterGlsl';

const GLSL = bicubicFilterGlsl({
  prefix: 'test',
  params: 'sampler2D tex, vec2 uv',
  uv: 'uv',
  size: 'vec2(64.0)',
  fetch: (texelUv) => `texture2D(tex, ${texelUv}).rgb`,
});

describe('bicubicFilterGlsl', () => {
  it('declares the filter under its prefix, with the given parameters', () => {
    expect(GLSL).toContain('vec3 testBicubic( sampler2D tex, vec2 uv ) {');
  });

  it('reads the four bilinear taps through the fetch expression', () => {
    for (const tap of ['p0', 'p1', 'p2', 'p3']) expect(GLSL).toContain(`texture2D(tex, ${tap}).rgb`);
  });

  it('sizes the taps by the size expression', () => {
    expect(GLSL).toContain('vec2 size = vec2(64.0);');
  });
});
