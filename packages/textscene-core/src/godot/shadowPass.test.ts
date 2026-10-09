import { describe, expect, it } from 'vitest';
import { drawsInShadowPass } from './shadowPass';

describe('drawsInShadowPass', () => {
  it('takes a surface of the opaque list', () => {
    expect(drawsInShadowPass({ alphaPass: false, depthInAlphaPass: false })).toBe(true);
  });

  it('refuses a blended surface with no depth prepass', () => {
    expect(drawsInShadowPass({ alphaPass: true, depthInAlphaPass: false })).toBe(false);
  });

  it('takes a blended surface that draws depth through a prepass (edge case)', () => {
    expect(drawsInShadowPass({ alphaPass: true, depthInAlphaPass: true })).toBe(true);
  });
});
