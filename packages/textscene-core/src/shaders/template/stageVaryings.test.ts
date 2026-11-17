import { describe, expect, it } from 'vitest';
import { StageVaryings } from './stageVaryings.js';

describe('StageVaryings', () => {
  it('gives the stages of a template one varying by name', () => {
    const varyings = new StageVaryings();
    expect(varyings.of('vec3', 'tint', false)).toBe(varyings.of('vec3', 'tint', false));
  });

  it('gives each element of an array varying the varying of its index', () => {
    const varyings = new StageVaryings();
    const pair = varyings.ofArray('vec2', 'm_pair', 2, false);
    expect(pair.element(1)).toBe(varyings.of('vec2', 'element1_m_pair', false));
  });

  it('keeps an element apart from a varying named as the array with its index', () => {
    const varyings = new StageVaryings();
    const pair = varyings.ofArray('vec2', 'm_pair', 2, false);
    expect(pair.element(1)).not.toBe(varyings.of('vec2', 'm_pair_1', false));
  });
});
