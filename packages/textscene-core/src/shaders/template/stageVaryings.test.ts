import { describe, expect, it } from 'vitest';
import { StageVaryings } from './stageVaryings.js';

describe('StageVaryings', () => {
  it('gives the stages of a template one varying by name', () => {
    const varyings = new StageVaryings();
    expect(varyings.of('vec3', 'tint', false)).toBe(varyings.of('vec3', 'tint', false));
  });

  it('gives each element of an array varying the varying of its index', () => {
    const varyings = new StageVaryings();
    const pair = varyings.ofArray('vec2', 'pair', 2, false);
    expect(pair.element(1)).toBe(varyings.of('vec2', 'pair_1', false));
  });
});
