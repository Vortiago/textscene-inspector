import { describe, expect, it } from 'vitest';
import { projectShaderOptionsOf } from './keptShaderOptions';

describe('projectShaderOptionsOf', () => {
  it('gives one object for equal options, so viewports that draw one sky share its bake', () => {
    const decoders = {};
    const renderer = { renderingMethod: 'gl_compatibility', glVaryings: 31 } as const;
    expect(projectShaderOptionsOf(decoders, { ...renderer })).toBe(
      projectShaderOptionsOf(decoders, { ...renderer })
    );
  });

  it('gives a new object for another varying limit', () => {
    const decoders = {};
    const options = [31, 15].map((glVaryings) =>
      projectShaderOptionsOf(decoders, { renderingMethod: 'gl_compatibility', glVaryings })
    );
    expect(options[0]).not.toBe(options[1]);
    expect(options.map(({ glVaryings }) => glVaryings)).toEqual([31, 15]);
  });

  it('gives a new object for other decoders', () => {
    const renderer = { renderingMethod: 'forward_plus' } as const;
    expect(projectShaderOptionsOf({}, renderer)).not.toBe(projectShaderOptionsOf({}, renderer));
  });

  it('holds the decoders and the rendering method', () => {
    const decoders = {};
    expect(projectShaderOptionsOf(decoders, { renderingMethod: 'mobile' })).toEqual({
      decoders,
      renderingMethod: 'mobile',
    });
  });
});
